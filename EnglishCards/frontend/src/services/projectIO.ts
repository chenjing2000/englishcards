import fixture from '../../assets/projects/brainco/project.json';
import {
  parseProject, projectDocument, type Project, type RenderProject,
} from '../models/project';
import { settingsSchema, defaults, type Styles } from '../models/settings';
import { ArticleImportCoordinator, type ImportResult } from '../v6/importers';
import { desktopRequest, isDesktop } from './desktopBridge';

const DRAFT = 'article-editor.draft.v6';
const LEGACY_DRAFT = 'reading-editor.draft.v2';
const restoredNotice = '已恢复本机 Article v6 自动草稿。';
const sampleNotice = '已创建空白 Article v6 文档。';

type RestoredDraft = {
  project: Project;
  notice: string;
  cacheBlocked: boolean;
  rejected?: string;
  desktopRejected?: boolean;
};

const readDraft = (text: string) => {
  const wrapper = JSON.parse(text) as Record<string, unknown>;
  if (!wrapper || typeof wrapper !== 'object' || !Object.hasOwn(wrapper, 'article')) {
    throw new Error('草稿不是 Article v6 格式。');
  }
  return parseProject(wrapper.article);
};
const draftText = (project: Project) => JSON.stringify({
  article: projectDocument(project),
  modifiedAt: new Date().toISOString(),
});

export function sampleDraft(): RestoredDraft {
  return {
    project: parseProject(fixture),
    notice: sampleNotice,
    cacheBlocked: false,
  };
}

export function restoreDraft(): RestoredDraft {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(DRAFT);
    if (saved) return { project: readDraft(saved), notice: restoredNotice, cacheBlocked: false };

    // The previous application used a different key and a v5 `{ project }` wrapper.
    // Preserve its exact bytes for explicit recovery, but never parse or migrate it.
    const legacy = localStorage.getItem(LEGACY_DRAFT);
    if (legacy) {
      let preserved = false;
      try {
        localStorage.setItem(`article-editor.rejected-draft.${Date.now()}`, legacy);
        localStorage.setItem('article-editor.rejected-draft', legacy);
        preserved = true;
      } catch { preserved = false; }
      return {
        project: parseProject(fixture),
        notice: preserved
          ? '检测到旧版自动草稿（v5），不兼容 Article v6；原始内容已隔离备份，请下载后按新格式重新整理。'
          : '检测到旧版自动草稿（v5），不兼容 Article v6；备份失败，自动缓存已停用以保护原数据。',
        cacheBlocked: !preserved,
        rejected: legacy,
      };
    }
  } catch {
    let preserved = false;
    if (saved) try {
      localStorage.setItem(`article-editor.rejected-draft.${Date.now()}`, saved);
      localStorage.setItem('article-editor.rejected-draft', saved);
      preserved = true;
    } catch { preserved = false; }
    return {
      project: parseProject(fixture),
      notice: preserved
        ? '草稿格式不受支持或无法读取，已隔离备份；当前创建空白文章。'
        : '草稿无法读取或备份，自动缓存已停用以保护原数据。',
      cacheBlocked: !preserved,
      rejected: saved ?? undefined,
    };
  }
  return sampleDraft();
}

export function cacheDraft(project: RenderProject) {
  localStorage.setItem(DRAFT, draftText(projectDocument(project)));
}

export const readSettingsFile = async (file: File) =>
  settingsSchema.parse(JSON.parse(await file.text()));

async function loadDesktopFile<T>(
  command: 'loadSettings',
  parse: (text: string) => T,
  fallback: T,
) {
  try {
    const text = await desktopRequest<string | null>(command);
    return { value: text === null ? fallback : parse(text), missing: text === null, rejected: false };
  } catch {
    return { value: fallback, missing: false, rejected: true };
  }
}

export type DesktopSaveResult = { pending: boolean; settingsError: string };

export class DesktopPersistence {
  private queue = Promise.resolve();
  private queued = 0;
  private settingsRevision = 0;
  private savedSettingsRevision = 0;

  constructor(
    private savedSettings: string | null,
    private rejectedSettings: boolean,
  ) {}

  replaceSettings() { this.settingsRevision++; }

  save(project: RenderProject): Promise<DesktopSaveResult> {
    const pending = this.queued++ > 0;
    const settingsRevision = this.settingsRevision;
    const write = this.queue.then(async () => {
      const result = { pending, settingsError: '' };
      try {
        const settings = settingsSchema.safeParse(project.styles);
        if (!settings.success) {
          result.pending = true;
          result.settingsError = `配置无效，未保存：${settings.error.issues.map(issue => issue.message).join(' ')}`;
        } else {
          const text = JSON.stringify(settings.data);
          if (text !== this.savedSettings || settingsRevision !== this.savedSettingsRevision) {
            result.pending = true;
            await desktopRequest('saveSettings', { text, preserveOriginal: this.rejectedSettings });
            this.savedSettings = text;
            this.savedSettingsRevision = settingsRevision;
            this.rejectedSettings = false;
          }
        }
      } catch (reason) { result.settingsError = `配置未保存：${String(reason)}`; }

      return result;
    });
    this.queue = write.then(() => { this.queued--; }, () => { this.queued--; });
    return write;
  }
}

export async function loadDesktopData() {
  // Phase E: the desktop no longer reads or restores a global article draft.
  // File-backed articles are opened explicitly through the Card Library.
  const sample = sampleDraft();
  const settings = await loadDesktopFile(
    'loadSettings', text => settingsSchema.parse(JSON.parse(text)), defaults,
  );
  const persistence = new DesktopPersistence(
    settings.missing ? null : JSON.stringify(settings.value),
    settings.rejected,
  );
  return {
    settings: settings.value,
    draft: sample,
    persistence,
    notice: settings.rejected ? '配置无法读取，原设置文件已保留。' : '',
  };
}

export async function importProjectFile(file: File): Promise<ImportResult> {
  return new ArticleImportCoordinator().import({ name: file.name, text: await file.text() });
}

export async function readProject(file: File): Promise<Project> {
  return (await importProjectFile(file)).article;
}

export async function openProject(file?: File): Promise<Project | null> {
  if (file) return readProject(file);
  if (!isDesktop()) return null;
  const selected = await desktopRequest<{ name: string; text: string } | null>('openProject');
  if (selected === null) return null;
  return new ArticleImportCoordinator().import(selected).article;
}

export function saveProject(project: Project) {
  const contents = JSON.stringify(parseProject(projectDocument(project)), null, 2);
  if (isDesktop()) return desktopRequest<true | null>('saveProject', contents).then(saved => saved === true ? contents : null);
  download(new Blob([contents], { type: 'application/json' }), 'article.json');
  return contents;
}

export function download(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function requestExport(project: RenderProject, signature: string, pages: number): Promise<boolean | null> {
  if (!isDesktop()) throw new Error('ZIP 导出仅在 Windows 桌面版中可用。');
  return desktopRequest<boolean | null>('exportAllZip', {
    project,
    document: projectDocument(project),
    signature,
    pages,
  });
}

export async function loadSettings() {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ settings: Styles; error?: string }>;
}

export async function saveSettings(settings: Styles) {
  const response = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
    keepalive: true,
  });
  if (!response.ok) throw new Error(await response.text());
}
