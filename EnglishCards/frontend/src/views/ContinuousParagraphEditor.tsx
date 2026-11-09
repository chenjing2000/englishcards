import { useEffect, useRef, useState } from 'react';
import type { Paragraph } from '../models/project';

type Props = {
  label: string;
  paragraphs: Paragraph[];
  onChange: (value: string) => boolean;
  inputRef: (input: HTMLTextAreaElement | null) => void;
};

const serialize = (paragraphs: Paragraph[]) => paragraphs.map(item => item.text).join('\n\n');

function normalize(value: string) {
  const text = value.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n').trim();
  if (!text) return '';
  return text.split(/\n[\t ]*\n(?:[\t ]*\n)*/u)
    .map(part => part.split('\n').map(line => line.trim()).filter(Boolean).join(' ').trim())
    .filter(Boolean).join('\n\n');
}

export default function ContinuousParagraphEditor({ label, paragraphs, onChange, inputRef }: Props) {
  const canonical = serialize(paragraphs);
  const [draft, setDraft] = useState(canonical);
  const lastPublished = useRef(canonical);
  const textarea = useRef<HTMLTextAreaElement | null>(null);

  // Keep blank lines while the user types. Only external changes (Undo/Redo
  // or opening another article) replace the local editing buffer.
  useEffect(() => {
    if (canonical !== lastPublished.current) {
      lastPublished.current = canonical;
      setDraft(canonical);
    }
  }, [canonical]);

  useEffect(() => {
    const node = textarea.current;
    if (!node) return;
    const fit = () => {
      node.style.height = 'auto';
      node.style.height = `${Math.max(120, node.scrollHeight + 2)}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(node);
    return () => observer.disconnect();
  }, [draft]);

  return <textarea
    className="continuous-paragraph-input"
    aria-label={label}
    value={draft}
    ref={node => { textarea.current = node; inputRef(node); }}
    onChange={event => {
      const next = event.target.value;
      if (onChange(next)) {
        setDraft(next);
        lastPublished.current = normalize(next);
      }
    }}
    onBlur={() => {
      setDraft(serialize(paragraphs));
      lastPublished.current = serialize(paragraphs);
    }}
  />;
}
