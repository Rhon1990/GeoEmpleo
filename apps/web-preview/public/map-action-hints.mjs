const HOLD_MS = 550;
const READ_MS = 1500;

export function installMapActionHints(buttons, clock = {setTimeout, clearTimeout}) {
  const {setTimeout: schedule, clearTimeout: cancel} = clock;
  let press;
  let shown;
  let hideTimer;
  let suppressClick;

  function hideHint() {
    if (hideTimer) cancel(hideTimer);
    shown?.classList.remove('touch-hint');
    shown = undefined;
    hideTimer = undefined;
    suppressClick = undefined;
  }

  function endPress(button, event, cancelled = false) {
    if (press?.button !== button || press.pointerId !== event.pointerId) return;
    cancel(press.timer);
    press = undefined;
    if (cancelled) hideHint();
    else if (shown === button) hideTimer = schedule(hideHint, READ_MS);
  }

  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || button.disabled) return;
      if (press) cancel(press.timer);
      hideHint();
      button.setPointerCapture?.(event.pointerId);
      press = {
        button,
        pointerId: event.pointerId,
        timer: schedule(() => {
          button.classList.add('touch-hint');
          shown = button;
          suppressClick = button;
        }, HOLD_MS),
      };
    });
    button.addEventListener('pointerup', event => endPress(button, event));
    button.addEventListener('pointercancel', event => endPress(button, event, true));
    button.addEventListener('contextmenu', event => {
      if (press?.button === button || shown === button) event.preventDefault();
    });
    button.addEventListener('click', event => {
      if (suppressClick !== button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = undefined;
    }, true);
  }
}
