// Admin panel for Victor Siena's site: portfolio, available designs and texts.
// Edits stay in this page until "Publicar no site"; a draft is kept in the browser meanwhile.
const BLOB_CLIENT = 'https://cdn.jsdelivr.net/npm/@vercel/blob@2.9.0/client/+esm';
const DRAFT_KEY = 'vs-admin:draft:v1';
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

// Editable texts — keys and limits match api/_lib/content.js and the data-edit attributes.
const TEXT_GROUPS = [
  { title: 'Capa', fields: [
    { key: 'heroLabel', label: 'Frase pequena acima do título', max: 80 },
    { key: 'heroLead', label: 'Subtítulo', max: 160, long: true },
  ] },
  { title: 'Sobre', fields: [
    { key: 'aboutBadge', label: 'Selo (ao lado da bandeira)', max: 40 },
    { key: 'aboutLead', label: 'Frase de abertura', max: 90, multiline: true },
    { key: 'aboutText1', label: 'Parágrafo 1', max: 400, long: true },
    { key: 'aboutText2', label: 'Parágrafo 2', max: 300, long: true },
    { key: 'aboutText3', label: 'Parágrafo 3', max: 300, long: true },
  ] },
  { title: 'Disponíveis', fields: [
    { key: 'availIntro', label: 'Texto ao lado do título', max: 220, long: true },
    { key: 'availNote', label: 'Instrução abaixo do carrossel', max: 160, long: true },
  ] },
  { title: 'Serviços', fields: [
    { key: 'service1Title', label: 'Serviço 1 · título', max: 40 }, { key: 'service1Text', label: 'Serviço 1 · texto', max: 220, long: true },
    { key: 'service2Title', label: 'Serviço 2 · título', max: 40 }, { key: 'service2Text', label: 'Serviço 2 · texto', max: 220, long: true },
    { key: 'service3Title', label: 'Serviço 3 · título', max: 40 }, { key: 'service3Text', label: 'Serviço 3 · texto', max: 220, long: true },
  ] },
  { title: 'Contato', fields: [
    { key: 'contactText', label: 'Texto de contato', max: 200, multiline: true },
    { key: 'region', label: 'Endereço / região (aparece no contato e no rodapé)', max: 80 },
    { key: 'whatsapp', label: 'WhatsApp (só números: 55 + DDD + número)', max: 15, special: true },
  ] },
];

const state = { storage: 'local', user: '', content: null, saved: '', tab: 'works', editing: null, pending: [] };
const $ = (selector, root = document) => root.querySelector(selector);

// ——— Small DOM helper ———
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'value') el.value = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  el.append(...children.flat().filter(child => child != null && child !== false));
  return el;
}

// Like replaceChildren, but skips empty values (null, false) used for optional parts.
const fill = (parent, ...children) => parent.replaceChildren(...children.flat(Infinity).filter(child => child != null && child !== false));

function toast(message, error = false) {
  const box = $('.toast');
  box.textContent = message;
  box.classList.toggle('error', error);
  box.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.hidden = true; }, error ? 6000 : 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Algo deu errado. Tente de novo.'); error.status = response.status; throw error; }
  return data;
}

function showView(name) {
  for (const view of document.querySelectorAll('.view')) view.hidden = view.id !== `view-${name}`;
}

// ——— Content: current site as defaults, published content on top ———
function readText(element) {
  return [...element.childNodes].map(node => node.nodeName === 'BR' ? '\n' : node.textContent).join('')
    .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
}

async function readDefaults() {
  const html = await (await fetch('/index.html', { cache: 'no-store' })).text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const texts = {};
  doc.querySelectorAll('[data-edit]').forEach(element => { if (!(element.dataset.edit in texts)) texts[element.dataset.edit] = readText(element); });
  const available = [...doc.querySelectorAll('.avail-item')].filter(item => !item.querySelector('.avail-own')).map(item => ({
    title: item.querySelector('.avail-caption strong')?.textContent.trim() || '',
    note: item.querySelector('.avail-caption small')?.textContent.trim() || '',
    image: { src: item.querySelector('img')?.getAttribute('src') || '', alt: item.querySelector('img')?.getAttribute('alt') || '' },
  }));
  const works = (window.PORTFOLIO_WORKS || []).map(work => ({ id: work.id, title: work.title, media: work.media.map(({ type, src, thumb, width, height }) => ({ type, src, thumb, width, height })) }));
  return { texts, whatsapp: window.VICTOR_CONFIG?.whatsapp || '', available, works };
}

