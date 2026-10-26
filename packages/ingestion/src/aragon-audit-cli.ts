import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditAragonOffers } from './connectors/aragon.ts';
import { fetchJson } from './http.ts';
import { sourceRegistry } from './registry.ts';
import { writeJsonAtomic } from './storage.ts';

interface AragonAuditOptions {
  reportDirectory?: string;
  checkedAt?: string;
  fetchImpl?: typeof fetch;
}

/** Isolated operational audit: its only output is aragon-audit.json, never the public catalog. */
export async function runAragonAuditCli(
  options: AragonAuditOptions = {},
  output: Pick<Console, 'log' | 'error'> = console,
): Promise<number> {
  try {
    const source = sourceRegistry.get('aragon-empleo-publico');
    if (!source?.endpoint || source.status !== 'candidate') throw new Error('Fuente candidata no disponible');
    const checkedAt = options.checkedAt ?? new Date().toISOString();
    const input = await fetchJson(source.endpoint, { fetchImpl: options.fetchImpl });
    const candidates = auditAragonOffers(input, checkedAt);
    const report = { checkedAt, status: 'candidate', received: (input as unknown[]).length,
      candidateCount: candidates.length, candidates, published: 0 };
    const directory = options.reportDirectory ?? fileURLToPath(new URL('../../../var/ingestion/', import.meta.url));
    await writeJsonAtomic(join(directory, 'aragon-audit.json'), report);
    output.log(`Aragón: ${report.received} registros, ${report.candidateCount} candidatos pendientes de verificación, 0 publicados.`);
    return 0;
  } catch {
    output.error('La auditoría de Aragón falló; se conserva el informe anterior. El catálogo público no se modifica.');
    return 1;
  }
}

if (import.meta.main) process.exitCode = await runAragonAuditCli();
