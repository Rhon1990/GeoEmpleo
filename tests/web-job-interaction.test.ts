import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearSelectionBeforeFocusRestore,
  createJobInteraction,
  previewJobAfterFocusRestore,
  restoreJobFocus,
} from '../apps/web-preview/public/job-interaction.mjs';

test('el foco temporal resalta una oferta y al salir restaura la selección',() => {
  const states: unknown[] = [];
  const interaction=createJobInteraction(state => states.push(state));

  interaction.select('job-a');
  interaction.preview('job-b');
  assert.deepEqual(interaction.snapshot(),{
    selectedId:'job-a',previewId:'job-b',activeId:'job-b',
  });

  interaction.clearPreview('job-b');
  assert.deepEqual(interaction.snapshot(),{
    selectedId:'job-a',previewId:null,activeId:'job-a',
  });
  assert.equal(states.length,3);
});

test('no limpia el foco de otra tarjeta ni notifica estados repetidos',() => {
  let notifications=0;
  const interaction=createJobInteraction(() => notifications++);

  interaction.preview('job-a');
  interaction.preview('job-a');
  interaction.clearPreview('job-b');
  assert.equal(notifications,1);
  assert.equal(interaction.snapshot().activeId,'job-a');
});

test('limpiar la selección elimina también cualquier foco temporal',() => {
  const interaction=createJobInteraction();
  interaction.select('job-a');
  interaction.preview('job-b');
  interaction.clearSelection();

  assert.deepEqual(interaction.snapshot(),{
    selectedId:null,previewId:null,activeId:null,
  });
});

test('restaura el foco a la tarjeta regenerada o al panel de resultados',() => {
  const focused:string[]=[];
  const button={focus:()=>focused.push('card')};
  const fallback={focus:()=>focused.push('results')};
  const list={querySelectorAll:()=>[
    {dataset:{jobId:'job-a'},querySelector:()=>button},
  ]};

  assert.equal(restoreJobFocus(list as unknown as HTMLElement,'job-a',fallback as unknown as HTMLElement),'card');
  assert.equal(restoreJobFocus(list as unknown as HTMLElement,'missing',fallback as unknown as HTMLElement),'fallback');
  assert.deepEqual(focused,['card','results']);
});

test('al cerrar limpia la selección antes de restaurar el foco y conserva la previsualización',() => {
  const interaction=createJobInteraction();
  interaction.select('job-a');

  clearSelectionBeforeFocusRestore(interaction,()=>{
    assert.equal(previewJobAfterFocusRestore(interaction,'job-a',()=> 'card'),'card');
  });

  assert.deepEqual(interaction.snapshot(),{
    selectedId:null,previewId:'job-a',activeId:'job-a',
  });
});

test('informa fallback cuando la tarjeta existe pero no contiene el botón enfocable',() => {
  const focused:string[]=[];
  const fallback={focus:()=>focused.push('results')};
  const list={querySelectorAll:()=>[
    {dataset:{jobId:'job-a'},querySelector:()=>null},
  ]};

  assert.equal(
    restoreJobFocus(list as unknown as HTMLElement,'job-a',fallback as unknown as HTMLElement),
    'fallback',
  );
  assert.deepEqual(focused,['results']);
});
