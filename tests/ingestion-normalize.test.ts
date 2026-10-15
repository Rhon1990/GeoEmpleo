import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryForSector,
  htmlToParagraphs,
  spanishDate,
} from '../packages/ingestion/src/normalize.ts';

test('convierte fechas españolas sin depender del locale del host', () => {
  assert.equal(spanishDate('15/10/2026'), '2026-10-15');
  assert.equal(spanishDate('31/02/2026'), null);
});

test('convierte HTML externo y entidades en párrafos de texto', () => {
  assert.deepEqual(
    htmlToParagraphs('<b>Funciones</b><BR/>Atención &amp; archivo.'),
    ['Funciones', 'Atención & archivo.'],
  );
});

test('decodifica entidades numéricas decimales y hexadecimales válidas', () => {
  assert.deepEqual(
    htmlToParagraphs('<p>Técnico &#241; &#x1F4BC;</p>'),
    ['Técnico ñ 💼'],
  );
});

test('decodifica todas las entidades nombradas admitidas', () => {
  assert.deepEqual(
    htmlToParagraphs('&lt;puesto&gt;&nbsp;&quot;QA&quot; &apos;manual&apos; &amp; soporte'),
    ['<puesto> "QA" \'manual\' & soporte'],
  );
});

test('elimina entidades numéricas inválidas sin lanzar', () => {
  assert.deepEqual(
    htmlToParagraphs('<p>Antes</p><p>&#1114112;&#xD800;Después</p>'),
    ['Antes', 'Después'],
  );
});

test('clasifica sectores conocidos y conserva un fallback explícito', () => {
  const expected = {
    AO: { category: 'administracion', label: 'Administración' },
    IF: { category: 'tecnologia', label: 'Tecnología' },
    SA: { category: 'sanidad', label: 'Sanidad' },
    SP: { category: 'cuidados', label: 'Cuidados y servicios' },
    TC: { category: 'transporte', label: 'Transporte' },
    TH: { category: 'hosteleria', label: 'Turismo y hostelería' },
    MR: { category: 'oficios', label: 'Oficios técnicos' },
  } as const;

  for (const [code, category] of Object.entries(expected)) {
    assert.deepEqual(categoryForSector(code), category);
  }
  assert.deepEqual(categoryForSector('ZZ'), { category: 'otros', label: 'Otros' });
});
