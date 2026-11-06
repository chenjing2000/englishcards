import { useEffect, useState } from 'react';
import AutoSizeTextarea from './AutoSizeTextarea';

type Props = {
  label: string; value: string; multiline?: boolean;
  commit: (value: string) => void;
  inputRef: (input: HTMLInputElement | HTMLTextAreaElement | null) => void;
};

export default function EntryHeadInput({ label, value, multiline, commit, inputRef }: Props) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const finish = () => { if (draft !== value) commit(draft); };
  if (multiline) return <AutoSizeTextarea label={label} value={draft} onChange={setDraft} onBlur={finish} inputRef={inputRef}
    onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); } }} />;
  return <input type="text" aria-label={label} value={draft} ref={inputRef} onChange={event => setDraft(event.target.value)} onBlur={finish}
    onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.blur(); } }} />;
}
