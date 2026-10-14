# GeoEmpleo — Plan ejecutable de contratos de dominio

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking. La ejecución inline evita delegación no solicitada.

**Goal:** Construir una primera biblioteca comprobable de políticas de país, salario español y elegibilidad de publicación, sin cuentas de candidatos.

**Architecture:** Núcleo TypeScript independiente de frameworks y proveedores; España implementa un contrato de país registrado explícitamente. Los datos de entrada ya son internos y tipados; la validación de eventos externos, persistencia y HTTP pertenecen a iteraciones posteriores del backlog.

**Tech Stack:** Node.js 24, TypeScript para comprobación de tipos, test runner de Node. No necesita servicios cloud, fuentes externas, Google Maps ni credenciales.

---

## Alcance y estado

Fecha: 14 de octubre de 2026, Europe/Madrid. **Primera iteración implementada localmente**, tras autorización explícita del usuario. Referencias: [backlog](../../planning/2026-10-14-backlog-tecnico.md), [contexto](../../project-context.md) y [arquitectura](../../architecture/2026-10-14-geoempleo-arquitectura.md).

Cubre GEO-03 y una base mínima de tooling, no toda GEO-06. El resultado es una biblioteca local testable, no una web ni una plataforma nacional. Las instrucciones y ejemplos se conservan como especificación reproducible; el código real prevalece cuando haya ajustes documentados por revisión.

Se comprobó Node local `v24.19.0`. TypeScript 7.0.2 y tipos de Node 24.19.2 están instalados como dependencias de desarrollo con versiones exactas y lockfile. El compilador se ejecuta mediante los scripts de npm, sin instalación global.

### Archivos previstos

| Ruta | Responsabilidad |
|---|---|
| `package.json`, `package-lock.json`, `tsconfig.json` | Tooling reproducible y comprobación estricta |
| `packages/domain/src/model.ts` | Tipos iniciales, no el modelo de catálogo completo |
| `packages/domain/src/country-policy.ts` | Registro y despacho genérico por país |
| `packages/country-es/src/compensation.ts` | Validación y anualización española explícita |
| `packages/domain/src/publication.ts` | Decisión pura de elegibilidad de publicación |
| `tests/compensation.test.ts` | Salario, desconocidos, errores y desbordamiento |
| `tests/country-policy.test.ts` | Segundo país sintético y configuración inválida |
| `tests/publication.test.ts` | Derechos, estado y caducidad |
| `docs/project-context.md`, `README.md` | Estado implementado y comandos realmente comprobados |

Las rutas de código son relativas a la raíz de GeoEmpleo y existen tras esta iteración. Las etiquetas `file` identifican los ejemplos originales de cada archivo. No introducir dependencias runtime en `domain`.

## Tarea 1: preparar tooling mínimo

- [x] Comprobar `git status --short` y `node --version`; debe existir Node 24 o superior. Crear los dos archivos siguientes.

<!-- file: package.json -->
```json
{
  "name": "geoempleo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "test": "node --test tests/*.test.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "check": "npm run typecheck && npm test"
  },
  "devDependencies": {
    "@types/node": "24.19.2",
    "typescript": "7.0.2"
  }
}
```

<!-- file: tsconfig.json -->
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  },
  "include": ["packages/**/*.ts", "tests/**/*.ts"]
}
```

- [x] Ejecutar `npm install --save-dev --save-exact typescript @types/node@24`. Debe añadir versiones exactas y `package-lock.json`; revisar compatibilidad del compilador resuelto. En instalaciones posteriores usar `npm ci`.
- [x] Ejecutar `npm exec tsc -- --version`; registrar versión resuelta. Todavía no ejecutar la suite: sus archivos se añaden en las siguientes tareas.
- [x] Crear un commit acotado: `git add package.json package-lock.json tsconfig.json` y `git commit -m "chore: prepare GeoEmpleo domain tooling"`.

## Tarea 2: contrato tipado inicial

- [x] Crear el siguiente archivo completo. Es un contrato interno: no valida JSON no confiable ni decide si un país ISO existe.

<!-- file: packages/domain/src/model.ts -->
```typescript
export interface Compensation {
  minMinor: number | null;
  maxMinor: number | null;
  currency: string;
  period: 'hour' | 'month' | 'year';
  basis: 'gross' | 'net' | 'unknown';
  paymentsPerYear: number | null;
  hoursPerWeek: number | null;
  paidWeeksPerYear: number | null;
}

