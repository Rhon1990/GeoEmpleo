import { isIP } from 'node:net';

/** URL HTTP sin credenciales y con autoridad ASCII convencional; no resuelve DNS. */
export function isHttpUrl(value: string): boolean {
  const authority = /^https?:\/\/([^/?#]+)/.exec(value)?.[1];
  if (!authority || !/^[\x21-\x7e]+$/.test(authority) || /[@%\\]/.test(authority) || value.includes('\\')) return false;
  const parts = /^(\[[0-9a-fA-F:.]+\]|[^:]+)(?::([0-9]{1,5}))?$/.exec(authority);
  if (!parts || (parts[2] !== undefined && Number(parts[2]) > 65535)) return false;
  const hostname = parts[1];
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return false;
    if (hostname.startsWith('[')) {
      return isIP(hostname.slice(1, -1)) === 6;
    }
    if (/^[0-9.]+$/.test(hostname)) return isIP(hostname) === 4;
    const labels = hostname.replace(/\.$/, '').split('.');
    if (hostname.length > 253 || labels.some(label => label.length > 63 || !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label))) return false;
    if (/^(?:[0-9]+|0x[0-9a-f]+)$/i.test(labels.at(-1)!)) return false;
    return parsed.hostname === hostname.toLowerCase();
  } catch {
    return false;
  }
}
