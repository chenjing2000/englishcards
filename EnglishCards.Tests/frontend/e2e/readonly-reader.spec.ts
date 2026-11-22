import { expect, test, type Page } from '@playwright/test';
import { defaults } from '@frontend/models/settings';

const base = { filetype: 'script', title: '', paragraphs: [[{ text: 'Exact  source wording.', timed_units: [['UNTRUSTED', null, null]] }, { text: 'Next sentence.', timed_units: [] }], [{ text: 'Final paragraph.' }]] };
async function desktop(page: Page, files: Record<string, unknown>, delay = false) {
  await page.addInitScript(({ files, delay }) => {
    const listeners = new Set<(event: MessageEvent) => void>();
    (window as unknown as { calls: string[] }).calls = [];
    Object.defineProperty(window, 'chrome', { value: { webview: {
      addEventListener: (_type: string, callback: (event: MessageEvent) => void) => listeners.add(callback),
      removeEventListener: (_type: string, callback: (event: MessageEvent) => void) => listeners.delete(callback),
      postMessage: ({ id, command, payload }: { id: number; command: string; payload: string }) => {
        (window as unknown as { calls: string[] }).calls.push(command);
        let value: unknown;
        let error = '';
        if (command === 'lastCardLibrary') value = 'C:/library';
        else if (command === 'listCardDirectory') value = { path: payload, folders: [], files: Object.keys(files).map(name => ({ name, path: `C:/library/${name}` })) };
        else if (command === 'openScriptFile') {
          const file = files[payload.split('/').at(-1)!] as Record<string, unknown>;
          if (file?.failure) error = String(file.failure);
          else value = { path: payload, text: JSON.stringify(file?.script ?? file), notices: file?.notices ?? [], vocabulary: file?.vocabulary ? { path: 'vocabulary.json', text: JSON.stringify(file.vocabulary) } : undefined, translation: file?.translation ? { path: 'translation.json', text: JSON.stringify(file.translation) } : undefined };
        } else error = `Unexpected command ${command}`;
        setTimeout(() => listeners.forEach(callback => callback({ data: error ? { id, ok: false, error } : { id, ok: true, value } } as MessageEvent)), delay && payload?.endsWith('slow.json') ? 400 : 0);
      },
    } }, configurable: true });
  }, { files, delay });
  await page.goto('/');
}

