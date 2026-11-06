import { test, expect } from './fixtures';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };
import { parseRenderProject } from '../../src/models/project';

test('cold font loading preserves the first layout including unique part-of-speech characters', async ({ page }) => {
  await page.route('**/*.woff2', async route => { await new Promise(resolve => setTimeout(resolve, 150)); await route.continue(); });
  await page.goto('/render'); await page.waitForFunction(() => typeof window.renderProject === 'function');
  const project = parseRenderProject({ ...fixture, title: 'Test', source: { paragraphs: [] }, translation: { paragraphs: [] }, expressions: [], mainIdea: 'Test', vocabulary: [{ id: 'v1', word: 'word', ipa: '', senses: [{ pos: 'Ж'.repeat(100), meaning: 'Test', example: '', exampleTranslation: '' }] }] });
  const signatures = await page.evaluate(async project => {
    const first = await window.renderProject(project);
    const diagnostics = window.renderDiagnostics;
    await document.fonts.ready;
    const second = await window.renderProject(project);
    return { first, second, diagnostics };
  }, project);
  expect(signatures.first).toBe(signatures.second);
  const exported = await page.request.post('/api/export', { data: { project, signature: signatures.first, diagnostics: signatures.diagnostics, page: 1 } });
  expect(exported.ok(), exported.ok() ? '' : await exported.text()).toBe(true);
});
