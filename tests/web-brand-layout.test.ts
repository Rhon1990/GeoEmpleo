import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse, type DefaultTreeAdapterTypes, type ParserError } from 'parse5';

type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;

const html = await readFile(new URL('../apps/web-preview/public/index.html', import.meta.url), 'utf8');
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
  assert.equal(allElements.filter(element => hasClass(element, 'brand-mark')).length, 1);

  const geo = allElements.find(element => hasClass(element, 'brand-geo'));
  const empleo = allElements.find(element => hasClass(element, 'brand-empleo'));
  assert.ok(geo);
  assert.ok(empleo);
  assert.equal(textContent(geo).trim(), 'geo');
  assert.equal(textContent(empleo).trim(), 'empleo');
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
