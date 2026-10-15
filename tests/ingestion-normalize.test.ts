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

test('valida bisiestos y los límites del calendario admitido', () => {
  assert.equal(spanishDate('29/02/2024'), '2024-02-29');
  assert.equal(spanishDate('29/02/2023'), null);
  assert.equal(spanishDate('29/02/2000'), '2000-02-29');
  assert.equal(spanishDate('29/02/1900'), null);
  assert.equal(spanishDate('01/01/0001'), '0001-01-01');
  assert.equal(spanishDate('31/12/9999'), '9999-12-31');
  assert.equal(spanishDate('01/01/0000'), null);
});

test('convierte HTML externo y entidades en párrafos de texto', () => {
  assert.deepEqual(
    htmlToParagraphs('<b>Funciones</b><BR/>Atención &amp; archivo.'),
    ['Funciones', 'Atención & archivo.'],
  );
});

test('preserva comparadores de texto y descarta atributos completos', () => {
  assert.deepEqual(
    htmlToParagraphs('1 < 2 y 3 > 2<p title="1 > 0">Texto</p>'),
    ['1 < 2 y 3 > 2', 'Texto'],
  );
});

test('ignora contenido no visible de script, style y template', () => {
  assert.deepEqual(
    htmlToParagraphs('<p>Visible</p><script>alert(1)</script><style>body{}</style><template>Oculto</template><div>Final</div>'),
    ['Visible', 'Final'],
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

test('decodifica entidades HTML estándar fuera del subconjunto original', () => {
  assert.deepEqual(htmlToParagraphs('Salario: 20.000 &euro;'), ['Salario: 20.000 €']);
});

test('elimina NUL, controles y surrogates aislados del texto', () => {
  assert.deepEqual(
    htmlToParagraphs('A\u0000\u0001\u0008\u000b\u000c\u000e\u001f\u007f\u0085\ud800B'),
    ['AB'],
  );
});

test('elimina entidades numéricas inválidas sin lanzar', () => {
  assert.deepEqual(
    htmlToParagraphs('<p>Antes</p><p>&#0;&#1;&#x7F;&#1114112;&#xD800;Después</p>'),
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

test('no expone categorías compartidas mutables', () => {
  const known = categoryForSector('TH');
  const fallback = categoryForSector('ZZ');

  assert.equal(Object.isFrozen(known), true);
  assert.equal(Object.isFrozen(fallback), true);
  assert.throws(() => {
    (known as { category: string }).category = 'alterada';
  }, TypeError);
  assert.throws(() => {
    (fallback as { label: string }).label = 'Alterado';
  }, TypeError);
  assert.deepEqual(categoryForSector('TH'), { category: 'hosteleria', label: 'Turismo y hostelería' });
  assert.deepEqual(categoryForSector('ZZ'), { category: 'otros', label: 'Otros' });
});