export interface AnnualSalary {
  minMinor: number | null;
  maxMinor: number | null;
  currency: string;
  basis: 'gross';
  period: 'year';
  /** Producto numérico informativo; los importes se calculan desde los factores originales. */
  factor: number;
  rounding: 'nearest_minor_unit';
}

export interface CountryPolicy {
  code: string;
  version: string;
  annualize(input: Compensation | null): AnnualSalary | null;
}

export interface PublicationCandidate {
  id: string;
  sourceId: string;
  title: string;
  descriptionText: string;
  status: 'active' | 'closed' | 'unknown';
  expiresAt: string | null;
}

export interface SourcePublicationPolicy {
  sourceId: string;
  allowsFullDescription: boolean;
}

export type PublicationDecision =
  | { publish: true }
  | { publish: false; reason:
      'source_mismatch' | 'permission_missing' | 'incomplete'
      | 'inactive' | 'invalid_expiry' | 'expired' };
```

- [x] Ejecutar `npm run typecheck`; esperar salida exitosa. Aquí se verifica un contrato de tipos, no comportamiento: las pruebas de reglas se añaden con TDD en tareas 3–5.
- [x] `git add packages/domain/src/model.ts` y `git commit -m "feat: define initial domain contracts"`.

## Tarea 3: salario español con evidencia explícita

- [x] Crear primero la prueba completa siguiente.

<!-- file: tests/compensation.test.ts -->
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Compensation } from '../packages/domain/src/model.ts';
import { spainPolicy } from '../packages/country-es/src/compensation.ts';

const salary = (patch: Partial<Compensation> = {}): Compensation => ({
  minMinor: 150000, maxMinor: 200000, currency: 'EUR',
  period: 'month', basis: 'gross', paymentsPerYear: null,
  hoursPerWeek: null, paidWeeksPerYear: null, ...patch,
});

test('anualiza según las pagas declaradas, sin imponer 14', () => {
  assert.equal(spainPolicy.annualize(salary({ paymentsPerYear: 12 }))?.minMinor, 1800000);
  assert.equal(spainPolicy.annualize(salary({ paymentsPerYear: 14 }))?.minMinor, 2100000);
});
test('preserva ausencia de salario y de pagas', () => {
  assert.equal(spainPolicy.annualize(null), null);
  assert.equal(spainPolicy.annualize(salary()), null);
  assert.equal(spainPolicy.annualize(salary({ minMinor: null, maxMinor: null })), null);
});
test('no convierte neto, base desconocida ni otra moneda', () => {
  for (const patch of [{ basis: 'net' }, { basis: 'unknown' }, { currency: 'USD' }] as const) {
    assert.equal(spainPolicy.annualize(salary(patch)), null);
  }
});
test('hora exige horas y semanas remuneradas explícitas', () => {
  const input = salary({ period: 'hour', minMinor: 1000, maxMinor: null, hoursPerWeek: 20 });
  assert.equal(spainPolicy.annualize(input), null);
  assert.equal(spainPolicy.annualize({ ...input, paidWeeksPerYear: 48 })?.minMinor, 960000);
});
test('el salario anual conserva el rango sin duplicar pagas', () => {
  const output = spainPolicy.annualize(salary({ period: 'year', paymentsPerYear: 14 }));
  assert.equal(output?.minMinor, 150000);
  assert.equal(output?.maxMinor, 200000);
  assert.equal(output?.factor, 1);
});
test('máximo conocido no inventa mínimo garantizado', () => {
  assert.equal(spainPolicy.annualize(salary({ period: 'year', minMinor: null }))?.minMinor, null);
});
test('rechaza rangos, importes y factores inválidos', () => {
  for (const input of [salary({ minMinor: 300000 }), salary({ minMinor: -1 }),
    salary({ minMinor: 1.5 }), salary({ paymentsPerYear: 0 }),
    salary({ hoursPerWeek: Number.NaN }), salary({ paidWeeksPerYear: -1 })]) {
    assert.throws(() => spainPolicy.annualize(input), RangeError);
  }
});
test('rechaza desbordamiento al convertir', () => {
  assert.throws(() => spainPolicy.annualize(salary({
    minMinor: Number.MAX_SAFE_INTEGER, maxMinor: null, paymentsPerYear: 14,
  })), RangeError);
});

test('redondea medio céntimo con factores decimales sin perder precisión', () => {
  const result = spainPolicy.annualize(salary({
    period: 'hour', minMinor: 1005, maxMinor: null,
    hoursPerWeek: 10.2, paidWeeksPerYear: 50.5,
  }));
  assert.equal(result?.minMinor, 517676);
  assert.equal(spainPolicy.annualize(salary({
    period: 'hour', minMinor: 10000000, maxMinor: null,
    hoursPerWeek: 1e-7, paidWeeksPerYear: 50,
  }))?.minMinor, 50);
  assert.equal(spainPolicy.annualize(salary({
    period: 'hour', minMinor: 1005, maxMinor: null,
    hoursPerWeek: 1e21, paidWeeksPerYear: 1e-21,
  }))?.minMinor, 1005);
});

test('rechaza factores compuestos fuera del rango representable', () => {
  for (const hoursPerWeek of [1e-200, 1e200]) {
    assert.throws(() => spainPolicy.annualize(salary({
      period: 'hour', minMinor: 0, maxMinor: null,
      hoursPerWeek, paidWeeksPerYear: hoursPerWeek,
    })), RangeError);
  }
});
```

