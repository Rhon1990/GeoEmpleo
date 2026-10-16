/**
 * @typedef {{selectedId:string|null,previewId:string|null,activeId:string|null}} JobInteractionState
 */

/** @param {(state:JobInteractionState)=>void} [onChange] */
export function createJobInteraction(onChange=()=>{}) {
  /** @type {string|null} */
  let selectedId=null;
  /** @type {string|null} */
  let previewId=null;
  const snapshot=()=>({selectedId,previewId,activeId:previewId??selectedId});
  const notify=()=>onChange(snapshot());
  return {
    snapshot,
    /** @param {string|null} id */
    preview(id) {
      if(previewId===id)return;
      previewId=id;notify();
    },
    /** @param {string} id */
    clearPreview(id) {
      if(previewId!==id)return;
      previewId=null;notify();
    },
    /** @param {string} id */
    select(id) {
      if(selectedId===id&&previewId===null)return;
      selectedId=id;previewId=null;notify();
    },
    clearSelection() {
      if(selectedId===null&&previewId===null)return;
      selectedId=null;previewId=null;notify();
    },
  };
}

/**
 * @param {HTMLElement} list
 * @param {string|null} id
 * @param {HTMLElement|null} fallback
 */
export function restoreJobFocus(list,id,fallback=null) {
  const article=[...list.querySelectorAll('[data-job-id]')].find(node=>node.dataset.jobId===id);
  const target=article?.querySelector('.card-open')??fallback;
  target?.focus({preventScroll:true});
  return article&&target?'card':target?'fallback':'none';
}
