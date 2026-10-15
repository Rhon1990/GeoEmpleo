import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';

interface Category {
  readonly category: string;
  readonly label: string;
}

const categories: Readonly<Record<string, Category>> = Object.freeze({
  AO: Object.freeze({ category: 'administracion', label: 'Administración' }),
  IF: Object.freeze({ category: 'tecnologia', label: 'Tecnología' }),
  SA: Object.freeze({ category: 'sanidad', label: 'Sanidad' }),
  SP: Object.freeze({ category: 'cuidados', label: 'Cuidados y servicios' }),
  TC: Object.freeze({ category: 'transporte', label: 'Transporte' }),
  TH: Object.freeze({ category: 'hosteleria', label: 'Turismo y hostelería' }),
  MR: Object.freeze({ category: 'oficios', label: 'Oficios técnicos' }),
});

const fallbackCategory: Category = Object.freeze({ category: 'otros', label: 'Otros' });
const paragraphTags = new Set(['div', 'li', 'p']);
const ignoredTags = new Set(['script', 'style', 'template']);

function isDiscardedControl(codePoint: number): boolean {
  return codePoint <= 0x08
    || (codePoint >= 0x0b && codePoint <= 0x0c)
    || (codePoint >= 0x0e && codePoint <= 0x1f)
    || (codePoint >= 0x7f && codePoint <= 0x9f);
}

function cleanTextNode(value: string): string {
  let clean = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined
      || codePoint === 0xfffd
      || isDiscardedControl(codePoint)
      || (codePoint >= 0xd800 && codePoint <= 0xdfff)) continue;
    clean += character;
  }
  return clean;
}

export function spanishDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day < 1 || day > daysInMonth[month - 1]!) return null;

  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function htmlToParagraphs(value: string): string[] {
  const fragment = parseFragment(value);
  const chunks: string[] = [];
  const boundary = (): void => {
    if (chunks.at(-1) !== '\n') chunks.push('\n');
  };

  const append = (node: DefaultTreeAdapterTypes.ChildNode): void => {
    if ('value' in node) {
      chunks.push(cleanTextNode(node.value));
      return;
    }
    if (!('tagName' in node)) return;

    const tagName = node.tagName.toLowerCase();
    if (ignoredTags.has(tagName)) return;
    if (tagName === 'br') {
      boundary();
      return;
    }

    const isParagraph = paragraphTags.has(tagName);
    if (isParagraph) boundary();
    for (const child of node.childNodes) append(child);
    if (isParagraph) boundary();
  };

  for (const node of fragment.childNodes) append(node);
  return chunks
    .join('')
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function categoryForSector(code: string): Category {
  return categories[code] ?? fallbackCategory;
}
