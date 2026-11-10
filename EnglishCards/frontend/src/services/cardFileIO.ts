import { parseProject, projectDocument, type Project } from '../models/project';
import { desktopRequest } from './desktopBridge';
import { CardSaveCoordinator } from './cardSaveCoordinator';

export type LibraryEntry = { path: string; name: string };
export type LibraryDirectory = {
  path: string;
  folders: LibraryEntry[];
  files: LibraryEntry[];
};

/** Load only one directory level; folder expansion initiates the next request. */
export function listCardDirectory(path: string): Promise<LibraryDirectory> {
  return desktopRequest<LibraryDirectory>('listCardDirectory', path);
}

export async function openCardFile(path: string): Promise<{ path: string; article: Project }> {
  const response = await desktopRequest<{ path: string; text: string }>('openCardFile', path);
  return { path: response.path, article: parseProject(JSON.parse(response.text)) };
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
