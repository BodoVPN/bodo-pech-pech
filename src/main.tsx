import { createRoot } from 'react-dom/client';
import { App } from './app.tsx';

declare const __BPP_SHELL__: string;
const script = document.currentScript?.textContent ?? '';
const policy = document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content ?? '';
const pristine = __BPP_SHELL__.replace('__CSP__', () => policy).replace('__SCRIPT__', () => script);
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<App pristine={pristine} />);
