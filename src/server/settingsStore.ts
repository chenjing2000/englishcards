import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { settingsSchema, defaults, type Styles } from '../models/settings';

export class SettingsStore {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly path: string) {}

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = this.pending.then(action);
    this.pending = result.catch(() => {});
    return result;
  }
  load(): Promise<{ settings: Styles; error?: string }> {
    return this.enqueue(async () => {
      try { return { settings: settingsSchema.parse(JSON.parse(await readFile(this.path, 'utf8'))) }; }
      catch (reason) {
        if ((reason as NodeJS.ErrnoException).code === 'ENOENT') { await this.write(defaults); return { settings: { ...defaults } }; }
        return { settings: { ...defaults }, error: `配置无法读取，暂用默认值；原文件未覆盖：${String(reason)}` };
      }
    });
  }
  save(input: unknown): Promise<Styles> {
    const settings = settingsSchema.parse(input);
    return this.enqueue(async () => { await this.write(settings); return settings; });
  }
  private async write(settings: Styles) {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(settings, null, 2) + '\n', 'utf8');
      await rename(temporary, this.path);
    } finally { await unlink(temporary).catch(reason => { if (reason.code !== 'ENOENT') throw reason; }); }
  }
}
