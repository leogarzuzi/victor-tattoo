(() => {
  const video = document.querySelector('.intro video');
  const canvas = document.querySelector('.intro-background');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const colorSample = document.createElement('canvas');
  colorSample.width = colorSample.height = 1;
  const colorContext = colorSample.getContext('2d', { willReadFrequently: true });
  let marginColor = null;
  let running = false;
  function draw() {
    if (!canvas.isConnected) return;
    const width = innerWidth, height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
    if (video.readyState >= 2 && video.videoWidth) {
      const vw = video.videoWidth, vh = video.videoHeight;
      const scale = Math.min(width / vw, height / vh);
      const renderedHeight = vh * scale;
      const left = (width - vw * scale) / 2;
      const top = (height - renderedHeight) / 2;
      // A flat neutral margin follows only the background's average tone.
      // No copied texture, reflected figure or mirrored ink motion.
      if (left > .5) {
        if (colorContext) {
          colorContext.drawImage(video, 0, 0, vw * .025, vh * .08, 0, 0, 1, 1);
          const target = colorContext.getImageData(0, 0, 1, 1).data;
          marginColor = marginColor ? marginColor.map((value, i) => value + (target[i] - value) * .2) : [target[0], target[1], target[2]];
        }
        const color = marginColor || [76, 78, 77];
        ctx.fillStyle = `rgb(${color.map(Math.round).join(',')})`;
        ctx.fillRect(0, top, left + 1, renderedHeight);
        // The right edge of the composition is already black.
      }
    }
    if (!video.paused && !video.ended) {
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(draw);
      else requestAnimationFrame(draw);
    } else running = false;
  }
  video.addEventListener('playing', () => { if (!running) { running = true; draw(); } });
  video.addEventListener('loadeddata', draw, { once: true });
})();
