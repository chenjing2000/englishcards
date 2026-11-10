import { parseProject, projectDocument, type Project } from '../models/project';
import { desktopRequest } from './desktopBridge';
import { CardSaveCoordinator } from './cardSaveCoordinator';

export type LibraryEntry = { path: string; name: string };
export type LibraryDirectory = {
  path: string;
  folders: LibraryEntry[];
  files: LibraryEntry[];
};

/** Ask the Windows host for an explicit library root; cancellation returns null. */
export function chooseCardLibrary(): Promise<string | null> {
  return desktopRequest<string | null>('chooseCardLibrary');
}

/** Create an independent new Article v6 file, never overwriting an existing path. */
export function createCardFile(directory: string, article: Project): Promise<{ path: string; text: string } | null> {
  return desktopRequest<{ path: string; text: string } | null>('createCardFile', {
    directory,
    text: serializedCard(article),
  });
}

/** Load only one directory level; folder expansion initiates the next request. */
export function listCardDirectory(path: string): Promise<LibraryDirectory> {
  return desktopRequest<LibraryDirectory>('listCardDirectory', path);
}

export async function openCardFile(path: string): Promise<{ path: string; article: Project }> {
  const response = await desktopRequest<{ path: string; text: string }>('openCardFile', path);
  const article = parseProject(JSON.parse(response.text));
  await desktopRequest<boolean>('activateCardFile', response.path);
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
