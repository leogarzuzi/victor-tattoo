// A small WhatsApp button that stays in the lower-right corner on every page.
(() => {
  const phone = String(window.VICTOR_CONFIG?.whatsapp || '').replace(/\D/g, '');
  const message = 'Olá, Victor! Quero conversar sobre um projeto 100% freehand para o meu corpo.';
  const link = document.createElement('a');
  link.className = 'whats-float';
  link.setAttribute('aria-label', 'Conversar com Victor no WhatsApp');
  link.href = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : 'index.html?intro=skip#agendar';
  if (phone) { link.target = '_blank'; link.rel = 'noopener'; }
  link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="bubble" d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5z"/><path class="phone" d="M8.7 7.4c.3-.5.6-.6.9-.6h.6c.2 0 .4.1.6.5l.8 1.9c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.4 0 .6.5.9 1.2 1.6 2.1 2.1.2.1.4.1.6 0l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.4 0 .6-.2 1.3-.7 1.7-.6.5-1.4.7-2.2.5-1.6-.4-3-1.3-4.1-2.5-1-1.1-1.8-2.4-2.1-3.8-.1-.7 0-1.5.4-2.1z"/></svg><span>WhatsApp</span>';
  document.body.append(link);
})();
