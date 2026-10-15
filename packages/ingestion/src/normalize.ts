const entities: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

interface Category {
  category: string;
  label: string;
}

const categories: Readonly<Record<string, Category>> = {
  AO: { category: 'administracion', label: 'Administración' },
  IF: { category: 'tecnologia', label: 'Tecnología' },
  SA: { category: 'sanidad', label: 'Sanidad' },
  SP: { category: 'cuidados', label: 'Cuidados y servicios' },
  TC: { category: 'transporte', label: 'Transporte' },
  TH: { category: 'hosteleria', label: 'Turismo y hostelería' },
  MR: { category: 'oficios', label: 'Oficios técnicos' },
};

const fallbackCategory: Category = { category: 'otros', label: 'Otros' };

export function spanishDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(iso) ? iso : null;
}

export function htmlToParagraphs(value: string): string[] {
  const text = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|li|div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_, entity: string) => {
      if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? `&${entity};`;

      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      const isUnicodeScalar = Number.isSafeInteger(codePoint)
        && codePoint >= 0
        && codePoint <= 0x10ffff
        && !(codePoint >= 0xd800 && codePoint <= 0xdfff);
      return isUnicodeScalar ? String.fromCodePoint(codePoint) : '';
    });

  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function categoryForSector(code: string): Category {
  return categories[code] ?? fallbackCategory;
}
