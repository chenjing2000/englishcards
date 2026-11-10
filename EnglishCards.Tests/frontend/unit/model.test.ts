import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import fixture from '@fixtures/projects/brainco/project.json';
import { collectHighlights, parseProject, editParagraph, toggleHighlight, defaults } from '@frontend/models/project';

describe('Article v6 persistence and vocabulary highlights', () => {
  it('requires identityTag and preserves custom or empty values', () => {
    expect(parseProject(fixture).identityTag).toBe('SOME BIRDS ON TREE');
    for (const identityTag of ['My reading notes', '']) {
      const article = parseProject({ ...fixture, identityTag });
      expect(article.identityTag).toBe(identityTag);
      expect(parseProject(JSON.parse(JSON.stringify(article)))).toEqual(article);
    }
    expect(() => parseProject({ ...fixture, personalizedHeader: 'legacy' })).toThrow();
  });

  it('preserves independent content and translation paragraph collections', () => {
    const article = parseProject(fixture);
    expect(article.schemaVersion).toBe(6);
    for (const [key, filename] of [['content', 'article'], ['translation', 'translation']] as const) {
      const snapshot = readFileSync(
        new URL(`../../../EnglishCards/frontend/assets/projects/brainco/${filename}.md`, import.meta.url),
        'utf8'
      ).replace(/\r\n/g, '\n').trim();
      expect(article[key].paragraphs.map(item => item.text).join('\n\n')).toBe(snapshot);
      expect(article[key].paragraphs).toHaveLength(2);
      expect(article[key].paragraphs.map(item => item.id)).toEqual(['p001', 'p002']);
    }
    expect(parseProject(JSON.parse(JSON.stringify(article)))).toEqual(article);
    expect(defaults.bodySize).toBe(34);
    expect(defaults.translationSize).toBe(32);
  });

  it('rejects legacy fields, duplicate vocabulary, bad IDs and invalid styles', () => {
    expect(() => parseProject({ ...fixture, schemaVersion: 5 })).toThrow();
    expect(() => parseProject({ ...fixture, title: null })).toThrow();
    expect(() => parseProject({ ...fixture, vocabulary: [fixture.vocabulary[0], { ...fixture.vocabulary[0], id: 'v002' }] })).toThrow();
    expect(() => parseProject({ ...fixture, mainIdea: '' })).toThrow();
    expect(() => parseProject({ ...fixture, content: { paragraphs: [{ id: 'p01', text: 'bad id' }] } })).toThrow();
    expect(() => parseProject({ ...fixture, styles: { ...defaults, bodySize: 10000 } })).toThrow();
    expect(() => parseProject({ ...fixture, highlights: [{ id: 'bad', paragraphId: 'p001', start: 0, end: 3, quote: 'bad' }] })).toThrow();
  });

  it('adds and removes an explicit variant while keeping the dictionary headword highlighted', () => {
    let article = parseProject({
      ...fixture,
      content: { paragraphs: [{ id: 'p001', text: 'word words' }] },
      vocabulary: [{
        id: 'v001', word: 'word', highlight: ['words'],
        senses: [{ pos: '', meaning: '', example: '', exampleTranslation: '' }],
      }],
    });
    expect(collectHighlights(article).map(mark => mark.quote)).toEqual(['word', 'words']);
    article = toggleHighlight(article, 'p001', 5, 10);
    expect(collectHighlights(article).map(mark => mark.quote)).toEqual(['word']);
    expect(article.vocabulary[0].highlight).toEqual([]);
  });

  it('derives highlight positions from current content without storing offsets', () => {
    let article = parseProject({ ...fixture, content: { paragraphs: [{ id: 'p001', text: 'word word' }] }, vocabulary: [] });
    article = toggleHighlight(article, 'p001', 5, 9);
    article = editParagraph(article, 'p001', 'new word word');
    expect(collectHighlights(article)).toMatchObject([{ start: 4, end: 8, quote: 'word' }, { start: 9, end: 13, quote: 'word' }]);
    article = editParagraph(article, 'p001', 'new word changed');
    expect(collectHighlights(article)).toHaveLength(1);
    expect(article.vocabulary.find(entry => entry.word === 'word')?.highlight).toEqual([]);
  });
});
