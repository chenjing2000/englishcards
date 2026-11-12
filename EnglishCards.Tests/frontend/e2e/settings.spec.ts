import { test, expect } from './fixtures';
import { defaults } from '@frontend/models/settings';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { readFile, writeFile, unlink } from 'node:fs/promises';

test('shared settings persist independently of articles and determine exact page-render dimensions', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await expect(page.getByRole('table', { name: '字号设置', exact: true })).toHaveCount(1);
  await expect(page.getByRole('table', { name: '其余设置', exact: true })).toHaveCount(1);
  await expect(page.getByLabel('强调色', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('分割线颜色', { exact: true })).toHaveCount(0);
  for (const [selector, size] of [['.title', 30], ['.article', 34], ['.translation', 32], ['.vocab [data-edit$=\":word\"]', 34], ['.vocab [data-edit$=\":ipa\"]', 30], ['.vocab [data-edit*=\"meaning\"]', 30], ['.vocab [data-edit*=\"example\"]', 30], ['.section-heading', 32], ['.vocab-heading', 32]] as const) {
    await expect(page.locator(selector).first()).toHaveCSS('font-size', `${size}px`);
  }
  await page.screenshot({ path: '.build/test-results/settings-fonts.png' });
  await page.getByLabel('页面高度', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.build/test-results/settings-dimensions.png' });
  for (const [label, value] of [['页面宽度', '1000'], ['页面高度', '1400'], ['英文正文字号', '38'], ['中文译文字号', '28'], ['页眉字号', '20'], ['页脚字号', '18']]) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect.poll(async () => (await (await request.get('/api/settings')).json()).settings).toEqual(await page.evaluate(() => window.editor.project.styles));
  const stored = await (await request.get('/api/settings')).json();
  expect(stored.settings).toMatchObject({ pageWidth: 1000, pageHeight: 1400, bodySize: 38, translationSize: 28 });
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({ name: 'another.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...fixture, title: 'Another article' })) });
  await expect(page.getByLabel('英文正文字号', { exact: true })).toHaveValue('38');
  await page.reload(); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.article').first()).toHaveCSS('font-size', '38px');
  await expect(page.locator('.translation').first()).toHaveCSS('font-size', '28px');
  await expect(page.locator('.eyebrow').first()).toHaveCSS('font-size', '20px');
  await expect(page.locator('.footer').first()).toHaveCSS('font-size', '18px');
  for (const node of await page.locator('.section-heading,.vocab-heading').all()) await expect(node).toHaveCSS('color', 'rgb(217, 136, 61)');
  const snapshot = await page.evaluate(() => window.editor);
  const response = await request.post('/api/render-page', { data: { ...snapshot, page: 1 } });
  expect(response.ok(), response.ok() ? '' : await response.text()).toBe(true);
  const png = Buffer.from(await response.body());
  expect(png.readUInt32BE(16)).toBe(1000);
  expect(png.readUInt32BE(20)).toBe(1400);
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await page.getByLabel('页面宽度', { exact: true }).fill('400');
  await page.getByLabel('左右边距', { exact: true }).fill('200');
  await expect(page.getByText(/配置无效，未保存/)).toBeVisible();
  await expect(page.getByRole('button', { name: '导出全部 ZIP', exact: true })).toHaveCount(0);
  expect((await (await request.get('/api/settings')).json()).settings.pageWidth).toBe(1000);
  await page.getByRole('button', { name: '默认配置', exact: true }).click();
  await expect.poll(async () => (await (await request.get('/api/settings')).json()).settings).toEqual(defaults);
  expect((await (await request.get('/api/settings')).json()).settings).toEqual(defaults);
});

test('missing settings are rebuilt and damaged settings require an explicit reset', async ({ page, request }) => {
  const path = '.build/test-runtime/settings.json';
  await unlink(path);
  expect((await (await request.get('/api/settings')).json()).settings).toEqual(defaults);
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(defaults);
  await writeFile(path, '{broken');
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  await expect(page.getByText(/配置无法读取，暂用默认值/)).toBeVisible();
  expect(await readFile(path, 'utf8')).toBe('{broken');
  await page.getByRole('button', { name: '默认配置', exact: true }).click();
  await expect.poll(async () => (await (await request.get('/api/settings')).json())).toEqual({ settings: defaults });
  expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(defaults);
});

test('a later edit during an in-flight settings save persists the latest visible settings', async ({ page, request }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const saving = new Promise<void>(resolve => { started = resolve; });
  let intercepted = false;
  await page.route('**/api/settings', async route => {
    if (route.request().method() === 'PUT' && !intercepted) { intercepted = true; started(); await held; }
    await route.continue();
  });
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click(); await download;
  await page.getByLabel('英文正文字号', { exact: true }).fill('40');
  await saving;
  await page.getByLabel('英文正文字号', { exact: true }).fill('34');
  await expect(page.getByLabel('英文正文字号', { exact: true })).toHaveValue('34');
  expect(await page.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented;
  })).toBe(true);
  const corrected = page.waitForResponse(response => response.url().endsWith('/api/settings') && response.request().method() === 'PUT'
    && JSON.parse(response.request().postData()!).bodySize === 34 && response.ok());
  release(); await corrected;
  expect((await (await request.get('/api/settings')).json()).settings.bodySize).toBe(34);
});
