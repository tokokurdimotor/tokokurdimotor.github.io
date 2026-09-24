// Public content only. GitHub credentials never belong in this file or its data.
(() => {
  const page = location.pathname.split('/').pop() || 'index.html';
  const localImage = value => typeof value === 'string' && /^assets\/img\/[\w .%/-]+$/i.test(value) && !value.includes('..');
  async function load() {
    try {
      const response = await fetch('assets/data/site-content.json', { cache: 'no-store' });
      if (!response.ok) return;
      const content = await response.json();
      if (content.version !== 1) return;
      const safeKeys = ['name', 'phoneIntl', 'phoneDisplay', 'address', 'hours', 'hoursEn', 'mapsQuery', 'brandLabel', 'tagline'];
      for (const key of safeKeys) if (typeof content.site[key] === 'string') SITE[key] = content.site[key];
      for (const key of ['mapsUrl', 'mapEmbedUrl']) {
        try { const url = new URL(content.site[key]); if (url.protocol === 'https:' && /(^|\.)google\.com$|^maps\.app\.goo\.gl$/.test(url.hostname)) SITE[key] = url.href; } catch (_) {}
      }
      if (localImage(content.site.logo)) SITE.logo = content.site.logo;
      for (const lang of ['id', 'en']) for (const [key, value] of Object.entries(content.translations[lang] || {})) {
        if (Object.hasOwn(translations[lang], key) && typeof value === 'string') translations[lang][key] = value;
      }
      if (Array.isArray(content.gallery)) GALLERY.splice(0, GALLERY.length, ...content.gallery.filter(item => localImage(item.src)));
      const meta = content.pages[page];
      if (meta) {
        document.title = meta.title;
        document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
      }
      applyContactInfo(); applyLogo(); wireWhatsAppButtons(); applyI18n(getLang()); renderGallery();
      document.querySelectorAll('.brand-lockup > strong').forEach(el => { el.firstChild.textContent = SITE.brandLabel || 'KURDI MOTOR'; });
      document.querySelectorAll('.brand-lockup > small').forEach(el => { el.textContent = SITE.tagline || 'AUTO PARTS & SERVICE'; });
      document.querySelectorAll('[data-cms-text]').forEach(el => { const value = content.texts?.[page]?.[el.dataset.cmsText]; if (typeof value === 'string') el.textContent = value; });
      for (const [key, value] of Object.entries(content.images[page] || {})) {
        const image = [...document.querySelectorAll('[data-cms-image]')].find(img => img.dataset.cmsImage === key);
        if (image && localImage(value.src) && !image.closest('#galleryGrid')) { image.src = value.src; image.removeAttribute('srcset'); image.alt = value.alt; }
      }
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link => {
        const url = new URL(link.href); url.pathname = '/' + SITE.phoneIntl; link.href = url.href;
        if (link.classList.contains('footer-phone')) link.firstChild.textContent = SITE.phoneDisplay + ' ';
      });
      document.querySelectorAll('.footer-grid > div:last-child > p').forEach(el => { el.textContent = SITE.address; });
      try {
        const url = new URL(content.site.tiktokUrl);
        if (url.protocol === 'https:' && /(^|\.)tiktok\.com$/.test(url.hostname)) document.querySelectorAll('a[href*="tiktok.com/"]').forEach(el => { el.href = url.href; });
      } catch (_) {}
      document.dispatchEvent(new Event('content-ready'));
    } catch (_) { /* Keep the complete static website available when offline. */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
