/**
 * @typedef {{selectedId:string|null,previewId:string|null,activeId:string|null}} JobInteractionState
 */

/** @param {(state:JobInteractionState)=>void} [onChange] */
export function createJobInteraction(onChange=()=>{}) {
  /** @type {string|null} */
  let selectedId=null;
  /** @type {string|null} */
  let previewId=null;
  /** @type {string|null} */
  let featuredId=null;
  const snapshot=()=>({selectedId,previewId,activeId:previewId??selectedId??featuredId});
  const notify=()=>onChange(snapshot());
  return {
    snapshot,
    /** @param {string|null} id */
    setFeatured(id) {
      if(featuredId===id)return;
      featuredId=id;notify();
    },
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
 * @param {HTMLElement} results
 */
export function beginNewSearch(interaction,results) {
  interaction.setFeatured(null);
  interaction.clearSelection();
  results.scrollTop=0;
}

/**
 * Restore keyboard focus before clearing its transient preview and the clicked selection.
 * @template T
 * @param {{clearSelection:()=>void}} interaction
 * @param {()=>T} restoreFocus
 * @returns {T}
 */
export function finishDetailInteraction(interaction,restoreFocus) {
  const target=restoreFocus();
  interaction.clearSelection();
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

/**
 * Capture the independent desktop results, mobile carousel and page positions.
 * @param {HTMLElement} results
 * @param {HTMLElement} carousel
 * @param {{scrollY:number,scrollTo:(x:number,y:number)=>void}} [viewport]
 */
export function captureDetailPosition(results,carousel,viewport=window) {
  const top=results.scrollTop;
  const left=carousel.scrollLeft;
  const y=viewport.scrollY;
  return () => {
    results.scrollTop=top;
    carousel.scrollLeft=left;
    viewport.scrollTo(0,y);
  };
}
