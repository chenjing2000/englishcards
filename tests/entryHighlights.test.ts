import { expect, it } from 'vitest';
import fixture from '../assets/projects/brainco/project.json';
import { collectHighlights, parseProject, toggleHighlight } from '../src/models/project';
import { readProject } from '../src/services/projectIO';

function project(text: string, words: string[], phrases: string[] = []) {
  return parseProject({ ...fixture, schemaVersion: 5, source: { paragraphs: [{ id: 'p1', text }] }, vocabulary: [{ id: 'v1', word: 'run', highlight: words, senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }] }], expressions: [{ id: 'x1', phrase: 'take off', highlight: phrases, senses: [{ pos: '', meaning: '起飞', example: '', exampleTranslation: '' }] }] });
}

it('preserves variant lists and rejects invalid list types', () => {
  const input = project('Runs.', ['run', 'runs'], ['take off']);
  expect(parseProject(JSON.parse(JSON.stringify(input)))).toEqual(input);
  expect(() => parseProject({ ...input, vocabulary: [{ ...input.vocabulary[0], highlight: 'runs' }] })).toThrow();
  expect(() => parseProject({ ...input, expressions: [{ ...input.expressions[0], highlight: [1] }] })).toThrow();
});

it('matches only supplied whole-word variants, case-insensitively, with literal punctuation', () => {
  const input = project('RUN runs running runner outrun run2 x_run éRun run\u0301 C++ a.b axb.', ['run', 'runs', 'running', 'C++', 'a.b']);
  expect(collectHighlights(input).map(mark => mark.quote)).toEqual(['RUN', 'runs', 'running', 'C++', 'a.b']);
  expect(input).not.toHaveProperty('highlights');
});

it('matches phrase variants across whitespace, merges overlaps and keeps UTF-16 source offsets', () => {
  const input = project('😀 They took\n off. People bring people together. in in in', ['people', '  ', 'People'], ['took off', 'bring people together', 'in in']);
  const result = collectHighlights(input);
  expect(result.map(mark => mark.quote)).toEqual(['took\n off', 'People', 'bring people together', 'in in in']);
  for (const mark of result) expect(input.source.paragraphs[0].text.slice(mark.start, mark.end)).toBe(mark.quote);
  expect(result[0].start).toBe(8);
});

it('does not mutate rules or match phrases across paragraphs', () => {
  const input = project('take', [], ['take off']);
  input.source.paragraphs.push({ id: 'p2', text: 'off' });
  const copy = structuredClone(input);
  expect(collectHighlights(input)).toEqual([]);
  expect(input).toEqual(copy);
});

it('persists rule cancellation through JSON save, import and ordinary parsing', async () => {
  const imported = await readProject(new File([JSON.stringify(project('run run', ['run']))], 'article.json'));
  expect(collectHighlights(imported)).toHaveLength(2);
  const edited = toggleHighlight(imported, 'p1', 0, 3);
  expect(parseProject(JSON.parse(JSON.stringify(edited))).vocabulary[0].highlight).toEqual([]);
  const reimported = await readProject(new File([JSON.stringify(edited)], 'again.json'));
  expect(collectHighlights(reimported)).toHaveLength(0);
  expect(reimported).not.toHaveProperty('highlights');
});
