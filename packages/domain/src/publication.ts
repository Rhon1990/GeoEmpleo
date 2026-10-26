import type { PublicationCandidate, PublicationDecision, SourcePublicationPolicy } from './model.ts';
import { parseUtcInstant } from './time.ts';

export function publicationDecision(
  candidate: PublicationCandidate, policy: SourcePublicationPolicy, now: Date,
): PublicationDecision {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Reloj inválido');
  if (policy.sourceId !== candidate.sourceId) return { publish: false, reason: 'source_mismatch' };
  if (!policy.allowsFullDescription) return { publish: false, reason: 'permission_missing' };
  if (!candidate.title.trim() || !candidate.descriptionText.trim()) return { publish: false, reason: 'incomplete' };
  if (candidate.status !== 'active') return { publish: false, reason: 'inactive' };
  if (candidate.expiresAt !== null) {
    const expiry = parseUtcInstant(candidate.expiresAt);
    if (expiry === null) return { publish: false, reason: 'invalid_expiry' };
    if (expiry <= now.getTime()) return { publish: false, reason: 'expired' };
  }
  return { publish: true };
}