function fromPublished(published, defaults) {
  return {
    texts: { ...defaults.texts, ...published.texts },
    whatsapp: published.whatsapp || defaults.whatsapp,
    available: published.available.map(({ title, note, image }) => ({ title, note, image: { src: image.src, alt: image.alt } })),
    works: published.works.map(({ id, title, media }) => ({ id, title, media })),
  };
}

async function loadContent() {
  const [defaults, { content: published }] = await Promise.all([readDefaults(), api('/api/content')]);
  state.content = published ? fromPublished(published, defaults) : defaults;
  state.saved = JSON.stringify(state.content);
  state.draft = readDraft();
}

const isDirty = () => JSON.stringify(state.content) !== state.saved;

function changed() {
  const dirty = isDirty();
  const bar = $('.publish-bar');
  bar.classList.toggle('is-dirty', dirty);
  const uploading = state.pending.length > 0;
  $('.publish-status').textContent = uploading ? 'Enviando arquivos…' : dirty ? 'Alterações ainda não publicadas.' : 'Tudo publicado.';
  $('#publish').disabled = !dirty || uploading;
  try {
    if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: state.saved, content: state.content }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

function readDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    return draft && JSON.stringify(draft.content) !== state.saved ? draft : null;
  } catch { return null; }
}

// ——— Media: resize photos in the browser, then upload ———
async function loadImage(file) {
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    const url = URL.createObjectURL(file);
    try { const image = new Image(); image.src = url; await image.decode(); return image; }
    catch { throw new Error(`Não consegui abrir "${file.name}". Envie fotos em JPG, PNG ou WEBP.`); }
    finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
}

const toBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));

async function encode(source, maxSide, quality) {
  const sourceWidth = source.videoWidth || source.width, sourceHeight = source.videoHeight || source.height;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceWidth * scale); canvas.height = Math.round(sourceHeight * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  let blob = await toBlob(canvas, 'image/webp', quality);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
  if (!blob) throw new Error('Não consegui preparar a imagem.');
  return { blob, width: canvas.width, height: canvas.height, ext: blob.type === 'image/webp' ? 'webp' : 'jpg' };
}

function once(target, event, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    target.addEventListener(event, () => { clearTimeout(timer); resolve(); }, { once: true });
    target.addEventListener('error', () => { clearTimeout(timer); reject(new Error('error')); }, { once: true });
  });
}

async function videoPoster(file) {
  const url = URL.createObjectURL(file);
  const video = h('video', { muted: true, playsinline: true, preload: 'auto' });
  video.muted = true; video.src = url;
  try {
    await once(video, 'loadeddata');
    video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    await once(video, 'seeked');
    return { poster: await encode(video, 720, 0.8), width: video.videoWidth, height: video.videoHeight };
  } catch { throw new Error(`Não consegui ler o vídeo "${file.name}". Envie em MP4.`); }
  finally { URL.revokeObjectURL(url); }
}

