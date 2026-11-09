import { useEffect, useRef, useState } from 'react';
import { parseHighlightInput } from '../models/project';
import AutoSizeTextarea from './AutoSizeTextarea';

type Props = {
  label: string;
  word: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: (input: HTMLTextAreaElement | null) => void;
};

/** Keeps the user's in-progress delimiter/spacing text while committing parsed rules on every keystroke. */
export default function HighlightInput({ label, word, value, onChange, inputRef }: Props) {
  const [draft, setDraft] = useState(value);
  const lastModelValue = useRef(value);
  const lastWord = useRef(word);

  useEffect(() => {
    if (value !== lastModelValue.current || word !== lastWord.current) {
      setDraft(value);
      lastModelValue.current = value;
      lastWord.current = word;
    }
  }, [value, word]);

  function change(next: string) {
    setDraft(next);
    lastModelValue.current = parseHighlightInput(next, word).join('; ');
    onChange(next);
  }

  return <AutoSizeTextarea label={label} value={draft} onChange={change} inputRef={inputRef} />;
}
