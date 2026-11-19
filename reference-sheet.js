// Build a printable collection locally; no uploaded photos or external services.
(() => {
  const encoder = new TextEncoder();
  function makePdf(pages) {
    const chunks = [], offsets = [0]; let size = 0;
    const write = value => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); size += bytes.length; };
    const object = (id, body) => { offsets[id] = size; write(`${id} 0 obj\n${body}\nendobj\n`); };
    write('%PDF-1.4\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
    pages.forEach((bytes, i) => {
      const id = 3 + i * 3;
      object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Photo ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
      offsets[id + 1] = size;
      write(`${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1680 /Height 2376 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
      write(bytes); write('\nendstream\nendobj\n');
      const commands = 'q\n595.28 0 0 841.89 0 0 cm\n/Photo Do\nQ\n';
      object(id + 2, `<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`);
    });
    const xref = size;
    write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach(offset => write(`${String(offset).padStart(10, '0')} 00000 n \n`));
    write(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }
  window.downloadReferenceSheet = async works => {
    if (!works.length) return;
    await document.fonts.load('40px "Cinzel Decorative"');
    const pages = [];
    for (let start = 0; start < works.length; start += 4) {
      const canvas = document.createElement('canvas'); canvas.width = 1680; canvas.height = 2376;
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#111'; context.font = '40px "Cinzel Decorative", serif';
      context.fillText('VICTORSIENAART', 64, 94);
      const group = works.slice(start, start + 4);
      const images = await Promise.all(group.map(async work => {
        const image = new Image(); image.src = work.cover.type === 'video' ? work.cover.thumb : work.cover.src;
        await image.decode(); return image;
      }));
      images.forEach((image, index) => {
        const x = 64 + (index % 2) * 796, y = 160 + Math.floor(index / 2) * 1090;
        const width = 756, height = 1010;
        // Preserve the entire photograph and its proportions within each cell.
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        context.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
      });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .94));
      if (!blob) throw new Error('Could not render selection');
      pages.push(new Uint8Array(await blob.arrayBuffer()));
    }
    const url = URL.createObjectURL(makePdf(pages));
    const link = document.createElement('a'); link.href = url; link.download = 'victorsienaart-selecao.pdf';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
})();
