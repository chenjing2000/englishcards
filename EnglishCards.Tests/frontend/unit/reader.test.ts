import { describe, expect, it } from 'vitest';
import { parseScript, parseVocabulary, parseTranslation, readerBlocks } from '@frontend/models/reader';
import { defaults } from '@frontend/models/settings';

const script = { filetype: 'script', title: '', paragraphs: [[
  { text: 'Exact  source wording.', timed_units: [['WRONG', null, null]] },
  { text: 'Next sentence.', timed_units: [] },
], [{ text: 'Final paragraph.' }]] };

describe('A1 native readonly input', () => {
  it('uses sentence text, keeps paragraph and sentence identity, tolerates absent timing', () => {
    const parsed = parseScript(script);
    expect(parsed.paragraphs[0][0].timed_units).toEqual([['WRONG', null, null]]);
    const blocks = readerBlocks({ script: parsed, styles: defaults });
    expect(blocks.map(block => block.text)).toEqual(['Exact  source wording. Next sentence.', 'Final paragraph.']);
    expect(blocks[0].sentences).toEqual([{ start: 0, end: 22, index: 0 }, { start: 23, end: 37, index: 1 }]);
    expect(blocks[0].indent).toBe(true);
  });
  it('rejects Article and missing title rather than converting or borrowing a filename', () => {
    expect(() => parseScript({ schemaVersion: 6, title: 'Article' })).toThrow();
    expect(() => parseScript({ filetype: 'script', paragraphs: script.paragraphs })).toThrow();
  });
  it('preserves invalid timing data without replacing or deriving text', () => {
    const parsed = parseScript({ ...script, paragraphs: [[{ text: 'Readable.', timed_units: [['bad', -4, 2], ['half', null, 1]] }]] });
    expect(parsed.paragraphs[0][0].timed_units).toEqual([['bad', -4, 2], ['half', null, 1]]);
    expect(readerBlocks({ script: parsed, styles: defaults })[0].text).toBe('Readable.');
  });
  it('uses native optional vocabulary and pure multiline translation in reading order', () => {
    const vocabulary = parseVocabulary({ filetype: 'vocabulary', words: [{ word: 'go', family: ['went'], phonetic_uk: '/ɡəʊ/', phonetic_us: '/ɡoʊ/', meanings: [{ pos: 'v.', meaning: '去' }] }] });
    const translation = parseTranslation({ filetype: 'translation', text: '第一行\n第二行\n\n另一段' });
    const blocks = readerBlocks({ script: parseScript({ ...script, title: 'Title' }), vocabulary, translation, styles: defaults });
    expect(blocks.map(block => block.kind)).toEqual(['title', 'article', 'article', 'vocab-heading', 'vocab', 'section-heading', 'translation']);
    expect(blocks.at(-1)?.text).toBe(translation.text);
    expect(blocks.find(block => block.kind === 'vocab')?.text).toContain('/ɡəʊ/');
    expect(blocks.find(block => block.kind === 'vocab')?.text).toContain('/ɡoʊ/');
  });
  it('rejects malformed optional companion structure', () => {
    expect(() => parseVocabulary({ filetype: 'vocabulary', words: [{ word: 'x', family: null }] })).toThrow();
    expect(() => parseTranslation({ filetype: 'translation', text: ['wrong'] })).toThrow();
  });
});


import { readScriptFiles } from '@frontend/services/readerIO';

describe('A3 companion identity and settings', () => {
  const base = { path: 'C:/books/lesson.script.json',
    text: JSON.stringify({ filetype: 'script', title: '', paragraphs: [[{ text: 'One sentence.' }]] }),
    notices: [] };
  it('keeps exact active Vocabulary source and original contents for safe updates', () => {
    const raw = JSON.stringify({ filetype: 'vocabulary', words: [] });
    const opened = readScriptFiles({ ...base, vocabulary: { path: 'C:/books/active.json', text: raw } });
    expect(opened.vocabularyPath).toBe('C:/books/active.json');
    expect(opened.vocabularyText).toBe(raw);
    expect(opened.document.vocabulary?.words).toEqual([]);
    expect(opened.settingsText).toBe(null);
  });
  it('does not invent a Vocabulary on open', () => {
    const opened = readScriptFiles(base);
    expect(opened.vocabularyPath).toBe(null);
    expect(opened.document.vocabulary).toBeUndefined();
  });
  it('loads valid settings without changing Script data', () => {
    const opened = readScriptFiles({ ...base, settingsText: JSON.stringify({ bodySize: 39 }) });
    expect(opened.settingsValid).toBe(true);
    expect(opened.document.styles.bodySize).toBe(39);
    expect(opened.document.script.paragraphs[0][0].text).toBe('One sentence.');
  });
  it('preserves corrupt settings source, warns and refuses it as valid', () => {
    const opened = readScriptFiles({ ...base, settingsText: '{invalid' });
    expect(opened.settingsValid).toBe(false);
    expect(opened.settingsText).toBe('{invalid');
    expect(opened.document.styles).toEqual(defaults);
    expect(opened.notices.join(' ')).toContain('设置文件无效');
  });
});
