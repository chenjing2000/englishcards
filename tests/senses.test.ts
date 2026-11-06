import { expect, it } from 'vitest';
import fixture from '../assets/projects/brainco/project.json';
import { parseProject, collectHighlights, commitEntryHead, removeEntrySense, senseSourceId, splitSenseMeaning } from '../src/models/project';

it('round-trips schema 3 without scalar entry fields', () => {
  const project = parseProject(fixture);
  expect(project.schemaVersion).toBe(5);
  expect(project.vocabulary[0].senses[0]).toMatchObject(fixture.vocabulary[0].senses[0]);
  expect(project.expressions[0].senses[0]).toMatchObject(fixture.expressions[0].senses[0]);
  expect(project.vocabulary[0]).not.toHaveProperty('pos');
  expect(project.expressions[0]).not.toHaveProperty('example');
  expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
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
  const project = parseProject(fixture);
  const sense = { pos: 'n.', meaning: '记录', example: 'Keep a record.', exampleTranslation: '保留记录。' };
  const input = { ...project, schemaVersion: 5, vocabulary: [{ id: 'v', word: 'record', ipa: '', highlight: ['recorded'], senses: [sense, { pos: 'v.', meaning: '录制', example: 'They recorded it.', exampleTranslation: '他们录制了它。' }] }] };
  expect(parseProject(input).vocabulary[0].senses).toEqual(input.vocabulary[0].senses);
  expect(() => parseProject({ ...input, vocabulary: [{ ...input.vocabulary[0], senses: undefined }] })).toThrow();
});

it('commits manual surface forms to the head and rule list without mutating old variants', () => {
  const input = parseProject({ ...fixture, source: { paragraphs: [{ id: 'p', text: 'ran running run' }] }, vocabulary: [{ id: 'v', word: '', highlight: [], senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }] }] });
  const first = commitEntryHead(input, 'vocabulary', 'v', 'ran');
  expect(first.vocabulary[0]).toMatchObject({ word: 'ran', highlight: ['ran'] });
  const second = commitEntryHead(first, 'vocabulary', 'v', 'running');
  expect(second.vocabulary[0].highlight).toEqual(['ran', 'running']);
  expect(collectHighlights(second).map(mark => mark.quote)).toEqual(['ran', 'running']);
  expect(input.vocabulary[0].highlight).toEqual([]);
  expect(commitEntryHead(second, 'vocabulary', 'v', 'running')).toBe(second);
  const spaced = commitEntryHead(second, 'vocabulary', 'v', '  ran  ');
  expect(spaced.vocabulary[0].highlight).toEqual(['ran', 'running', '  ran  ']);
});

it('uses unambiguous sense source IDs even when entry IDs contain separators', () => {
  expect(senseSourceId('x', 1, 'meaning')).not.toBe(senseSourceId('x:sense:1', 0, 'meaning'));
  expect(senseSourceId('x', 1, 'meaning')).not.toBe(senseSourceId('x', 2, 'meaning'));
});

it('removes a sense without mutating the source and protects the final sense', () => {
  const input = parseProject(fixture);
  const entry = input.expressions[0];
  entry.senses.push({ pos: '', meaning: '另一含义', example: 'Another example.', exampleTranslation: '另一个例句。' });
  const result = removeEntrySense(input, 'expressions', entry.id, 0);
  expect(result.expressions[0].senses).toEqual([entry.senses[1]]);
  expect(input.expressions[0].senses).toHaveLength(2);
  expect(parseProject(JSON.parse(JSON.stringify(result)))).toEqual(result);
  expect(removeEntrySense(result, 'expressions', entry.id, 0)).toBe(result);
});
