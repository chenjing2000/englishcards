import { z } from 'zod';

import { defaults, settingsSchema, type Styles } from './settings';
export { defaults, settingsSchema as styleSchema, type Styles } from './settings';

const id = z.string().min(1).max(200);
const text = z.string().max(300000).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(value), '含无效控制字符或乱码替代符');
const paragraph = z.object({ id, text });
const variants = z.array(text).max(2000).default([]);
export const emptySense = () => ({ pos: '', meaning: '', example: '', exampleTranslation: '' });
const senseSchema = z.object({ pos: text, meaning: text, example: text, exampleTranslation: text }).strict();
const senses = z.array(senseSchema).min(1).max(2000);
const common = {
  id, title: text, personalizedHeader: text.default('SOME BIRDS ON TREE'), readingLevel: z.number().optional(),
  source: z.object({ paragraphs: z.array(paragraph).max(500) }),
  translation: z.object({ paragraphs: z.array(paragraph).max(500) }),
  vocabulary: z.array(z.object({ id, word: text, ipa: text.optional(), highlight: variants, senses }).strict()).max(2000),
  expressions: z.array(z.object({ id, phrase: text, highlight: variants, senses }).strict()).max(2000),
  mainIdea: text,
  theme: z.literal('classic').default('classic'),
};
const currentSchema = z.object({ ...common, schemaVersion: z.literal(5), warnings: z.array(z.string()).default([]) }).strict();
export type Project = z.infer<typeof currentSchema>;
export type RenderProject = Project & { styles: Styles };
export function projectDocument(input: Project & { styles?: Styles }): Project { const { styles: _settings, ...document } = input; return document; }
export function parseRenderProject(input: unknown): RenderProject {
  const { styles, ...document } = input as Record<string, unknown>;
  return { ...parseProject(document), styles: settingsSchema.parse(styles ?? defaults) };
}
export type EntryCollection = 'vocabulary' | 'expressions';
export type Sense = Project['vocabulary'][number]['senses'][number];
export function splitSenseMeaning(value: string, previousPos = ''): Pick<Sense, 'pos' | 'meaning'> {
  if (previousPos && value.startsWith(`${previousPos} `)) return { pos: previousPos, meaning: value.slice(previousPos.length + 1) };
  if (previousPos && value === previousPos) return { pos: previousPos, meaning: '' };
  const match = /^([A-Za-z][A-Za-z./&-]*\.)(?:\s([\s\S]*))?$/u.exec(value);
  return match ? { pos: match[1], meaning: match[2] ?? '' } : { pos: '', meaning: value };
}
export const newId = () => crypto.randomUUID();
export const layoutKey = (kind: string, sourceId: string) => JSON.stringify([kind, sourceId]);

export function parseProject(input: unknown): Project {
  if (input && typeof input === 'object' && 'schemaVersion' in input && input.schemaVersion !== 5) {
    throw new Error('仅支持 schemaVersion: 5，旧格式不再支持，请按当前 skill 重新生成 JSON。');
  }
  const project = currentSchema.parse(input);
  const ids = [project.id, ...project.source.paragraphs.map(item => item.id), ...project.translation.paragraphs.map(item => item.id), ...project.vocabulary.map(item => item.id), ...project.expressions.map(item => item.id)];
  if (new Set(ids).size !== ids.length) throw new Error('项目含重复 ID，请为各条目使用唯一 ID。');
  return project;
}

export type HighlightRange = { paragraphId: string; start: number; end: number; quote: string };
const normalizeTerm = (term: string) => term.trim().replace(/\s+/gu, ' ').toLowerCase();

function termMatches(source: string, term: string): { start: number; end: number }[] {
  const value = term.trim().replace(/\s+/gu, ' ');
  if (!value) return [];
  const pattern = new RegExp('(?<![\\p{L}\\p{N}\\p{M}_])' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/gu, '\\s+') + '(?![\\p{L}\\p{N}\\p{M}_])', 'giu');
  const matches: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    matches.push({ start: match.index, end: match.index + match[0].length });
    pattern.lastIndex = match.index + (source.codePointAt(match.index)! > 0xffff ? 2 : 1);
  }
  return matches;
}

function isWholeTermSelection(source: string, start: number, end: number): boolean {
  const selected = source.slice(start, end);
  const first = start + selected.length - selected.trimStart().length;
  const last = end - selected.length + selected.trimEnd().length;
  return termMatches(source, selected).some(match => match.start === first && match.end === last);
}

