import { test, expect } from './fixtures';
import fixture from '../../assets/projects/brainco/project.json' with { type: 'json' };

test('each vocabulary sense has one combined editor stacked below the previous sense', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  const input = { ...fixture, vocabulary: [{ id: 'sour', word: 'sour', ipa: '', highlight: ['sour'], senses: [
    { pos: 'v.', meaning: '恶化；变的不友好', example: '', exampleTranslation: '' },
    { pos: 'adj.', meaning: '酸的，有酸味的', example: '', exampleTranslation: '' },
  ] }] };
  await page.getByLabel('打开项目 JSON').setInputFiles({ name: 'combined.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(input)) });
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  const cell = page.getByRole('table', { name: '词汇 1', exact: true });
  await expect(cell.locator('textarea[aria-label^="含义"]')).toHaveCount(2);
  const first = page.getByLabel('含义 1', { exact: true });
  const second = page.getByLabel('含义 1 义项 2', { exact: true });
  await expect(first).toHaveValue('v. 恶化；变的不友好');
  await expect(second).toHaveValue('adj. 酸的，有酸味的');
  expect((await second.boundingBox())!.y).toBeGreaterThan((await first.boundingBox())!.y + (await first.boundingBox())!.height);
  await first.fill('n. 酸味');
  await first.press('Tab');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect((await page.evaluate(() => window.editor.project)).vocabulary[0].senses[0]).toMatchObject({ pos: 'n.', meaning: '酸味' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(first).toHaveValue('v. 恶化；变的不友好');
  await page.reload(); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  await expect(second).toHaveValue('adj. 酸的，有酸味的');
  await page.screenshot({ path: 'artifacts/test-results/combined-meanings.png' });
});

test('combined meanings support normal sequential typing and backspace without inserting spaces', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '词汇', exact: true }).click();
  const input = page.getByLabel('含义 1', { exact: true });
  await input.fill('');
  await input.pressSequentially('n. test');
  await expect(input).toHaveValue('n. test');
  for (let i = 0; i < 7; i++) await input.press('Backspace');
  await expect(input).toHaveValue('');
  await input.pressSequentially('adj. sour');
  await input.press('Enter');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect((await page.evaluate(() => window.editor.project)).vocabulary[0].senses[0]).toMatchObject({ pos: 'adj.', meaning: 'sour' });
});

test('source, main idea and translation editors fit content and shrink after editing', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  for (const [tab, label] of [['原文', '英文标题'], ['原文', '英文段落 1'], ['主旨与译文', 'Main Idea'], ['主旨与译文', '中文段落 1']]) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const input = page.getByLabel(label, { exact: true });
    await input.fill('Short.');
    const oneLine = await input.evaluate(node => { const style = getComputedStyle(node); return parseFloat(style.lineHeight) + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth); });
    await expect.poll(async () => (await input.boundingBox())!.height).toBeCloseTo(oneLine, 0);
    await input.fill('One\nTwo\nThree\nFour\nFive');
    await expect.poll(async () => (await input.boundingBox())!.height).toBeGreaterThan(oneLine + 60);
    await input.fill('Short.');
    await expect.poll(async () => (await input.boundingBox())!.height).toBeCloseTo(oneLine, 0);
  }
});

test('expression fields retain multiple senses without part-of-speech or sense controls', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: '表达', exact: true }).click();
  await expect(page.locator('input[aria-label^="表达词性"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /添加义项|删除.*义项/ })).toHaveCount(0);
  await expect(page.getByLabel('含义 1', { exact: true })).toHaveValue(fixture.expressions[0].senses[0].meaning);
});
