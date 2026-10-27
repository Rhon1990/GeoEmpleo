import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse, parseFragment, type DefaultTreeAdapterTypes, type ParserError } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

const html = await readFile(new URL('../apps/web-preview/public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../apps/web-preview/public/styles.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../apps/web-preview/public/app.mjs', import.meta.url), 'utf8');
const googleMap = await readFile(new URL('../apps/web-preview/public/google-map.mjs', import.meta.url), 'utf8');
const parseErrors: ParserError[] = [];
const document = parse(html, { onParseError: error => parseErrors.push(error) });

function elements(node: Node): Element[] {
  const matches = 'tagName' in node ? [node] : [];
  if (!('childNodes' in node)) return matches;
  return matches.concat(node.childNodes.flatMap(elements));
}

const allElements = elements(document);

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find(candidate => candidate.name === name)?.value;
}

function hasClass(element: Element, className: string): boolean {
  return attribute(element, 'class')?.split(/\s+/).includes(className) ?? false;
}

function textContent(node: Node): string {
  if ('value' in node) return node.value;
  if (!('childNodes' in node)) return '';
  return node.childNodes.map(textContent).join('');
}

function elementWithClass(root: Node, tagName: string, className: string): Element | undefined {
  return elements(root).find(element => element.tagName === tagName && hasClass(element, className));
}

function directElementChildren(element: Element): Element[] {
  return element.childNodes.filter((child): child is Element => 'tagName' in child);
}