- [x] Ejecutar `node --test tests/compensation.test.ts`; debe fallar por módulo de implementación ausente. No dar ese error por prueba funcional: tras escribir la implementación, los casos deben ejecutar sus aserciones.
- [x] Crear la implementación mínima completa.

<!-- file: packages/country-es/src/compensation.ts -->
```typescript
import type { AnnualSalary, Compensation, CountryPolicy } from '../../domain/src/model.ts';

function validate(input: Compensation): void {
  for (const amount of [input.minMinor, input.maxMinor]) {
    if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) {
      throw new RangeError('Importe inválido en unidades menores');
    }
  }
  if (input.minMinor !== null && input.maxMinor !== null && input.minMinor > input.maxMinor) {
    throw new RangeError('Rango salarial invertido');
  }
  for (const factor of [input.paymentsPerYear, input.hoursPerWeek, input.paidWeeksPerYear]) {
    if (factor !== null && (!Number.isFinite(factor) || factor <= 0)) {
      throw new RangeError('Factor salarial inválido');
    }
  }
  if (input.paymentsPerYear !== null && !Number.isSafeInteger(input.paymentsPerYear)) {
    throw new RangeError('Número de pagas inválido');
  }
}

function decimalRatio(value: number): [bigint, bigint] {
  const [coefficient, exponent = '0'] = value.toString().split('e');
  const [integer, fraction = ''] = coefficient.split('.');
  const numerator = BigInt(integer + fraction);
  const scale = fraction.length - Number(exponent);
  return scale >= 0
    ? [numerator, 10n ** BigInt(scale)]
    : [numerator * 10n ** BigInt(-scale), 1n];
}

function convert(amount: number | null, factors: readonly number[]): number | null {
  if (amount === null) return null;
  let numerator = BigInt(amount);
  let denominator = 1n;
  for (const factor of factors) {
    const [factorNumerator, factorDenominator] = decimalRatio(factor);
    numerator *= factorNumerator;
    denominator *= factorDenominator;
  }
  // Redondeo de importes positivos al céntimo más próximo, con empate hacia arriba.
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Importe anual fuera de rango');
  return Number(rounded);
}

function annualize(input: Compensation | null): AnnualSalary | null {
  if (input === null) return null;
  validate(input);
  if (input.basis !== 'gross' || input.currency !== 'EUR') return null;
  if (input.minMinor === null && input.maxMinor === null) return null;
  let factors: readonly number[];
  switch (input.period) {
    case 'year': factors = [1]; break;
    case 'month':
      if (input.paymentsPerYear === null) return null;
      factors = [input.paymentsPerYear];
      break;
    case 'hour':
      if (input.hoursPerWeek === null || input.paidWeeksPerYear === null) return null;
      factors = [input.hoursPerWeek, input.paidWeeksPerYear];
      break;
  }
  const factor = factors.reduce((product, value) => product * value, 1);
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Factor salarial fuera de rango');
  return {
    minMinor: convert(input.minMinor, factors), maxMinor: convert(input.maxMinor, factors),
    currency: input.currency, basis: 'gross', period: 'year', factor,
    rounding: 'nearest_minor_unit',
  };
}

export const spainPolicy: CountryPolicy = { code: 'ES', version: '1.0.0', annualize };
```

