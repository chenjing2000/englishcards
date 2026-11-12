import { expect, it } from 'vitest';
import fixture from '@fixtures/projects/brainco/project.json';
import { parseProject, collectHighlights, commitEntryHead, removeEntrySense, senseSourceId, splitSenseMeaning } from '@frontend/models/project';

it('round-trips unified vocabulary entries with multiple senses', () => {
  const article = parseProject(fixture);
  expect(article.schemaVersion).toBe(6);
  expect(article.vocabulary[0].senses[0]).toMatchObject(fixture.vocabulary[0].senses[0]);
  expect(article).not.toHaveProperty('expressions');
  expect(article.vocabulary[0]).not.toHaveProperty('pos');
  expect(parseProject(JSON.parse(JSON.stringify(article)))).toEqual(article);
});

it('splits a combined sense editor without mixing meanings or changing custom existing parts of speech', () => {
  expect(splitSenseMeaning('v. 恶化；变的不友好')).toEqual({ pos: 'v.', meaning: '恶化；变的不友好' });
  expect(splitSenseMeaning('adj. 酸的，有酸味的')).toEqual({ pos: 'adj.', meaning: '酸的，有酸味的' });
  expect(splitSenseMeaning('n./v. 记录')).toEqual({ pos: 'n./v.', meaning: '记录' });
  expect(splitSenseMeaning('只有含义')).toEqual({ pos: '', meaning: '只有含义' });
  expect(splitSenseMeaning('')).toEqual({ pos: '', meaning: '' });
  expect(splitSenseMeaning('n. / v. 记录', 'n. / v.')).toEqual({ pos: 'n. / v.', meaning: '记录' });
});

it('keeps distinct senses and their examples together and rejects missing sense lists', () => {
  const article = parseProject(fixture);
  const sense = { pos: 'n.', meaning: '记录', example: 'Keep a record.', exampleTranslation: '保留记录。' };
  const input = { ...article, vocabulary: [{ id: 'v001', word: 'record', ipa: '', highlight: ['recorded'], senses: [sense, { pos: 'v.', meaning: '录制', example: 'They recorded it.', exampleTranslation: '他们录制了它。' }] }] };
  expect(parseProject(input).vocabulary[0].senses).toEqual(input.vocabulary[0].senses);
  expect(() => parseProject({ ...input, vocabulary: [{ ...input.vocabulary[0], senses: undefined }] })).toThrow();
});

it('replaces the previous primary head highlight while committing a new surface form', () => {
  const input = parseProject({ ...fixture, content: { paragraphs: [{ id: 'p001', text: 'ran running run' }] }, vocabulary: [{ id: 'v001', word: '', highlight: [], senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }] }] });
  const first = commitEntryHead(input, 'v001', 'ran');
  expect(first.vocabulary[0]).toMatchObject({ word: 'ran', highlight: [] });
  const second = commitEntryHead(first, 'v001', 'running');
  expect(second.vocabulary[0].highlight).toEqual([]);
  expect(collectHighlights(second).map(mark => mark.quote)).toEqual(['running']);
  expect(input.vocabulary[0].word).toBe('');
  expect(commitEntryHead(second, 'v001', 'running')).toBe(second);
});

it('uses unambiguous sense source IDs even when entry IDs contain separators', () => {
  expect(senseSourceId('x', 1, 'meaning')).not.toBe(senseSourceId('x:sense:1', 0, 'meaning'));
  expect(senseSourceId('x', 1, 'meaning')).not.toBe(senseSourceId('x', 2, 'meaning'));
});

it('removes a sense without mutating the source and protects the final sense', () => {
  const article = parseProject(fixture);
  const entry = article.vocabulary[0];
  entry.senses.push({ pos: '', meaning: '另一含义', example: 'Another example.', exampleTranslation: '另一个例句。' });
  const result = removeEntrySense(article, entry.id, 0);
  expect(result.vocabulary[0].senses).toEqual([entry.senses[1]]);
  expect(article.vocabulary[0].senses).toHaveLength(2);
  expect(parseProject(JSON.parse(JSON.stringify(result)))).toEqual(result);
  expect(removeEntrySense(result, entry.id, 0)).toBe(result);
});
