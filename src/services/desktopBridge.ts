type Reply = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };
type WebViewBridge = {
  postMessage(message: { id: number; command: string; payload: unknown }): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<Reply>) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent<Reply>) => void): void;
};

function webView() {
  return (window as Window & { chrome?: { webview?: WebViewBridge } }).chrome?.webview;
}

export const isDesktop = () => typeof webView()?.postMessage === 'function';
let nextId = 0;

export function desktopRequest<T>(command: string, payload: unknown = null): Promise<T> {
  return new Promise((resolve, reject) => {
    const bridge = webView();
    if (!bridge) { reject(new Error('桌面文件服务不可用。')); return; }
    const id = ++nextId;
    const receive = ({ data }: MessageEvent<Reply>) => {
      if (data?.id !== id) return;
      bridge.removeEventListener('message', receive);
      if (data.ok) resolve(data.value as T);
      else reject(new Error(data.error));
    };
    bridge.addEventListener('message', receive);
    try { bridge.postMessage({ id, command, payload }); }
    catch (reason) { bridge.removeEventListener('message', receive); reject(reason); }
  });
}
