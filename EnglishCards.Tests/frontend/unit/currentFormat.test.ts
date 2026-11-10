import { expect, it } from 'vitest';
import fixture from '@fixtures/projects/brainco/project.json';
import { parseProject } from '@frontend/models/project';

it('accepts only Article schemaVersion 6 without migrating old files', () => {
  expect(parseProject(fixture).schemaVersion).toBe(6);
  for (const schemaVersion of [1, 2, 3, 4, 5, 99]) {
    expect(() => parseProject({ ...fixture, schemaVersion })).toThrow(/schemaVersion.*6/);
  }
});

it('rejects old fields and unknown top-level data instead of discarding them', () => {
  expect(() => parseProject({ ...fixture, highlights: [] })).toThrow();
  expect(() => parseProject({ ...fixture, hightlights: [] })).toThrow();
  expect(() => parseProject({ ...fixture, personalizedHeader: 'legacy' })).toThrow();
  expect(() => parseProject({ ...fixture, expressions: [] })).toThrow();
  expect(() => parseProject({ ...fixture, mainIdea: 'legacy' })).toThrow();
});

it('rejects removed manual layout fields even in current-version files', () => {
  expect(() => parseProject({ ...fixture, layoutOverrides: { manualPageBreaks: [], elementStyles: {} } })).toThrow();
});
