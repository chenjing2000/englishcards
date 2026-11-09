import { expect, it } from 'vitest';
import fixture from '@fixtures/projects/brainco/project.json';
import { collectHighlights, parseProject, toggleHighlight } from '@frontend/models/project';
import { readProject } from '@frontend/services/projectIO';

function article(text: string, words: string[], phrases: string[] = []) {
  return parseProject({
    ...fixture,
    content: { paragraphs: [{ id: 'p001', text }] },
    vocabulary: [
      { id: 'v001', word: 'run', highlight: words, senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }] },
      ...(phrases.length ? [{ id: 'v002', word: 'take off', highlight: phrases, senses: [{ pos: '', meaning: '起飞', example: '', exampleTranslation: '' }] }] : []),
    ],
  });
}

it('preserves variant lists and rejects invalid list types', () => {
  const input = article('Runs.', ['run', 'runs'], ['take off']);
  expect(parseProject(JSON.parse(JSON.stringify(input)))).toEqual(input);
  expect(() => parseProject({ ...input, vocabulary: [{ ...input.vocabulary[0], highlight: 'runs' }] })).toThrow();
  expect(() => parseProject({ ...input, vocabulary: [{ ...input.vocabulary[0], highlight: [1] }] })).toThrow();
});

it('matches supplied whole-word variants, case-insensitively, with literal punctuation', () => {
  const input = article('RUN runs running runner outrun run2 x_run éRun run\u0301 C++ a.b axb.', ['run', 'runs', 'running', 'C++', 'a.b']);
  expect(collectHighlights(input).map(mark => mark.quote)).toEqual(['RUN', 'runs', 'running', 'C++', 'a.b']);
  expect(input).not.toHaveProperty('highlights');
});

it('matches phrase variants across whitespace and keeps UTF-16 source offsets', () => {
  const input = article('😀 They took\n off. People bring people together. in in in', ['people', '  ', 'People'], ['took off', 'bring people together', 'in in']);
  const result = collectHighlights(input);
  expect(result.map(mark => mark.quote)).toEqual(['took\n off', 'People', 'bring people together', 'in in']);
  for (const mark of result) expect(input.content.paragraphs[0].text.slice(mark.start, mark.end)).toBe(mark.quote);
  expect(result[0].start).toBe(8);
});

it('does not mutate rules or match phrases across paragraphs', () => {
  const input = article('take', [], ['take off']);
  input.content.paragraphs.push({ id: 'p002', text: 'off' });
  const copy = structuredClone(input);
  expect(collectHighlights(input)).toEqual([]);
  expect(input).toEqual(copy);
});

it('matches the dictionary headword even when highlight is empty', () => {
  const input = article('Study studies. A study group studies together.', []);
  input.vocabulary[0].word = 'study';
  input.vocabulary[0].highlight = [];
  expect(collectHighlights(input).map(mark => mark.quote)).toEqual(['Study', 'study']);
});

it('prefers the longest same-start phrase and never merges overlapping rules', () => {
  const input = article('only for demonstration.', ['only'], ['only for', 'for demonstration']);
  input.vocabulary[0].word = 'dictionary';
  input.vocabulary[0].highlight = ['only'];
  input.vocabulary[1].word = 'only for';
  input.vocabulary[1].highlight = ['for demonstration'];
  expect(collectHighlights(input).map(mark => mark.quote)).toEqual(['only for']);
});

it('persists rule cancellation through JSON save, import and ordinary parsing', async () => {
  const imported = await readProject(new File([JSON.stringify(article('run runs', ['runs']))], 'article.json'));
  expect(collectHighlights(imported).map(mark => mark.quote)).toEqual(['run', 'runs']);
  const edited = toggleHighlight(imported, 'p001', 4, 8);
  expect(parseProject(JSON.parse(JSON.stringify(edited))).vocabulary[0].highlight).toEqual([]);
  const reimported = await readProject(new File([JSON.stringify(edited)], 'again.json'));
  expect(collectHighlights(reimported).map(mark => mark.quote)).toEqual(['run']);
  expect(reimported).not.toHaveProperty('highlights');
});