test('A1 reads exact native sentence text with one visible page and no editing or source writes', async ({ page }) => {
  await desktop(page, { 'native.json': base });
  await page.getByRole('button', { name: 'native.json', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.text-line[data-kind="article"]').first()).toHaveText('Exact  source wording. Next sentence.');
  await expect(page.locator('.preview')).not.toContainText('UNTRUSTED');
  await expect(page.locator('.text-line[data-kind="title"]')).toHaveCount(0);
  await expect(page.locator('input,textarea,[contenteditable="true"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '上一页' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '下一页' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '停止', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'PNG', exact: true })).toHaveAttribute('title', '保存');
  await expect(page.getByRole('button', { name: 'PNG', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'MP4', exact: true })).toHaveAttribute('title', '导出 MP4');
  await expect(page.getByRole('button', { name: 'MP4', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '清空', exact: true })).toHaveCount(0);
  await expect(page.locator('.reader-library-heading').getByRole('button', { name: '设置', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('A3');
  await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
  const calls = await page.evaluate(() => (window as unknown as { calls: string[] }).calls);
  expect(calls.filter(command => command === 'openScriptFile')).toHaveLength(1);
  expect(calls.every(command => ['lastCardLibrary', 'listCardDirectory', 'openScriptFile'].includes(command))).toBe(true);
});

test('A1 retains the previous readable page when Article or an unreadable file is rejected', async ({ page }) => {
  await desktop(page, { 'native.json': base, 'article.json': { schemaVersion: 6, title: 'Wrong' }, 'missing.json': { failure: 'File missing' } });
  await page.getByRole('button', { name: 'native.json', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  const original = await page.locator('.card').textContent();
  for (const name of ['article.json', 'missing.json']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.reader-message')).toContainText('无法打开 Script');
    expect(await page.locator('.card').textContent()).toBe(original);
  }
});

test('A1 renders native optional vocabulary and preserves translation line breaks in order', async ({ page }) => {
  await desktop(page, { 'native.json': { script: base, vocabulary: { filetype: 'vocabulary', words: [{ word: 'go', family: ['went'], phonetic_uk: '/ɡəʊ/', phonetic_us: '/ɡoʊ/', meanings: [{ pos: 'v.', meaning: '去' }] }] }, translation: { filetype: 'translation', text: '第一行\n第二行\n\n另一段' }, notices: ['找到多个 Vocabulary，按文件名选用：a.json'] } });
  await page.getByRole('button', { name: 'native.json', exact: true }).click();
  await expect(page.locator('.preview')).toContainText('UK /ɡəʊ/ US /ɡoʊ/');
  await expect(page.locator('.reader-message')).toContainText('a.json');
  const lines = await page.locator('.text-line').evaluateAll(elements => elements.map(element => ({ kind: (element as HTMLElement).dataset.kind, text: element.textContent })));
  expect(lines.findIndex(line => line.kind === 'article')).toBeLessThan(lines.findIndex(line => line.kind === 'vocab'));
  expect(lines.findIndex(line => line.kind === 'vocab')).toBeLessThan(lines.findIndex(line => line.kind === 'translation'));
  expect(lines.filter(line => line.kind === 'translation').map(line => line.text).join('')).toBe('第一行\n第二行\n\n另一段');
});

test('A1 reports malformed optional input while still reading Script', async ({ page }) => {
  await desktop(page, { 'native.json': { script: base, vocabulary: { filetype: 'vocabulary', words: 'bad' } } });
  await page.getByRole('button', { name: 'native.json', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.locator('.reader-message')).toContainText('Vocabulary 无法读取');
});

test('A1 ignores stale open results when switching scripts quickly', async ({ page }) => {
  await desktop(page, { 'slow.json': base, 'fast.json': { ...base, title: 'Current Script' } }, true);
  await page.getByRole('button', { name: 'slow.json', exact: true }).click();
  await page.getByRole('button', { name: 'fast.json', exact: true }).click();
  await expect(page.locator('.card')).toContainText('Current Script');
  await page.waitForTimeout(500);
  await expect(page.locator('.card')).toContainText('Current Script');
});

test('A1 navigation exposes exactly one page and preserves all logical paragraph characters', async ({ page }) => {
  const text = 'A measured sentence with punctuation, symbols + and repeated words. '.repeat(100);
  await desktop(page, { 'long.json': { ...base, paragraphs: [[{ text, timed_units: [] }]] } });
  await page.getByRole('button', { name: 'long.json', exact: true }).click();
  await expect(page.locator('.card')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '下一页' })).toBeEnabled();
  let actual = '';
  let pages = 0;
  let indented = 0;
  do {
    await expect(page.locator('.card')).toHaveCount(1);
    const lines = await page.locator('.text-line[data-kind="article"]').evaluateAll(elements => elements.map(element => ({ text: element.textContent, indent: (element as HTMLElement).style.textIndent })));
    actual += lines.map(line => line.text).join('');
    indented += lines.filter(line => line.indent !== '0px').length;
    pages++;
    if (await page.getByRole('button', { name: '下一页' }).isDisabled()) break;
    await page.getByRole('button', { name: '下一页' }).click();
  } while (pages < 30);
  expect(actual).toBe(text);
  expect(indented).toBe(1);
  expect(pages).toBeGreaterThan(1);
  await expect(page.getByLabel('页码', { exact: true })).toHaveText(`${pages} / ${pages}`);
  await page.getByRole('button', { name: '上一页' }).click();
  await expect(page.getByLabel('页码', { exact: true })).toHaveText(`${pages - 1} / ${pages}`);
});

test('A1 render entry accepts native inputs and measures stable font-ready pagination', async ({ page }) => {
  await page.goto('/render');
  await page.waitForFunction(() => typeof window.renderProject === 'function');
  const result = await page.evaluate(async styles => {
    const input = { script: { filetype: 'script' as const, title: 'Font measurement', paragraphs: [[{ text: 'Words with spacing and accents café. '.repeat(40), timed_units: [] }]] }, styles };
    const first = await window.renderProject(input);
    const second = await window.renderProject(input);
    return { first, second, diagnostics: window.renderDiagnostics };
  }, defaults);
  expect(result.first).toBe(result.second);
  expect(result.diagnostics?.pages).toBeGreaterThan(0);
  await expect(page.locator('.text-line[data-kind="article"]').first()).toHaveCSS('text-indent', '68px');
});
