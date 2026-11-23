import { parseScript, parseVocabulary, parseTranslation, type ReaderDocument } from '../models/reader';
import { defaults, settingsSchema, type Styles } from '../models/settings';
import { desktopRequest } from './desktopBridge';

type Companion = { path: string; text: string };
export type ScriptFiles = {
  path: string; text: string; vocabulary?: Companion; translation?: Companion;
  notices: string[]; settingsText?: string | null;
};
export type LoadedScript = {
  path: string; document: ReaderDocument; notices: string[];
  vocabularyPath: string | null; vocabularyText: string | null;
  settingsText: string | null; settingsValid: boolean;
};
export function readScriptFiles(files: ScriptFiles): LoadedScript {
  const document: ReaderDocument = { script: parseScript(JSON.parse(files.text)), styles: defaults };
  const notices = [...files.notices];
  let vocabularyPath: string | null = null;
  let vocabularyText: string | null = null;
  if (files.vocabulary) {
    try {
      document.vocabulary = parseVocabulary(JSON.parse(files.vocabulary.text));
      vocabularyPath = files.vocabulary.path;
      vocabularyText = files.vocabulary.text;
    } catch { notices.push('Vocabulary 无法读取，已仅显示其他内容：' + files.vocabulary.path); }
  }
  if (files.translation) {
    try { document.translation = parseTranslation(JSON.parse(files.translation.text)); }
    catch { notices.push('Translation 无法读取，已仅显示其他内容：' + files.translation.path); }
  }
  let settingsValid = true;
  if (files.settingsText != null) {
    try { document.styles = settingsSchema.parse(JSON.parse(files.settingsText)); }
    catch {
      settingsValid = false;
      notices.push('Script 设置文件无效：已使用默认布局。请修正原设置文件后重新打开，不能直接覆盖损坏的文件。');
    }
  }
  return { path: files.path, document, notices, vocabularyPath, vocabularyText,
    settingsText: files.settingsText ?? null, settingsValid };
}
export async function openScriptFile(path: string): Promise<LoadedScript> {
  return readScriptFiles(await desktopRequest<ScriptFiles>('openScriptFile', path));
}
export type SavedFile = { path: string; text: string };
export function addVocabularyWord(data: {
  scriptPath: string; vocabularyPath: string | null; expectedText: string | null;
  word: string; meaning: string; partOfSpeech: string;
}) {
  return desktopRequest<SavedFile>('addVocabularyWord', data);
}
export function saveScriptSettings(data: { scriptPath: string; expectedText: string | null; text: string }) {
  return desktopRequest<SavedFile>('saveScriptSettings', data);
}
export const normalizeStyles = (styles: Styles) => settingsSchema.parse(styles);
