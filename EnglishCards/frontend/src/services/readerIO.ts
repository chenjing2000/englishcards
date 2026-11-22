import { parseScript, parseVocabulary, parseTranslation, type ReaderDocument } from '../models/reader';
import { defaults } from '../models/settings';
import { desktopRequest } from './desktopBridge';

type Companion = { path: string; text: string };
export type ScriptFiles = { path: string; text: string; vocabulary?: Companion; translation?: Companion; notices: string[] };
export function readScriptFiles(files: ScriptFiles): { path: string; document: ReaderDocument; notices: string[] } {
  const document: ReaderDocument = { script: parseScript(JSON.parse(files.text)), styles: defaults };
  const notices = [...files.notices];
  if (files.vocabulary) {
    try { document.vocabulary = parseVocabulary(JSON.parse(files.vocabulary.text)); }
    catch { notices.push(`Vocabulary 无法读取，已仅显示其他内容：${files.vocabulary.path}`); }
  }
  if (files.translation) {
    try { document.translation = parseTranslation(JSON.parse(files.translation.text)); }
    catch { notices.push(`Translation 无法读取，已仅显示其他内容：${files.translation.path}`); }
  }
  return { path: files.path, document, notices };
}
export async function openScriptFile(path: string) {
  return readScriptFiles(await desktopRequest<ScriptFiles>('openScriptFile', path));
}
