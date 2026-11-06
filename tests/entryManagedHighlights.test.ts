import { expect, it } from 'vitest';
import fixture from '../assets/projects/brainco/project.json';
import { collectHighlights, parseProject, toggleHighlight, editParagraph } from '../src/models/project';

function project(text = 'They ran and ran. They took off.') {
  return parseProject({ ...fixture, schemaVersion: 5, source: { paragraphs: [{ id: 'p', text }] }, vocabulary: [], expressions: [] });
}

it('stores manually selected surface forms in entries, with no top-level highlights', () => {
  let result = toggleHighlight(project(), 'p', 5, 8);
  expect(result.vocabulary[0]).toMatchObject({ word: 'ran', ipa: '', senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }], highlight: ['ran'] });
  expect(collectHighlights(result).map(mark => mark.quote)).toEqual(['ran', 'ran']);
  result = toggleHighlight(result, 'p', 23, 31);
  expect(result.expressions[0]).toMatchObject({ phrase: 'took off', highlight: ['took off'] });
  expect(result).not.toHaveProperty('highlights');
  expect(JSON.parse(JSON.stringify(result))).not.toHaveProperty('highlights');
  expect(parseProject(JSON.parse(JSON.stringify(result)))).toEqual(result);
});

it('cancels a variant everywhere, keeping collected entries and undoable immutable state', () => {
  const added = toggleHighlight(project(), 'p', 5, 8);
  const removed = toggleHighlight(added, 'p', 13, 16);
  expect(removed.vocabulary[0].word).toBe('ran');
  expect(removed.vocabulary[0].highlight).toEqual([]);
  expect(collectHighlights(removed)).toEqual([]);
  expect(added.vocabulary[0].highlight).toEqual(['ran']);
});

it('uses matching dictionary entries and cancels duplicate or overlapping rules across both lists', () => {
  const input = project('RUN run take off.');
  input.vocabulary = [{ id: 'v', word: 'run', ipa: '', senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }], highlight: [] }];
  const added = toggleHighlight(input, 'p', 0, 3);
  expect(added.vocabulary).toHaveLength(1); expect(added.vocabulary[0].highlight).toEqual(['RUN']);
  added.expressions = [{ id: 'x', phrase: 'take off', senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }], highlight: ['take off'] }];
  added.vocabulary.push({ id: 'off', word: 'off', ipa: '', senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }], highlight: ['off'] });
  const removed = toggleHighlight(added, 'p', 13, 16);
  expect(removed.expressions[0].highlight).toEqual([]);
  expect(removed.vocabulary[1].highlight).toEqual([]);
});

it('keeps explicit variants when article text changes', () => {
  const marked = toggleHighlight(project(), 'p', 23, 31);
  const edited = editParagraph(marked, 'p', 'They will take off.');
  expect(edited.expressions[0].highlight).toEqual(['took off']);
  expect(collectHighlights(edited)).toEqual([]);
});

it('rejects partial-word selections', () => {
  const input = project('runner run');
  expect(toggleHighlight(input, 'p', 0, 3)).toBe(input);
  const added = toggleHighlight(input, 'p', 0, 7);
  expect(added.vocabulary[0].highlight).toEqual(['runner']);
  expect(collectHighlights(added).map(mark => mark.quote)).toEqual(['runner']);
});
