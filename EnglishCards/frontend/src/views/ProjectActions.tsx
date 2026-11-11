import { useRef } from 'react';
type Props = { open: (file?: File) => Promise<void>; save: () => void };
export default function ProjectActions({ open, save }: Props) {
  const file = useRef<HTMLInputElement>(null);
  return <div className="project-actions" role="group" aria-label="项目文件操作">
    <input hidden ref={file} type="file" accept=".json,.txt,application/json,text/plain" aria-label="导入 Article JSON 或 TXT" onChange={event => { void open(event.target.files?.[0]); event.target.value = ''; }} />
    <button title="打开文章" aria-label="打开文章" onClick={() => file.current!.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V4h7l2 3h9v4M3 7h9M3 10h19l-3 10H3Z" /></svg></button>
    <button title="保存 JSON" aria-label="保存 JSON" onClick={save}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h13l4 4v14H3V3ZM7 3v7h10V3M7 21v-7h10v7" /></svg></button>
  </div>;
}
