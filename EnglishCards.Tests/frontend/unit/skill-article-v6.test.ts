import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseArticleV6 } from '@frontend/v6/article';

describe('Article v6 skill contract', () => {
  it('keeps the complete documented example compatible with the production parser', () => {
    const path = fileURLToPath(new URL('../../../docs/skills/article-to-englishcards/SKILL.md', import.meta.url));
    const skill = readFileSync(path, 'utf8');
    const section = skill.split('## 完整示例')[1];
    expect(section).toBeDefined();
    const source = section.match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
    expect(source).toBeDefined();
    const article = parseArticleV6(JSON.parse(source!));
    expect(article.schemaVersion).toBe(6);
    expect(article.vocabulary).toHaveLength(1);
    expect(article.content.paragraphs).toHaveLength(2);
  });
});
