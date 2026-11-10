import { defaults, settingsSchema, type Styles } from './settings';
import {
  ARTICLE_VERSION, MAX_PARAGRAPHS, MAX_VOCABULARY, ArticleValidationError,
  addVocabulary as addArticleVocabulary, articleToPlainText, createEmptySense,
  normalizeVocabulary, paragraphId, parseArticleV6, paragraphsFromText,
  removeVocabulary as removeArticleVocabulary, replaceParagraphText,
  vocabularyId, type Article, type Paragraph, type Sense, type VocabularyItem,
} from '../v6/article';

export {
  defaults, settingsSchema as styleSchema, type Styles,
  ARTICLE_VERSION, MAX_PARAGRAPHS, MAX_VOCABULARY,
  ArticleValidationError, articleToPlainText, createEmptySense,
  normalizeVocabulary, paragraphId, parseArticleV6, paragraphsFromText,
  vocabularyId,
};
export type { Article, Paragraph, Sense, VocabularyItem };
export type Project = Article;
export type RenderProject = Article & { styles: Styles };
export type EntryCollection = 'vocabulary';

export const emptySense = createEmptySense;
export const newId = () => crypto.randomUUID();
export const layoutKey = (kind: string, sourceId: string) => JSON.stringify([kind, sourceId]);
export const senseSourceId = (id: string, index: number, field: string) =>
  index === 0 ? `${id}:${field}` : JSON.stringify([id, index, field]);

export function projectDocument(input: Article | RenderProject): Article {
  const { styles: _runtimeStyles, ...document } = input as RenderProject;
  return parseArticleV6(document);
}

export function parseProject(input: unknown): Article {
  return parseArticleV6(input);
}

export function parseRenderProject(input: unknown): RenderProject {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ArticleValidationError('article', '必须为对象');
  }
  const { styles, ...document } = input as Record<string, unknown>;
  return { ...parseArticleV6(document), styles: settingsSchema.parse(styles ?? defaults) };
}

export function createEmptyArticle(title = ''): Article {
  return parseArticleV6({
    schemaVersion: ARTICLE_VERSION,
    id: newId(),
    title,
    identityTag: '',
    vocabulary: [],
    content: { paragraphs: [] },
    translation: { paragraphs: [] },
  });
}

export function splitSenseMeaning(value: string, previousPos = ''): Pick<Sense, 'pos' | 'meaning'> {
  if (previousPos && value.startsWith(`${previousPos} `)) {
    return { pos: previousPos, meaning: value.slice(previousPos.length + 1) };
  }
  if (previousPos && value === previousPos) return { pos: previousPos, meaning: '' };
  const match = /^([A-Za-z][A-Za-z./&-]*\.)(?:\s([\s\S]*))?$/u.exec(value);
  return match ? { pos: match[1], meaning: match[2] ?? '' } : { pos: '', meaning: value };
}

export type HighlightRange = { paragraphId: string; start: number; end: number; quote: string };

const normalizeTerm = (term: string) => term.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
/** Parse the semicolon-separated editor value into independent, de-duplicated rules. */
export function parseHighlightInput(value: string, word = ''): string[] {
  const seen = new Set<string>();
  const primary = normalizeTerm(word);
  if (primary) seen.add(primary);
  const result: string[] = [];
  for (const part of value.split(';')) {
    const term = part.normalize('NFC').trim().replace(/\s+/gu, ' ');
    const key = normalizeTerm(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(term);
  }
  return result;
}

/** Format stored rules for editing, omitting rules already represented by the word field. */
export function formatHighlightInput(highlight: string[], word = ''): string {
  return parseHighlightInput(highlight.join(';'), word).join('; ');
}


function termMatches(source: string, term: string): { start: number; end: number }[] {
  const value = term.trim().replace(/\s+/gu, ' ');
  if (!value) return [];
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/gu, '\\s+');
  const pattern = new RegExp('(?<![\\p{L}\\p{N}\\p{M}_])' + escaped + '(?![\\p{L}\\p{N}\\p{M}_])', 'giu');
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

/** A preview selection must be a complete English word/phrase with no Han characters. */
export function isValidVocabularySelection(source: string, start: number, end: number): boolean {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > source.length) return false;
  const selected = source.slice(start, end);
  return /[A-Za-z]/u.test(selected) && !/\p{Script=Han}/u.test(selected)
    && isWholeTermSelection(source, start, end);
}

export function renumberVocabulary(entries: VocabularyItem[]): VocabularyItem[] {
  if (entries.length > MAX_VOCABULARY) {
    throw new ArticleValidationError('vocabulary', '最多允许 999 个词条');
  }
  return entries.map((entry, index) => ({ ...entry, id: vocabularyId(index + 1) }));
}

export function addVocabulary(article: Article, selected: string): Article {
  return addArticleVocabulary(article, selected);
}