function ruleForSelector(cssText: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|})\\s*${escapedSelector}\\{([^}]*)\\}`).exec(cssText);
  assert.ok(match, `Expected a CSS rule for ${selector}`);
  return match[1];
}

function lastRuleForSelector(cssText: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...cssText.matchAll(new RegExp(`(?:^|})\\s*${escapedSelector}\\{([^}]*)\\}`, 'g'))];
  assert.ok(matches.length > 0, `Expected a CSS rule for ${selector}`);
  return matches.at(-1)![1];
}

function rulesForSelector(cssText: string, selector: string): string[] {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...cssText.matchAll(new RegExp(`(?:^|})\\s*${escapedSelector}\\{([^}]*)\\}`, 'g'))]
    .map(match => match[1]);
}

function mediaBlockForViewport(cssText: string, viewportWidth: number): string | undefined {
  const mediaPattern = /@media\(max-width:(\d+)px\)\{/g;
  const matches = [...cssText.matchAll(mediaPattern)]
    .filter(match => Number(match[1]) >= viewportWidth && match.index !== undefined)
    .sort((left, right) => Number(left[1]) - Number(right[1]));

  for (const match of matches) {
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    for (let index = bodyStart; index < cssText.length; index += 1) {
      if (cssText[index] === '{') depth += 1;
      if (cssText[index] === '}') depth -= 1;
      if (depth === 0) return cssText.slice(bodyStart, index);
    }
  }
  return undefined;
}

function relativeLuminance(hex: string): number {
  const shorthand = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const normalized = shorthand
    ? `#${shorthand[1]}${shorthand[1]}${shorthand[2]}${shorthand[2]}${shorthand[3]}${shorthand[3]}`
    : hex;
  const channels = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(normalized)?.slice(1);
  assert.ok(channels, `Expected a three- or six-digit hex colour, received ${hex}`);
  const linear = channels.map(channel => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function openAccessMessageInHeader(root: Node): Element | undefined {
  const siteHeader = elements(root).find(
    element => element.tagName === 'header' && hasClass(element, 'site-header'),
  );
  if (!siteHeader) return undefined;

  return elements(siteHeader).find(element => {
    const containsMessage = element.childNodes.some(
      child => 'value' in child && child.value.trim() === 'Sin registro',
    );
    if (!containsMessage) return false;

    let container: Node | null = element;
    while (container && 'tagName' in container) {
      const role = attribute(container, 'role')?.toLowerCase();
      if (
        ['a', 'button', 'input'].includes(container.tagName) ||
        role === 'button' ||
        role === 'link'
      ) {
        return false;
      }
      if (container === siteHeader) break;
      container = container.parentNode;
    }
    return true;
  });
}

test('index.html parses without HTML errors', () => {
  assert.deepEqual(parseErrors, []);
});

test('header uses the Ruta G mark and split wordmark', () => {
  const brandMarks = allElements.filter(element => hasClass(element, 'brand-mark'));
  assert.equal(brandMarks.length, 1);

  const route = elementWithClass(brandMarks[0], 'path', 'route');
  const destination = elementWithClass(brandMarks[0], 'path', 'destination');
  const destinationDot = elementWithClass(brandMarks[0], 'circle', 'destination-dot');
  assert.equal(attribute(route!, 'd'), 'M42.5 18.2A18 18 0 1 0 42 39.1');
  assert.equal(attribute(destination!, 'd'), 'M28 28h15v11');
  assert.deepEqual(
    ['cx', 'cy', 'r'].map(name => attribute(destinationDot!, name)),
    ['43', '43', '6'],
  );

  const geo = allElements.find(element => hasClass(element, 'brand-geo'));
  const empleo = allElements.find(element => hasClass(element, 'brand-empleo'));
  assert.ok(geo);
  assert.ok(empleo);
  assert.equal(textContent(geo).trim(), 'geo');
  assert.equal(textContent(empleo).trim(), 'empleo');
});

test('favicon encodes the Ruta G route, destination and destination dot', () => {
  const favicon = allElements.find(
    element => element.tagName === 'link' && attribute(element, 'rel') === 'icon',
  );
  assert.ok(favicon);

  const href = attribute(favicon, 'href');
  assert.ok(href);
  assert.ok(href.startsWith('data:image/svg+xml,'));
  const faviconSvg = parseFragment(decodeURIComponent(href.slice(href.indexOf(',') + 1)));
  const route = elements(faviconSvg).find(
    element => element.tagName === 'path' && attribute(element, 'd') === 'M42.5 18.2A18 18 0 1 0 42 39.1',
  );
  const destination = elements(faviconSvg).find(
    element => element.tagName === 'path' && attribute(element, 'd') === 'M28 28h15v11',
  );
  const destinationDot = elements(faviconSvg).find(
    element => element.tagName === 'circle'
      && attribute(element, 'cx') === '43'
      && attribute(element, 'cy') === '43'
      && attribute(element, 'r') === '6',
  );
  assert.ok(route);
  assert.ok(destination);
  assert.ok(destinationDot);
});

test('page has one visually hidden GeoEmpleo heading', () => {
  const headings = allElements.filter(element => element.tagName === 'h1');
  assert.equal(headings.length, 1);
  assert.equal(textContent(headings[0]).trim(), 'GeoEmpleo');
  assert.ok(hasClass(headings[0], 'visually-hidden'));
  assert.match(css, /\.visually-hidden\{[^}]*position:absolute[^}]*clip(?:-path)?:/);
});

