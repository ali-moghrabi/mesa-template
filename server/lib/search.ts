import { escapeRegex } from './pagination';

export const MAX_SEARCH_TERMS = 6;

export function searchTerms(input: string | undefined | null): string[] {
  if (!input) return [];
  const words = input
    .normalize('NFKC')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(words)].slice(0, MAX_SEARCH_TERMS);
}

export function allTermsMatch(
  terms: string[],
  fields: readonly string[],
): Record<string, unknown> {
  return {
    $and: terms.map((term) => {
      const pattern = new RegExp(escapeRegex(term), 'i');
      return { $or: fields.map((field) => ({ [field]: pattern })) };
    }),
  };
}

export function relevanceScore(
  phrase: string,
  terms: string[],
  field = '$name',
): Record<string, unknown> {
  const lower = phrase.toLowerCase();
  const escaped = escapeRegex(lower);
  const test = (regex: string) => ({
    $regexMatch: { input: field, regex, options: 'i' },
  });

  return {
    $add: [
      { $cond: [{ $eq: [{ $toLower: field }, lower] }, 100, 0] },
      { $cond: [test(`^${escaped}`), 60, { $cond: [test(escaped), 40, 0] }] },
      ...terms.map((term) => ({
        $cond: [test(`(^|[\\s(/-])${escapeRegex(term)}`), 10, 0],
      })),
    ],
  };
}
