import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import fixture from '../assets/projects/brainco/project.json';
import { collectHighlights, parseProject, editParagraph, toggleHighlight, defaults } from '../src/models/project';

describe('project persistence and entry highlights', () => {
  it('defaults missing personalized headers and preserves custom or empty values', () => {
    expect(parseProject(fixture).personalizedHeader).toBe('SOME BIRDS ON TREE');
    for (const personalizedHeader of ['My reading notes', '']) {
      const project = parseProject({ ...fixture, personalizedHeader });
      expect(project.personalizedHeader).toBe(personalizedHeader);
      expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    }
  });
  it('preserves both independent content snapshots', () => {
    const project = parseProject(fixture);
    expect(project.schemaVersion).toBe(5);
    for (const [key, filename] of [['source', 'article'], ['translation', 'translation']] as const) {
      const snapshot = readFileSync(`assets/projects/brainco/${filename}.md`, 'utf8').replace(/\r\n/g, '\n').trim();
      expect(project[key].paragraphs.map(item => item.text).join('\n\n')).toBe(snapshot);
      expect(project[key].paragraphs).toHaveLength(2);
    }
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
    expect(defaults.bodySize).toBe(34);
    expect(defaults.translationSize).toBe(32);
  });
  it('rejects bad versions, fields, IDs, ranges and unsafe styles', () => {
    expect(() => parseProject({ ...fixture, schemaVersion: 99 })).toThrow();
    expect(() => parseProject({ ...fixture, title: null })).toThrow();
    expect(() => parseProject({ ...fixture, vocabulary: [fixture.vocabulary[0], fixture.vocabulary[0]] })).toThrow();
    const project = parseProject(fixture);
    expect(() => parseProject({ ...project, styles: { ...defaults, bodySize: 10000 } })).toThrow();
    expect(() => parseProject({ ...project, highlights: [{ id: 'bad', paragraphId: 'en-1', start: 0, end: 3, quote: 'bad' }] })).toThrow();
  });
  it('marks and removes all occurrences through an entry rule', () => {
    let project = parseProject({ ...fixture, source: { paragraphs: [{ id: 'p', text: 'word word' }] } });
    project = toggleHighlight(project, 'p', 0, 4);
    expect(collectHighlights(project)).toHaveLength(2);
    project = toggleHighlight(project, 'p', 5, 9);
    expect(collectHighlights(project)).toEqual([]);
    expect(project.vocabulary.find(entry => entry.word === 'word')?.highlight).toEqual([]);
  });
  it('derives positions from current text without storing offsets', () => {
    let project = parseProject({ ...fixture, source: { paragraphs: [{ id: 'p', text: 'word word' }] } });
    project = toggleHighlight(project, 'p', 5, 9);
    project = editParagraph(project, 'p', 'new word word');
    expect(collectHighlights(project)).toMatchObject([{ start: 4, end: 8, quote: 'word' }, { start: 9, end: 13, quote: 'word' }]);
    project = editParagraph(project, 'p', 'new word changed');
    expect(collectHighlights(project)).toHaveLength(1);
    expect(project.vocabulary.find(entry => entry.word === 'word')?.highlight).toEqual(['word']);
  });
  it('round-trips maximum-length paragraph IDs including JSON escapes', () => {
    const paragraphId = '\u0001'.repeat(200);
    const project = parseProject({ ...fixture, source: { paragraphs: [{ id: paragraphId, text: 'Article' }] } });
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);

  });

});