test('muted text token meets WCAG AA contrast on white', () => {
  const muted = css.match(/--muted:(#[0-9a-f]{6})/i)?.[1];
  const white = css.match(/--white:(#[0-9a-f]{3,6})/i)?.[1];
  const paper = css.match(/--paper:(#[0-9a-f]{3,6})/i)?.[1];
  assert.ok(muted);
  assert.ok(white);
  assert.ok(paper);
  assert.ok(
    contrastRatio(muted, white) >= 4.5,
    `${muted} has insufficient contrast on ${white}`,
  );
  assert.ok(
    contrastRatio(muted, paper) >= 4.5,
    `${muted} has insufficient contrast on ${paper}`,
  );
  assert.match(css, /\.site-header nav a,\.site-header nav button\{[^}]*color:var\(--muted\)/);
  assert.match(css, /\.field-label\{[^}]*color:var\(--muted\)/);
  for (const selector of [
    '.search-bar input::placeholder',
    '.location-line',
    '.meta-tag',
    '.card-footer',
    '.catalog-note',
    '.site-footer',
    '.detail-employer',
    '.detail-facts dt',
    '.detail-note',
    '.detail-provenance',
  ]) assert.match(ruleForSelector(css, selector), /color:var\(--muted\)/, selector);
});

test('map interactions use the approved petroleum and saffron identity', () => {
  assert.match(ruleForSelector(css, '.job-pin'), /background:var\(--petrol\)/);
  assert.match(ruleForSelector(css, '.job-pin.selected'), /background:var\(--saffron\)[^}]*color:#392d0f/);
  assert.match(ruleForSelector(css, '.origin-pin'), /background:var\(--saffron\)[^}]*color:#392d0f/);
  assert.match(ruleForSelector(css, '.job-card.selected'), /border-color:var\(--petrol\)/);
  assert.match(googleMap, /strokeColor:'#086071'/);
  assert.match(googleMap, /fillColor:'#f5b944'/);
  assert.doesNotMatch(`${css}\n${googleMap}`, /#254631|#d5ec83|#6f8f47|#4e7950|#6ea967/i);
});

test('advanced markers use the current Google Maps click event', () => {
  assert.match(googleMap, /marker\.addEventListener\('gmp-click'/);
  assert.doesNotMatch(googleMap, /marker\.addListener\('click'/);
});

test('tablet header wraps its search without hiding controls at 800px', () => {
  const tabletRules = mediaBlockForViewport(css, 800);
  assert.ok(tabletRules, 'Expected a responsive header rule that applies at 800px');
  assert.match(tabletRules, /\.site-header\{[^}]*flex-wrap:wrap/);
  assert.match(tabletRules, /\.search-bar\{[^}]*order:3[^}]*flex-basis:100%[^}]*min-width:0/);
  assert.doesNotMatch(tabletRules, /\.open-access\{[^}]*display:none/);
});

test('mobile cards use a single-column results grid', () => {
  const mobileRules = mediaBlockForViewport(css, 780);
  assert.ok(mobileRules, 'Expected a responsive rule that applies at 780px');
  assert.match(mobileRules, /\.job-list\{[^}]*grid-template-columns:1fr/);
});

test('job cards expose their real source while decorative geometry stays hidden', () => {
  assert.match(app, /visual\.setAttribute\('aria-hidden','true'\)/);
  assert.match(
    app,
    /visualFrame\.append\(visual, element\('span',call\.source,'source-pill'\)\)/,
    'Expected the source pill to be a sibling of the aria-hidden visual',
  );
  assert.doesNotMatch(app, /visual\.append\([^\n]*call\.source/);
  assert.match(
    app,
    /setAttribute\('aria-label', `Ver oferta: \$\{call\.title\}\. Fuente: \$\{call\.source\}`\)/,
    'Expected the card action to announce its real source once',
  );
});

test('header contains the only public search form and open-access message', () => {
  const forms = allElements.filter(element => attribute(element, 'id') === 'search-form');
  assert.equal(forms.length, 1);
  assert.equal(forms[0].tagName, 'form');

  let ancestor = forms[0].parentNode;
  let belongsToHeader = false;
  while (ancestor) {
    if ('tagName' in ancestor && ancestor.tagName === 'header' && hasClass(ancestor, 'site-header')) {
      belongsToHeader = true;
      break;
    }
    ancestor = 'parentNode' in ancestor ? ancestor.parentNode : null;
  }
  assert.equal(belongsToHeader, true);
  assert.ok(openAccessMessageInHeader(document));
});

test('open-access message must be informational and inside the site header', () => {
  const invalidExamples = [
    '<header class="site-header"></header><footer><span>Sin registro</span></footer>',
    '<header class="site-header"><button>Sin registro</button></header>',
    '<header class="site-header"><a href="/registro">Sin registro</a></header>',
    '<header class="site-header"><input value="Sin registro"></header>',
    '<header class="site-header"><span role="button">Sin registro</span></header>',
    '<header class="site-header"><span role="link">Sin registro</span></header>',
    '<header class="site-header"><button><span>Sin registro</span></button></header>',
  ];

  for (const invalidHtml of invalidExamples) {
    assert.equal(openAccessMessageInHeader(parse(invalidHtml)), undefined);
  }
});

test('legacy intro is absent and the page keeps one Google Map', () => {
  assert.equal(allElements.filter(element => hasClass(element, 'intro')).length, 0);
  assert.equal(allElements.filter(element => attribute(element, 'id') === 'google-map').length, 1);
});

test('workspace composes results and map as its only visual columns', () => {
  const workspaces = allElements.filter(element => hasClass(element, 'workspace'));
  assert.equal(workspaces.length, 1);

  const columns = directElementChildren(workspaces[0]);
  assert.equal(columns.length, 2);
  assert.ok(hasClass(columns[0], 'results-panel'));
  assert.equal(attribute(columns[0], 'id'), 'results');
  assert.ok(hasClass(columns[1], 'map-panel'));
});

test('map controls overlay the single map and keep approved labels and legend', () => {
  const mapPanel = allElements.find(element => hasClass(element, 'map-panel'));
  const mapOverlay = allElements.find(element => hasClass(element, 'map-overlay'));
  const googleMaps = allElements.filter(element => attribute(element, 'id') === 'google-map');
  assert.ok(mapPanel);
  assert.ok(mapOverlay);
  assert.equal(mapOverlay.parentNode, mapPanel);
  assert.equal(googleMaps.length, 1);

  const mapPanelChildren = directElementChildren(mapPanel);
  const overlayIndex = mapPanelChildren.indexOf(mapOverlay);
  assert.notEqual(overlayIndex, -1);
  assert.equal(mapPanelChildren[overlayIndex + 1], googleMaps[0]);

  const mapActions = elements(mapOverlay).find(element => hasClass(element, 'map-actions'));
  assert.ok(mapActions);
  const approvedLabels = new Map([
    ['return-origin', 'Volver a mi ubicación'],
    ['use-location', 'Usar mi ubicación'],
    ['choose-origin', 'Elegir mi zona'],
    ['search-area', 'Actualizar esta zona'],
    ['show-all-map', 'Ver España'],
  ]);
  for (const [id, label] of approvedLabels) {
    const action: Element | undefined = elements(mapActions).find(
      element => attribute(element, 'id') === id,
    );
    assert.ok(action, `Expected #${id} inside the map overlay`);
    assert.equal(textContent(action).trim(), label);
  }

  const legendLead = elements(mapPanel).find(
    element => element.tagName === 'strong'
      && textContent(element).trim() === 'Ubicaciones municipales aproximadas',
  );
  assert.ok(legendLead);
});

test('map controls expose matching accessible names and hidden labels', () => {
  const approvedLabels = new Map([
    ['return-origin', 'Volver a mi ubicación'],
    ['use-location', 'Usar mi ubicación'],
    ['choose-origin', 'Elegir mi zona'],
    ['search-area', 'Actualizar esta zona'],
    ['show-all-map', 'Ver España'],
  ]);

  for (const [id, label] of approvedLabels) {
    const action = allElements.find(element => attribute(element, 'id') === id);
    assert.ok(action, `Expected #${id}`);
    assert.equal(action.tagName, 'button');
    assert.equal(attribute(action, 'aria-label'), label, `Expected #${id} aria-label`);
    assert.equal(attribute(action, 'data-tooltip'), label, `Expected #${id} tooltip`);
    const hiddenLabels = elements(action).filter(element => hasClass(element, 'visually-hidden'));
    assert.equal(hiddenLabels.length, 1, `Expected one hidden label in #${id}`);
    assert.equal(textContent(hiddenLabels[0]).trim(), label);
  }
});

test('map controls use one decorative inline icon per action', () => {
  for (const id of [
    'return-origin',
    'use-location',
    'choose-origin',
    'search-area',
    'show-all-map',
  ]) {
    const action = allElements.find(element => attribute(element, 'id') === id);
    assert.ok(action, `Expected #${id}`);
    const icons = elements(action).filter(element => element.tagName === 'svg');
    assert.equal(icons.length, 1, `Expected one inline SVG in #${id}`);
    assert.equal(attribute(icons[0], 'aria-hidden'), 'true');
    assert.equal(attribute(icons[0], 'focusable'), 'false');
  }
});

test('map action toolbar keeps compact targets and CSS-only tooltips', () => {
  assert.match(ruleForSelector(css, '.map-actions button'), /position:relative/);
  assert.match(ruleForSelector(css, '.map-actions button'), /width:44px/);
  assert.match(ruleForSelector(css, '.map-actions button'), /height:44px/);
  assert.match(ruleForSelector(css, '.map-actions button svg'), /width:22px[^}]*height:22px/);
  assert.match(
    ruleForSelector(css, '.map-actions button::after'),
    /content:attr\(data-tooltip\)/,
  );
  assert.match(
    ruleForSelector(css, '.map-actions button:hover::after,.map-actions button:focus-visible::after'),
    /opacity:1/,
  );
  assert.match(ruleForSelector(css, '.map-actions button:first-child::after'), /left:0/);
  assert.match(ruleForSelector(css, '.map-actions button:last-child::after'), /right:0/);
});

test('desktop shell gives the workspace the actual remaining viewport height', () => {
  const rootRule = ruleForSelector(css, ':root');
  const bodyRule = ruleForSelector(css, 'body');
  const mainRule = ruleForSelector(css, 'main');
  const workspaceRule = ruleForSelector(css, '.workspace');
  const resultsRule = ruleForSelector(css, '.results-panel');
  const mapPanelRule = ruleForSelector(css, '.map-panel');
  const mapRule = ruleForSelector(css, '.dynamic-map');
  const footerRule = ruleForSelector(css, '.site-footer');

  assert.doesNotMatch(rootRule, /--workspace-offset/);
  assert.match(bodyRule, /height:100vh/);
  assert.match(bodyRule, /height:100dvh/);
  assert.match(bodyRule, /display:grid/);
  assert.match(bodyRule, /grid-template-rows:auto minmax\(0,1fr\) auto/);

  assert.match(mainRule, /width:100%/);
  assert.match(mainRule, /max-width:none/);
  assert.match(mainRule, /padding:0/);
  assert.match(mainRule, /display:grid/);
  assert.match(mainRule, /grid-template-rows:auto minmax\(0,1fr\)/);
  assert.match(mainRule, /min-height:0/);

  assert.match(workspaceRule, /display:grid/);
  assert.match(
    workspaceRule,
    /grid-template-columns:minmax\(480px,1fr\) minmax\(480px,1fr\)/,
  );
  assert.match(workspaceRule, /min-height:0/);
  assert.doesNotMatch(workspaceRule, /(?:d)?vh|workspace-offset/);
  assert.match(resultsRule, /overflow:auto/);
  assert.match(resultsRule, /min-height:0/);
  assert.doesNotMatch(resultsRule, /max-height|(?:d)?vh|workspace-offset/);
  assert.match(mapPanelRule, /min-height:0/);
  assert.match(mapRule, /height:100%/);
  assert.match(mapRule, /min-height:0/);
  assert.doesNotMatch(mapRule, /(?:d)?vh|workspace-offset/);
  assert.doesNotMatch(footerRule, /position:(?:absolute|fixed|sticky)/);

  assert.match(
    css,
    /#search-area\{[^}]*background:var\(--petrol\)[^}]*border-color:var\(--petrol\)[^}]*color:#fff/,
  );
  assert.match(
    css,
    /\.map-overlay\{[^}]*width:calc\(100% - 24px\)[^}]*justify-content:center[^}]*overflow:visible/,
  );
  assert.match(css, /\.map-actions\{[^}]*flex-wrap:nowrap[^}]*justify-content:center/);
  assert.match(css, /\.map-footer\{[^}]*bottom:36px/);
});

test('tablet layout avoids minimum-column horizontal overflow', () => {
  const tabletRules = mediaBlockForViewport(css, 900);
  assert.ok(tabletRules, 'Expected a responsive workspace rule that applies at 900px');
  assert.match(
    tabletRules,
    /\.workspace\{[^}]*(?:grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)|flex-direction:column)/,
  );
  assert.doesNotMatch(tabletRules, /\.workspace\{[^}]*minmax\((?:4[8-9]\d|[5-9]\d\d)px/);
});

test('mobile preserves document flow with a single visible workspace panel', () => {
  const mobileRules = mediaBlockForViewport(css, 780);
  assert.ok(mobileRules, 'Expected a responsive workspace rule that applies at 780px');
  assert.match(mobileRules, /body\{[^}]*display:block[^}]*height:auto/);
  assert.match(mobileRules, /main\{[^}]*display:block/);
  assert.match(mobileRules, /\.workspace\{[^}]*display:flex[^}]*flex-direction:column/);
  assert.match(mobileRules, /\.workspace\[data-view="jobs"\] \.map-panel[^}]*display:none/);
  assert.match(mobileRules, /\.workspace\[data-view="map"\] \.results-panel[^}]*display:none/);
  assert.match(ruleForSelector(css,'.mobile-view-switch'), /display:none/);
  const switcher=allElements.find(node=>hasClass(node,'mobile-view-switch'));
  assert.ok(switcher);
  assert.equal(attribute(switcher,'role'),'group');
  assert.equal(attribute(switcher,'aria-label'),'Vista principal');
  const buttons=elements(switcher).filter(node=>node.tagName==='button');
  assert.deepEqual(buttons.map(node=>attribute(node,'data-workspace-view')),['jobs','map']);
  assert.deepEqual(buttons.map(node=>attribute(node,'aria-pressed')),['true','false']);
});

