import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

/**
 * Prints a React element in an isolated iframe so the app UI never leaks into the print.
 * App stylesheets are cloned so Tailwind classes work inside the document.
 */
export const printElement = (element, { title = 'Print' } = {}) =>
  new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><div id="p"></div></body></html>`);
    doc.close();
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => doc.head.appendChild(n.cloneNode(true)));
    const root = createRoot(doc.getElementById('p'));
    flushSync(() => root.render(element));

    const imgs = [...doc.images];
    const ready = Promise.all([
      doc.fonts?.ready,
      ...imgs.map((img) => (img.complete ? null : new Promise((r) => { img.onload = r; img.onerror = r; }))),
    ]);
    ready.then(() => setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { root.unmount(); iframe.remove(); resolve(); }, 500);
    }, 250));
  });
