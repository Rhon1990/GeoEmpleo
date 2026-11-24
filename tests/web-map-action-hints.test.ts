import {test} from 'node:test';
import assert from 'node:assert/strict';

type HintInstaller = (buttons: EventTarget[], clock?: {setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout}) => void;
let installMapActionHints: HintInstaller | undefined;
try {
  ({installMapActionHints} = await import('../apps/web-preview/public/map-action-hints.mjs'));
} catch (error) {
  if ((error as {code?: string}).code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

class HintButton extends EventTarget {
  disabled = false;
  private classes = new Set<string>();
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name),
  };
  setPointerCapture(_pointerId: number) {}
}

function pointer(button: HintButton, type: string, pointerType = 'touch') {
  const event = new Event(type, {cancelable: true});
  Object.defineProperties(event, {pointerType: {value: pointerType}, pointerId: {value: 1}});
  button.dispatchEvent(event);
  return event;
}

function fakeClock() {
  let now = 0;
  let nextId = 0;
  const tasks = new Map<number, {time: number; callback: () => void}>();
  return {
    setTimeout: ((callback: () => void, delay: number) => {
      const id = ++nextId;
      tasks.set(id, {time: now + delay, callback});
      return id;
    }) as unknown as typeof setTimeout,
    clearTimeout: ((id: number) => { tasks.delete(id); }) as unknown as typeof clearTimeout,
    advance(ms: number) {
      const end = now + ms;
      while (true) {
        const next = [...tasks].filter(([, task]) => task.time <= end).sort((a, b) => a[1].time - b[1].time)[0];
        if (!next) break;
        now = next[1].time;
        tasks.delete(next[0]);
        next[1].callback();
      }
      now = end;
    },
  };
}

test('una pulsación corta ejecuta la acción sin mostrar el nombre', () => {
  assert.equal(typeof installMapActionHints, 'function');
  const button = new HintButton();
  const clock = fakeClock();
  installMapActionHints!([button], clock);
  let actions = 0;
  button.addEventListener('click', () => actions++);
  pointer(button, 'pointerdown');
  clock.advance(400);
  pointer(button, 'pointerup');
  button.dispatchEvent(new Event('click', {cancelable: true}));
  clock.advance(2000);
  assert.equal(actions, 1);
  assert.equal(button.classList.contains('touch-hint'), false);
});

test('una pulsación prolongada muestra el nombre sin ejecutar la acción', () => {
  assert.equal(typeof installMapActionHints, 'function');
  const button = new HintButton();
  const clock = fakeClock();
  installMapActionHints!([button], clock);
  let actions = 0;
  button.addEventListener('click', () => actions++);
  pointer(button, 'pointerdown');
  clock.advance(550);
  assert.equal(button.classList.contains('touch-hint'), true);
  pointer(button, 'pointerup');
  const click = new Event('click', {cancelable: true});
  button.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true);
  assert.equal(actions, 0);
  clock.advance(1500);
  assert.equal(button.classList.contains('touch-hint'), false);
});

test('el ratón no activa la pista de pulsación y cancelar el toque tampoco', () => {
  assert.equal(typeof installMapActionHints, 'function');
  const button = new HintButton();
  const clock = fakeClock();
  installMapActionHints!([button], clock);
  pointer(button, 'pointerdown', 'mouse');
  clock.advance(1000);
  assert.equal(button.classList.contains('touch-hint'), false);
  pointer(button, 'pointerdown');
  pointer(button, 'pointercancel');
  clock.advance(1000);
  assert.equal(button.classList.contains('touch-hint'), false);
});
