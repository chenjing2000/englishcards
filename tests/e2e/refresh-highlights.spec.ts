import { test, expect } from './fixtures';
import { readFile } from 'node:fs/promises';
import { unzipSync, strFromU8 } from 'fflate';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };

test('manual heads retain surface rules, senses stay paired and refresh preserves rule-only highlights', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const input = { ...fixture,
    source: { paragraphs: [{ id: 'p', text: 'ran run. A record was recorded. They took off and take off.' }] },
    vocabulary: [{ id: 'v', word: 'run', ipa: '', highlight: ['ran'], senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }] }],
    expressions: [{ id: 'x', phrase: 'take off', highlight: ['take off'], senses: [{ pos: '', meaning: '起飞', example: '', exampleTranslation: '' }, { pos: '', meaning: '迅速走红', example: 'Her career took off.', exampleTranslation: '她的事业腾飞了。' }] }],
  };
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'senses.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  const marks = page.locator('.article .hot');
  await expect(marks).toHaveText(['ran', 'take off']);
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  const refresh = page.getByRole('button', { name: '刷新词汇与表达高亮', exact: true });
  const add = page.getByRole('button', { name: '在选中词汇下方添加空白行', exact: true });
  expect((await refresh.boundingBox())!.x).toBeGreaterThan((await add.boundingBox())!.x);
  const before = await page.evaluate(() => window.editor.project);
  await refresh.click(); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect(await page.evaluate(() => window.editor.project)).toEqual(before);
  await expect(marks).toHaveText(['ran', 'take off']);
  await add.click();
  const head = page.getByLabel('词头 2', { exact: true });
  await head.fill('rec'); await head.fill('record'); await head.press('Enter');
  await page.getByLabel('含义 2', { exact: true }).fill('n. 记录');
  await page.getByLabel('词汇例句 2 义项 1', { exact: true }).fill('Keep a record.');
  await page.getByLabel('词汇翻译 2 义项 1', { exact: true }).fill('保留记录。');
  await page.getByRole('button', { name: '为词汇 2 添加义项', exact: true }).click();
  await page.getByLabel('含义 2 义项 2', { exact: true }).fill('v. 录制');
  await page.getByLabel('词汇例句 2 义项 2', { exact: true }).fill('They recorded it.');
  await page.getByLabel('词汇翻译 2 义项 2', { exact: true }).fill('他们录制了它。');
  await page.getByRole('button', { name: '表达', exact: true }).click();
  await page.getByRole('button', { name: '添加表达', exact: true }).click();
  await page.getByLabel('短语 2', { exact: true }).fill('took off');
  await page.getByLabel('含义 2', { exact: true }).fill('起飞');
  await page.getByLabel('例句 2', { exact: true }).fill('They took off.');
  await page.getByLabel('翻译 2', { exact: true }).fill('他们起飞了。');
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  await refresh.click(); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(marks).toHaveText(['ran', 'record', 'took off', 'take off']);
  await expect(page.getByLabel('信息提示栏')).toHaveText('');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const saved = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(saved.schemaVersion).toBe(5);
  expect(saved.vocabulary[1].highlight).toEqual(['record']);
  expect(saved.vocabulary[1].senses).toEqual([
    { pos: 'n.', meaning: '记录', example: 'Keep a record.', exampleTranslation: '保留记录。' },
    { pos: 'v.', meaning: '录制', example: 'They recorded it.', exampleTranslation: '他们录制了它。' },
  ]);
  expect(saved.expressions[1].highlight).toEqual(['took off']);
  expect(saved.expressions[0].senses.map((sense: { meaning: string }) => sense.meaning)).toEqual(['起飞', '迅速走红']);
  expect(saved.expressions[1].senses[0].example).toBe('They took off.');
  expect(saved).not.toHaveProperty('highlights');
  await page.reload(); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(marks).toHaveText(['ran', 'record', 'took off', 'take off']);
  const snapshot = await page.evaluate(() => window.editor);
  const { styles: _settings, ...document } = snapshot.project; expect(document).toEqual(saved);
  const result = await request.post('/api/export', { data: snapshot });
  expect(result.ok(), result.ok() ? '' : await result.text()).toBe(true);
  const exported = JSON.parse(strFromU8(unzipSync(await result.body())['project.json']));
  expect(exported).toEqual(saved);
  const output = page.locator(`.vocab[data-source="${saved.vocabulary[1].id}"]`);
  expect((await output.allTextContents()).join('')).toContain('n. 记录\n例句：Keep a record.\n翻译：保留记录。\nv. 录制');
  await page.screenshot({ path: 'artifacts/test-results/multiple-senses.png' });
});

test('import stays unready while reading and refreshing unchanged rules does not add history', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const original = await page.evaluate(() => window.editor.project);
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () { await new Promise(resolve => setTimeout(resolve, 500)); return read.call(this); };
  });
  const input = { ...fixture, source: { paragraphs: [{ id: 'p', text: 'No active rules.' }] }, vocabulary: [], expressions: [] };
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await expect(page.getByRole('button', { name: '导出全部 ZIP', exact: true })).toBeDisabled();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('英文段落 1', { exact: true })).toHaveValue('No active rules.');
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: '刷新词汇与表达高亮', exact: true }).click();
    await expect(page.locator('[data-ready="true"]')).toBeVisible();
  }
  await expect(page.getByLabel('信息提示栏')).toHaveText('');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect(await page.evaluate(() => window.editor.project)).toEqual(original);
});
