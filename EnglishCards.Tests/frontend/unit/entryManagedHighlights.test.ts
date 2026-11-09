import { expect, it } from 'vitest';
import fixture from '@fixtures/projects/brainco/project.json';
import { addVocabulary, collectHighlights, isValidVocabularySelection, parseProject, toggleHighlight, editParagraph, commitEntryHead } from '@frontend/models/project';

function article(text = 'They ran and ran. They took off.') {
  return parseProject({ ...fixture, content: { paragraphs: [{ id: 'p001', text }] }, vocabulary: [] });
}

it('stores manually selected surface forms in the unified vocabulary list', () => {
  let result = toggleHighlight(article(), 'p001', 5, 8);
  expect(result.vocabulary[0]).toMatchObject({
    id: 'v001', word: 'ran', ipa: '',
    senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }],
    highlight: ['ran'],
  });
  expect(collectHighlights(result).map(mark => mark.quote)).toEqual(['ran', 'ran']);
  result = toggleHighlight(result, 'p001', 23, 31);
  expect(result.vocabulary[1]).toMatchObject({ id: 'v002', word: 'took off', highlight: ['took off'] });
  expect(result).not.toHaveProperty('expressions');
  expect(result).not.toHaveProperty('highlights');
  expect(parseProject(JSON.parse(JSON.stringify(result)))).toEqual(result);
});

it('cancels a variant everywhere while retaining the vocabulary entry and immutable history', () => {
  const added = toggleHighlight(article(), 'p001', 5, 8);
  const removed = toggleHighlight(added, 'p001', 13, 16);
  expect(removed.vocabulary[0].word).toBe('ran');
  expect(removed.vocabulary[0].highlight).toEqual([]);
  expect(collectHighlights(removed)).toEqual([]);
  expect(added.vocabulary[0].highlight).toEqual(['ran']);
});

it('uses matching dictionary entries and cancels duplicate or overlapping rules in one collection', () => {
  const input = article('RUN run take off.');
  input.vocabulary = [{ id: 'v001', word: 'run', ipa: '', senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }], highlight: [] }];
  const added = toggleHighlight(input, 'p001', 0, 3);
  expect(added.vocabulary).toHaveLength(1);
  expect(added.vocabulary[0].highlight).toEqual(['RUN']);
  added.vocabulary.push({ id: 'v002', word: 'take off', senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }], highlight: ['take off'] });
  added.vocabulary.push({ id: 'v003', word: 'off', ipa: '', senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }], highlight: ['off'] });
  const removed = toggleHighlight(added, 'p001', 13, 16);
  expect(removed.vocabulary[1].highlight).toEqual([]);
  expect(removed.vocabulary[2].highlight).toEqual([]);
});

it('keeps explicit variants when article text changes', () => {
  const marked = toggleHighlight(article(), 'p001', 23, 31);
  const edited = editParagraph(marked, 'p001', 'They will take off.');
  expect(edited.vocabulary[0].highlight).toEqual(['took off']);
  expect(collectHighlights(edited)).toEqual([]);
});

it('replaces the old head highlight on rename while preserving independent variants', () => {
  const input = article('only for; solely for.');
  input.vocabulary = [{
    id: 'v001', word: 'only for', ipa: '', highlight: ['only for', 'solely for'],
    senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }],
  }];
  const renamed = commitEntryHead(input, 'vocabulary', 'v001', 'only');
  expect(renamed.vocabulary[0]).toMatchObject({ word: 'only', highlight: ['solely for', 'only'] });
  expect(collectHighlights(renamed).map(mark => mark.quote)).toEqual(['only', 'solely for']);
  expect(collectHighlights(input).map(mark => mark.quote)).toEqual(['only for', 'solely for']);
  const cleared = commitEntryHead(renamed, 'vocabulary', 'v001', '');
  expect(cleared.vocabulary[0].highlight).toEqual(['solely for']);
});

it('rejects partial-word selections', () => {
  const input = article('runner run');
  expect(toggleHighlight(input, 'p001', 0, 3)).toBe(input);
  const added = toggleHighlight(input, 'p001', 0, 7);
  expect(added.vocabulary[0].highlight).toEqual(['runner']);
  expect(collectHighlights(added).map(mark => mark.quote)).toEqual(['runner']);
});


it('accepts only complete English selections without Han characters', () => {
  const text = 'runner takes off 中文 words';
  expect(isValidVocabularySelection(text, 0, 6)).toBe(true);
  expect(isValidVocabularySelection(text, 7, 16)).toBe(true);
  expect(isValidVocabularySelection(text, 2, 5)).toBe(false);
  expect(isValidVocabularySelection(text, 17, 19)).toBe(false);
  expect(isValidVocabularySelection(text, 0, 19)).toBe(false);
  expect(isValidVocabularySelection(text, 20, 25)).toBe(true);
});

it('does not create a second vocabulary entry for an existing highlighted variant', () => {
  const input = article('run runs');
  input.vocabulary = [{
    id: 'v001', word: 'run', ipa: '', highlight: ['run', 'runs'],
    senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }],
  }];
  expect(addVocabulary(input, 'runs')).toBe(input);
  const added = addVocabulary(input, 'running');
  expect(added.vocabulary).toHaveLength(2);
  expect(added.vocabulary[1]).toMatchObject({ id: 'v002', word: 'running', highlight: ['running'] });
});