function addHighlightTerm(project: Project, selected: string): Project {
  const term = selected.trim();
  const normalized = normalizeTerm(term);
  if (!normalized || [...project.vocabulary, ...project.expressions].some(entry => entry.highlight.some(value => normalizeTerm(value) === normalized))) return project;
  const wordIndex = project.vocabulary.findIndex(entry => normalizeTerm(entry.word) === normalized);
  if (wordIndex !== -1) return { ...project, vocabulary: project.vocabulary.map((entry, index) => index === wordIndex ? { ...entry, highlight: [...entry.highlight, term] } : entry) };
  const phraseIndex = project.expressions.findIndex(entry => normalizeTerm(entry.phrase) === normalized);
  if (phraseIndex !== -1) return { ...project, expressions: project.expressions.map((entry, index) => index === phraseIndex ? { ...entry, highlight: [...entry.highlight, term] } : entry) };
  if (/\s/u.test(term)) return { ...project, expressions: [...project.expressions, { id: newId(), phrase: term, highlight: [term], senses: [emptySense()] }] };
  return { ...project, vocabulary: [...project.vocabulary, { id: newId(), word: term, ipa: '', highlight: [term], senses: [emptySense()] }] };
}

export function collectHighlights(project: Project): HighlightRange[] {
  const terms = new Set([...project.vocabulary, ...project.expressions].flatMap(entry => entry.highlight).filter(term => term.trim()));
  const result: HighlightRange[] = [];
  for (const paragraph of project.source.paragraphs) {
    const matches = [...terms].flatMap(term => termMatches(paragraph.text, term));
    matches.sort((left, right) => left.start - right.start || right.end - left.end);
    const merged: typeof matches = [];
    for (const match of matches) {
      const previous = merged.at(-1);
      if (previous && match.start < previous.end) previous.end = Math.max(previous.end, match.end);
      else merged.push({ ...match });
    }
    result.push(...merged.map(match => ({ paragraphId: paragraph.id, ...match, quote: paragraph.text.slice(match.start, match.end) })));
  }
  return result;
}

export const senseSourceId = (id: string, index: number, field: string) => index === 0 ? `${id}:${field}` : JSON.stringify([id, index, field]);

export function commitEntryHead(project: Project, key: EntryCollection, entryId: string, value: string): Project {
  const property = key === 'vocabulary' ? 'word' : 'phrase';
  let changed = false;
  const entries = project[key].map(entry => {
    const current = 'word' in entry ? entry.word : entry.phrase;
    if (entry.id !== entryId || current === value) return entry;
    const term = value.trim();
    const highlight = term && !entry.highlight.includes(value) ? variants.parse([...entry.highlight, value]) : entry.highlight;
    changed = true;
    return { ...entry, [property]: value, highlight };
  });
  return changed ? { ...project, [key]: entries } as Project : project;
}

export function removeEntrySense(project: Project, key: EntryCollection, id: string, index: number): Project {
  const entry = project[key].find(entry => entry.id === id);
  if (!entry || entry.senses.length <= 1 || index < 0 || index >= entry.senses.length) return project;
  return { ...project, [key]: project[key].map(item => item.id === id ? { ...item, senses: item.senses.filter((_, i) => i !== index) } : item) };
}

export function editParagraph(project: Project, paragraphId: string, next: string, key: 'source' | 'translation' = 'source'): Project {
  return { ...project, [key]: { paragraphs: project[key].paragraphs.map(item => item.id === paragraphId ? { ...item, text: next } : item) } };
}

export function toggleHighlight(project: Project, paragraphId: string, start: number, end: number): Project {
  if (end <= start) return project;
  const paragraph = project.source.paragraphs.find(item => item.id === paragraphId)!;
  let removed = false;
  function withoutSelectedRule<T extends { highlight: string[] }>(entry: T): T {
    const highlight = entry.highlight.filter(term => !termMatches(paragraph.text, term).some(match => match.start < end && match.end > start));
    if (highlight.length === entry.highlight.length) return entry;
    removed = true; return { ...entry, highlight };
  }
  const vocabulary = project.vocabulary.map(withoutSelectedRule), expressions = project.expressions.map(withoutSelectedRule);
  if (removed) return { ...project, vocabulary, expressions };
  return isWholeTermSelection(paragraph.text, start, end) ? addHighlightTerm(project, paragraph.text.slice(start, end)) : project;
}
