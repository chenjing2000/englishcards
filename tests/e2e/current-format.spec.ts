import { test, expect } from './fixtures';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };

test('old schemas are rejected without replacing the current project or draft', async ({ page, request }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const original = await page.evaluate(() => window.editor.project);
  const draft = await page.evaluate(() => localStorage.getItem('reading-editor.draft.v2'));
  for (const schemaVersion of [1, 2, 3, 4]) {
    const input = { ...fixture, schemaVersion, title: 'An unsupported project' };
    await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
    await expect(page.getByRole('alert')).toContainText('仅支持 schemaVersion: 5');
    expect(await page.evaluate(() => window.editor.project)).toEqual(original);
    expect(await page.evaluate(() => localStorage.getItem('reading-editor.draft.v2'))).toBe(draft);
    const result = await request.post('/api/export', { data: { project: input, signature: 'old' } });
    expect(result.status()).toBe(400);
    expect(await result.text()).toContain('仅支持 schemaVersion: 5');
  }
});
