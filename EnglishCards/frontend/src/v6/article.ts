/** EnglishCards Article v6 — strictly validated, deliberately incompatible with v5. */
export const ARTICLE_VERSION = 6 as const;
export const MAX_PARAGRAPHS = 999;
export const MAX_VOCABULARY = 999;
export const PARAGRAPH_ID = /^p(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})$/;
export const VOCABULARY_ID = /^v(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2})$/;
export const MAX_TEXT_LENGTH = 300000;

export interface Paragraph { id: string; text: string }
export interface Sense { pos: string; meaning: string; example: string; exampleTranslation: string }
export interface VocabularyItem {
  id: string;
  word: string;
  ipa?: string;
  highlight: string[];
  senses: Sense[];
}
export interface Article {
  schemaVersion: 6;
  id: string;
  title: string;
  identityTag: string;
  vocabulary: VocabularyItem[];
  content: { paragraphs: Paragraph[] };
  translation: { paragraphs: Paragraph[] };
}

export class ArticleValidationError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.path = path;
    this.name = 'ArticleValidationError';
  }
}

function fail(path: string, message: string): never { throw new ArticleValidationError(path, message); }
function record(value: unknown, path: string, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, '必须为对象');
  const object = value as Record<string, unknown>;
  const allowed = new Set([...required, ...optional]);
  for (const key of required) if (!Object.hasOwn(object, key)) fail(`${path}.${key}`, '缺少必需字段');
  for (const key of Object.keys(object)) if (!allowed.has(key)) fail(`${path}.${key}`, '不支持的字段（旧格式不兼容）');
  return object;
}
function string(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, '必须为字符串');
  if (value.length > MAX_TEXT_LENGTH) fail(path, `文本超过 ${MAX_TEXT_LENGTH} 字符`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/u.test(value)) fail(path, '含非法控制字符或乱码替代符');
  return value;
}
function nonEmptyString(value: unknown, path: string): string {
  const result = string(value, path);
  if (!result.trim()) fail(path, '不能为空');
  return result;
}
function array(value: unknown, path: string, maximum: number): unknown[] {
  if (!Array.isArray(value)) fail(path, '必须为数组');
  if (value.length > maximum) fail(path, `最多允许 ${maximum} 项，当前 ${value.length} 项`);
  return value;
}
export function paragraphId(number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > MAX_PARAGRAPHS) {
    throw new RangeError('段落序号必须在 1–999 之间');
  }
  return `p${String(number).padStart(3, '0')}`;
}
export function vocabularyId(number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > MAX_VOCABULARY) {
    throw new RangeError('词条序号必须在 1–999 之间');
  }
  return `v${String(number).padStart(3, '0')}`;
}
function parseParagraphs(value: unknown, path: string): Paragraph[] {
  const source = record(value, path, ['paragraphs']);
  return array(source.paragraphs, `${path}.paragraphs`, MAX_PARAGRAPHS).map((entry, index) => {
    const at = `${path}.paragraphs[${index}]`;
    const item = record(entry, at, ['id', 'text']);
    if (item.id !== paragraphId(index + 1)) fail(`${at}.id`, `必须为 ${paragraphId(index + 1)}，段落需按当前顺序连续编号`);
    const value = nonEmptyString(item.text, `${at}.text`);
    return { id: item.id as string, text: value };
  });
}
function parseVocabulary(value: unknown): VocabularyItem[] {
  const entries = array(value, 'vocabulary', MAX_VOCABULARY);
  const words = new Set<string>();
  return entries.map((entry, index) => {
    const at = `vocabulary[${index}]`;
    const item = record(entry, at, ['id', 'word', 'highlight', 'senses'], ['ipa']);
    if (item.id !== vocabularyId(index + 1)) fail(`${at}.id`, `必须为 ${vocabularyId(index + 1)}`);
    const word = nonEmptyString(item.word, `${at}.word`);
    const normalized = normalizeVocabulary(word);
    if (words.has(normalized)) fail(`${at}.word`, `重复词条：${word}`);
    words.add(normalized);
    const highlight = array(item.highlight, `${at}.highlight`, 2000).map((v, i) => string(v, `${at}.highlight[${i}]`));
    const senses = array(item.senses, `${at}.senses`, 2000).map((sense, i) => {
      const where = `${at}.senses[${i}]`;
      const fields = record(sense, where, ['pos', 'meaning', 'example', 'exampleTranslation']);
      return {
        pos: string(fields.pos, `${where}.pos`), meaning: string(fields.meaning, `${where}.meaning`),
        example: string(fields.example, `${where}.example`),
        exampleTranslation: string(fields.exampleTranslation, `${where}.exampleTranslation`),
      };
    });
    if (!senses.length) fail(`${at}.senses`, '至少需要一个义项，可使用空义项');
    return {
      id: item.id as string, word,
      ...(item.ipa === undefined ? {} : { ipa: string(item.ipa, `${at}.ipa`) }),
      highlight, senses,
    };
  });
}
export function normalizeVocabulary(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
}
/** Does not fill missing fields, translate legacy formats, or silently remove unknown keys. */
export function parseArticleV6(input: unknown): Article {
  const value = record(input, 'article', ['schemaVersion', 'id', 'title', 'identityTag', 'content', 'vocabulary', 'translation']);
  if (value.schemaVersion !== ARTICLE_VERSION) fail('schemaVersion', `只支持 ${ARTICLE_VERSION}；不兼容旧格式`);
  const id = nonEmptyString(value.id, 'id');
  const title = string(value.title, 'title');
  const identityTag = string(value.identityTag, 'identityTag');
  return {
    schemaVersion: ARTICLE_VERSION, id, title, identityTag,
    content: { paragraphs: parseParagraphs(value.content, 'content') },
    vocabulary: parseVocabulary(value.vocabulary),
    translation: { paragraphs: parseParagraphs(value.translation, 'translation') },
  };
}

