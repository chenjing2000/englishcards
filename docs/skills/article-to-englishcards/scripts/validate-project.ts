import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectHighlights, parseProject } from '../../../../src/models/project';

const files = process.argv.slice(2);
const skillPath = fileURLToPath(new URL('../SKILL.md', import.meta.url));
let failed = false;
for (const path of files.length ? files : [skillPath]) {
  try {
    const text = await readFile(path, 'utf8');
    const source = files.length ? text : text.match(/```json\r?\n([\s\S]*?)\r?\n```/)?.[1];
    if (!source) throw new Error('SKILL.md 中缺少完整 JSON 示例');
    const input = JSON.parse(source);
    if (input.schemaVersion !== 5) throw new Error('本 skill 生成文件必须使用 schemaVersion: 5');
    if ('highlights' in input || 'hightlights' in input) throw new Error('新格式禁止顶层 highlights/hightlights，请将原始变体归入各条目的 highlight 列表');
    for (const entry of [...(input.vocabulary ?? []), ...(input.expressions ?? [])]) {
      if (['pos', 'meaning', 'example', 'exampleTranslation'].some(field => field in entry)) throw new Error('schema 5 的词性、含义及例句必须放在 senses 中，不能位于条目顶层');
    }
    const project = parseProject(input);
    if (!files.length && project.personalizedHeader !== parseProject({ ...input, personalizedHeader: undefined }).personalizedHeader) throw new Error('示例默认页眉与程序不一致');
    console.log(`PASS ${path}: 原文 ${project.source.paragraphs.length} 段，译文 ${project.translation.paragraphs.length} 段，词汇 ${project.vocabulary.length} 项，表达 ${project.expressions.length} 项，高亮 ${collectHighlights(project).length} 处`);
  } catch (reason) {
    failed = true;
    console.error(`FAIL ${path}: ${reason instanceof Error ? reason.message : String(reason)}`);
  }
}
if (failed) process.exitCode = 1;
