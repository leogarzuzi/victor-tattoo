(() => {
  const overlay = document.querySelector('.intro');
  const main = document.querySelector('main');
  const video = overlay.querySelector('video');
  if (new URLSearchParams(location.search).get('intro') === 'skip') {
    video.pause();
    overlay.remove();
    main.inert = false;
    return;
  }
  if (matchMedia('(max-width: 640px)').matches) {
    video.pause();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      overlay.remove();
      return;
    }
    main.inert = true;
    const portrait = main.querySelector('img');
    const ready = portrait.decode().catch(() => {});
    ready.then(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.classList.add('leaving');
        setTimeout(() => { overlay.remove(); main.inert = false; }, 1950);
      }));
    });
    return;
  }
  let finished = false;
  let fadeFrame;
  let lastOpacity = 1;
  function fadeVideoTail() {
    if (finished) return;
    if (Number.isFinite(video.duration) && video.duration > 0) {
      const fadeDuration = 1.3;
      const progress = Math.min(1, Math.max(0, (video.currentTime - (video.duration - fadeDuration)) / fadeDuration));
      const opacity = 1 - progress * progress * (3 - 2 * progress);
      lastOpacity = Math.min(lastOpacity, opacity);
      video.style.opacity = String(lastOpacity);
    }
    fadeFrame = requestAnimationFrame(fadeVideoTail);
  }
  function finish(immediate = false) {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(fadeFrame);
    // Hide the media before pausing so its decoded first frame cannot flash.
    video.style.opacity = '0';
    video.pause();
    main.inert = false;
    if (overlay.contains(document.activeElement)) document.activeElement.blur();
    if (immediate) {
      overlay.remove();
      dispatchEvent(new Event('intro:complete'));
      return;
    }
    overlay.classList.add('leaving');
    setTimeout(() => {
      overlay.remove();
      dispatchEvent(new Event('intro:complete'));
    }, 1950);
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(true); return; }
  main.inert = true;
  video.muted = true;
  video.addEventListener('playing', () => { cancelAnimationFrame(fadeFrame); fadeVideoTail(); });
  video.addEventListener('ended', () => finish(), { once: true });
  video.addEventListener('error', () => finish(), { once: true });
  video.querySelectorAll('source').forEach(source => source.addEventListener('error', () => {
    if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) finish();
  }, { once: true }));
  overlay.querySelector('button').addEventListener('click', () => finish());
  video.play().catch(() => finish());
})();
