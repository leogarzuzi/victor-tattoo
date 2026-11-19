(() => {
  const video = document.querySelector('.intro video');
  const canvas = document.querySelector('.contact-ripple');
  const ctx = canvas.getContext('2d');
  if (!ctx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const sample = document.createElement('canvas');
  const size = 320;
  canvas.width = canvas.height = sample.width = sample.height = size;
  const source = sample.getContext('2d', { willReadFrequently: true });
  if (!source) return;
  const output = ctx.createImageData(size, size);
  let token, stopped = false;
  function draw() {
    if (stopped || !canvas.isConnected) return;
    const age = video.currentTime - .82;
    ctx.clearRect(0, 0, size, size);
    if (age > 0 && age < 1.05 && video.readyState >= 2) {
      const vw = video.videoWidth, vh = video.videoHeight;
      const scale = innerWidth <= 640 ? Math.min(innerWidth / vw, innerHeight / vh) : Math.max(innerWidth / vw, innerHeight / vh);
      const patch = vh * .24;
      const cx = vw * .714, cy = vh * .579;
      canvas.style.width = canvas.style.height = `${patch * scale}px`;
      canvas.style.left = `${(innerWidth - vw * scale) / 2 + (cx - patch / 2) * scale}px`;
      canvas.style.top = `${(innerHeight - vh * scale) / 2 + (cy - patch / 2) * scale}px`;
      source.drawImage(video, cx - patch / 2, cy - patch / 2, patch, patch, 0, 0, size, size);
      const input = source.getImageData(0, 0, size, size).data;
      const strength = Math.sin(Math.PI * age / 1.05) * 5;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = x - size / 2, dy = y - size / 2;
        const r = Math.hypot(dx, dy);
        const envelope = Math.max(0, 1 - r / (size * .47));
        const wave = Math.sin(r * .16 - age * 19) * strength * envelope ** 2;
        const factor = r > 0 ? wave / r : 0;
        const sx = Math.min(size - 1, Math.max(0, Math.round(x + dx * factor)));
        const sy = Math.min(size - 1, Math.max(0, Math.round(y + dy * factor)));
        const i = (y * size + x) * 4, j = (sy * size + sx) * 4;
        output.data[i] = input[j]; output.data[i + 1] = input[j + 1]; output.data[i + 2] = input[j + 2];
        output.data[i + 3] = Math.round(255 * Math.min(1, envelope * 8));
      }
      ctx.putImageData(output, 0, 0);
    }
    token = requestAnimationFrame(draw);
  }
  video.addEventListener('playing', () => { if (!token) token = requestAnimationFrame(draw); }, { once: true });
  const stop = () => { stopped = true; cancelAnimationFrame(token); ctx.clearRect(0, 0, size, size); };
  video.addEventListener('ended', stop, { once: true });
  video.addEventListener('pause', stop, { once: true });
})();
