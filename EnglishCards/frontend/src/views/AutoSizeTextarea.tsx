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
    const workspace = element.closest<HTMLElement>('.workspace');
    let previousWidth = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width;
      if (width !== previousWidth) {
        previousWidth = width;
        if (workspace?.dataset.resizing !== 'true') fit();
      }
    });
    const finishPaneResize = () => requestAnimationFrame(fit);
    observer.observe(element);
    window.addEventListener('editor-pane-resize-end', finishPaneResize);
    document.fonts.addEventListener('loadingdone', fit);
    return () => {
      observer.disconnect();
      window.removeEventListener('editor-pane-resize-end', finishPaneResize);
      document.fonts.removeEventListener('loadingdone', fit);
    };
  }, [value]);
  return <textarea aria-label={label} rows={1} value={value} ref={element => { input.current = element; inputRef(element); }}
    onChange={event => onChange(event.target.value)} onBlur={onBlur} onKeyDown={onKeyDown} />;
}
