// Applies what was published in the admin panel (window.SITE_CONTENT, from /api/content).
// Runs before the page scripts, so they build the carousel and the portfolio from it.
// When nothing was published yet, the page keeps the content written in the HTML.
(() => {
  const content = window.SITE_CONTENT;
  if (!content || typeof content !== 'object') return;

  if (Array.isArray(content.works) && content.works.length) window.PORTFOLIO_WORKS = content.works;
  if (content.whatsapp) window.VICTOR_CONFIG = Object.assign(window.VICTOR_CONFIG || {}, { whatsapp: content.whatsapp });

  // Line breaks typed in the admin become <br>, without ever reading text as HTML.
  function setText(element, value) {
    const lines = String(value).split('\n');
    element.replaceChildren(...lines.flatMap((line, index) => index ? [document.createElement('br'), line] : [line]));
  }
  const texts = content.texts || {};
  document.querySelectorAll('[data-edit]').forEach(element => {
    const value = texts[element.dataset.edit];
    if (typeof value !== 'string') return;
    setText(element, value);
    element.hidden = !value;
  });

  // "O próximo traço": rebuild the designs, keeping the fixed "Um projeto seu" card at the end.
  const track = document.querySelector('.avail-track');
  if (track && Array.isArray(content.available)) {
    const template = track.querySelector('.avail-item:not(:has(.avail-own))');
    const own = track.querySelector('.avail-own')?.closest('.avail-item');
    if (template) {
      const items = content.available.map(item => {
        const li = template.cloneNode(true);
        const card = li.querySelector('.avail-card');
        card.dataset.idea = `Tenho interesse no desenho disponível: ${item.title}.`;
        const image = li.querySelector('img');
        image.src = item.image.src;
        image.alt = item.image.alt || item.title;
        li.querySelector('.avail-caption strong').textContent = item.title;
        const note = li.querySelector('.avail-caption small');
        note.textContent = item.note || '';
        note.hidden = !item.note;
        return li;
      });
      track.replaceChildren(...items, ...(own ? [own] : []));
    }
  }
})();