let blobClient;
async function uploadFile(pathname, blob, onProgress) {
  if (state.storage === 'local') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/upload?pathname=${encodeURIComponent(pathname)}`);
      xhr.setRequestHeader('Content-Type', blob.type);
      xhr.upload.onprogress = event => event.lengthComputable && onProgress(event.loaded / event.total);
      xhr.onload = () => {
        let data = {}; try { data = JSON.parse(xhr.responseText); } catch {}
        xhr.status === 200 ? resolve(data.url) : reject(Object.assign(new Error(data.error || 'Falha no envio.'), { status: xhr.status }));
      };
      xhr.onerror = () => reject(new Error('Falha de conexão no envio.'));
      xhr.send(blob);
    });
  }
  blobClient ||= await import(BLOB_CLIENT);
  const result = await blobClient.upload(pathname, blob, {
    access: 'public', handleUploadUrl: '/api/upload', contentType: blob.type,
    multipart: blob.size > 8 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onProgress(percentage / 100),
  });
  return result.url;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fileKind(file) {
  if (file.type.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop().toLowerCase();
  if (file.type.startsWith('video/') || VIDEO_TYPES[ext]) return 'video';
  return null;
}

// Prepares and uploads one file; resolves to a media item for the site.
async function processFile(file, onProgress, { photoOnly = false, maxSide = 2400 } = {}) {
  const kind = fileKind(file);
  if (!kind || (photoOnly && kind !== 'image')) throw new Error(`"${file.name}" não é ${photoOnly ? 'uma foto' : 'foto nem vídeo'}.`);
  const id = newId();
  if (kind === 'image') {
    const image = await loadImage(file);
    const full = await encode(image, maxSide, 0.86);
    if (photoOnly) {
      image.close?.();
      const src = await uploadFile(`media/${id}.${full.ext}`, full.blob, onProgress);
      return { type: 'image', src, thumb: src, width: full.width, height: full.height };
    }
    const thumb = await encode(image, 720, 0.8);
    image.close?.();
    const thumbUrl = await uploadFile(`media/${id}-thumb.${thumb.ext}`, thumb.blob, p => onProgress(p * 0.15));
    const src = await uploadFile(`media/${id}.${full.ext}`, full.blob, p => onProgress(0.15 + p * 0.85));
    return { type: 'image', src, thumb: thumbUrl, width: full.width, height: full.height };
  }
  if (file.size > MAX_VIDEO_BYTES) throw new Error(`O vídeo "${file.name}" passa de 100 MB.`);
  const ext = file.name.split('.').pop().toLowerCase();
  const type = file.type || VIDEO_TYPES[ext] || 'video/mp4';
  const video = file.type ? file : new File([file], file.name, { type });
  const { poster, width, height } = await videoPoster(video);
  const thumbUrl = await uploadFile(`media/${id}-thumb.${poster.ext}`, poster.blob, p => onProgress(p * 0.05));
  const src = await uploadFile(`media/${id}.${VIDEO_TYPES[ext] ? ext : 'mp4'}`, video, p => onProgress(0.05 + p * 0.95));
  return { type: 'video', src, thumb: thumbUrl, width, height };
}

// Uploads several files into a list, with a placeholder card per file while it is sent.
async function addFiles(files, target, options) {
  const jobs = [...files].map(file => {
    const job = { id: newId(), target, name: file.name, progress: 0, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '' };
    state.pending.push(job);
    return { job, file };
  });
  render(); changed();
  let failures = 0;
  for (const { job, file } of jobs) {
    try {
      const media = await processFile(file, progress => {
        job.progress = progress;
        const bar = document.querySelector(`[data-job="${job.id}"] .progress span`);
        if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
      }, options);
      options?.onDone ? options.onDone(media) : target.push(media);
    } catch (error) {
      failures += 1;
      toast(error.status === 401 ? 'Sua sessão expirou. Entre de novo.' : error.message, true);
      if (error.status === 401) { state.pending = []; showLogin(); return; }
    } finally {
      state.pending = state.pending.filter(item => item !== job);
      if (job.preview) URL.revokeObjectURL(job.preview);
    }
    render(); changed();
  }
  if (!failures) toast(jobs.length > 1 ? `${jobs.length} arquivos enviados. Publique para aparecer no site.` : 'Arquivo enviado. Publique para aparecer no site.');
}

function filePicker({ multiple = true, photoOnly = false, onPick }) {
  const input = h('input', { type: 'file', accept: photoOnly ? 'image/*' : 'image/*,video/mp4,video/webm,video/quicktime,.mov,.m4v', multiple, hidden: true });
  input.addEventListener('change', () => { if (input.files.length) onPick(input.files); input.remove(); });
  document.body.append(input);
  input.click();
}

function dropZone(label, hint, onFiles, photoOnly) {
  const zone = h('button', { type: 'button', class: 'drop' }, h('strong', {}, label), h('span', {}, hint));
  zone.addEventListener('click', () => filePicker({ photoOnly, onPick: onFiles }));
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('is-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
  zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('is-over'); if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files); });
  return zone;
}

function move(list, index, delta) {
  const to = index + delta;
  if (to < 0 || to >= list.length) return;
  [list[index], list[to]] = [list[to], list[index]];
  render(); changed();
}

// ——— Panels ———
function renderWorks(panel) {
  const works = state.content.works;
  if (state.editing && works.includes(state.editing)) return renderWork(panel, state.editing);
  state.editing = null;
  const draft = state.draft;
  fill(panel, 
    draft && h('div', { class: 'notice' },
      h('p', {}, 'Há alterações não publicadas da sua última visita.'),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-small', type: 'button', onClick: () => { state.draft = null; changed(); render(); } }, 'Descartar'),
        h('button', { class: 'btn btn-small btn-primary', type: 'button', onClick: () => { state.draft = null; state.content = draft.content; render(); changed(); toast('Rascunho recuperado.'); } }, 'Recuperar'))),
    h('div', { class: 'panel-head' },
      h('div', {}, h('h2', {}, 'Portfólio'), h('p', {}, 'Os 3 primeiros aparecem em “Trabalhos recentes” na página inicial.')),
      h('button', { class: 'btn btn-primary', type: 'button', onClick: () => { const work = { id: '', title: '', media: [] }; works.unshift(work); state.editing = work; render(); changed(); } }, '+ Novo trabalho')),
    h('ul', { class: 'rows' }, works.map((work, index) => {
      const photos = work.media.filter(media => media.type === 'image').length, videos = work.media.length - photos;
      return h('li', { class: 'row' },
        work.media[0] ? h('img', { class: 'row-thumb', src: work.media[0].thumb, alt: '', loading: 'lazy' }) : h('div', { class: 'row-thumb' }),
        h('div', { class: 'row-body' }, h('strong', {}, work.title || 'Sem título'), h('small', {}, [photos && `${photos} foto${photos > 1 ? 's' : ''}`, videos && `${videos} vídeo${videos > 1 ? 's' : ''}`].filter(Boolean).join(' · ') || 'Sem fotos')),
        h('div', { class: 'row-actions' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Subir', title: 'Subir', disabled: index === 0, onClick: () => move(works, index, -1) }, '↑'),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Descer', title: 'Descer', disabled: index === works.length - 1, onClick: () => move(works, index, 1) }, '↓'),
          h('button', { class: 'btn btn-small', type: 'button', onClick: () => { state.editing = work; render(); scrollTo(0, 0); } }, 'Editar'),
          h('button', { class: 'btn btn-small btn-danger', type: 'button', onClick: () => {
            if (!confirm(`Excluir o trabalho "${work.title || 'Sem título'}" com todas as fotos?`)) return;
            works.splice(works.indexOf(work), 1); render(); changed(); toast('Trabalho excluído. Publique para valer no site.');
          } }, 'Excluir')));
    })));
}

function mediaCard(media, index, list) {
  return h('li', { class: 'media-card' },
    h('img', { src: media.thumb, alt: '', loading: 'lazy' }),
    index === 0 ? h('span', { class: 'media-badge cover' }, 'Capa') : media.type === 'video' && h('span', { class: 'media-badge' }, '▶ Vídeo'),
    h('div', { class: 'media-tools' },
      h('button', { class: 'icon-btn', type: 'button', title: 'Mover para trás', 'aria-label': 'Mover para trás', disabled: index === 0, onClick: () => move(list, index, -1) }, '←'),
      h('button', { class: 'icon-btn', type: 'button', title: 'Mover para frente', 'aria-label': 'Mover para frente', disabled: index === list.length - 1, onClick: () => move(list, index, 1) }, '→'),
      h('button', { class: 'icon-btn', type: 'button', title: 'Usar como capa', 'aria-label': 'Usar como capa', disabled: index === 0, onClick: () => { list.unshift(...list.splice(index, 1)); render(); changed(); } }, '★'),
      h('button', { class: 'icon-btn danger', type: 'button', title: 'Excluir', 'aria-label': 'Excluir', onClick: () => { if (confirm('Excluir esta mídia?')) { list.splice(index, 1); render(); changed(); } } }, '✕')));
}

function pendingCards(target) {
  return state.pending.filter(job => job.target === target).map(job => h('li', { class: 'media-card uploading', dataset: { job: job.id } },
    job.preview ? h('img', { src: job.preview, alt: '' }) : h('div', { style: 'aspect-ratio:4/5' }),
    h('span', { class: 'media-badge' }, 'Enviando…'),
    h('div', { class: 'progress' }, h('span', { style: `width:${Math.round(job.progress * 100)}%` })),
    h('div', { class: 'media-tools' }, h('small', { class: 'muted' }, job.name.slice(0, 22)))));
}

function renderWork(panel, work) {
  const title = h('input', { value: work.title, maxlength: 60, placeholder: 'Ex.: Braço, Costas, Mão e pulso', onInput: () => { work.title = title.value; changed(); } });
  fill(panel, 
    h('button', { class: 'btn btn-small back', type: 'button', onClick: () => { state.editing = null; render(); } }, '← Todos os trabalhos'),
    h('label', { class: 'field' }, h('span', {}, 'Título do trabalho'), title),
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', {}, 'Fotos e vídeos'), h('p', {}, 'A primeira é a capa. Use ★ para escolher outra capa e as setas para mudar a ordem.'))),
    h('ul', { class: 'media-grid' }, work.media.map((media, index) => mediaCard(media, index, work.media)), pendingCards(work.media)),
    dropZone('+ Adicionar fotos ou vídeos', 'Toque para escolher ou arraste aqui. Vídeos em MP4, até 100 MB.', files => addFiles(files, work.media)),
    h('button', { class: 'btn btn-danger', type: 'button', onClick: () => {
      if (!confirm(`Excluir o trabalho "${work.title || 'Sem título'}" com todas as fotos?`)) return;
      state.content.works.splice(state.content.works.indexOf(work), 1); state.editing = null; render(); changed();
    } }, 'Excluir este trabalho'));
  if (!work.title) title.focus();
}

function renderAvailable(panel) {
  const items = state.content.available;
  const addDesign = files => addFiles(files, items, { photoOnly: true, maxSide: 1600, onDone: media => items.push({ title: 'Novo desenho', note: '', image: { src: media.src, alt: '' } }) });
  fill(panel, 
    h('div', { class: 'panel-head' },
      h('div', {}, h('h2', {}, 'Disponíveis'), h('p', {}, 'Desenhos do carrossel “O próximo traço”. O card “Um projeto seu” fica sempre no final.')),
      h('button', { class: 'btn btn-primary', type: 'button', onClick: () => filePicker({ photoOnly: true, onPick: addDesign }) }, '+ Novo desenho')),
    h('ul', { class: 'rows' }, items.map((item, index) => {
      const title = h('input', { value: item.title, maxlength: 60, onInput: () => { item.title = title.value; changed(); } });
      const note = h('input', { value: item.note, maxlength: 80, placeholder: 'Ex.: Mínimo 12 cm · R$ 600', onInput: () => { item.note = note.value; changed(); } });
      return h('li', { class: 'design' },
        h('div', { class: 'design-photo' }, h('img', { src: item.image.src, alt: '', loading: 'lazy' })),
        h('div', { class: 'design-fields' },
          h('label', { class: 'field' }, h('span', {}, 'Nome do desenho'), title),
          h('label', { class: 'field' }, h('span', {}, 'Linha de baixo (tamanho, preço…)'), note),
          h('div', { class: 'row-actions' },
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mover para trás', title: 'Mover para trás', disabled: index === 0, onClick: () => move(items, index, -1) }, '↑'),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mover para frente', title: 'Mover para frente', disabled: index === items.length - 1, onClick: () => move(items, index, 1) }, '↓'),
            h('button', { class: 'btn btn-small', type: 'button', onClick: () => filePicker({ multiple: false, photoOnly: true, onPick: files => addFiles(files, items, { photoOnly: true, maxSide: 1600, onDone: media => { item.image = { src: media.src, alt: item.image.alt }; } }) }) }, 'Trocar foto'),
            h('button', { class: 'btn btn-small btn-danger', type: 'button', onClick: () => { if (confirm(`Excluir "${item.title}" do carrossel?`)) { items.splice(index, 1); render(); changed(); } } }, 'Excluir'))));
    }), pendingCards(items)));
}

function renderTexts(panel) {
  const texts = state.content.texts;
  fill(panel, 
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', {}, 'Textos'), h('p', {}, 'Os títulos grandes ficam fixos para não quebrar o layout.'))),
    TEXT_GROUPS.map(group => h('section', { class: 'text-group' }, h('h3', {}, group.title), group.fields.map(field => {
      const value = field.special ? state.content.whatsapp : texts[field.key] || '';
      const counter = h('span', { class: 'counter' }, `${value.length}/${field.max}`);
      const tag = field.multiline || field.long ? 'textarea' : 'input';
      const input = h(tag, { value, maxlength: field.max, rows: field.multiline ? 3 : field.long ? 3 : null, inputmode: field.special ? 'numeric' : null });
      input.addEventListener('input', () => {
        if (field.special) { input.value = input.value.replace(/\D/g, ''); state.content.whatsapp = input.value; }
        else texts[field.key] = field.multiline ? input.value : input.value.replace(/\n/g, ' ');
        counter.textContent = `${input.value.length}/${field.max}`;
        changed();
      });
      if (!field.multiline && tag === 'textarea') input.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
      return h('label', { class: 'field' },
        h('span', { class: 'field-head' }, field.label, counter), input,
        field.multiline && h('small', {}, 'Enter quebra a linha no site.'));
    }))));
}

function renderAccount(panel) {
  const form = h('form', { class: 'text-group' },
    h('h3', {}, 'Trocar senha'),
    h('label', { class: 'field' }, h('span', {}, 'Senha atual'), h('input', { name: 'current', type: 'password', autocomplete: 'current-password', required: true })),
    h('label', { class: 'field' }, h('span', {}, 'Nova senha'), h('input', { name: 'password', type: 'password', autocomplete: 'new-password', minlength: 8, required: true })),
    h('label', { class: 'field' }, h('span', {}, 'Repita a nova senha'), h('input', { name: 'confirm', type: 'password', autocomplete: 'new-password', minlength: 8, required: true })),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Salvar nova senha'),
    h('p', { class: 'form-error', role: 'alert' }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('.form-error', form);
    message.classList.remove('form-ok');
    const { current, password, confirm: repeat } = Object.fromEntries(new FormData(form));
    if (password !== repeat) { message.textContent = 'As duas senhas novas não são iguais.'; return; }
    try {
      await api('/api/password', { method: 'POST', body: JSON.stringify({ current, password }) });
      form.reset(); message.classList.add('form-ok'); message.textContent = 'Senha trocada.';
    } catch (error) { message.textContent = error.message; }
  });
  fill(panel, 
    h('div', { class: 'panel-head' }, h('div', {}, h('h2', {}, 'Conta'), h('p', {}, `Você entrou como ${state.user}.`))),
    form);
}

const panels = { works: renderWorks, available: renderAvailable, texts: renderTexts, account: renderAccount };

function render() {
  if (!state.content) return;
  for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.tab === state.tab));
  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.hidden = panel.dataset.panel !== state.tab;
    if (!panel.hidden) panels[state.tab](panel);
  }
}

// ——— Publish ———
async function publish() {
  const button = $('#publish');
  button.disabled = true;
  $('.publish-status').textContent = 'Publicando…';
  try {
    const { content } = await api('/api/content', { method: 'PUT', body: JSON.stringify({ content: state.content }) });
    const editingIndex = state.content.works.indexOf(state.editing);
    state.content = fromPublished(content, { texts: state.content.texts, whatsapp: '' });
    state.editing = editingIndex >= 0 ? state.content.works[editingIndex] : null;
    state.saved = JSON.stringify(state.content);
    render(); changed();
    toast('Publicado! O site atualiza em até 1 minuto.');
  } catch (error) {
    if (error.status === 401) { toast('Sua sessão expirou. Entre de novo e publique outra vez.', true); showLogin(); }
    else toast(error.message, true);
    changed();
  }
}

// ——— Login flow ———
function showLogin(message = '') {
  showView('login');
  $('#login-form .form-error').textContent = message;
  $('#login-form [name=user]').focus();
}

async function openEditor() {
  showView('loading');
  try { if (!state.content) await loadContent(); }
  catch (error) { showView('login'); $('#login-form .form-error').textContent = error.message; return; }
  showView('editor');
  render(); changed();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, message = $('.form-error', form), button = $('button', form);
  message.textContent = ''; button.disabled = true;
  try {
    const result = await api('/api/session', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    state.user = result.user;
    form.reset();
    if (result.mustChange) { showView('password'); $('#first-password-form [name=password]').focus(); }
    else openEditor();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});

$('#first-password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, message = $('.form-error', form);
  const { password, confirm: repeat } = Object.fromEntries(new FormData(form));
  if (password !== repeat) { message.textContent = 'As duas senhas não são iguais.'; return; }
  try {
    await api('/api/password', { method: 'POST', body: JSON.stringify({ password }) });
    form.reset(); toast('Senha criada. Bem-vindo ao painel!');
    openEditor();
  } catch (error) {
    if (error.status === 401) showLogin(error.message); else message.textContent = error.message;
  }
});

$('#logout').addEventListener('click', async () => {
  if (isDirty() && !confirm('Há alterações não publicadas. Elas ficam guardadas neste navegador. Sair mesmo assim?')) return;
  await api('/api/session', { method: 'DELETE' }).catch(() => {});
  location.reload();
});

$('#publish').addEventListener('click', publish);
for (const tab of document.querySelectorAll('[data-tab]')) tab.addEventListener('click', () => { state.tab = tab.dataset.tab; render(); scrollTo(0, 0); });
addEventListener('beforeunload', event => { if (state.content && (isDirty() || state.pending.length)) { event.preventDefault(); event.returnValue = ''; } });

(async () => {
  try {
    const session = await api('/api/session');
    state.storage = session.storage;
    if (!session.user) return showLogin();
    state.user = session.user;
    if (session.mustChange) return showView('password');
    openEditor();
  } catch (error) { showLogin(error.message); }
})();
