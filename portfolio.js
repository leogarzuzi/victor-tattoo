(() => {
  const works = window.PORTFOLIO_WORKS || [];
  const track = document.querySelector('.gallery-track');
  const collection = document.querySelector('.collection');
  const bar = document.querySelector('.gallery-progress span');
  const position = document.querySelector('.gallery-position');
  const viewer = document.querySelector('.work-viewer');
  const slides = viewer.querySelector('.viewer-slides');
  const previous = viewer.querySelector('.viewer-prev');
  const next = viewer.querySelector('.viewer-next');
  const counter = viewer.querySelector('.viewer-counter');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 800px)');
  const favoritesKey = 'victor-siena:favorites:v1';
  const entries = works.flatMap(work => work.media.map((media, index) => ({ ...work, id: `${work.id}~${index}`, cover: media, media: [media] })));
  const validIds = new Set(entries.map(entry => entry.id));
  const mediaId = () => entries.find(entry => entry.cover.src === activeWork?.media[activeIndex]?.src)?.id;
  const normalize = ids => ids.flatMap(id => validIds.has(id) ? [id] : entries.filter(entry => entry.id.split('~')[0] === id && entry.cover.src === works.find(work => work.id === id)?.cover.src).map(entry => entry.id));
  function readFavorites() {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return new Set(Array.isArray(saved) ? normalize(saved) : []);
    } catch { return new Set(); }
  }
  let favorites = readFavorites(), onlyFavorites = false;
  const sharedIds = new URLSearchParams(location.search).get('saved');
  let sharedSelection = sharedIds === null ? null : new Set(normalize(sharedIds.split(',')));
  if (sharedSelection) onlyFavorites = true;
  const selectedWorks = () => entries.filter(work => (sharedSelection || favorites).has(work.id));
  const heart = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
  const filter = document.createElement('button');
  filter.className = 'favorites-filter'; filter.type = 'button';
  document.querySelector('main').append(filter);
  const favoritesHeading = document.createElement('div');
  favoritesHeading.className = 'favorites-heading'; favoritesHeading.hidden = true;
  favoritesHeading.innerHTML = '<h1>Seus favoritos <span class="favorites-total"></span></h1>';
  collection.prepend(favoritesHeading);
  const actions = document.createElement('div');
  actions.className = 'selection-actions'; actions.hidden = true;
  actions.innerHTML = '<button type="button" class="copy-selection">Copiar link ↗</button><button type="button" class="download-selection">Baixar seleção ↓</button>';
  collection.append(actions);
  actions.querySelector('.copy-selection').addEventListener('click', async event => {
    const button = event.currentTarget;
    const url = new URL('portfolio.html', location.href);
    url.searchParams.set('saved', selectedWorks().map(work => work.id).join(','));
    try {
      await navigator.clipboard.writeText(url.href);
      button.textContent = 'Link copiado ✓';
      setTimeout(() => { button.textContent = 'Copiar link ↗'; }, 2000);
    } catch { window.prompt('Copie o link da seleção:', url.href); }
  });
  actions.querySelector('.download-selection').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true; button.textContent = 'Preparando…';
    try { await window.downloadReferenceSheet(selectedWorks()); }
    catch { status.textContent = 'Não foi possível baixar a seleção. Tente novamente.'; }
    finally { button.disabled = false; button.textContent = 'Baixar seleção ↓'; }
  });
  const empty = document.createElement('p');
  empty.className = 'favorites-empty'; empty.textContent = 'Seus trabalhos favoritos aparecem aqui. Toque no coração de uma foto para salvar.';
  empty.hidden = true; document.querySelector('.gallery-stage').append(empty);
  const savedTrack = document.createElement('div'); savedTrack.className = 'saved-track'; savedTrack.hidden = true; document.querySelector('.gallery-stage').append(savedTrack);
  const status = document.createElement('span');
  status.className = 'favorites-status'; status.setAttribute('role', 'status');
  document.body.append(status);
  function favoriteButton(work) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'favorite-toggle'; button.dataset.workId = work.id;
    button.innerHTML = '<span class="love-heart" aria-hidden="true"><span class="bottom"></span><span class="round"></span></span>';
    button.addEventListener('click', () => {
      const id = mediaId();
      if (!id) return;
      const saving = !favorites.has(id);
      button.classList.remove('heart-saving', 'heart-removing');
      void button.offsetWidth;
      button.classList.add(saving ? 'heart-saving' : 'heart-removing');
      favorites.has(id) ? favorites.delete(id) : favorites.add(id);
      if (!favorites.has(id)) sharedSelection?.delete(id);
      try { localStorage.setItem(favoritesKey, JSON.stringify([...favorites])); }
      catch { status.textContent = 'Este navegador não permitiu salvar os favoritos. Eles durarão apenas nesta visita.'; }
      refreshFavorites();
    });
    return button;
  }
  function refreshFavorites() {
    document.querySelectorAll('.favorite-toggle').forEach(button => {
      const saved = favorites.has(mediaId());
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved ? 'Remover trabalho dos favoritos' : 'Salvar trabalho nos favoritos');
    });
    filter.innerHTML = heart + `<span>${onlyFavorites ? 'Ver todos' : 'Favoritos'} · ${favorites.size}</span>`;
    filter.setAttribute('aria-pressed', String(onlyFavorites));
    document.body.classList.toggle('showing-favorites', onlyFavorites);
    favoritesHeading.hidden = !onlyFavorites;
    const selection = sharedSelection || favorites;
    favoritesHeading.querySelector('.favorites-total').textContent = String(selection.size).padStart(2, '0');
    actions.hidden = !onlyFavorites;
    actions.querySelectorAll('button').forEach(button => { button.disabled = selection.size === 0; });
    let visibleIndex = 0;
    track.querySelectorAll('.work-card').forEach(card => {
      card.hidden = onlyFavorites;
      card.classList.toggle('is-large', !card.hidden && visibleIndex++ % 3 === 0);
    });
    const signature = [...selection].join('|');
    if (savedTrack.dataset.signature !== signature) {
      savedTrack.dataset.signature = signature;
      savedTrack.replaceChildren(...selectedWorks().map(work => {
        const card = document.createElement('figure'); card.className = 'work-card';
        const button = document.createElement('button'); button.type = 'button'; button.className = 'work-cover';
        button.setAttribute('aria-label', `Abrir foto — ${work.title}`);
        const image = document.createElement('img'); image.src = work.cover.thumb; image.alt = work.title; image.loading = 'lazy';
        button.append(image); card.append(button);
        button.addEventListener('click', () => openWork(work, button)); return card;
      }));
    }
    savedTrack.hidden = !onlyFavorites;
    empty.hidden = !onlyFavorites || selection.size > 0;
    layout();
  }
  filter.addEventListener('click', () => window.fadePageChange(() => {
    onlyFavorites = !onlyFavorites; sharedSelection = null;
    if (!onlyFavorites && location.search) history.replaceState(null, '', location.pathname);
    window.scrollTo({ top: 0, behavior: 'instant' }); refreshFavorites();
  }));
  addEventListener('storage', event => {
    if (event.key === favoritesKey || event.key === null) { favorites = readFavorites(); refreshFavorites(); }
  });
  let activeWork, activeIndex = 0, openingButton, busy = false;
  let horizontalDistance = 0, scrollTick = false, slideTick = false;
  const icon = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="6" y="3" width="11" height="12"/><path d="M3 6v11h11"/></svg>';
  for (const [index, work] of works.entries()) {
    const figure = document.createElement('figure');
    figure.className = 'work-card';
    figure.dataset.workId = work.id;
    const button = document.createElement('button');
    button.className = 'work-cover';
    button.type = 'button';
    button.setAttribute('aria-label', `Abrir ${work.title}, ${work.media.length} ${work.media.length === 1 ? 'mídia' : 'mídias'}`);
    const image = document.createElement('img');
    image.src = work.cover.thumb;
    image.alt = `Tatuagem de Victor Siena Art — ${work.title.toLowerCase()}`;
    image.width = work.cover.width; image.height = work.cover.height;
    image.loading = index < 3 ? 'eager' : 'lazy'; image.decoding = 'async';
    button.append(image);
    if (work.media.length > 1 || work.cover.type === 'video') {
      const badge = document.createElement('span'); badge.className = 'media-count'; badge.setAttribute('aria-hidden', 'true');
      badge.innerHTML = '<span class="mini-stack"><span class="mini-card"><img src="' + work.cover.thumb + '" alt=""></span></span>';
      badge.append(document.createTextNode(work.cover.type === 'video' ? 'Vídeo' : String(work.media.length)));
      button.append(badge);
    }
    const caption = document.createElement('figcaption');
    const title = document.createElement('span'); title.textContent = work.title;
    const detail = document.createElement('span'); detail.textContent = work.media.some(m => m.type === 'video') ? 'Foto / vídeo' : 'Fotografia';
    caption.append(title, detail); figure.append(button, caption); track.append(figure);
    button.addEventListener('click', () => openWork(work, button));
  }
  function layout() {
    horizontalDistance = Math.max(0, track.scrollWidth - innerWidth);
    collection.style.height = onlyFavorites || mobile.matches || reduced.matches ? '' : `${horizontalDistance + innerHeight}px`;
    updateScroll();
  }
  function updateScroll() {
    scrollTick = false;
    if (onlyFavorites || mobile.matches || reduced.matches) { track.style.transform = ''; return; }
    const offset = Math.max(0, Math.min(horizontalDistance, -collection.getBoundingClientRect().top));
    track.style.transform = `translate3d(${-offset}px,0,0)`;
    const progress = horizontalDistance ? offset / horizontalDistance : 0;
    bar.style.transform = `scaleX(${progress})`;
    position.textContent = String(Math.min(works.length, Math.floor(progress * works.length) + 1)).padStart(2, '0');
  }
  addEventListener('scroll', () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  addEventListener('resize', layout);
  mobile.addEventListener('change', layout); reduced.addEventListener('change', layout);
  document.fonts.ready.then(layout); refreshFavorites();

  function updateSlide() {
    slideTick = false;
    if (!activeWork) return;
    activeIndex = Math.max(0, Math.min(activeWork.media.length - 1, Math.round(slides.scrollLeft / Math.max(1, slides.clientWidth))));
    counter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(activeWork.media.length).padStart(2, '0')}`;
    previous.disabled = activeIndex === 0;
    next.disabled = activeIndex === activeWork.media.length - 1;
    const favorite = viewer.querySelector('.favorite-toggle');
    if (favorite) { favorite.setAttribute('aria-pressed', String(favorites.has(mediaId()))); favorite.setAttribute('aria-label', favorites.has(mediaId()) ? 'Remover esta foto dos favoritos' : 'Salvar esta foto nos favoritos'); }
    slides.querySelectorAll('video').forEach((video, i) => {
      const slideIndex = Number(video.closest('.viewer-slide').dataset.index);
      if (slideIndex !== activeIndex) video.pause();
    });
  }
  function move(direction) {
    if (!activeWork || busy) return;
    const index = Math.max(0, Math.min(activeWork.media.length - 1, activeIndex + direction));
    slides.scrollTo({ left: index * slides.clientWidth, behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  slides.addEventListener('scroll', () => { if (!slideTick) { slideTick = true; requestAnimationFrame(updateSlide); } }, { passive: true });
  previous.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
  viewer.addEventListener('keydown', event => {
    if (event.target.tagName === 'VIDEO') return;
    if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
  });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function fitRect(media) {
    const bounds = slides.getBoundingClientRect();
    const availableWidth = bounds.width - (mobile.matches ? 0 : innerWidth * .14);
    const availableHeight = bounds.height - 24;
    const ratio = Math.min(availableWidth / media.width, availableHeight / media.height);
    const width = media.width * ratio, height = media.height * ratio;
    return { left: bounds.left + (bounds.width - width) / 2, top: bounds.top + (bounds.height - height) / 2, width, height };
  }
  function makeClone(image, rect) {
    const clone = document.createElement('img'); clone.className = 'transition-clone'; clone.alt = '';
    clone.src = image.currentSrc || image.src;
    Object.assign(clone.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    viewer.append(clone); return clone;
  }
  function animateClone(clone, from, to) {
    const key = rect => ({ left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    return clone.animate([key(from), key(to)], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).finished.catch(() => {});
  }
  async function openWork(work, button) {
    if (busy || viewer.open) return;
    busy = true; activeWork = work; activeIndex = 0; openingButton = button;
    const coverRect = button.getBoundingClientRect();
    const cover = button.querySelector('img');
    // Put the chosen cover first, then retain the imported sequence of the other media.
    const coverIndex = work.media.findIndex(m => m.src === work.cover.src);
    const ordered = [...work.media];
    if (coverIndex > 0) ordered.unshift(...ordered.splice(coverIndex, 1));
    activeWork = { ...work, media: ordered };
    slides.replaceChildren();
    ordered.forEach((media, index) => {
      const slide = document.createElement('div'); slide.className = 'viewer-slide'; slide.dataset.index = String(index);
      if (media.type === 'video') {
        const video = document.createElement('video'); video.controls = true; video.playsInline = true; video.preload = index === 0 ? 'metadata' : 'none';
        video.poster = media.thumb; video.src = media.src; video.setAttribute('aria-label', `${work.title}, vídeo ${index + 1}`); slide.append(video);
      } else {
        const img = document.createElement('img'); img.src = media.src; img.alt = `${work.title} — vista ${index + 1}`;
        img.width = media.width; img.height = media.height; img.loading = index < 2 ? 'eager' : 'lazy'; img.decoding = 'async'; slide.append(img);
      }
      slides.append(slide);
    });
    viewer.querySelector('.viewer-title').textContent = work.title;
    viewer.querySelector('.favorite-toggle')?.remove();
    viewer.querySelector('.viewer-top').insertBefore(favoriteButton(work), viewer.querySelector('.viewer-close'));
    refreshFavorites();
    document.body.classList.add('viewer-open');
    document.querySelector('.site-header').inert = true;
    document.querySelector('main').inert = true;
    viewer.showModal();
    slides.scrollLeft = 0; updateSlide();
    const target = fitRect(ordered[0]);
    const first = slides.firstElementChild;
    if (!reduced.matches) {
      first.style.visibility = 'hidden';
      const clone = makeClone(cover, coverRect);
      requestAnimationFrame(() => viewer.classList.add('is-open'));
      await animateClone(clone, coverRect, target);
      first.style.visibility = ''; clone.remove();
    } else viewer.classList.add('is-open');
    busy = false;
    viewer.querySelector('.viewer-close').focus({ preventScroll: true });
  }
  async function closeWork() {
    if (!viewer.open || busy) return;
    busy = true;
    slides.querySelectorAll('video').forEach(video => video.pause());
    if (!reduced.matches && activeIndex === 0 && openingButton?.isConnected) {
      const first = slides.firstElementChild;
      const from = fitRect(activeWork.media[0]);
      const target = openingButton.getBoundingClientRect();
      const clone = makeClone(openingButton.querySelector('img'), from);
      first.style.visibility = 'hidden';
      viewer.style.opacity = '1';
      viewer.classList.add('is-closing');
      viewer.classList.remove('is-open');
      await animateClone(clone, from, target); clone.remove();
    } else {
      viewer.classList.remove('is-open');
      if (!reduced.matches) await sleep(400);
    }
    viewer.close(); slides.replaceChildren();
    viewer.classList.remove('is-closing'); viewer.style.opacity = '';
    document.body.classList.remove('viewer-open');
    document.querySelector('.site-header').inert = false;
    document.querySelector('main').inert = false;
    (openingButton?.closest('[hidden]') ? filter : openingButton)?.focus({ preventScroll: true });
    activeWork = null; busy = false;
  }
  viewer.querySelector('.viewer-close').addEventListener('click', closeWork);
  viewer.addEventListener('cancel', event => { event.preventDefault(); closeWork(); });
  slides.addEventListener('click', event => { if (event.target === slides || event.target.classList.contains('viewer-slide')) closeWork(); });
})();
