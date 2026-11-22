import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { defaults } from '@frontend/models/settings';
import { selectPreviewText } from './preview-selection';

test('settings use keyboard text entry while mouse wheels and arrow keys do not change values', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('信息提示栏')).toHaveText('');
  await page.getByRole('button', { name: '打开设置', exact: true }).click();
  const input = page.getByLabel('英文正文字号', { exact: true });
  await expect(input).toHaveAttribute('type', 'text');
  await input.focus(); await input.press('ArrowUp'); await input.press('ArrowDown');
  await input.hover(); await page.mouse.wheel(0, 400);
  await expect(input).toHaveValue('34');
  await page.getByLabel('英文行距', { exact: true }).fill('1.');
  await page.getByLabel('英文行距', { exact: true }).pressSequentially('55');
  await expect(page.getByLabel('英文行距', { exact: true })).toHaveValue('1.55');
  await expect.poll(async () => (await (await request.get('/api/settings')).json()).settings.lineHeight).toBe(1.55);
  await expect(page.getByLabel('信息提示栏')).toHaveText('');
  const gap = page.getByLabel('段距', { exact: true });
  await gap.fill('0');
  await gap.fill('');
  await expect(page.getByRole('alert')).toContainText('Error:');
  await page.getByRole('button', { name: '默认配置', exact: true }).click();
  await expect.poll(async () => (await (await request.get('/api/settings')).json()).settings).toEqual(defaults);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(gap).toHaveValue(String(defaults.paragraphGap));
});

test('duplicate preview selections show timed warnings while import errors remain until closed', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const text = 'run';
  const input = {
    ...fixture,
    content: { paragraphs: [{ id: 'p001', text }] },
    vocabulary: [{ id: 'v001', word: 'run', highlight: ['run'], senses: [{ pos: 'v.', meaning: '跑', example: '', exampleTranslation: '' }] }],
  };
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'duplicate.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
  });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.clock.install();
  const bar = page.getByLabel('信息提示栏');
  await expect.poll(() => bar.evaluate(node => node.getBoundingClientRect().height)).toBe(0);

  async function addDuplicate() {
    expect(await selectPreviewText(page, 'p001', text, 'run')).toBe(true);
    await expect(page.getByRole('button', { name: '将选中文字加入词汇' })).toBeVisible();
    await page.getByRole('button', { name: '将选中文字加入词汇' }).click();
  }

  await addDuplicate();
  await expect(bar).toContainText('Warning:');
  await expect(bar.locator('.notice')).toHaveCSS('font-size', '14px');
  await expect.poll(() => bar.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(0);
  expect(await bar.evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(120);
  await expect(bar.locator('.notice')).toHaveCSS('line-height', '21px');
  await page.clock.runFor(9000); await expect(bar).toContainText('Warning:');
  await page.clock.runFor(1000); await expect(bar).toHaveText('');

  await addDuplicate();
  await page.clock.runFor(9000);
  await addDuplicate();
  await page.clock.runFor(1000);
  await expect(bar).toContainText('Warning:');
  await page.clock.runFor(9000);
  await expect(bar).toHaveText('');

  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{'),
  });
  await expect(bar.getByRole('alert')).toContainText('Error:');
  await expect(bar.getByRole('button', { name: '关闭', exact: true })).toHaveCSS('font-size', '12px');
  await page.clock.runFor(10001);
  await expect(bar.getByRole('alert')).toContainText('无法打开文章');
  await bar.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(bar).toHaveText('');
});
