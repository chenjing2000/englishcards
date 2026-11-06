import { useLayoutEffect, useState } from 'react';

type Props = { error: string; warning: { text: string } | null; closeError: () => void };
export default function NotificationBar({ error, warning, closeError }: Props) {
  const [displayed, setDisplayed] = useState<{ text: string; kind: 'error' | 'warning' } | null>(null);
  const open = !!(error || warning);
  useLayoutEffect(() => {
    if (error) setDisplayed({ text: error, kind: 'error' });
    else if (warning) setDisplayed({ text: warning.text, kind: 'warning' });
    else {
      // A message can end before the opening transition starts, so transitionend is not guaranteed.
      const timer = setTimeout(() => setDisplayed(null), 200);
      return () => clearTimeout(timer);
    }
  }, [error, warning]);
  return <div className="notice-shell" aria-label="信息提示栏" data-open={open}
    onTransitionEnd={event => { if (event.target === event.currentTarget && !open) setDisplayed(null); }}>
    <div className="notice-clip"><div className={`notice${displayed ? ` notice-${displayed.kind}` : ''}`}>
      {displayed && <div role={open ? displayed.kind === 'error' ? 'alert' : 'status' : undefined}>
        {displayed.kind === 'error' ? 'Error:' : 'Warning:'} {displayed.text}
        {error && <button onClick={closeError}>关闭</button>}
      </div>}
    </div></div>
  </div>;
}
