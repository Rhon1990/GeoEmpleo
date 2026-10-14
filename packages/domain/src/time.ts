export function parseUtcInstant(value: string): number | null {
  const instant = Date.parse(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)
      || !Number.isFinite(instant)) return null;
  const canonical = value.includes('.') ? value : value.replace('Z', '.000Z');
  return new Date(instant).toISOString() === canonical ? instant : null;
}
