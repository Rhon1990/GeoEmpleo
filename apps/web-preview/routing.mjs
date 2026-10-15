export function resolvePreviewPath(target) {
  try { return new URL(target, 'http://127.0.0.1').pathname; }
  catch { return null; }
}
