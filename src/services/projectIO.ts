import fixture from '../../assets/projects/brainco/project.json';
import { defaults, parseProject, projectDocument, type Project, type RenderProject } from '../models/project';
import { settingsSchema, type Styles } from '../models/settings';
import { desktopRequest, isDesktop } from './desktopBridge';

const DRAFT = 'reading-editor.draft.v2';
const sampleNotice = '已加载 BrainCo 完整样例。所有处理均在本机完成。';
const restoredNotice = '已恢复本机自动草稿；请另存 JSON 作为可移植备份。';
const readDraft = (text: string) => parseProject(JSON.parse(text).project);
const draftText = (project: Project) => JSON.stringify({ project, modifiedAt: new Date().toISOString() });
type RestoredDraft = { project: Project; notice: string; cacheBlocked: boolean; rejected?: string; desktopRejected?: boolean };

export function sampleDraft(): RestoredDraft {
  return { project: parseProject(fixture), notice: sampleNotice, cacheBlocked: false };
}

export function restoreDraft(): RestoredDraft {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(DRAFT);
    if (saved) return { project: readDraft(saved), notice: restoredNotice, cacheBlocked: false };
  } catch {
    let preserved = false;
    if (saved) try {
      localStorage.setItem(`reading-editor.rejected-draft.${Date.now()}`, saved);
      localStorage.setItem('reading-editor.rejected-draft', saved);
      preserved = true;
    } catch { preserved = false; }
    return { project: parseProject(fixture), notice: preserved ? '草稿格式不受支持或无法读取，已隔离备份，可下载原始草稿。当前显示样例。' : '草稿无法读取或备份，自动缓存已停用以保护旧数据；请保存 JSON。', cacheBlocked: !preserved, rejected: saved ?? undefined };
  }
  return sampleDraft();
}

export function cacheDraft(project: RenderProject) {
  localStorage.setItem(DRAFT, draftText(projectDocument(project)));
}

export const readSettingsFile = async (file: File) => settingsSchema.parse(JSON.parse(await file.text()));

async function loadDesktopFile<T>(command: 'loadSettings' | 'loadDraft', parse: (text: string) => T, fallback: T) {
  try {
    const text = await desktopRequest<string | null>(command);
    return { value: text === null ? fallback : parse(text), missing: text === null, rejected: false };
  } catch {
    return { value: fallback, missing: false, rejected: true };
  }
}

export type DesktopSaveResult = { pending: boolean; settingsError: string; draftError: string };

export class DesktopPersistence {
  private queue = Promise.resolve();
  private queued = 0;
  private settingsRevision = 0;
  private savedSettingsRevision = 0;

  constructor(private savedSettings: string | null, private savedDraft: string,
              private rejectedSettings: boolean, private rejectedDraft: boolean) {}

  replaceSettings() { this.settingsRevision++; }

  save(project: RenderProject): Promise<DesktopSaveResult> {
    const pending = this.queued++ > 0;
    const settingsRevision = this.settingsRevision;
    const write = this.queue.then(async () => {
      const result = { pending, settingsError: '', draftError: '' };
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

      try {
        const document = projectDocument(project);
        const snapshot = JSON.stringify(document);
        if (snapshot !== this.savedDraft) {
          result.pending = true;
          const text = draftText(parseProject(document));
          await desktopRequest('saveDraft', { text, preserveOriginal: this.rejectedDraft });
          this.savedDraft = snapshot;
          this.rejectedDraft = false;
        }
      } catch (reason) { result.draftError = `自动草稿未保存：${String(reason)}`; }
      return result;
    });
    this.queue = write.then(() => { this.queued--; }, () => { this.queued--; });
    return write;
  }
}

export async function loadDesktopData() {
  const sample = sampleDraft();
  const [settings, draft] = await Promise.all([
    loadDesktopFile('loadSettings', text => settingsSchema.parse(JSON.parse(text)), defaults),
    loadDesktopFile('loadDraft', readDraft, sample.project),
  ]);
  const notice = [
    settings.rejected && '配置无法读取，暂用默认值，原文件已保留。',
    draft.rejected && '草稿无法读取，当前显示样例，可另存原始草稿。',
  ].filter(Boolean).join(' ');
  const persistence = new DesktopPersistence(settings.missing ? null : JSON.stringify(settings.value),
    JSON.stringify(draft.value), settings.rejected, draft.rejected);
  return {
    settings: settings.value,
    draft: { ...sample, project: draft.value, notice: draft.missing ? sample.notice : restoredNotice, desktopRejected: draft.rejected },
    persistence, notice,
  };
}

export async function readProject(file: File) {
  return parseProject(JSON.parse(await file.text()));
}

export async function openProject(file?: File) {
  if (file) return readProject(file);
  if (!isDesktop()) return null;
  const selected = await desktopRequest<{ name: string; text: string } | null>('openProject');
  return selected === null ? null : parseProject(JSON.parse(selected.text));
}

export function saveProject(project: Project) {
  const contents = JSON.stringify(parseProject(projectDocument(project)), null, 2);
  if (isDesktop()) return desktopRequest<true | null>('saveProject', contents).then(saved => saved === true ? contents : null);
  download(new Blob([contents], { type: 'application/json' }), 'reading-project.json');
  return contents;
}

export function download(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function requestExport(project: RenderProject, signature: string, pages: number): Promise<boolean | null> {
  if (!isDesktop()) throw new Error('ZIP 导出仅在 Windows 桌面版中可用。');
  return desktopRequest<boolean | null>('exportAllZip', {
    project, document: projectDocument(project), signature, pages,
  });
}

export async function loadSettings() {
  const response = await fetch('/api/settings');
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ settings: import('../models/settings').Styles; error?: string }>;
}
export async function saveSettings(settings: import('../models/settings').Styles) {
  const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings), keepalive: true });
  if (!response.ok) throw new Error(await response.text());
}
