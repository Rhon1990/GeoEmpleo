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
 * @param {{clearSelection:()=>void}} interaction
 * @param {()=>void} restoreFocus
 */
export function clearSelectionBeforeFocusRestore(interaction,restoreFocus) {
  interaction.clearSelection();
  restoreFocus();
}

/**
 * @param {{preview:(id:string)=>void}} interaction
 * @param {string|null} id
 * @param {()=>('card'|'fallback'|'none')} restoreFocus
 */
export function previewJobAfterFocusRestore(interaction,id,restoreFocus) {
  const target=restoreFocus();
  if(target==='card'&&id!==null)interaction.preview(id);
  return target;
}

/**
 * @param {HTMLElement} list
 * @param {string|null} id
 * @param {HTMLElement|null} fallback
 */
export function restoreJobFocus(list,id,fallback=null) {
  const article=[...list.querySelectorAll('[data-job-id]')].find(node=>node.dataset.jobId===id);
  const cardTarget=article?.querySelector('.card-open');
  const target=cardTarget??fallback;
  target?.focus({preventScroll:true});
  return cardTarget?'card':target?'fallback':'none';
}
