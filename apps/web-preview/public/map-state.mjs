export function createOriginSelection(onOrigin) {
  let active = false;
  return {
    arm() {active=true;},
    cancel() {active=false;},
    isActive() {return active;},
    capture(point) {if(!active)return false;active=false;onOrigin(point);return true;},
  };
}
