import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { emptySense, parseProject, vocabularyId } from '@frontend/models/project';

test('unified vocabulary senses preserve navigation, deletion history, canonical IDs and export', async ({ page, request }) => {
  const article = parseProject(fixture);
  article.content.paragraphs = [];
  article.translation.paragraphs = [];
  article.vocabulary = [
    { id: 'v001', word: 'first', ipa: '', highlight: [], senses: [emptySense()] },
    { id: 'v002', word: 'record', ipa: '', highlight: [], senses: [
      { pos: 'v.', meaning: '录制', example: 'A distinct example.', exampleTranslation: '独立例句。' },
      { ...emptySense(), pos: 'n.', meaning: '记录' },
    ] },
    { id: 'v003', word: 'take off', highlight: [], senses: [
      { ...emptySense(), meaning: 'meaning-one' },
      { ...emptySense(), meaning: 'meaning-two' },
    ] },
    { id: 'v004', word: 'another phrase', highlight: [], senses: [{ ...emptySense(), meaning: 'meaning-three' }] },
  ];
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'sense-keys.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(article)),
  });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  // First senses use a compact ID; later senses use a JSON-encoded compound ID.
  // Match the semantic field name rather than assuming one ID serialization.
  const meanings = page.locator('.vocab [data-edit*="meaning"]');
  await expect(meanings).toHaveText(['录制', '记录', 'meaning-one', 'meaning-two', 'meaning-three']);
  await page.getByRole('region', { name: '分页预览' }).getByText('A distinct example.', { exact: true }).click();
  await expect(page.getByLabel('词汇例句 2 义项 1', { exact: true })).toBeFocused();
  await expect(page.getByLabel('词头 2', { exact: true })).toHaveValue('record');
  await meanings.filter({ hasText: '记录' }).click();
  await expect(page.getByLabel('含义 2 义项 2', { exact: true })).toBeFocused();

  await page.getByRole('region', { name: '分页预览' }).getByText('A distinct example.', { exact: true }).click();
  await page.getByRole('button', { name: '删除词汇 2 义项 1', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  let snapshot = await page.evaluate(() => window.editor);
  expect(snapshot.project.vocabulary[1].senses.map((sense: { meaning: string }) => sense.meaning)).toEqual(['记录']);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('含义 2 义项 2', { exact: true })).toHaveValue('n. 记录');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();

  snapshot = await page.evaluate(() => window.editor);
  const exported = await request.post('/api/export', { data: { ...snapshot, page: 1 } });
  expect(exported.ok(), exported.ok() ? '' : await exported.text()).toBe(true);
  const saved = await page.evaluate(() => window.editor.project);
  expect(saved.vocabulary.map((entry: { id: string }) => entry.id))
    .toEqual(saved.vocabulary.map((_: unknown, index: number) => vocabularyId(index + 1)));
});
