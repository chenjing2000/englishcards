import { defaults } from '../src/models/settings';
import { SettingsStore } from '../src/server/settingsStore';
import { chromium } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'artifacts/demo');
await mkdir(output, { recursive: true });
const settingsPath = resolve(root, 'artifacts/test-runtime/demo-settings.json');
await new SettingsStore(settingsPath).save(defaults);
const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/server/index.ts', '--production'], { cwd: root, env: { ...process.env, PORT: '4318', SETTINGS_PATH: settingsPath }, stdio: 'pipe', windowsHide: true });
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += String(chunk); }); server.stderr.on('data', chunk => { serverLog += String(chunk); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let online = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { online = (await fetch('http://127.0.0.1:4318')).ok; } catch { online = false; }
    if (online) break;
    await setTimeout(100);
  }
  if (!online) throw new Error(`生产服务未就绪：${serverLog}`);
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const externalRequests: string[] = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    externalRequests.push(route.request().url()); return route.abort();
  });
  await page.goto('http://127.0.0.1:4318');
  await page.waitForSelector('[data-ready="true"]');
  await page.screenshot({ path: resolve(output, 'editor.png') });
  const snapshot = await page.evaluate(() => window.editor);
  const first = await page.request.post('http://127.0.0.1:4318/api/export', { data: snapshot });
  if (!first.ok()) throw new Error(await first.text());
  const archive = await first.body();
  await writeFile(resolve(output, 'reading-cards.zip'), archive);
  const files = unzipSync(archive);
  const pngNames = Object.keys(files).filter(name => name.endsWith('.png'));
  const hashes: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    await writeFile(resolve(output, name), bytes);
    hashes[name] = createHash('sha256').update(bytes).digest('hex');
    if (name.endsWith('.png')) {
      const png = Buffer.from(bytes);
      if (png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 1600) throw new Error('PNG 尺寸错误');
    }
  }
  const second = await page.request.post('http://127.0.0.1:4318/api/export', { data: snapshot });
  if (!second.ok()) throw new Error(await second.text());
  const repeated = unzipSync(await second.body());
  const repeatIdentical = pngNames.every(name => Buffer.from(files[name]).equals(Buffer.from(repeated[name])));
  await page.setViewportSize({ width: 1800, height: 2000 });
  await page.locator('.preview').evaluate(node => { (node as HTMLElement).style.setProperty('--zoom', '1'); });
  let previewIdentical = true;
  for (let index = 0; index < pngNames.length; index++) {
    // Floating workspace controls can overlap the card on screen, but are not part of its image.
    const preview = await page.locator('.card').nth(index).screenshot({ style: '.project-actions,.zoom-indicator{visibility:hidden!important}' });
    previewIdentical = previewIdentical && preview.equals(Buffer.from(files[pngNames[index]]));
  }
  let protectedFiles: number | null = null;
  try {
    const original = unzipSync(await readFile(resolve(root, '../english-reading-editor-handoff.zip')));
    protectedFiles = 0;
    for (const [name, bytes] of Object.entries(original)) {
      const clean = name.replace(/^english-reading-editor-handoff\//, '');
      if (!(clean.startsWith('projects/') || clean.startsWith('reference/')) || clean.endsWith('/')) continue;
      if (!Buffer.from(bytes).equals(await readFile(resolve(root, 'assets', clean)))) throw new Error(`原始参考文件被修改：${clean}`);
      protectedFiles++;
    }
  } catch (reason) { if ((reason as NodeJS.ErrnoException).code !== 'ENOENT') throw reason; }
  const validation = { generatedAt: new Date().toISOString(), productionMode: true, pageCount: pngNames.length, dimensions: [1200, 1600], repeatIdentical, previewIdentical, externalRequests, protectedFilesVerifiedAgainstOriginalZip: protectedFiles, hashes };
  await writeFile(resolve(output, 'validation.json'), JSON.stringify(validation, null, 2));
  if (!repeatIdentical || !previewIdentical || externalRequests.length) throw new Error('演示验收未通过');
  console.log(JSON.stringify(validation, null, 2));
} finally {
  await browser?.close();
  if (process.platform === 'win32' && server.pid) spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else server.kill();
}