test('filter controls constrain horizontal scrolling to the category rail', () => {
  assert.match(lastRuleForSelector(css, '.filter-bar'), /min-width:0/);
  assert.match(rulesForSelector(css, '.filter-controls').join(';'), /min-width:0/);
  const categories = lastRuleForSelector(css, '.categories');
  assert.match(categories, /width:100%/);
  assert.match(categories, /max-width:100%/);
  assert.match(categories, /overflow-x:auto/);
  assert.match(categories, /overscroll-behavior-inline:contain/);
});

test('narrow mobile stacks flexible fields without shrinking touch controls', () => {
  const narrowRules = mediaBlockForViewport(css, 480);
  assert.ok(narrowRules, 'Expected a responsive rule that applies at 480px');
  assert.match(narrowRules, /\.proximity-bar label:first-child,\.proximity-bar label:nth-child\(2\)\{[^}]*min-width:0[^}]*width:100%/);
  assert.match(narrowRules, /\.proximity-bar input,\.proximity-bar select\{[^}]*width:100%/);
  assert.match(narrowRules, /\.map-actions\{[^}]*max-width:100%/);
  assert.doesNotMatch(narrowRules, /\.map-overlay\{[^}]*position:static/);
  assert.match(lastRuleForSelector(css, '.map-actions button'), /width:44px[^}]*height:44px/);
});

test('map offer groups stay within the visible viewport', () => {
  assert.match(lastRuleForSelector(css, '.map-job-group'), /max-width:min\(340px,calc\(100vw - 48px\)\)/);
});
