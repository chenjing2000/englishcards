import { expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaults, settingsSchema } from '@frontend/models/settings';
import { SettingsStore } from '@test-server/settingsStore';

it('defines all agreed defaults and validates usable page dimensions', () => {
  expect(defaults).toEqual({ titleSize: 30, bodySize: 34, mainIdeaSize: 32, translationSize: 32,
    headerSize: 18, footerSize: 17, wordSize: 34, vocabularySize: 26, phraseSize: 34, expressionSize: 30, headingSize: 24,
    lineHeight: 1.45, translationLineHeight: 1.62, paragraphGap: 18, marginX: 54, marginTop: 34, marginBottom: 80, pageWidth: 1200, pageHeight: 1600 });
  expect(settingsSchema.safeParse({ ...defaults, pageWidth: 400, marginX: 200 }).success).toBe(false);
  expect(settingsSchema.safeParse({ ...defaults, pageHeight: 400, marginTop: 200, marginBottom: 200 }).success).toBe(false);
  expect(settingsSchema.safeParse({ ...defaults, pageWidth: 1000, pageHeight: 1400 }).success).toBe(true);
  expect(settingsSchema.safeParse({ ...defaults, accent: '#ffffff' }).success).toBe(false);
  expect(settingsSchema.safeParse({ ...defaults, pageWidth: 400, marginX: 100, footerSize: 80, marginBottom: 145 }).success).toBe(false);
});

it('recreates missing settings, serializes saves and preserves damaged files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'englishcards-settings-'));
  const path = join(directory, 'config/settings.json');
  const store = new SettingsStore(path);
  try {
    expect((await store.load()).settings).toEqual(defaults);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(defaults);
    await Promise.all([store.save({ ...defaults, bodySize: 40 }), store.save({ ...defaults, bodySize: 42 })]);
    expect((await store.load()).settings.bodySize).toBe(42);
    await unlink(path);
    expect((await store.load()).settings).toEqual(defaults);
    await writeFile(path, '{broken');
    expect((await store.load()).error).toBeTruthy();
    expect(await readFile(path, 'utf8')).toBe('{broken');
    await store.save(defaults);
    expect((await store.load()).error).toBeUndefined();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
