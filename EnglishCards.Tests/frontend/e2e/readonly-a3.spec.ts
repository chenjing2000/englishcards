import { expect, test } from '@playwright/test';

async function openA3(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const listeners = new Set<(event: MessageEvent) => void>();
    const calls: { command: string; payload: unknown }[] = [];
    (window as unknown as { a3Calls: typeof calls }).a3Calls = calls;
    Object.defineProperty(window, 'chrome', { configurable: true, value: { webview: {
      addEventListener: (_: string, cb: (event: MessageEvent) => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: (event: MessageEvent) => void) => listeners.delete(cb),
      postMessage: (request: { id: number; command: string; payload: any }) => {
        calls.push({ command: request.command, payload: request.payload });
        const text = JSON.stringify({ filetype: 'script', title: 'Test title',
          paragraphs: [[{ text: 'Example sentence with a selected word.', timed_units: [] }]] });
        let result: unknown = null;
        if (request.command === 'lastCardLibrary') result = 'C:/library';
        else if (request.command === 'listCardDirectory') result = {
          path: 'C:/library', folders: [], files: [{ name: 'lesson.json', path: 'C:/library/lesson.json' }],
        };
        else if (request.command === 'openScriptFile') result = {
          path: 'C:/library/lesson.json', text, notices: [], vocabulary: null, translation: null, settingsText: null,
        };
        else if (request.command === 'addVocabularyWord') {
          result = { path: 'C:/library/lesson.vocabulary.json', text: JSON.stringify({
            filetype: 'vocabulary', words: [{
              word: request.payload.word, family: [], phonetic_uk: '', phonetic_us: '',
              meanings: [{ pos: request.payload.partOfSpeech, meaning: request.payload.meaning }],
            }],
          }) };
        }
        else if (request.command === 'saveScriptSettings') result = { path: 'C:/library/export/lesson/settings.json', text: request.payload.text };
        else result = false;
        Promise.resolve().then(() => listeners.forEach(cb => cb({ data: { id: request.id, ok: true, value: result } } as MessageEvent)));
      },
    } } });
  });
  await page.goto('/');
  await expect(page.locator('.text-line.article').first()).toBeVisible();
}

test('A3 selected Script text opens word dialog and saves to active Vocabulary', async ({ page }) => {
  await openA3(page);
  await page.evaluate(() => {
    const line = document.querySelector('.text-line.article')!;
    const node = Array.from(line.childNodes).find(n => n.nodeType === Node.TEXT_NODE)!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(node, 0); range.setEnd(node, 7);
    selection.removeAllRanges(); selection.addRange(range);
    document.querySelector('.reader-stage')!.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.getByRole('button', { name: '添加生词' }).click();
  await expect(page.getByRole('dialog', { name: '添加生词' })).toContainText('Example');
  await page.getByPlaceholder('输入释义').fill('例子');
  await page.getByRole('button', { name: '保存', exact: true }).last().click();
  await expect(page.locator('.reader-message')).toContainText('生词已保存');
  const requests = await page.evaluate(() => (window as unknown as { a3Calls: { command: string; payload: any }[] }).a3Calls);
  const write = requests.find(x => x.command === 'addVocabularyWord');
  expect(write?.payload.word).toBe('Example');
  expect(write?.payload.vocabularyPath).toBeNull();
  expect(requests.filter(x => x.command === 'addVocabularyWord')).toHaveLength(1);
});

test('A3 settings remain local to Script and save on explicit confirmation only', async ({ page }) => {
  await openA3(page);
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByLabel('正文字号').fill('37');
  await page.getByRole('button', { name: '取消' }).click();
  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByLabel('正文字号')).toHaveValue('34');
  await page.getByLabel('正文字号').fill('37');
  await page.getByRole('button', { name: '保存', exact: true }).last().click();
  await expect(page.locator('.reader-message')).toContainText('设置已保存');
  const writes = await page.evaluate(() => (window as unknown as { a3Calls: { command: string; payload: any }[] }).a3Calls.filter(c => c.command === 'saveScriptSettings'));
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0].payload.text).bodySize).toBe(37);
  expect(writes[0].payload.scriptPath).toBe('C:/library/lesson.json');
});