- [x] Ejecutar `node --test tests/compensation.test.ts` y `npm run typecheck`; esperar 10 pruebas válidas y cero errores de tipos. Conservar la entrada original fuera de la derivación; el resultado no prueba salario garantizado si solo existe máximo.
- [x] `git add packages/country-es/src/compensation.ts tests/compensation.test.ts` y `git commit -m "feat: normalize declared Spanish compensation"`.

## Tarea 4: registro de países sin condicionales de España

- [x] Escribir primero estas pruebas.

<!-- file: tests/country-policy.test.ts -->
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCountryRegistry, normalizeCompensation } from '../packages/domain/src/country-policy.ts';
import { spainPolicy } from '../packages/country-es/src/compensation.ts';

test('despacha un segundo país sintético sin modificar el núcleo', () => {
  const registry = createCountryRegistry([spainPolicy, {
    code: 'ZZ', version: 'fixture-1', annualize: () => ({
      minMinor: 100, maxMinor: null, currency: 'XXX', basis: 'gross',
      period: 'year', factor: 1, rounding: 'nearest_minor_unit',
    }),
  }]);
  const output = normalizeCompensation(registry, 'ZZ', null);
  assert.equal(output.countryCode, 'ZZ');
  assert.equal(output.policyVersion, 'fixture-1');
  assert.equal(output.annualSalary?.currency, 'XXX');
});
test('rechaza países duplicados o no configurados', () => {
  assert.throws(() => createCountryRegistry([spainPolicy, spainPolicy]), /duplicado/);
  assert.throws(() => normalizeCompensation(createCountryRegistry([spainPolicy]), 'XX', null), /no configurado/);
});
```

- [x] Ejecutar `node --test tests/country-policy.test.ts`; esperar fallo por módulo ausente.
- [x] Crear el módulo completo.

<!-- file: packages/domain/src/country-policy.ts -->
```typescript
import type { Compensation, CountryPolicy } from './model.ts';

export function createCountryRegistry(policies: readonly CountryPolicy[]): ReadonlyMap<string, CountryPolicy> {
  const registry = new Map<string, CountryPolicy>();
  for (const policy of policies) {
    if (registry.has(policy.code)) throw new Error(`País duplicado: ${policy.code}`);
    registry.set(policy.code, policy);
  }
  return registry;
}