export function commitEntryHead(article: Article, _key: EntryCollection, entryId: string, value: string): Article {
  const entry = article.vocabulary.find(item => item.id === entryId);
  if (!entry || entry.word === value) return article;
  const normalized = normalizeVocabulary(value);
  if (normalized && article.vocabulary.some(item => item.id !== entryId && normalizeVocabulary(item.word) === normalized)) {
    throw new ArticleValidationError('vocabulary.word', `重复词条：${value}`);
  }
  const previousHead = normalizeTerm(entry.word);
  const next = article.vocabulary.map(item => {
    if (item.id !== entryId) return item;
    // Word is a primary rule by itself; remove redundant copies of the old or new head.
    // All other explicitly managed variants remain independent.
    const highlight = item.highlight.filter(term => {
      const key = normalizeTerm(term);
      return key !== previousHead && key !== normalized;
    });
    return { ...item, word: value, highlight };
  });
  return { ...article, vocabulary: renumberVocabulary(next) };
}

export function removeEntrySense(article: Article, _key: EntryCollection, id: string, index: number): Article {
  const entry = article.vocabulary.find(item => item.id === id);
  if (!entry || entry.senses.length <= 1 || index < 0 || index >= entry.senses.length) return article;
  return {
    ...article,
    vocabulary: article.vocabulary.map(item => item.id === id
      ? { ...item, senses: item.senses.filter((_, senseIndex) => senseIndex !== index) }
      : item),
  };
}

export function editParagraph(article: Article, paragraphIdValue: string, next: string, key: 'content' | 'translation' = 'content'): Article {
  const collection = article[key].paragraphs;
  if (!collection.some(item => item.id === paragraphIdValue)) return article;
  const paragraphs = collection.map(item => item.id === paragraphIdValue ? { ...item, text: next } : item);
  return key === 'content'
    ? { ...article, content: { paragraphs } }
    : { ...article, translation: { paragraphs } };
}

export function appendParagraph(article: Article, key: 'content' | 'translation'): Article {
  const paragraphs = article[key].paragraphs;
  if (paragraphs.length >= MAX_PARAGRAPHS) {
    throw new ArticleValidationError(`${key}.paragraphs`, '最多允许 999 个自然段落');
  }
  const next = [...paragraphs, { id: paragraphId(paragraphs.length + 1), text: '' }];
  return key === 'content'
    ? { ...article, content: { paragraphs: next } }
    : { ...article, translation: { paragraphs: next } };
}

export function setArticleText(article: Article, key: 'title' | 'identityTag', value: string): Article {
  return key === 'title' ? { ...article, title: value } : { ...article, identityTag: value };
}

export function toggleHighlight(article: Article, paragraphIdValue: string, start: number, end: number): Article {
  if (end <= start) return article;
  const paragraph = article.content.paragraphs.find(item => item.id === paragraphIdValue);
  if (!paragraph) return article;

  let removed = false;
  const vocabulary = article.vocabulary.map(entry => {
    const highlight = entry.highlight.filter(term => {
      const overlaps = termMatches(paragraph.text, term).some(match => match.start < end && match.end > start);
      if (overlaps) removed = true;
      return !overlaps;
    });
    return highlight.length === entry.highlight.length ? entry : { ...entry, highlight };
  });
  if (removed) return { ...article, vocabulary };

  if (!isValidVocabularySelection(paragraph.text, start, end)) return article;
  return addVocabulary(article, paragraph.text.slice(start, end));
}

export function collectHighlights(article: Article): HighlightRange[] {
  // Dictionary headwords and user-supplied variants are equal, independent match rules.
  const terms = new Map<string, string>();
  for (const entry of article.vocabulary) {
    for (const term of [entry.word, ...entry.highlight]) {
      const value = term.trim().replace(/\s+/gu, ' ');
      const key = normalizeTerm(value);
      if (key && !terms.has(key)) terms.set(key, value);
    }
  }

  const result: HighlightRange[] = [];
  for (const paragraph of article.content.paragraphs) {
    const matches = [...terms.values()].flatMap(term => termMatches(paragraph.text, term));
    // Leftmost match wins; when two rules start together, the longer phrase wins.
    matches.sort((left, right) => left.start - right.start || right.end - left.end);
    let occupiedUntil = -1;
    for (const match of matches) {
      if (match.start < occupiedUntil) continue;
      result.push({
        paragraphId: paragraph.id, ...match, quote: paragraph.text.slice(match.start, match.end),
      });
      occupiedUntil = match.end;
    }
  }
  return result;
}

export function replaceArticleParagraphs(article: Article, section: 'content' | 'translation', fullText: string): Article {
  return replaceParagraphText(article, section, fullText);
}

export function removeVocabulary(article: Article, id: string): Article {
  return removeArticleVocabulary(article, id);
}

