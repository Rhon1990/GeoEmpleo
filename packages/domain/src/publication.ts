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