export function normalizeCompensation(
  registry: ReadonlyMap<string, CountryPolicy>, countryCode: string, input: Compensation | null,
) {
  const policy = registry.get(countryCode);
  if (!policy) throw new Error(`País no configurado: ${countryCode}`);
  return { countryCode, policyVersion: policy.version, annualSalary: policy.annualize(input) };
}
```

- [x] Ejecutar `node --test tests/country-policy.test.ts` y `npm run typecheck`; esperar dos tests válidos. `ZZ` y `XXX` son fixtures sintéticos, no cobertura comercial.
- [x] `git add packages/domain/src/country-policy.ts tests/country-policy.test.ts` y `git commit -m "feat: dispatch versioned country policies"`.

## Tarea 5: bloquear publicación incompleta, no autorizada o caducada

- [x] Escribir primero el test completo. El reloj se inyecta para evitar pruebas dependientes de la fecha de ejecución.

<!-- file: tests/publication.test.ts -->
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import type { PublicationCandidate } from '../packages/domain/src/model.ts';
import { publicationDecision } from '../packages/domain/src/publication.ts';

const now = new Date('2026-10-14T10:00:00.000Z');
const candidate: PublicationCandidate = {
  id: 'fixture-1', sourceId: 'fixture-source', title: 'Operario/a',
  descriptionText: 'Descripción completa de ejemplo propio.',
  status: 'active', expiresAt: null,
};
const policy = { sourceId: 'fixture-source', allowsFullDescription: true };

test('publica una ficha completa activa con permiso y sin cuenta', () => {
  assert.deepEqual(publicationDecision(candidate, policy, now), { publish: true });
});
test('no confunde política de otra fuente con permiso de publicación', () => {
  assert.deepEqual(publicationDecision(candidate, { ...policy, sourceId: 'otra' }, now),
    { publish: false, reason: 'source_mismatch' });
});
test('bloquea descripción sin permiso', () => {
  assert.deepEqual(publicationDecision(candidate, { ...policy, allowsFullDescription: false }, now),
    { publish: false, reason: 'permission_missing' });
});
test('bloquea título o descripción vacíos', () => {
  for (const patch of [{ title: ' ' }, { descriptionText: ' ' }]) {
    assert.deepEqual(publicationDecision({ ...candidate, ...patch }, policy, now),
      { publish: false, reason: 'incomplete' });
  }
});
test('no publica estado cerrado ni desconocido', () => {
  for (const status of ['closed', 'unknown'] as const) {
    assert.deepEqual(publicationDecision({ ...candidate, status }, policy, now),
      { publish: false, reason: 'inactive' });
  }
});
test('bloquea expiración inválida o sin hora normalizada', () => {
  for (const expiresAt of ['incorrecta', '2026-10-14', '2026-02-30T10:00:00.000Z']) {
    assert.deepEqual(publicationDecision({ ...candidate, expiresAt }, policy, now),
      { publish: false, reason: 'invalid_expiry' });
  }
});
test('cierra exactamente en el instante de expiración', () => {
  assert.deepEqual(publicationDecision({ ...candidate, expiresAt: now.toISOString() }, policy, now),
    { publish: false, reason: 'expired' });
});
test('permite vencimiento futuro y rechaza reloj inválido', () => {
  assert.deepEqual(publicationDecision({ ...candidate, expiresAt: '2026-10-15T10:00:00.000Z' }, policy, now),
    { publish: true });
  assert.deepEqual(publicationDecision({ ...candidate, expiresAt: '2026-10-15T10:00:00Z' }, policy, now),
    { publish: true });
  assert.throws(() => publicationDecision(candidate, policy, new Date('invalid')), RangeError);
});
```

- [x] Ejecutar `node --test tests/publication.test.ts`; esperar fallo por módulo ausente.
- [x] Crear la implementación siguiente. Las fechas recibidas son instantes normalizados; resolver fechas locales sin hora y plazos oficiales requiere el normalizador regional de GEO-11/15.

<!-- file: packages/domain/src/publication.ts -->
```typescript
import type { PublicationCandidate, PublicationDecision, SourcePublicationPolicy } from './model.ts';

export function publicationDecision(
  candidate: PublicationCandidate, policy: SourcePublicationPolicy, now: Date,
): PublicationDecision {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Reloj inválido');
  if (policy.sourceId !== candidate.sourceId) return { publish: false, reason: 'source_mismatch' };
  if (!policy.allowsFullDescription) return { publish: false, reason: 'permission_missing' };
  if (!candidate.title.trim() || !candidate.descriptionText.trim()) return { publish: false, reason: 'incomplete' };
  if (candidate.status !== 'active') return { publish: false, reason: 'inactive' };
  if (candidate.expiresAt !== null) {
    const expiry = Date.parse(candidate.expiresAt);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(candidate.expiresAt)
        || !Number.isFinite(expiry)) return { publish: false, reason: 'invalid_expiry' };
    const canonicalInput = candidate.expiresAt.includes('.')
      ? candidate.expiresAt : candidate.expiresAt.replace('Z', '.000Z');
    if (new Date(expiry).toISOString() !== canonicalInput) return { publish: false, reason: 'invalid_expiry' };
    if (expiry <= now.getTime()) return { publish: false, reason: 'expired' };
  }
  return { publish: true };
}
```

- [x] Ejecutar `node --test tests/publication.test.ts` y `npm run check`; esperar 20 tests totales y cero errores de tipos. El permiso representado es un dato de política previamente verificado, no una comprobación jurídica automática.
- [x] `git add packages/domain/src/publication.ts tests/publication.test.ts` y `git commit -m "feat: enforce complete authorized public postings"`.

## Tarea 6: documentación y cierre de la iteración

- [x] Añadir a `README.md` este contenido junto a los enlaces existentes que tenga en el momento de implementación; no sobrescribir cambios ajenos.

