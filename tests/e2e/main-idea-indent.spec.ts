import { test, expect } from './fixtures';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };
import { parseRenderProject } from '../../src/models/project';

test('main idea indents only its first line and exports with the same pagination', async ({ page, request }) => {
  await page.goto('/render');
  await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject({ ...fixture, source: { paragraphs: [] }, translation: { paragraphs: [] }, vocabulary: [], expressions: [],
    mainIdea: '这是一段用于检查主旨首行缩进和跨页续行的完整文字。'.repeat(70) });
  const signature = await page.evaluate(project => window.renderProject(project), project);
  const lines = page.locator('.mainIdea[data-source="mainIdea"]');
  await expect(lines.first()).toHaveCSS('text-indent', `${project.styles.mainIdeaSize * 2}px`);
  const indents = await lines.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).textIndent));
  expect(new Set(indents.slice(1))).toEqual(new Set(['0px']));
  expect((await lines.allTextContents()).join('')).toBe(project.mainIdea);
  expect(await lines.evaluateAll(nodes => new Set(nodes.map(node => node.closest('.card')!.getAttribute('data-page'))).size)).toBeGreaterThan(1);
  const diagnostics = await page.evaluate(() => window.renderDiagnostics);
  const result = await request.post('/api/export', { data: { project, signature, diagnostics, page: 1 } });
  expect(result.ok(), result.ok() ? '' : await result.text()).toBe(true);
});

test('main idea has an independent font size and no individual PNG buttons appear', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const main = page.locator('.mainIdea').first(), translation = page.locator('.translation').first();
  await expect(main).toHaveCSS('font-size', '32px');
  await expect(translation).toHaveCSS('font-size', '32px');
  await page.getByRole('button', { name: '样式', exact: true }).click();
  await page.getByLabel('中文译文字号', { exact: true }).fill('44');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(main).toHaveCSS('font-size', '32px');
  await expect(translation).toHaveCSS('font-size', '44px');
  await expect(main).toHaveCSS('text-indent', '64px');
  await expect(page.getByRole('button', { name: /^第 \d+ 页 PNG$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '导出全部 ZIP', exact: true })).toBeEnabled();
});
