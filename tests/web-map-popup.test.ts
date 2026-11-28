import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoogleMap} from '../apps/web-preview/public/google-map.mjs';

// Exercise the real controller with a small SDK boundary; no Maps network dependency.
class Events {
  listeners = new Map<string, Set<() => void>>();
  addListener(name: string, callback: () => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(callback);
    return {remove: () => this.listeners.get(name)!.delete(callback)};
  }
  emit(name: string) { for (const callback of [...this.listeners.get(name) ?? []]) callback(); }
}
class Element extends Events {
  children: Element[] = [];
  classList = {toggle() {}};
  append(child: Element) { this.children.push(child); }
  addEventListener(name: string, callback: () => void) { this.addListener(name, callback); }
}

test('centrar un grupo conserva su lista y permite seleccionar una oferta', async () => {
  const previous = {window: globalThis.window, document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame};
  const frames: FrameRequestCallback[] = [];
  const markers: Marker[] = [];
  let map!: FakeMap;
  let popup!: Popup;
  let viewportChanges = 0;
  const selected: string[] = [];
  const host = {
    getBoundingClientRect: () => ({left: 0, top: 0, width: 800, height: 600}),
    querySelector: () => ({getBoundingClientRect: () => ({left: 400, top: 300, width: 200, height: 100})}),
  };
  class FakeMap extends Events {
    pans: number[][] = [];
    constructor() { super(); map = this; }
    getZoom() { return 12; }
    setOptions() {}
    panBy(x: number, y: number) { this.pans.push([x, y]); }
  }
  class Marker extends Element {
    map: unknown;
    zIndex = 1;
    constructor(options: {map: unknown}) { super(); this.map = options.map; markers.push(this); }
  }
  class Popup extends Events {
    opened = false;
    content!: Element;
    constructor() { super(); popup = this; }
    close() { this.opened = false; }
    setContent(content: Element) { this.content = content; }
    open() { this.opened = true; this.emit('domready'); }
  }
  const mockWindow = {
    Map,
    google: {maps: {InfoWindow: Popup, importLibrary: async (name: string) => name === 'maps' ? {Map: FakeMap} : {AdvancedMarkerElement: Marker}}},
    geoEmpleoMapsReady() {},
  };
  globalThis.window = mockWindow as unknown as Window & typeof globalThis;
  globalThis.document = {
    createElement: () => new Element(),
    querySelector: () => null,
    head: {append: () => queueMicrotask(() => mockWindow.geoEmpleoMapsReady())},
  } as unknown as Document;
  globalThis.requestAnimationFrame = callback => frames.push(callback);
  try {
    const pending = createGoogleMap(host, {googleMapsApiKey: 'test'}, {
      onSelect: (id: string) => selected.push(id),
      onViewport: () => viewportChanges++,
    });
    await new Promise(resolve => setImmediate(resolve));
    map.emit('idle');
    const controller = await pending;
    const calls = ['a', 'b'].map(id => ({id, title: `Oferta ${id}`, city: 'Las Rozas', location: {point: [-3.88, 40.49]}}));
    controller.update(calls, null, null);
    const anchor = markers.at(-1)!;
    anchor.emit('gmp-click');
    frames.shift()!(0);
    assert.equal(popup.opened, true);
    assert.deepEqual(map.pans, [[100, 50]]);
    const before = viewportChanges;
    map.emit('idle'); // Completion of the popup's presentation pan.
    assert.equal(popup.opened, true, 'the centered list must remain open');
    assert.ok(anchor.map, 'the popup anchor must remain attached');
    assert.equal(viewportChanges, before, 'centering must not search a different area');
    popup.content.children[2].emit('click');
    assert.deepEqual(selected, ['b']);
    assert.equal(popup.opened, false);
    map.emit('idle'); // A later user movement still refreshes the map.
    assert.equal(viewportChanges, before + 1);
    assert.equal(anchor.map, null);
    controller.update([calls[0]], null, null);
    markers.at(-1)!.emit('gmp-click');
    assert.deepEqual(selected, ['b', 'a']);
  } finally {
    Object.assign(globalThis, previous);
  }
});
