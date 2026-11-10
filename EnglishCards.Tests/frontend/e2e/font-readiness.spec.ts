import { test, expect } from './fixtures';
import fixture from '@fixtures/projects/brainco/project.json' with { type: 'json' };
import { parseRenderProject } from '@frontend/models/project';

test('cold font loading preserves the first layout with Latin Extended characters and Windows CJK fallback', async ({ page }) => {
  await page.route('**/*.woff2', async route => { await new Promise(resolve => setTimeout(resolve, 150)); await route.continue(); });
  await page.goto('/render'); await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject({ ...fixture, title: 'Test', content: { paragraphs: [] }, translation: { paragraphs: [] }, vocabulary: [{ id: 'v001', word: 'word', ipa: '', highlight: [], senses: [{ pos: 'Ł'.repeat(100), meaning: 'Test', example: '', exampleTranslation: '' }] }] });
  const signatures = await page.evaluate(async project => {
    const first = await window.renderProject(project);
    const diagnostics = window.renderDiagnostics;
    await document.fonts.ready;
    const second = await window.renderProject(project);
    const cardFont = getComputedStyle(document.querySelector('.card')!).fontFamily;
    return { first, second, diagnostics, cardFont };
  }, project);
  expect(signatures.first).toBe(signatures.second);
  expect(signatures.cardFont).toContain('Microsoft YaHei UI');
  expect(signatures.cardFont).toContain('Microsoft YaHei');
  expect(signatures.cardFont).toContain('DengXian');
  const exported = await page.request.post('/api/export', { data: { project, signature: signatures.first, diagnostics: signatures.diagnostics, page: 1 } });
  expect(exported.ok(), exported.ok() ? '' : await exported.text()).toBe(true);
});
