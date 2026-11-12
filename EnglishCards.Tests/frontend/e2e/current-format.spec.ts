import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

test('v5 and earlier schemas are rejected without replacing the current Article or draft', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const original = await page.evaluate(() => window.editor.project);
  const draft = await page.evaluate(() => localStorage.getItem('article-editor.draft.v6'));
  for (const schemaVersion of [1, 2, 3, 4, 5]) {
    const input = { ...fixture, schemaVersion, title: 'An unsupported article' };
    await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({
      name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)),
    });
    await expect(page.getByRole('alert')).toContainText('只支持 6');
    expect(await page.evaluate(() => window.editor.project)).toEqual(original);
    expect(await page.evaluate(() => localStorage.getItem('article-editor.draft.v6'))).toBe(draft);
    const result = await request.post('/api/render-page', { data: { project: input, signature: 'old', page: 1 } });
    expect(result.status()).toBe(400);
    expect(await result.text()).toContain('只支持 6');
  }
});
