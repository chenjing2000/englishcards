import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

test('Phase C renders one continuous editor in Vocabulary Content Translation order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const editor = page.getByLabel('文章编辑');
  await expect(editor.locator('.editor-section > h2')).toHaveText(['Vocabulary', 'Content', 'Translation']);
  await expect(page.getByRole('navigation', { name: '编辑板块' })).toHaveCount(0);
  await expect(page.getByLabel('英文正文')).toHaveCount(1);
  await expect(page.getByLabel('中文译文')).toHaveCount(1);
  await expect(page.getByLabel('英文正文')).toHaveValue(fixture.content.paragraphs.map(p => p.text).join('\n\n'));
});

test('Phase C edits and renumbers natural paragraphs while preserving JSON data', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const body = page.getByLabel('英文正文');
  await body.fill('First new paragraph.\n\nSecond new paragraph.');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const article = await page.evaluate(() => window.editor.project);
  expect(article.content.paragraphs).toEqual([
    { id: 'p001', text: 'First new paragraph.' },
    { id: 'p002', text: 'Second new paragraph.' },
  ]);
  await expect(body).toHaveValue('First new paragraph.\n\nSecond new paragraph.');
  await page.getByRole('button', { name: '打开设置' }).click();
  await expect(page.getByLabel('设置面板')).toBeVisible();
  await page.getByRole('button', { name: '返回文章编辑' }).click();
  await expect(body).toHaveValue('First new paragraph.\n\nSecond new paragraph.');
});
