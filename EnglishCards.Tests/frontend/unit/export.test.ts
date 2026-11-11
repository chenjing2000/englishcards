import { beforeAll, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import fixture from '@fixtures/projects/brainco/project.json';

const { launch, post } = vi.hoisted(() => ({ launch: vi.fn(), post: vi.fn() }));
vi.mock('@playwright/test', () => ({ chromium: { launch } }));
vi.mock('@test-server/settingsStore', () => ({ SettingsStore: class { async load() { return { settings: {} }; } } }));
// Capture the real export handler without starting a listening server or Vite.
vi.mock('express', () => {
  const app = { post, use() {}, get() {}, put() {}, listen() {} };
  return { default: Object.assign(() => app, { json() {}, static() {} }) };
});

let renderPage: (request: Request, response: Response) => Promise<void>;
beforeAll(async () => {
  const args = process.argv;
  process.argv = [...args, '--production'];
  try { await import('@test-server/index'); }
  finally { process.argv = args; }
  renderPage = post.mock.calls.find(([path]) => path === '/api/render-page')![1];
});

function response() {
  return {
    statusCode: 200, body: undefined as unknown, contentType: '',
    status(code: number) { this.statusCode = code; return this; },
    type(value: string) { this.contentType = value; return this; },
    send(body: unknown) { this.body = body; return this; },
  };
}

it('reports cleanup failures and releases the page-render slot for the next request', async () => {
  const close = vi.fn().mockRejectedValue(new Error('Browser cleanup failed'));
  launch.mockResolvedValueOnce({
    newPage: async () => ({ goto: async () => { throw new Error('Render failed'); } }), close,
  });
  const request = { headers: {}, body: { project: fixture, signature: 'stale', page: 1 } } as Request;
  const failed = response();
  await expect(renderPage(request, failed as unknown as Response)).resolves.toBeUndefined();
  expect(failed.statusCode).toBe(400);
  expect(failed.body).toContain('Render failed');
  expect(failed.body).toContain('Browser cleanup failed');
  expect(close).toHaveBeenCalledTimes(1);

  launch.mockResolvedValueOnce({
    newPage: async () => ({ goto: async () => {}, waitForFunction: async () => {}, evaluate: async () => 'current' }),
    close: async () => {},
  });
  const next = response();
  await renderPage(request, next as unknown as Response);
  expect(next.statusCode).toBe(400);
  expect(next.body).toContain('导出与预览分页不一致');
});

it('does not send a successful PNG when browser cleanup fails', async () => {
  const png = Buffer.from('image bytes');
  const page = {
    goto: async () => {}, waitForFunction: async () => {}, evaluate: async () => 'current',
    locator: () => ({ count: async () => 1, nth: () => ({ screenshot: async () => png }) }),
  };
  const close = vi.fn().mockRejectedValueOnce(new Error('Cleanup failed')).mockResolvedValue(undefined);
  launch.mockResolvedValue({ newPage: async () => page, close });
  const request = { headers: {}, body: { project: fixture, signature: 'current', page: 1 } } as Request;
  const failed = response();
  await renderPage(request, failed as unknown as Response);
  expect(failed.statusCode).toBe(400);
  expect(failed.body).toContain('Cleanup failed');
  expect(close).toHaveBeenCalledTimes(1);

  const next = response();
  await renderPage(request, next as unknown as Response);
  expect(next.statusCode).toBe(200);
  expect(next.contentType).toBe('png');
  expect(next.body).toEqual(png);
});

it('suggests installing Chromium only when its executable is missing', async () => {
  const request = { headers: {}, body: { project: fixture, signature: 'unused', page: 1 } } as Request;
  launch.mockRejectedValueOnce(new Error("browserType.launch: Executable doesn't exist at C:/missing/chrome.exe"));
  const missing = response(); await renderPage(request, missing as unknown as Response);
  expect(missing.body).toContain('npx.cmd playwright install chromium');
  launch.mockRejectedValueOnce(new Error('Browser launch permission denied'));
  const denied = response(); await renderPage(request, denied as unknown as Response);
  expect(denied.body).toContain('permission denied');
  expect(denied.body).not.toContain('install chromium');
});

it('requires a positive page number before launching Chromium', async () => {
  launch.mockClear();
  const request = { headers: {}, body: { project: fixture, signature: 'current' } } as Request;
  const missing = response();
  await renderPage(request, missing as unknown as Response);
  expect(missing.statusCode).toBe(400);
  expect(missing.body).toContain('页码无效');
  expect(launch).not.toHaveBeenCalled();
});
