import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { parseRenderProject } from '@frontend/models/project';

test('content and translation paragraphs indent only their first line and paginate consistently', async ({ page, request }) => {
  await page.goto('/render');
  await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject({
    ...fixture,
    content: { paragraphs: [{ id: 'p001', text: 'This paragraph checks first-line indentation and continuation line layout. '.repeat(70) }] },
    vocabulary: [],
    translation: { paragraphs: [{ id: 'p001', text: '这是一段用于检查译文首行缩进和跨页续行的完整文字。'.repeat(70) }] },
  });
  const signature = await page.evaluate(project => window.renderProject(project), project);
  const contentLines = page.locator('.article[data-source="p001"]');
  const translationLines = page.locator('.translation[data-source="p001"]');
  await expect(contentLines.first()).toHaveCSS('text-indent', `${project.styles.bodySize * 2}px`);
  await expect(translationLines.first()).toHaveCSS('text-indent', `${project.styles.translationSize * 2}px`);
  const contentIndents = await contentLines.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).textIndent));
  const translationIndents = await translationLines.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).textIndent));
  expect(new Set(contentIndents.slice(1))).toEqual(new Set(['0px']));
  expect(new Set(translationIndents.slice(1))).toEqual(new Set(['0px']));
  expect((await contentLines.allTextContents()).join('')).toBe(project.content.paragraphs[0].text);
  expect((await translationLines.allTextContents()).join('')).toBe(project.translation.paragraphs[0].text);
  const diagnostics = await page.evaluate(() => window.renderDiagnostics);
  const result = await request.post('/api/render-page', { data: { project, signature, diagnostics, page: 1 } });
  expect(result.ok(), result.ok() ? '' : await result.text()).toBe(true);
});

test('the old Main Idea section is absent from Article v6 rendering and editing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(page.locator('.mainIdea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '表达', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '主旨与译文', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Translation', exact: true })).toBeVisible();
});
