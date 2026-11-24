// Validates what the admin publishes, so the site layout always receives the shape it expects.
const storage = require('./storage');

// Editable texts and their maximum length. Keep in sync with data-edit attributes in the HTML.
const TEXTS = {
  heroLabel: 80, heroLead: 160,
  aboutBadge: 40, aboutLead: 90, aboutText1: 400, aboutText2: 300, aboutText3: 300,
  availIntro: 220, availNote: 160,
  service1Title: 40, service1Text: 220, service2Title: 40, service2Text: 220, service3Title: 40, service3Text: 220,
  contactText: 200, region: 80,
};
const MULTILINE = new Set(['aboutLead', 'contactText']);
const CONTENT_PREFIX = 'site/content-';

function fail(message) { const error = new Error(message); error.status = 400; throw error; }

function cleanText(value, max, multiline) {
  if (typeof value !== 'string') return '';
  let text = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
  text = multiline ? text.split('\n').map(line => line.trim()).join('\n').replace(/\n{3,}/g, '\n\n') : text.replace(/\n/g, ' ');
  return text.trim().slice(0, max);
}

// Media may live in the site's own assets folder or in this project's Blob store.
function cleanSrc(value) {
  if (typeof value !== 'string' || value.length > 600) return null;
  if (/^assets\/[\w\-./]+$/.test(value) && !value.includes('..')) return value;
  if (storage.isLocal() && /^\/local-blob\/media\/[\w\-./]+$/.test(value) && !value.includes('..')) return value;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com') && url.pathname.startsWith('/media/')) return url.href;
  } catch {}
  return null;
}

const slug = (value, fallback) => (String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || fallback);

function cleanMedia(media) {
  if (!media || !['image', 'video'].includes(media.type)) return null;
  const src = cleanSrc(media.src);
  const thumb = cleanSrc(media.thumb) || (media.type === 'image' ? src : null);
  if (!src || !thumb) return null;
  const width = Math.round(Number(media.width)), height = Math.round(Number(media.height));
  if (!(width > 0 && width < 20000 && height > 0 && height < 20000)) return null;
  return { type: media.type, src, thumb, width, height };
}

function validate(input) {
  if (!input || typeof input !== 'object') fail('Conteúdo inválido.');
  const texts = {};
  // Texts missing from the request are left out, so the page keeps what its HTML says.
  for (const [key, max] of Object.entries(TEXTS)) {
    if (typeof input.texts?.[key] === 'string') texts[key] = cleanText(input.texts[key], max, MULTILINE.has(key));
  }

  const whatsapp = String(input.whatsapp || '').replace(/\D/g, '');
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) fail('O WhatsApp precisa ter DDI + DDD + número, só dígitos (ex.: 5521999999999).');

  if (!Array.isArray(input.available) || input.available.length > 40) fail('Lista de disponíveis inválida.');
  const available = input.available.map((item, index) => {
    const title = cleanText(item?.title, 60);
    const src = cleanSrc(item?.image?.src);
    if (!title) fail(`O desenho disponível nº ${index + 1} está sem nome.`);
    if (!src) fail(`O desenho "${title}" está sem foto.`);
    return { title, note: cleanText(item?.note, 80), image: { src, alt: cleanText(item?.image?.alt, 200) || title } };
  });

  if (!Array.isArray(input.works) || input.works.length > 300) fail('Lista de trabalhos inválida.');
  const ids = new Set();
  const works = input.works.map((work, index) => {
    const title = cleanText(work?.title, 60);
    if (!title) fail(`O trabalho nº ${index + 1} está sem título.`);
    const media = (Array.isArray(work.media) ? work.media.slice(0, 80) : []).map(cleanMedia).filter(Boolean);
    if (!media.length) fail(`O trabalho "${title}" precisa de pelo menos uma foto ou vídeo.`);
    let id = slug(work.id || title, `trabalho-${index + 1}`);
    while (ids.has(id)) id += '-2';
    ids.add(id);
    return { id, title, cover: media[0], media };
  });
  if (!works.length) fail('O portfólio precisa de pelo menos um trabalho.');

  return { version: 1, updatedAt: new Date().toISOString(), texts, whatsapp, available, works };
}

const read = () => storage.readLatestJSON(CONTENT_PREFIX);

// Every uploaded file the published content no longer uses, and that is older than a few hours, is deleted.
function referenced(content) {
  const urls = new Set();
  for (const item of content.available) urls.add(item.image.src);
  for (const work of content.works) for (const media of work.media) { urls.add(media.src); urls.add(media.thumb); }
  return urls;
}

async function save(input) {
  const content = validate(input);
  await storage.writeJSON(CONTENT_PREFIX, content, 3);
  try {
    const used = referenced(content);
    const cutoff = Date.now() - 6 * 3600e3;
    const unused = (await storage.list('media/')).filter(item => !used.has(item.url) && item.uploadedAt.getTime() < cutoff);
    await storage.remove(unused);
  } catch (error) { console.error('cleanup failed', error); }
  return content;
}

module.exports = { read, save, validate, TEXTS };
