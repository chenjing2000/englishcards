import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };

test('per-word vocabulary tables edits and moves the selected row, inserts below it and handles an empty table', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const project = { ...fixture, vocabulary: [
    { id: 'v001', word: 'alpha', ipa: '/a/', highlight: [], senses: [{ pos: 'n.', meaning: '甲', example: '', exampleTranslation: '' }] },
    { id: 'v002', word: 'beta', ipa: '/b/', highlight: [], senses: [{ pos: 'adj.', meaning: '乙', example: '', exampleTranslation: '' }] },
    { id: 'v003', word: 'gamma', ipa: '/g/', highlight: [], senses: [{ pos: 'v.', meaning: '丙', example: '', exampleTranslation: '' }] },
  ] };
  await page.getByLabel('导入 Article JSON 或 TXT').setInputFiles({ name: 'table.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  
  const table = page.locator('.vocabulary-editor');
  await expect(page.getByRole('table', { name: '词汇 1', exact: true }).getByRole('rowheader')).toHaveText(['词汇', '音标', '高亮词汇', '含义', '例句', '翻译']);
  const actions = page.getByRole('group', { name: '词汇行操作', exact: true });
  await expect(actions.getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: '刷新词汇高亮', exact: true })).toHaveCount(0);
  const up = actions.getByRole('button', { name: '上移选中词汇', exact: true });
  const down = actions.getByRole('button', { name: '下移选中词汇', exact: true });
  const remove = actions.getByRole('button', { name: '删除选中词汇', exact: true });
  await expect(up.locator('svg')).toBeVisible();
  const actionSize = await up.boundingBox();
  expect(actionSize?.width).toBe(21);
  expect(actionSize?.height).toBe(21);
  await expect(up).toHaveCSS('border-radius', '7px');
  await expect(up.locator('svg')).toHaveCSS('width', '15px');
  await expect(up.locator('svg')).toHaveCSS('height', '15px');
  const add = actions.getByRole('button', { name: '在选中词汇下方添加空白行', exact: true });
  const words = table.locator('input[aria-label^="词头 "]');
  const selected = page.locator('.vocabulary-entry.selected');
  async function expectWords(expected: string[]) {
    await expect.poll(() => words.evaluateAll(nodes => nodes.map(node => (node as HTMLInputElement).value))).toEqual(expected);
  }
  await expect(up).toBeDisabled();
  await page.getByLabel('词头 2', { exact: true }).fill('edited beta');
  await up.click();
  await expectWords(['edited beta', 'alpha', 'gamma']);
  await expect(selected.getByLabel('词头 1', { exact: true })).toHaveValue('edited beta');
  await expect(up).toBeDisabled();
  await down.click();
  await expectWords(['alpha', 'edited beta', 'gamma']);
  await add.click();
  await expectWords(['alpha', 'edited beta', '', 'gamma']);
  await expect(page.getByLabel('词头 3', { exact: true })).toBeFocused();
  await expect(page.getByLabel('音标 3', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('含义 3', { exact: true })).toHaveValue('');
  await expect(selected.getByLabel('词头 3', { exact: true })).toHaveValue('');
  await remove.click();
  await expectWords(['alpha', 'edited beta', 'gamma']);
  await expect(selected.getByLabel('词头 3', { exact: true })).toHaveValue('gamma');
  await expect(down).toBeDisabled();
  for (let index = 0; index < 3; index++) await remove.click();
  await expect(words).toHaveCount(0);
  await expect(up).toBeDisabled(); await expect(down).toBeDisabled(); await expect(remove).toBeDisabled();
  await expect(add).toBeEnabled();
  await add.click();
  await expectWords(['']);
  await expect(page.getByLabel('词头 1', { exact: true })).toBeFocused();
});

test('table fields preserve part of speech and drafts; preview clicks do not navigate', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  
  await page.getByLabel('音标 2', { exact: true }).fill('/changed/');
  await page.getByLabel('含义 2', { exact: true }).fill('n. 保留的含义');
  await page.getByLabel('含义 2', { exact: true }).press('Tab');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const snapshot = await page.evaluate(() => window.editor.project);
  expect(snapshot.vocabulary[1]).toMatchObject({ ipa: '/changed/', senses: [{ pos: 'n.', meaning: '保留的含义' }] });
  await page.reload(); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  
  await expect(page.getByLabel('音标 2', { exact: true })).toHaveValue('/changed/');
  await expect(page.getByLabel('含义 2', { exact: true })).toHaveValue('n. 保留的含义');
  await page.getByLabel('词头 2', { exact: true }).focus();
  await page.locator('.card [data-edit]').filter({ hasText: fixture.vocabulary[0].word }).first().click();
  await expect(page.getByLabel('词头 1', { exact: true })).not.toBeFocused();
  await expect(page.locator('.vocabulary-entry.selected').getByLabel('词头 2', { exact: true })).toHaveValue(fixture.vocabulary[1].word);
  await page.getByLabel('词头 2', { exact: true }).click();
  await page.screenshot({ path: '.build/test-results/vocabulary-table.png' });
});
