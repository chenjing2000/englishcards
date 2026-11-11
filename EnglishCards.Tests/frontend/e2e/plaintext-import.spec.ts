import { test, expect } from './fixtures';

test('plain-text import uses the filename as title and splits natural paragraphs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
    name: 'The Big Era.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('\uFEFFThe first line\ncontinues on this line.\r\n\r\nThe second paragraph.\n\n\nThe third paragraph.', 'utf8'),
  });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.getByLabel('英文标题', { exact: true })).toHaveValue('The Big Era');
  await expect(page.getByLabel('IdentityTag', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: '导出全部 ZIP', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('英文正文', { exact: true })).toHaveValue('The first line continues on this line.\n\nThe second paragraph.\n\nThe third paragraph.');
  const snapshot = await page.evaluate(() => window.editor.project);
  expect(snapshot.schemaVersion).toBe(6);
  expect(snapshot.vocabulary).toEqual([]);
  expect(snapshot.translation.paragraphs).toEqual([]);
  expect(snapshot.content.paragraphs.map((paragraph: { id: string }) => paragraph.id)).toEqual(['p001', 'p002', 'p003']);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click();
  const { readFile } = await import('node:fs/promises');
  const saved = JSON.parse(await readFile((await (await download).path())!, 'utf8'));
  const { styles: _styles, ...document } = snapshot;
  expect(saved).toEqual(document);
});

test('TXT input does not accept malformed or legacy JSON as prose', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const original = await page.evaluate(() => window.editor.project);
  for (const text of ['{broken', JSON.stringify({ schemaVersion: 5, title: 'legacy' })]) {
    await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
      name: 'looks-like-json.txt', mimeType: 'text/plain', buffer: Buffer.from(text),
    });
    await expect(page.getByRole('alert')).toContainText('无法打开文章');
    expect(await page.evaluate(() => window.editor.project)).toEqual(original);
  }
});
