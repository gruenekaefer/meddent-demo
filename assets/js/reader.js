// PDF reader, adapted from static/js/pdf-reader.js in meddent-lms.
let current = null;

export async function openReader(root, url) {
  if (current) current.close();
  // Closing must never throw: it runs on every page change.
  const session = {
    closed: false, doc: null, task: null,
    close() { this.closed = true; try { this.task?.destroy(); } catch { /* already closed */ } },
  };
  current = session;

  const $ = selector => root.querySelector(selector);
  const status = $('#pdf-status');
  const canvas = $('#pdf-canvas');
  const context = canvas.getContext('2d');
  let pageNumber = 1;
  let zoom = 1;
  let renderTask = null;
  let serial = 0;
  const textCache = new Map();

  let pdfjs;
  try {
    pdfjs = await import('./vendor/pdfjs/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;
  } catch {
    status.textContent = 'The PDF reader could not load. Use Open in new tab instead.';
    return;
  }

  async function pageText(n) {
    if (!textCache.has(n)) {
      const page = await session.doc.getPage(n);
      const content = await page.getTextContent();
      textCache.set(n, content.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join(''));
    }
    return textCache.get(n);
  }

  async function render() {
    if (session.closed || !session.doc) return;
    const mine = ++serial;
    try {
      if (renderTask) { renderTask.cancel(); try { await renderTask.promise; } catch { /* cancelled */ } }
      const page = await session.doc.getPage(pageNumber);
      if (mine !== serial || session.closed) return;
      const base = page.getViewport({ scale: 1 });
      const available = Math.max(220, root.clientWidth - 48);
      const viewport = page.getViewport({ scale: Math.min(1.5, available / base.width) * zoom });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const pages = session.doc.numPages;
      $('#pdf-page').textContent = pageNumber;
      $('#pdf-pages').textContent = pages;
      $('#pdf-zoom').textContent = `${Math.round(zoom * 100)}%`;
      $('#pdf-prev').disabled = pageNumber === 1;
      $('#pdf-next').disabled = pageNumber === pages;
      renderTask = page.render({ canvasContext: context, viewport, transform: [dpr, 0, 0, dpr, 0, 0] });
      await renderTask.promise;
      if (mine !== serial || session.closed) return;
      $('#pdf-text').textContent = (await pageText(pageNumber)) || 'No selectable text on this page.';
      status.textContent = `${pages} page${pages === 1 ? '' : 's'} · Reading progress is saved when you select Mark as complete.`;
    } catch (error) {
      if (error?.name !== 'RenderingCancelledException' && !session.closed) {
        status.textContent = 'This page could not be displayed. Use Open in new tab instead.';
      }
    }
  }

  try {
    session.task = pdfjs.getDocument({ url, isEvalSupported: false, enableXfa: false });
    session.doc = await session.task.promise;
    if (session.closed) { session.close(); return; }
    await render();
  } catch {
    if (!session.closed) status.textContent = 'The PDF reader could not open this file. Use Open in new tab instead.';
    return;
  }

  $('#pdf-prev').addEventListener('click', () => { if (pageNumber > 1) { pageNumber--; render(); } });
  $('#pdf-next').addEventListener('click', () => { if (pageNumber < session.doc.numPages) { pageNumber++; render(); } });
  $('#pdf-in').addEventListener('click', () => { zoom = Math.min(2.5, zoom + 0.25); render(); });
  $('#pdf-out').addEventListener('click', () => { zoom = Math.max(0.5, zoom - 0.25); render(); });
  $('#pdf-fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen();
      render();
    } catch {
      status.textContent = 'Full screen is not available in this browser. Use Open in new tab.';
    }
  });
  $('#pdf-search-form').addEventListener('submit', async event => {
    event.preventDefault();
    const term = $('#pdf-search').value.trim().toLowerCase();
    if (!term) return;
    status.textContent = 'Searching…';
    const pages = session.doc.numPages;
    for (let offset = 0; offset < pages; offset++) {
      const n = ((pageNumber - 1 + offset) % pages) + 1;
      if ((await pageText(n)).toLowerCase().includes(term)) {
        pageNumber = n;
        await render();
        $('.pdf-text').open = true;
        status.textContent = `Text found on page ${n}. Open Accessible text below to read the match.`;
        return;
      }
    }
    status.textContent = 'No matching text found.';
  });

  let resizeTimer;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); };
  window.addEventListener('resize', onResize);
  const close = session.close.bind(session);
  session.close = () => { window.removeEventListener('resize', onResize); close(); };
}

export function closeReader() {
  if (current) { current.close(); current = null; }
}
