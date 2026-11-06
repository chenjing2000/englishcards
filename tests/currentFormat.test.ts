import { expect, it } from 'vitest';
import fixture from '../assets/projects/brainco/project.json';
import { parseProject } from '../src/models/project';

it('accepts only schema 5 without migrating old files', () => {
  expect(parseProject(fixture).schemaVersion).toBe(5);
  for (const schemaVersion of [1, 2, 3, 4, 99]) expect(() => parseProject({ ...fixture, schemaVersion })).toThrow(/schemaVersion.*5/);
});

it('rejects old highlight tables and scalar entry fields instead of discarding them', () => {
  expect(() => parseProject({ ...fixture, highlights: [] })).toThrow();
  expect(() => parseProject({ ...fixture, hightlights: [] })).toThrow();
  expect(() => parseProject({ ...fixture, vocabulary: [{ ...fixture.vocabulary[0], pos: 'n.', meaning: '旧释义' }] })).toThrow();
  expect(() => parseProject({ ...fixture, expressions: [{ ...fixture.expressions[0], meaning: '旧释义', example: 'Old example.' }] })).toThrow();
});

it('rejects removed manual layout fields even in current-version files', () => {
  expect(() => parseProject({ ...fixture, layoutOverrides: { manualPageBreaks: [], elementStyles: {} } })).toThrow();
});
