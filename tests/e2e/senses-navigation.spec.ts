import { test, expect } from './fixtures';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };
import { emptySense, parseProject } from '../../src/models/project';

test('distinct sense keys preserve navigation, removal history and export', async ({ page, request }) => {
  const input = parseProject(fixture);
  input.source.paragraphs = []; input.translation.paragraphs = []; input.mainIdea = '';
  input.vocabulary = [
    { id: 'va', word: 'first', ipa: '', highlight: [], senses: [emptySense()] },
    { id: 'vb', word: 'record', ipa: '', highlight: [], senses: [{ pos: 'v.', meaning: '录制', example: 'A distinct example.', exampleTranslation: '独立例句。' }, { ...emptySense(), pos: 'n.', meaning: '记录' }] },
  ];
  input.expressions = [
    { id: 'x', phrase: 'take off', highlight: [], senses: [{ ...emptySense(), meaning: 'meaning-one' }, { ...emptySense(), meaning: 'meaning-two' }] },
    { id: 'x:sense:1', phrase: 'another phrase', highlight: [], senses: [{ ...emptySense(), meaning: 'meaning-three' }] },
  ];
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'sense-keys.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const meanings = page.locator('.meaning .line-content');
  await expect(meanings).toHaveText(['meaning-one', 'meaning-two', 'meaning-three']);
  await page.locator('.vocab [data-edit]').filter({ hasText: 'A distinct example.' }).click();
  await expect(page.getByLabel('词汇例句 2 义项 1', { exact: true })).toBeFocused();
  await expect(page.getByLabel('词头 2', { exact: true })).toHaveValue('record');
  await meanings.filter({ hasText: 'meaning-two' }).click();
  await expect(page.getByLabel('含义 1 义项 2', { exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: /添加义项|删除.*义项/ })).toHaveCount(0);
  await page.locator('.vocab [data-edit]').filter({ hasText: 'A distinct example.' }).click();
  await page.getByRole('button', { name: '删除词汇 2 义项 1', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  let snapshot = await page.evaluate(() => window.editor);
  expect(snapshot.project.vocabulary[1].senses.map(sense => sense.meaning)).toEqual(['记录']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('含义 2 义项 2', { exact: true })).toHaveValue('n. 记录');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  snapshot = await page.evaluate(() => window.editor);
  const exported = await request.post('/api/export', { data: { ...snapshot, page: 1 } });
  expect(exported.ok(), exported.ok() ? '' : await exported.text()).toBe(true);
});
