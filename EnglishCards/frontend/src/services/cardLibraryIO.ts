import { desktopRequest } from './desktopBridge';
export type LibraryEntry = { path: string; name: string };
export type LibraryDirectory = { path: string; folders: LibraryEntry[]; files: LibraryEntry[] };
export const lastCardLibrary = () => desktopRequest<string>('lastCardLibrary');
export const chooseCardLibrary = () => desktopRequest<string | null>('chooseCardLibrary');
export const listCardDirectory = (path: string) => desktopRequest<LibraryDirectory>('listCardDirectory', path);
export const saveLastCardLibrary = (path: string) => desktopRequest<boolean>('saveLastCardLibrary', path);

// Windows paths are identities, independent of picker casing and separators.
export const sameLibraryPath = (a: string | null, b: string | null) => a !== null && b !== null &&
  a.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase() === b.replaceAll('\\', '/').replace(/\/+$/, '').toLowerCase();
