(() => {
  const works = window.PORTFOLIO_WORKS || [];
  const preview = document.querySelector('#work-preview');
  works.slice(0, 3).forEach((work, index) => {
    const link = document.createElement('a'); link.href = 'portfolio.html';
    link.setAttribute('aria-label', `Ver portfólio — ${work.title}`);
    const image = document.createElement('img'); image.src = work.cover.src;
    if (work.cover.type === 'video') image.src = work.cover.thumb;
    image.alt = `Tatuagem de Victor Siena Art — ${work.title}`; image.loading = 'lazy'; image.decoding = 'async';
    const word = document.createElement('span'); word.className = 'photo-word';
    word.textContent = ['Forma', 'Fluxo', 'Presença'][index];
    link.append(image, word); preview.append(link);
  });
  const header = document.querySelector('.site-header');
  const about = document.querySelector('#sobre');
  const head = document.querySelector('.marble-head');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const previewCards = [...preview.querySelectorAll('a')];
  let pointer = null;
  let scheduled = false;
  // The torn diagonal edges flatten as each section rises, like the tear closing.
  const cutSections = [document.querySelector('#trabalhos'), about];
  function updateCuts() {
    if (reduced.matches) { cutSections.forEach(section => section.style.removeProperty('--cut')); return; }
    cutSections.forEach(section => {
      const depth = parseFloat(getComputedStyle(section).marginTop) * -1 || 0;
      const progress = Math.min(1, Math.max(0, (innerHeight * .95 - section.getBoundingClientRect().top) / (innerHeight * .8)));
      const eased = progress * progress * (3 - 2 * progress);
      section.style.setProperty('--cut', `${(depth * (1 - eased * .7)).toFixed(1)}px`);
    });
  }
  function update() {
    scheduled = false; header.classList.toggle('is-scrolled', scrollY > 35);
    updateCuts();
    const previewTop = preview.getBoundingClientRect().top;
    previewCards.forEach(card => {
      const center = previewTop + card.offsetTop + card.offsetHeight / 2;
      const focus = mouse.matches || reduced.matches ? 0 : Math.max(0, 1 - Math.abs(center - innerHeight * .5) / (innerHeight * .42));
      card.style.setProperty('--photo-scale', String(1 + focus * .075));
      card.style.setProperty('--photo-lift', `${-8 * focus}px`);
      card.classList.toggle('is-scroll-highlight', focus > .4);
    });
    if (reduced.matches) { head.style.setProperty('--eye-y', '0px'); return; }
    // A white outline moves inside each black socket; the center stays hollow.
    const bounds = head.getBoundingClientRect();
    const verticalRange = 6;
    let x = 0, y = Math.max(-verticalRange, Math.min(verticalRange, (innerHeight * .5 - (bounds.top + bounds.height * .366)) / innerHeight * 38));
    if (mouse.matches && pointer) {
      const dx = pointer.x - (bounds.left + bounds.width * .573), dy = pointer.y - (bounds.top + bounds.height * .366);
      const distance = Math.hypot(dx, dy);
      const strength = Math.min(1, distance / 230);
      x = distance ? dx / distance * 12 * strength : 0;
      y = distance ? dy / distance * 6 * strength : 0;
    }
    head.style.setProperty('--eye-y', `${y}px`);
    head.style.setProperty('--eye-x', `${x}px`);
    head.style.setProperty('--eye-right-x', `${x * .65}px`);
    head.style.setProperty('--eye-right-y', `${y * .7}px`);
  }
  addEventListener('pointermove', event => {
    if (!mouse.matches || reduced.matches) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }, { passive: true });
  addEventListener('resize', update); reduced.addEventListener('change', update); mouse.addEventListener('change', update); update();
  const dialog = document.querySelector('.booking-dialog');
  const form = document.querySelector('#booking-form');
  const feedback = dialog.querySelector('.booking-status');
  let opener;
  const phone = String(window.VICTOR_CONFIG?.whatsapp || '').replace(/\D/g, '');
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = phone ? 'Enviar no WhatsApp' : 'Copiar meu pedido';
  submit.dataset.text = submitLabel;
  submit.querySelector('.btn-text').textContent = submitLabel;
  function openBooking(button, idea) {
    opener = button;
    if (idea) form.elements.idea.value = idea;
    feedback.textContent = '';
    dialog.showModal(); document.body.classList.add('booking-open');
    document.querySelector('main').inert = true;
    if (!reduced.matches) dialog.animate([{ transform: 'translateX(100%)', opacity: .3 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.22,1,.36,1)' });
    form.elements.name.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-booking], [data-idea]').forEach(button => button.addEventListener('click', event => {
    if (button.tagName === 'A') event.preventDefault();
    openBooking(button, button.dataset.idea);
  }));
  // Deep link from other pages: index.html#agendar opens the booking form.
  if (location.hash === '#agendar') {
    history.replaceState(null, '', location.pathname + location.search);
    const openFromLink = () => { if (!dialog.open) openBooking(null); };
    if (!document.querySelector('.intro')) openFromLink();
    else {
      addEventListener('intro:complete', openFromLink, { once: true });
      if (matchMedia('(max-width: 640px)').matches) setTimeout(openFromLink, 2000);
    }
  }
  function closeBooking() { dialog.close(); }
  dialog.querySelector('.booking-close').addEventListener('click', closeBooking);
  dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) closeBooking(); });
  dialog.addEventListener('close', () => { document.body.classList.remove('booking-open'); document.querySelector('main').inert = false; opener?.focus({ preventScroll: true }); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const text = ['Olá, Victor! Gostaria de conversar sobre uma tatuagem.', '', `Nome: ${data.get('name')}`, `Telefone: ${data.get('phone')}`, `Região: ${data.get('placement') || 'A definir'}`, `Tamanho: ${data.get('size') || 'A definir'}`, '', `Ideia: ${data.get('idea')}`, ...(data.get('reference') ? ['', `Referências: ${data.get('reference')}`] : []), '', 'Posso enviar as fotos de referência nesta conversa.'].join('\n');
    if (phone) { location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`; return; }
    try { await navigator.clipboard.writeText(text); feedback.textContent = 'Pedido copiado. Cole na conversa com o artista e anexe suas referências.'; }
    catch { feedback.textContent = text; feedback.style.whiteSpace = 'pre-wrap'; }
  });
})();
