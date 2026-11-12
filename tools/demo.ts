import { defaults } from '../EnglishCards/frontend/src/models/settings';
import { SettingsStore } from './test-server/settingsStore';
import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, '.build/demo');
await mkdir(output, { recursive: true });
const settingsPath = resolve(root, '.build/test-runtime/demo-settings.json');
await new SettingsStore(settingsPath).save(defaults);

const port = 4318;
const baseURL = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'tools/test-server/index.ts', '--production'], {
  cwd: root, env: { ...process.env, PORT: String(port), SETTINGS_PATH: settingsPath },
  stdio: 'pipe', windowsHide: true,
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += String(chunk); });
server.stderr.on('data', chunk => { serverLog += String(chunk); });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

function checkPng(bytes: Buffer, width: number, height: number, index: number) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error(`第 ${index} 页 PNG 签名无效。`);
  }
  const actualWidth = bytes.readUInt32BE(16);
  const actualHeight = bytes.readUInt32BE(20);
  if (actualWidth !== width || actualHeight !== height) {
    throw new Error(`第 ${index} 页 PNG 尺寸错误：${actualWidth}x${actualHeight}，期望 ${width}x${height}。`);
  }
}

try {
  let online = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`演示服务提前退出：${serverLog}`);
    try { online = (await fetch(baseURL)).ok; } catch { online = false; }
    if (online) break;
    await setTimeout(100);
  }
  if (!online) throw new Error(`生产服务未就绪：${serverLog}`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const externalRequests: string[] = [];
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === baseURL) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(baseURL);
  await page.waitForSelector('.preview[data-ready="true"]');
  await page.waitForFunction(() => window.editor?.diagnostics?.pages > 0);
  await page.screenshot({ path: resolve(output, 'editor.png') });

  const { project, signature, diagnostics } = await page.evaluate(() => window.editor);
  const pageCount = diagnostics.pages;
  const { pageWidth, pageHeight } = project.styles;
  const hashes: Record<string, string> = {};
  let repeatIdentical = true;
  for (let index = 1; index <= pageCount; index++) {
    const payload = { project, signature, diagnostics, page: index };
    const first = await page.request.post(`${baseURL}/api/render-page`, { data: payload, timeout: 120000 });
    if (!first.ok()) throw new Error(`第 ${index} 页渲染失败：${await first.text()}`);
    const bytes = await first.body();
    checkPng(bytes, pageWidth, pageHeight, index);
    const fileName = `page-${String(index).padStart(3, '0')}.png`;
    await writeFile(resolve(output, fileName), bytes);
    hashes[fileName] = createHash('sha256').update(bytes).digest('hex');

    const second = await page.request.post(`${baseURL}/api/render-page`, { data: payload, timeout: 120000 });
    if (!second.ok()) throw new Error(`第 ${index} 页重复渲染失败：${await second.text()}`);
    const repeated = await second.body();
    checkPng(repeated, pageWidth, pageHeight, index);
    repeatIdentical &&= bytes.equals(repeated);
  }

  const validation = {
    generatedAt: new Date().toISOString(),
    productionMode: true,
    renderEndpoint: '/api/render-page',
    pageCount, dimensions: [pageWidth, pageHeight],
    signature, repeatIdentical, externalRequests, hashes,
  };
  await writeFile(resolve(output, 'validation.json'), JSON.stringify(validation, null, 2));
  if (!repeatIdentical || externalRequests.length) throw new Error('浏览器分页演示验收未通过。');
  console.log(JSON.stringify(validation, null, 2));
} finally {
  await browser?.close();
  if (process.platform === 'win32' && server.pid) {
    const killer = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    await new Promise<void>(resolveDone => killer.once('exit', () => resolveDone()));
  } else {
    server.kill();
  }
}
