import { useLayoutEffect, useRef } from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: (input: HTMLTextAreaElement | null) => void;
  onBlur?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
};

export default function AutoSizeTextarea({ label, value, onChange, inputRef, onBlur, onKeyDown }: Props) {
  const input = useRef<HTMLTextAreaElement | null>(null);
  useLayoutEffect(() => {
    const element = input.current!;
    function fit() {
      element.style.height = 'auto';
      const style = getComputedStyle(element);
      element.style.height = `${Math.ceil(element.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth))}px`;
    }
    fit();
    let previousWidth = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width;
      if (width !== previousWidth) { previousWidth = width; fit(); }
    });
    observer.observe(element);
    document.fonts.addEventListener('loadingdone', fit);
    return () => { observer.disconnect(); document.fonts.removeEventListener('loadingdone', fit); };
  }, [value]);
  return <textarea aria-label={label} rows={1} value={value} ref={element => { input.current = element; inputRef(element); }}
    onChange={event => onChange(event.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} />;
}
