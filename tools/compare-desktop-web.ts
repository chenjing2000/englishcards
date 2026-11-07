import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [runDirectory] = process.argv.slice(2);
if (!runDirectory) throw new Error('Usage: tsx tools/compare-desktop-web.ts <desktop-verification-directory>');
const webRoot = fileURLToPath(new URL('../EnglishCards/.build/frontend-dist/', import.meta.url));
const origin = 'https://englishcards-web.test';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 }, deviceScaleFactor: 1 });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/render') return route.fulfill({ path: resolve(webRoot, 'index.html') });
    if (/^\/assets\/[\w.-]+$/.test(url.pathname)) {
      return route.fulfill({ path: resolve(webRoot, '.' + url.pathname) });
    }
    return route.abort();
  });

  const comparison = [];
  for (const name of ['default', 'long', 'maximum']) {
    const directory = resolve(runDirectory, name);
    const webOutput = resolve(directory, 'web');
    await mkdir(webOutput, { recursive: true });
    const { project, signature, diagnostics } = JSON.parse(await readFile(resolve(directory, 'preview.json'), 'utf8')) as Window['editor'];
    const { pageWidth, pageHeight } = project.styles;
    await page.setViewportSize({ width: Math.max(1440, pageWidth), height: Math.max(1800, pageHeight) });
    await page.goto(origin + '/render');
    await page.waitForFunction(() => typeof window.renderProject === 'function');
    const web = await page.evaluate(async input => ({
      signature: await window.renderProject(input), diagnostics: window.renderDiagnostics!,
    }), project);
    await writeFile(resolve(webOutput, 'render.json'), JSON.stringify(web, null, 2));
    const wrapAt = diagnostics.records.findIndex((record, index) =>
      JSON.stringify(record.slice(0, 4)) !== JSON.stringify(web.diagnostics.records[index]?.slice(0, 4)));
    const sameWrap = wrapAt === -1 && diagnostics.records.length === web.diagnostics.records.length;
    const pixels = [];
    for (let index = 0; index < web.diagnostics.pages; index++) {
      const file = 'page-' + String(index + 1).padStart(2, '0') + '.png';
      const browserPng = await page.locator('.card').nth(index).screenshot({ path: resolve(webOutput, file), animations: 'disabled' });
      if (index >= diagnostics.pages) continue;
      const desktopPng = await readFile(resolve(directory, file));
      const diff = await page.evaluate(async ([left, right]) => {
        const [desktop, web] = await Promise.all([left, right].map(async png => {
          const blob = await (await fetch('data:image/png;base64,' + png)).blob();
          const bitmap = await createImageBitmap(blob);
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          const context = canvas.getContext('2d', { willReadFrequently: true })!;
          context.drawImage(bitmap, 0, 0);
          bitmap.close();
          return context.getImageData(0, 0, canvas.width, canvas.height);
        }));
        if (desktop.width !== web.width || desktop.height !== web.height) return { dimensionsMatch: false };
        let changedPixels = 0;
        for (let offset = 0; offset < desktop.data.length; offset += 4) {
          if (desktop.data[offset] !== web.data[offset] || desktop.data[offset + 1] !== web.data[offset + 1] ||
              desktop.data[offset + 2] !== web.data[offset + 2] || desktop.data[offset + 3] !== web.data[offset + 3]) {
            changedPixels++;
          }
        }
        return { dimensionsMatch: true, changedPixels, totalPixels: desktop.width * desktop.height };
      }, [desktopPng.toString('base64'), browserPng.toString('base64')]);
      pixels.push({ file, ...diff });
    }
    comparison.push({
      name, desktopPages: diagnostics.pages, webPages: web.diagnostics.pages, sameWrap,
      firstDifferentWrap: wrapAt === -1 ? null : {
        record: wrapAt + 1, desktop: diagnostics.records[wrapAt], web: web.diagnostics.records[wrapAt],
      },
      sameLayoutSignature: signature === web.signature, pixels,
    });
  }
  const report = { chromium: browser.version(), comparison };
  await writeFile(resolve(runDirectory, 'web-comparison.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
