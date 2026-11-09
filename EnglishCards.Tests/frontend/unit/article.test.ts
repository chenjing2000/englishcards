import assert from 'node:assert/strict';
import { test } from 'vitest';
import { addVocabulary, paragraphId, parseArticleV6, paragraphsFromText, vocabularyId } from '@frontend/v6/article.ts';
import { ArticleImportCoordinator } from '@frontend/v6/importers.ts';

const importer = new ArticleImportCoordinator();
const baseline = () => importer.import({ name: 'A title.txt', text: 'first\nline\n\nsecond paragraph' }).article;

test('plaintext title from filename; natural paragraph join, stable IDs', () => {
  const a = baseline();
  assert.equal(a.title, 'A title');
  assert.equal(a.identityTag, '');
  assert.deepEqual(a.content.paragraphs, [{ id: 'p001', text: 'first line' }, { id: 'p002', text: 'second paragraph' }]);
});
test('UTF-8 BOM, Windows and mixed line endings', () => {
  const got = importer.import({ name: 'Three.dots.here.txt', text: '\uFEFFalpha\r\nbeta\r\n\r\ngamma\n\n\ndelta' });
  assert.equal(got.article.title, 'Three.dots.here');
  assert.deepEqual(got.article.content.paragraphs.map(p => p.text), ['alpha beta', 'gamma', 'delta']);
});
test('v6 JSON is preferred even for .txt', () => {
  const input = { name: 'x.txt', text: JSON.stringify(baseline()) };
  assert.equal(importer.import(input).format, 'json');
});
test('bad v6 JSON never silently falls back', () => {
  const bad = { ...baseline(), schemaVersion: 5 };
  assert.throws(() => importer.import({ name: 'old.txt', text: JSON.stringify(bad) }), /只支持 6/);
  assert.throws(() => importer.import({ name: 'old.json', text: '{"schemaVersion":6,' }), /JSON 语法错误/);
  assert.throws(() => importer.import({ name: 'mislabeled.txt', text: '{broken' }), /JSON 语法错误/);
  assert.throws(() => importer.import({ name: 'broken.json', text: 'ordinary words' }), /JSON 语法错误/);
});
test('missing title, legacy fields and nonsequential IDs fail', () => {
  const a = baseline();
  assert.throws(() => parseArticleV6({ ...a, title: undefined }), /title/);
  assert.throws(() => parseArticleV6({ ...a, mainIdea: '' }), /mainIdea/);
  assert.throws(() => parseArticleV6({ ...a, content: { paragraphs: [{ id: 'p004', text: 'x' }] } }), /p001/);
});
test('paragraphs up to 999 in content and translation, independently numbered', () => {
  const paragraphs = paragraphsFromText(Array.from({ length: 999 }, (_, i) => `para${i}`).join('\n\n'));
  assert.equal(paragraphs.length, 999);
  assert.equal(paragraphs.at(-1)?.id, 'p999');
  const a = baseline();
  assert.equal(parseArticleV6({ ...a, content: { paragraphs }, translation: { paragraphs } }).translation.paragraphs.length, 999);
  assert.throws(() => paragraphsFromText(Array.from({ length: 1000 }, (_, i) => `para${i}`).join('\n\n')), /最多允许 999/);
});
test('vocabulary identifiers and deduplication', () => {
  assert.equal(paragraphId(1), 'p001');
  assert.equal(vocabularyId(999), 'v999');
  assert.throws(() => paragraphId(1000));
  const a = addVocabulary(baseline(), ' artificial intelligence ');
  assert.equal(a.vocabulary[0].id, 'v001');
  assert.equal(a.vocabulary[0].word, 'artificial intelligence');
  assert.strictEqual(addVocabulary(a, 'ARTIFICIAL   INTELLIGENCE'), a);
});
test('content and translation independently reject the 1000th paragraph', () => {
  const a = baseline();
  const tooMany = Array.from({ length: 1000 }, (_, i) => ({ id: `p${String(i + 1).padStart(3, '0')}`, text: `p${i}` }));
  assert.throws(() => parseArticleV6({ ...a, content: { paragraphs: tooMany } }), /最多允许 999/);
  assert.throws(() => parseArticleV6({ ...a, translation: { paragraphs: tooMany } }), /最多允许 999/);
});

test('selecting a duplicate vocabulary head reuses the entry without overwriting its senses', () => {
  const base = baseline();
  const existing = {
    id: 'v001', word: 'run', ipa: '/rʌn/', highlight: [],
    senses: [{ pos: 'v.', meaning: '跑', example: 'Run fast.', exampleTranslation: '快跑。' }],
  };
  const article = { ...base, vocabulary: [existing] };
  const updated = addVocabulary(article, 'RUN');
  assert.equal(updated.vocabulary.length, 1);
  assert.deepEqual(updated.vocabulary[0].highlight, []);
  assert.deepEqual(updated.vocabulary[0].senses, existing.senses);
});

test('blank input, unknown extensions are refused', () => {
  assert.throws(() => importer.import({ name: 'empty.txt', text: '  \r\n \r\n' }), /有效正文/);
  assert.throws(() => importer.import({ name: 'article.md', text: 'hello' }), /只支持/);
});

test('whole-text editor update rejects 1000 paragraphs without mutating article', async () => {
  const { replaceParagraphText } = await import('@frontend/v6/article.ts');
  const current = baseline();
  assert.throws(() => replaceParagraphText(current, 'content', Array.from({ length: 1000 }, () => 'x').join('\n\n')), /999/);
  assert.equal(current.content.paragraphs.length, 2);
  const changed = replaceParagraphText(current, 'translation', '第一段\n\n第二段');
  assert.equal(changed.translation.paragraphs[1].id, 'p002');
  assert.equal(changed.content.paragraphs.length, 2);
});
test('deletion canonicalizes vocabulary IDs; plain-text export retains paragraph separation', async () => {
  const { removeVocabulary, articleToPlainText } = await import('@frontend/v6/article.ts');
  const a = addVocabulary(addVocabulary(baseline(), 'sun'), 'moon');
  assert.equal(removeVocabulary(a, 'v001').vocabulary[0].id, 'v001');
  assert.equal(articleToPlainText(a), 'first line\n\nsecond paragraph');
});
test('vocabulary permits 999 items but refuses 1000', () => {
  let a = baseline();
  a = { ...a, vocabulary: Array.from({ length: 999 }, (_, i) => ({
    id: vocabularyId(i + 1), word: `word${i}`, ipa: '', highlight: [],
    senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }],
  })) };
  assert.equal(parseArticleV6(a).vocabulary.length, 999);
  assert.throws(() => addVocabulary(a, 'extra word'), /999/);
});
