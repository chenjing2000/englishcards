import { desktopRequest } from './desktopBridge';
export type LibraryEntry = { path: string; name: string };
export type LibraryDirectory = { path: string; folders: LibraryEntry[]; files: LibraryEntry[] };
export const lastCardLibrary = () => desktopRequest<string>('lastCardLibrary');
export const chooseCardLibrary = () => desktopRequest<string | null>('chooseCardLibrary');
export const listCardDirectory = (path: string) => desktopRequest<LibraryDirectory>('listCardDirectory', path);
export const saveLastCardLibrary = (path: string) => desktopRequest<boolean>('saveLastCardLibrary', path);
