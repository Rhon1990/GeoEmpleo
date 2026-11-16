import test from 'node:test';
import assert from 'node:assert/strict';
import {
  beginNewSearch,
  captureDetailPosition,
  createJobInteraction,
  finishDetailInteraction,
  restoreJobFocus,
} from '../apps/web-preview/public/job-interaction.mjs';

test('una búsqueda nueva comienza arriba y descarta la oferta seleccionada',() => {
  const interaction=createJobInteraction();
  const results={scrollTop:440};
  interaction.setFeatured('job-b');
  interaction.select('job-a');
  beginNewSearch(interaction,results as HTMLElement);
  assert.equal(results.scrollTop,0);
  assert.equal(interaction.snapshot().activeId,null);
});

test('la tarjeta centrada mantiene su pin coral en móvil hasta cambiar o salir del mapa',() => {
  const interaction=createJobInteraction();
  interaction.setFeatured('job-a');
  assert.equal(interaction.snapshot().activeId,'job-a');
  interaction.preview('job-b');
  assert.equal(interaction.snapshot().activeId,'job-b');
  interaction.clearPreview('job-b');
  assert.equal(interaction.snapshot().activeId,'job-a');
  interaction.select('job-a');
  interaction.clearSelection();
  assert.equal(interaction.snapshot().activeId,'job-a');
  interaction.setFeatured('job-c');
  assert.equal(interaction.snapshot().activeId,'job-c');
  interaction.setFeatured(null);
  assert.equal(interaction.snapshot().activeId,null);
});

test('restaura la posición de lista, carrusel y página tras cerrar un detalle',() => {
  const results={scrollTop:640};
  const carousel={scrollLeft:320};
  const viewport={scrollY:990,scrollTo(x:number,y:number){assert.equal(x,0);this.scrollY=y;}};
  const restore=captureDetailPosition(results as HTMLElement,carousel as HTMLElement,viewport as unknown as Window);
  results.scrollTop=0;carousel.scrollLeft=0;viewport.scrollY=0;
  restore();
  assert.deepEqual([results.scrollTop,carousel.scrollLeft,viewport.scrollY],[640,320,990]);
});

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

test('al cerrar el detalle elimina el coral incluso si restaurar el foco activa la previsualización',() => {
  const interaction=createJobInteraction();
  interaction.select('job-a');

  assert.equal(finishDetailInteraction(interaction,()=>{
    interaction.preview('job-a');
    return 'card';
  }),'card');

  assert.deepEqual(interaction.snapshot(),{
    selectedId:null,previewId:null,activeId:null,
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
