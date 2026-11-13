# Map Loading Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar un indicador durante la primera carga del mapa y sus puntos, y una señal compacta durante búsquedas posteriores.

**Architecture:** Un controlador pequeño representa `initial`, `refresh` o `hidden` a partir de la disponibilidad del mapa y la respuesta del catálogo. `app.mjs` conecta ese estado a los eventos existentes; el SVG local y CSS solo afectan al panel del mapa.

**Tech Stack:** JavaScript ES modules, HTML/CSS, Google Maps JavaScript API, Node test runner.

---

### Task 1: Estado de carga

**Files:**
- Create: `apps/web-preview/public/map-loading.mjs`
- Create: `tests/web-map-loading.test.ts`

- [ ] Escribir una prueba que observe la secuencia `initial → hidden → refresh → hidden` al llegar el primer `idle`, terminar la primera búsqueda y actualizar otra zona. Probar también `fail()` y `retry()`.

```ts
const states: string[] = [];
const loading = createMapLoadingState(state => states.push(state));
assert.equal(states.at(-1), 'initial');
loading.searchStarted(); loading.mapReady(); loading.searchFinished();
assert.equal(states.at(-1), 'hidden');
loading.searchStarted(); assert.equal(states.at(-1), 'refresh');
loading.searchFinished(); assert.equal(states.at(-1), 'hidden');
loading.fail(); assert.equal(states.at(-1), 'hidden');
loading.retry(); assert.equal(states.at(-1), 'initial');
```

- [ ] Ejecutar `node --test tests/web-map-loading.test.ts` y comprobar que falla por ausencia del módulo.
- [ ] Implementar `createMapLoadingState(onChange)`: `mapReady()`, `searchStarted()`, `searchFinished()`, `fail()`, `retry()`. La función emite `initial` mientras falte mapa o primera respuesta, `refresh` solo en una consulta posterior y `hidden` al terminar o fallar.

```js
export function createMapLoadingState(onChange) {
  let ready=false, settled=false, searching=false, failed=false;
  const emit=()=>onChange(failed?'hidden':!ready||!settled?'initial':searching?'refresh':'hidden');
  emit();
  return {
    mapReady(){ready=true;emit();},
    searchStarted(){searching=true;emit();},
    searchFinished(){settled=true;searching=false;emit();},
    fail(){failed=true;searching=false;emit();},
    retry(){ready=false;settled=false;searching=false;failed=false;emit();},
  };
}
```

- [ ] Repetir `node --test tests/web-map-loading.test.ts` y comprobar cero fallos.

### Task 2: Indicador visual e integración

**Files:**
- Modify: `apps/web-preview/public/index.html`
- Modify: `apps/web-preview/public/styles.css`
- Modify: `apps/web-preview/public/app.mjs`
- Modify: `apps/web-preview/public/google-map.mjs`
- Create: `apps/web-preview/public/icons/material-symbols/progress-activity.svg`
- Modify: `apps/web-preview/public/icons/material-symbols/README.md`

- [ ] Descargar el SVG oficial `progress_activity_24px.svg` de `google/material-design-icons` y guardarlo con el patrón local de Material Symbols.
- [ ] Insertar en `#map-panel`, fuera de `#google-map`, un `#map-loading` visible desde el HTML inicial, con `role="status"`, texto «Cargando mapa y ofertas…» y el icono decorativo.

```html
<div id="map-loading" class="map-loading" data-phase="initial" role="status" aria-live="polite">
  <span class="material-icon map-loading-icon" aria-hidden="true"></span>
  <span id="map-loading-label">Cargando mapa y ofertas…</span>
</div>
```

- [ ] Añadir CSS para capa inicial centrada, señal `data-phase="refresh"` compacta, `[hidden]` y animación desactivada por `prefers-reduced-motion`.

```css
.map-loading{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;gap:12px;background:#e9efedee;color:var(--petrol-dark);font-weight:650}
.map-loading[hidden]{display:none}
.map-loading[data-phase="refresh"]{inset:70px 12px auto auto;padding:9px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;box-shadow:0 3px 12px #0002;font-size:12px}
.map-loading-icon{width:28px;height:28px;mask-image:url('/icons/material-symbols/progress-activity.svg');-webkit-mask-image:url('/icons/material-symbols/progress-activity.svg');animation:map-loading-spin 1s linear infinite}
.map-loading[data-phase="refresh"] .map-loading-icon{width:18px;height:18px}
@keyframes map-loading-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.map-loading-icon{animation:none}}
```

- [ ] Esperar el primer `idle` de Google Maps durante un máximo de 20 segundos y emitir `events.onReady?.()`. Conectar el controlador a `onLoading`, `onResult`, `onError`, `startMap` y a las rutas de error. Ocultar solo después de `render()` de la primera respuesta; dejar visible el mapa en consultas posteriores.

```js
// google-map.mjs: al final de createGoogleMap, antes del return
await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{listener.remove();reject(new Error('El mapa tardó demasiado en iniciar.'));},20000);
  const listener=map.addListener('idle',()=>{clearTimeout(timer);listener.remove();events.onReady?.();resolve();});
});

// app.mjs: después de obtener #map-loading
const mapLoadingState=createMapLoadingState(mode=>{
  const loader=document.querySelector('#map-loading');
  loader.hidden=mode==='hidden'; loader.dataset.phase=mode;
  document.querySelector('#map-loading-label').textContent=mode==='refresh'?'Actualizando ofertas…':'Cargando mapa y ofertas…';
  document.querySelector('#map-panel').setAttribute('aria-busy',String(mode==='initial'));
});
// onLoading: mapLoadingState.searchStarted()
// después de render() en onResult/onError: mapLoadingState.searchFinished()
// startMap: mapLoadingState.retry(); onReady(){mapLoadingState.mapReady();}
// sin clave, catch o mapa irrecuperable: mapLoadingState.fail()
```

- [ ] Renovar las versiones de `styles.css` y `app.mjs` en `index.html` para evitar caché obsoleta.
- [ ] Ejecutar la prueba focalizada y `node --test tests/web-brand-layout.test.ts tests/web-map-search.test.ts tests/web-map-state.test.ts`; corregir solo regresiones relacionadas.

### Task 3: QA y contexto

**Files:**
- Modify: `docs/project-context.md`

- [ ] Actualizar el índice del proyecto con el indicador y la condición real que lo cierra.
- [ ] Ejecutar `npm run typecheck` y las pruebas web focalizadas.
- [ ] Abrir la vista local a ancho móvil y escritorio; comprobar primer estado, aparición de puntos, desaparición del indicador, refresco, error y movimiento reducido. No publicar cambios durante esta validación.
- [ ] Revisar `git diff --check`, `git status --short` y los archivos tocados.
