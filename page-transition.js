(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const style = document.createElement('style');
  style.textContent = 'html::after{content:"";position:fixed;inset:0;background:#000;z-index:10000;opacity:0;pointer-events:none;transition:opacity .55s ease}html.page-covered::after{opacity:1;pointer-events:auto}@media(prefers-reduced-motion:reduce){html::after{transition:none}}';
  document.head.append(style);
  let pending = false, changing = false;
  try { pending = sessionStorage.getItem('victor-page-transition') === '1'; sessionStorage.removeItem('victor-page-transition'); } catch {}
  // Cover every initial render too, including refresh and direct links.
  root.classList.add('page-covered');
  const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('page-covered')));
  addEventListener('pageshow', () => { changing = false; reveal(); });
  const wait = () => new Promise(resolve => setTimeout(resolve, reduced.matches ? 0 : 570));
  window.fadePageChange = async change => {
    if (changing) return;
    changing = true; root.classList.add('page-covered');
    await wait();
    try { await change(); } finally { reveal(); await wait(); changing = false; }
  };
  document.addEventListener('click', async event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.download || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
    event.preventDefault();
    if (changing) return;
    changing = true; root.classList.add('page-covered');
    await wait();
    try { sessionStorage.setItem('victor-page-transition', '1'); } catch {}
    location.assign(url.href);
  });
})();
