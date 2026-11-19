// "O próximo traço": an endless strip of available designs.
// It drifts slowly on its own, stops while pressed or focused, and follows the pointer when dragged.
(() => {
  const viewport = document.querySelector('.avail-carousel');
  if (!viewport) return;
  const track = viewport.querySelector('.avail-track');
  const originals = [...track.children];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const SPEED = 28; // px per second
  const DRAG_THRESHOLD = 6;

  // Repeat the set until one full loop always covers the visible width.
  let setWidth = 0;
  function measure() {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    setWidth = originals.reduce((sum, item) => sum + item.getBoundingClientRect().width + gap, 0);
  }
  function fill() {
    measure();
    let copies = track.children.length / originals.length;
    while (setWidth > 0 && copies * setWidth < setWidth + viewport.clientWidth + 1) {
      originals.forEach(item => {
        const clone = item.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('button').forEach(button => { button.tabIndex = -1; });
        track.append(clone);
      });
      copies += 1;
    }
  }
  fill();

  let offset = 0;
  let last = performance.now();
  let pressed = false, dragged = false, focused = false, visible = true;
  let startX = 0, pointerX = 0;
  const wrap = () => {
    if (!setWidth) return;
    offset %= setWidth;
    if (offset > 0) offset -= setWidth;
  };
  const render = () => { track.style.transform = `translate3d(${offset.toFixed(2)}px,0,0)`; };

  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if (!pressed && !focused && visible && !reduced.matches) { offset -= SPEED * dt; wrap(); render(); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pressed = true; dragged = false;
    startX = pointerX = event.clientX;
    viewport.classList.add('is-held');
  });
  addEventListener('pointermove', event => {
    if (!pressed) return;
    const dx = event.clientX - pointerX;
    pointerX = event.clientX;
    if (!dragged && Math.abs(event.clientX - startX) > DRAG_THRESHOLD) { dragged = true; viewport.classList.add('is-dragging'); }
    if (dragged) { offset += dx; wrap(); render(); }
  });
  const release = () => {
    if (!pressed) return;
    pressed = false;
    viewport.classList.remove('is-held', 'is-dragging');
    last = performance.now();
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  // A drag must not count as choosing a design.
  viewport.addEventListener('click', event => {
    if (!dragged) return;
    event.preventDefault(); event.stopImmediatePropagation();
    dragged = false;
  }, true);

  // Keyboard users get a still strip; a mouse click that focuses a card does not freeze it.
  viewport.addEventListener('focusin', event => { focused = event.target.matches(':focus-visible'); });
  viewport.addEventListener('focusout', () => { focused = false; last = performance.now(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; last = performance.now(); }).observe(viewport);
  addEventListener('resize', () => { fill(); wrap(); render(); });
  // Image sizes are known only after loading; re-measure when they arrive.
  track.querySelectorAll('img').forEach(image => { if (!image.complete) image.addEventListener('load', () => { measure(); wrap(); }, { once: true }); });
})();
