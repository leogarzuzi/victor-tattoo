(() => {
  const header = document.querySelector('.site-header');
  const toggle = header.querySelector('.menu-toggle');
  const brandLinks = [header.querySelector('.header-logo'), header.querySelector('.header-name')];
  function close() {
    header.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    brandLinks.forEach(link => { link.inert = false; });
  }
  toggle.addEventListener('click', () => {
    header.classList.add('menu-animate');
    const box = toggle.getBoundingClientRect();
    header.style.setProperty('--menu-x', `${box.left + box.width / 2}px`);
    header.style.setProperty('--menu-y', `${box.top + box.height / 2}px`);
    const open = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    brandLinks.forEach(link => { link.inert = open; });
  });
  header.querySelectorAll('a').forEach(link => link.addEventListener('click', close));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('menu-open')) { close(); toggle.focus(); }
    if (event.key === 'Tab' && header.classList.contains('menu-open') && matchMedia('(max-width: 640px)').matches) {
      const links = [...header.querySelectorAll('.header-nav a')];
      const first = toggle, last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', event => { if (!header.contains(event.target)) close(); });
})();
