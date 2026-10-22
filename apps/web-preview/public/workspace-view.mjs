/**
 * @param {(view:'jobs'|'map')=>void} apply
 * @param {string} [initial]
 * @param {()=>void} [activateMap]
 */
export function createWorkspaceView(apply,initial='jobs',activateMap=()=>{}) {
  /** @param {string} value */
  const validate=value=>{
    if(value!=='jobs'&&value!=='map')throw new RangeError('Unknown workspace view');
    return value;
  };
  let view=validate(initial);
  apply(view);
  return {
    snapshot:()=>view,
    /** @param {string} next */
    select(next) {
      const validated=validate(next);
      if(view===validated)return;
      view=validated;
      apply(view);
      if(view==='map')activateMap();
    },
  };
}
