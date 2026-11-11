import { parseProject, projectDocument, type Project, type RenderProject } from '../models/project';
import { desktopRequest } from './desktopBridge';
import { CardSaveCoordinator } from './cardSaveCoordinator';

export type LibraryEntry = { path: string; name: string };
export type LibraryDirectory = {
  path: string;
  folders: LibraryEntry[];
  files: LibraryEntry[];
};

/** Default root is the executable-adjacent userdata folder. */
export function defaultCardLibrary(): Promise<string> {
  return desktopRequest<string>('defaultCardLibrary');
}

/** Last card-library directory successfully selected and loaded. */
export function lastCardLibrary(): Promise<string> {
  return desktopRequest<string>('lastCardLibrary');
}

/** Persist a library root only after its first-level listing succeeds. */
export function saveLastCardLibrary(path: string): Promise<boolean> {
  return desktopRequest<boolean>('saveLastCardLibrary', path);
}

/** Ask the Windows host for an explicit library root; cancellation returns null. */
export function chooseCardLibrary(): Promise<string | null> {
  return desktopRequest<string | null>('chooseCardLibrary');
}

/** Produce a safe filename from the English title for a JSON/ZIP pair. */
export function cardFileName(title: string): string {
  const name = Array.from(title.normalize('NFC'), char =>
    char.charCodeAt(0) < 32 || char.charCodeAt(0) === 92 || '<>:"/|?*'.includes(char) ? '-' : char,
  ).join('')
    .replace(/\s+/gu, ' ').replace(/[. ]+$/gu, '').trim().slice(0, 100);
  const safe = name || 'Untitled';
  return (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/iu.test(safe) ? '_' : '') + safe + '.json';
}

/** Load only one directory level; folder expansion initiates the next request. */
export function listCardDirectory(path: string): Promise<LibraryDirectory> {
  return desktopRequest<LibraryDirectory>('listCardDirectory', path);
}

export async function openCardFile(path: string): Promise<{ path: string; article: Project }> {
  const response = await desktopRequest<{ path: string; text: string; fingerprint: string }>('openCardFile', path);
  const article = parseProject(JSON.parse(response.text));
  await desktopRequest<boolean>('activateCardFile', { path: response.path, fingerprint: response.fingerprint });
  return { path: response.path, article };
}

export function serializedCard(article: Project): string {
  return JSON.stringify(projectDocument(article), null, 2) + '\n';
}

/**
 * The coordinator captures the file path once. Every write is validated by the
 * C# Article v6 boundary and must target the currently opened file there.
 */
export function createCardSaveCoordinator(filePath: string, article: Project): CardSaveCoordinator {
  return new CardSaveCoordinator(filePath, serializedCard(article), async (path, snapshot) => {
    await desktopRequest<boolean>('saveCardFile', { path, text: snapshot });
  });
}

export type ArticlePairTarget = { path: string; folder: string; existingFiles: string[] };

/** Choose a destination folder and report only the matching files that already exist. */
export function chooseArticlePairTarget(fileName: string): Promise<ArticlePairTarget | null> {
  return desktopRequest('chooseArticlePairTarget', fileName);
}

/** Commit one immutable Article v6 snapshot to the previously selected target. */
export function saveArticlePair(project: RenderProject, signature: string, pages: number,
  target: ArticlePairTarget, overwriteApproved: boolean):
  Promise<{ path: string; text: string; folder: string; folderPreferenceSaved: boolean } | null> {
  return desktopRequest('saveArticlePair', {
    project, document: projectDocument(project), fileName: cardFileName(project.title),
    signature, pages, path: target.path, overwriteApproved,
  });
}