export function createEmptySense(): Sense {
  return { pos: '', meaning: '', example: '', exampleTranslation: '' };
}
export function addVocabulary(article: Article, selected: string): Article {
  const word = selected.trim().replace(/\s+/gu, ' ');
  if (!word) return article;
  const normalized = normalizeVocabulary(word);
  if (article.vocabulary.some(item => normalizeVocabulary(item.word) === normalized)) return article;
  if (article.vocabulary.length >= MAX_VOCABULARY) throw new ArticleValidationError('vocabulary', '最多允许 999 个词条');
  const next = { ...article, vocabulary: [...article.vocabulary, {
    id: vocabularyId(article.vocabulary.length + 1), word, ipa: '', highlight: [word], senses: [createEmptySense()],
  }] };
  return parseArticleV6(next);
}

/** Allows index-based identifiers and rejects attempts to exceed the documented cap. */
export function paragraphsFromText(text: string): Paragraph[] {
  const normalized = text.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n').trim();
  if (!normalized) return [];
  const contents = normalized.split(/\n[\t ]*\n(?:[\t ]*\n)*/u)
    .map(part => part.split('\n').map(line => line.trim()).filter(Boolean).join(' ').trim())
    .filter(Boolean);
  if (contents.length > MAX_PARAGRAPHS) throw new ArticleValidationError('content.paragraphs', `最多允许 999 段，当前 ${contents.length} 段`);
  return contents.map((part, index) => ({ id: paragraphId(index + 1), text: part }));
}

/** Re-number a paragraph collection after a whole-text edit, with a single validation boundary. */
export function replaceParagraphText(article: Article, section: 'content' | 'translation', fullText: string): Article {
  const paragraphs = paragraphsFromText(fullText);
  return parseArticleV6({ ...article, [section]: { paragraphs } });
}

/** Deleting a vocabulary entry re-numbers the remainder to keep v001..vNNN canonical. */
export function removeVocabulary(article: Article, id: string): Article {
  if (!article.vocabulary.some(entry => entry.id === id)) return article;
  return parseArticleV6({ ...article, vocabulary: article.vocabulary
    .filter(entry => entry.id !== id)
    .map((entry, index) => ({ ...entry, id: vocabularyId(index + 1) })) });
}

/** Plain text export is article body only, with one blank line between natural paragraphs. */
export function articleToPlainText(article: Article): string {
  return parseArticleV6(article).content.paragraphs.map(item => item.text).join('\n\n');
}
