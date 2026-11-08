import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArticleV6 } from '../../../EnglishCards/frontend/src/v6/article.ts';

const files = process.argv.slice(2);
const skillPath = fileURLToPath(new URL('../SKILL.md', import.meta.url));
let failed = false;
for (const path of files.length ? files : [skillPath]) {
  try {
    const text = await readFile(path, 'utf8');
    const source = files.length ? text : text.match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
    if (!source) throw new Error('SKILL.md 中缺少完整 Article v6 JSON 示例');
    const article = parseArticleV6(JSON.parse(source));
    console.log(`PASS ${path}: Article v${article.schemaVersion}，正文 ${article.content.paragraphs.length} 段，译文 ${article.translation.paragraphs.length} 段，Vocabulary ${article.vocabulary.length} 项`);
  } catch (reason) {
    failed = true;
    console.error(`FAIL ${path}: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
}
if (failed) process.exitCode = 1;