```markdown
## Desarrollo local del dominio

Requisitos: Node.js 24 o superior y npm.

Instalación: `npm ci`.
Comprobación de tipos y reglas: `npm run check`.

La biblioteca no requiere cuentas, claves Google ni fuentes externas.
Todavía no incluye frontend, API, persistencia, mapa o datos reales.

Contexto: [docs/project-context.md](docs/project-context.md).
Backlog: [docs/planning/2026-10-14-backlog-tecnico.md](docs/planning/2026-10-14-backlog-tecnico.md).
```

- [x] En `docs/project-context.md`, sustituir el párrafo de estado exclusivamente documental por el siguiente, **solo si la implementación y todas las comprobaciones realmente se completan**:

```markdown
Existe una primera biblioteca local TypeScript de contratos de país, salario español y elegibilidad de publicación. Se ejecuta con `npm ci` y `npm run check`. Las reglas usan fixtures propios; no existe todavía frontend, API pública, persistencia, ingesta de fuentes reales ni Google Maps integrado. La cobertura nacional y los objetivos de escala permanecen sin validar en runtime.
```

- [x] Ejecutar `npm ci`, `npm run check` y `git diff --check`. Revisar el diff y confirmar que no existen cuentas de candidatos ni dependencias cloud añadidas a `domain`.
- [x] Registrar comandos, versiones y resultados reales. Marcar GEO-03 terminado solo con evidencia; GEO-06 sigue parcial porque CI/servicios locales están fuera de este alcance.
- [x] `git add README.md docs/project-context.md` y `git commit -m "docs: describe validated local domain workflow"`.

## Límites y próximo plan

Este slice no interpreta JSON externo, sanitiza HTML, verifica licencias por sí mismo, deduplica ni cierra vacantes multifuente. No es un motor monetario general ni aplica equivalencias por divisa. La política española devuelve `null` para salarios no comparables; se conserva el original en el catálogo posterior.

GEO-04/05 detallarán JSON Schema interoperable, tipos completos de vacante/publicación, políticas con vigencia, procedencia, migraciones y outbox. Esos contratos deben resolver información por campo y múltiples fuentes antes de exponer fichas reales. GEO-21 integrará Google Maps sobre los endpoints de búsqueda, sin condicionar el núcleo ni exigir cuenta a visitantes.

## Validación documental previa a implementar

Se extrajeron los nueve bloques `file` a un directorio temporal. Se comprobó primero que las tres suites fallan por módulos ausentes y después se ejecutó `node --test tests/compensation.test.ts tests/country-policy.test.ts tests/publication.test.ts` con todas las muestras del plan: **18 pruebas pasaron, 0 fallos**, Node 24.19.0.

La revisión detectó y corrigió un error en la canonicalización de fechas con milisegundos antes de la entrega. La suite final cubre fechas válidas con/sin milisegundos, fechas de calendario inválidas y expiración exacta. No se instaló ninguna dependencia ni se ejecutó `tsc`, que no está disponible globalmente; la comprobación estática y reproducibilidad de `npm ci` siguen siendo comprobaciones obligatorias durante implementación. No se han creado archivos de aplicación, lockfiles ni commits en GeoEmpleo.

## Ejecución local verificada

Las seis tareas se completaron en un worktree aislado. Se comprobó la fase roja funcional (15 aserciones fallidas), después la fase verde y la comprobación estática. Se corrigió mediante regresión un redondeo decimal con horas/semanas fraccionarias; ahora los importes usan ratios BigInt de cada factor original y redondeo de empate hacia arriba. No se añadieron dependencias runtime.

Evidencias: `npm run check`, 20 pruebas pasadas y cero errores de tipos; `npm ci --cache /private/tmp/geoempleo-npm-cache --offline`, instalación desde lockfile satisfactoria; `git diff --check`, sin errores. Versiones: Node 24.19.0, TypeScript 7.0.2, tipos de Node 24.19.2. La revisión independiente del código final no dejó hallazgos pendientes.

GEO-03 queda implementado localmente; GEO-06 permanece parcial. La siguiente iteración es GEO-04 (contratos JSON/API), seguida de persistencia/outbox. No se han conectado fuentes, integrado Google Maps ni desplegado servicios.
