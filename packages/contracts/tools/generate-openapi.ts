import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function readSchema(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../schemas/v1/${name}.schema.json`, import.meta.url), 'utf8'));
}

function bundle(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(bundle);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$id' && key !== '$schema').map(([key, child]) => {
    if (key !== '$ref') return [key, bundle(child)];
    const ref = String(child);
    if (ref.startsWith('common.schema.json#')) {
      return [key, '#/components/schemas/Common' + ref.slice('common.schema.json#'.length)];
    }
    if (ref.startsWith('#/$defs/')) return [key, '#/components/schemas/Common' + ref.slice(1)];
    throw new Error(`Referencia de esquema no soportada: ${ref}`);
  }));
}

const componentRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const commonRef = (name: string) => componentRef(`Common/$defs/${name}`);
const countryParameter = {
  name: 'country', in: 'path', required: true,
  description: 'Código de país normalizado; el servicio futuro comprobará si está habilitado.',
  schema: commonRef('CountryCode'),
};

function responses(name: string) {
  const response = (description: string, schema: string) => ({
    description, content: { 'application/json': { schema: componentRef(schema) } },
  });
  return {
    '200': response('Resultado público', name),
    '400': response('Solicitud no válida', 'Problem'),
    '404': response('País o recurso no disponible', 'Problem'),
    '503': response('Servicio temporalmente no disponible', 'Problem'),
  };
}

export function buildOpenApi(): Record<string, unknown> {
  const common = readSchema('common');
  const definitions = common.$defs as Record<string, { properties: Record<string, unknown> }>;
  const query = definitions.SearchQuery.properties;
  const queryParameters = Object.entries(query).map(([name, schema]) => ['filters', 'location'].includes(name)
    ? { name, in: 'query', required: false, content: { 'application/json': { schema: bundle(schema) } } }
    : { name, in: 'query', required: false, schema: bundle(schema) });
  const read = (parameters: unknown[], schema: string, summary: string) => ({
    get: { summary, security: [], parameters, responses: responses(schema) },
  });
  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'GeoEmpleo: contrato público inicial', version: '1.0.0',
      description: 'Especificación de una API futura. No hay servidor HTTP implementado. Sin registro ni cuentas. Parámetros omitidos se normalizarán a q/location/cursor=null, filters={}, sort=relevance y limit=25 antes de validar SearchRequest.',
    },
    servers: [], security: [],
    paths: {
      '/v1/{country}/jobs': read([countryParameter, ...queryParameters], 'JobList', 'Buscar ofertas públicamente'),
      '/v1/{country}/jobs/{id}': read([
        countryParameter, { name: 'id', in: 'path', required: true, schema: commonRef('Uuid') },
      ], 'JobDetail', 'Leer el detalle completo públicamente'),
      '/v1/{country}/map': read([
        countryParameter,
        ...queryParameters.filter(parameter => ['q', 'filters'].includes(parameter.name)),
        { name: 'bbox', in: 'query', required: true, style: 'form', explode: false, schema: commonRef('Bounds') },
        { name: 'zoom', in: 'query', required: true, schema: { type: 'integer', minimum: 0, maximum: 30 } },
      ], 'MapResponse', 'Consultar agrupaciones de ofertas en el mapa'),
    },
    components: { schemas: {
      Common: bundle(common),
      SearchRequest: bundle(readSchema('search-request')),
      JobDetail: bundle(readSchema('job-detail')),
      JobList: bundle(readSchema('job-list')),
      MapResponse: bundle(readSchema('map-response')),
      Problem: bundle(readSchema('problem')),
    } },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = new URL('../openapi/v1.json', import.meta.url);
  const content = JSON.stringify(buildOpenApi(), null, 2) + '\n';
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8') !== content) {
      throw new Error('OpenAPI no corresponde a los esquemas. Ejecuta npm run generate:openapi.');
    }
    console.log('OK: OpenAPI coincide con los esquemas versionados');
  } else {
    mkdirSync(new URL('../openapi/', import.meta.url), { recursive: true });
    writeFileSync(output, content);
  }
}
