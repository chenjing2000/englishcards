import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { selectPreviewText } from './preview-selection';

test('unified vocabulary entries retain variants, paired senses and automatic highlight updates', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const input = {
    ...fixture,
    content: { paragraphs: [{ id: 'p001', text: 'ran run. A record was recorded. They took off and take off.' }] },
    vocabulary: [
      { id: 'v001', word: 'run', ipa: '', highlight: ['ran'], senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }] },
      { id: 'v002', word: 'take off', highlight: ['take off', 'took off'], senses: [
        { pos: '', meaning: '起飞', example: '', exampleTranslation: '' },
        { pos: '', meaning: '迅速走红', example: 'Her career took off.', exampleTranslation: '她的事业腾飞了。' },
      ] },
    ],
  };
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'senses.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
  });
  const marks = page.locator('.article .hot');
  await expect(marks).toHaveText(['ran', 'run', 'took off', 'take off']);
  
  const add = page.getByRole('button', { name: '在选中词汇下方添加空白行', exact: true });
  await expect(page.getByRole('button', { name: '刷新词汇高亮', exact: true })).toHaveCount(0);
  await expect(marks).toHaveText(['ran', 'took off', 'take off']);

  await add.click();
  await page.getByLabel('词头 2', { exact: true }).fill('record');
  await page.getByLabel('含义 2', { exact: true }).fill('n. 记录');
  await page.getByLabel('词汇例句 2 义项 1', { exact: true }).fill('Keep a record.');
  await page.getByLabel('词汇翻译 2 义项 1', { exact: true }).fill('保留记录。');
  await page.getByRole('button', { name: '为词汇 2 添加义项', exact: true }).click();
  await page.getByLabel('含义 2 义项 2', { exact: true }).fill('v. 录制');
  await page.getByLabel('词汇例句 2 义项 2', { exact: true }).fill('They recorded it.');
  await page.getByLabel('词汇翻译 2 义项 2', { exact: true }).fill('他们录制了它。');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(marks).toHaveText(['ran', 'run', 'record', 'took off', 'take off']);
  await expect(page.getByLabel('信息提示栏')).toHaveText('');

  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const saved = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(saved.schemaVersion).toBe(6);
  expect(saved.vocabulary[1].id).toBe('v002');
  expect(saved.vocabulary[1].highlight).toEqual([]);
  expect(saved.vocabulary[1].senses).toEqual([
    { pos: 'n.', meaning: '记录', example: 'Keep a record.', exampleTranslation: '保留记录。' },
    { pos: 'v.', meaning: '录制', example: 'They recorded it.', exampleTranslation: '他们录制了它。' },
  ]);
  expect(saved.vocabulary[2].highlight).toEqual(['take off', 'took off']);
  expect(saved.vocabulary[2].senses.map((sense: { meaning: string }) => sense.meaning)).toEqual(['起飞', '迅速走红']);
  expect(saved).not.toHaveProperty('expressions');
  expect(saved).not.toHaveProperty('mainIdea');
  await page.reload(); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(marks).toHaveText(['ran', 'record', 'took off', 'take off']);
  const snapshot = await page.evaluate(() => window.editor);
  const { styles: _settings, ...document } = snapshot.project;
  expect(document).toEqual(saved);
  const result = await request.post('/api/export', { data: snapshot });
  expect(result.ok(), result.ok() ? '' : await result.text()).toBe(true);
  const exported = JSON.parse(strFromU8(unzipSync(await result.body())['article.json']));
  expect(exported).toEqual(saved);
  const output = page.locator(`.vocab[data-source="${saved.vocabulary[1].id}"]`);
  expect((await output.allTextContents()).join('')).toContain('n. 记录');
  await page.screenshot({ path: '.build/test-results/multiple-senses.png' });
});

test('renaming a vocabulary head removes its obsolete phrase highlight automatically', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const text = 'This is only for testing. It is only for demonstration.';
  const input = { ...fixture, content: { paragraphs: [{ id: 'p001', text }] }, vocabulary: [] };
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'head-rename.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
  });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();

  expect(await selectPreviewText(page, 'p001', text, 'only for')).toBe(true);
  await page.getByRole('button', { name: '将选中文字加入词汇', exact: true }).click();
  const marks = page.locator('.card .article .hot');
  await expect(marks).toHaveText(['only for', 'only for']);
  await expect(page.getByLabel('词头 1', { exact: true })).toHaveValue('only for');

  await page.getByLabel('词头 1', { exact: true }).fill('only');
  await page.getByLabel('词头 1', { exact: true }).press('Enter');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(marks).toHaveText(['only', 'only']);
  expect(await page.evaluate(() => window.editor.project.vocabulary[0])).toMatchObject({
    word: 'only',
    highlight: [],
  });
  await expect(page.getByRole('button', { name: '刷新词汇高亮', exact: true })).toHaveCount(0);

  await page.reload();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(marks).toHaveText(['only', 'only']);
});
