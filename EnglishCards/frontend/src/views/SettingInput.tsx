import { useEffect, useState } from 'react';

type Props = { id: string; value: number; decimal: boolean; onChange: (value: number) => void };
const numericValue = (text: string) => /^\d+(?:\.\d*)?$/.test(text) ? Number(text) : NaN;

export default function SettingInput({ id, value, decimal, onChange }: Props) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(current => Number.isFinite(value)
      ? numericValue(current) === value ? current : String(value)
      : Number.isFinite(numericValue(current)) ? '' : current);
  }, [value]);
  return <input id={id} type="text" inputMode={decimal ? 'decimal' : 'numeric'} spellCheck={false} value={draft}
    onChange={event => {
      const text = event.target.value;
      setDraft(text);
      onChange(numericValue(text));
    }} />;
}
