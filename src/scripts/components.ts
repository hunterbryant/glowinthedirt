/**
 * Replacements for the bits of webflow.js the site used: delayed page links,
 * the image slider on /work, the image lightbox on project pages, and the
 * background videos. They use Webflow's own class names so the existing CSS applies.
 */

/** Links that wait for their exit animation before navigating (was a jQuery snippet in Webflow's custom code). */
export function initDelayLinks() {
  const delays: [string, number][] = [['a.delay-link', 1000], ['a.delay-link-short', 300]];
  for (const [selector, ms] of delays) {
    document.querySelectorAll<HTMLAnchorElement>(selector).forEach((a) => {
      a.addEventListener('click', (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const href = a.getAttribute('href');
        if (href) window.setTimeout(() => { window.location.href = href; }, ms);
      });
    });
  }
  // Coming back with the browser's back button can restore a page mid-animation; reload it fresh.
  window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload(); });
}

export function initSliders() {
  document.querySelectorAll<HTMLElement>('.w-slider').forEach((slider) => {
    const mask = slider.querySelector<HTMLElement>('.w-slider-mask');
    if (!mask) return;
    const slides = [...mask.querySelectorAll<HTMLElement>(':scope > .w-slide')];
    if (!slides.length) return;
    const duration = Number(slider.dataset.duration ?? 500);
    const easing = slider.dataset.easing ?? 'ease';
    const infinite = slider.dataset.infinite !== 'false';
    const autoplay = slider.dataset.autoplay === 'true';
    const delay = Number(slider.dataset.delay ?? 4000);
    const nav = slider.querySelector<HTMLElement>('.w-slider-nav');
    let index = 0;

    const dots = slides.map((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'w-slider-dot';
      dot.setAttribute('role', 'button');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('aria-label', `Show slide ${i + 1} of ${slides.length}`);
      dot.addEventListener('click', () => go(i));
      nav?.appendChild(dot);
      return dot;
    });

    const go = (i: number) => {
      if (infinite) i = (i + slides.length) % slides.length;
      else i = Math.max(0, Math.min(slides.length - 1, i));
      index = i;
      slides.forEach((s, n) => {
        s.style.transition = `transform ${duration}ms ${easing}`;
        s.style.transform = `translateX(${-index * 100}%)`;
        s.setAttribute('aria-hidden', String(n !== index));
      });
      dots.forEach((d, n) => d.classList.toggle('w-active', n === index));
    };

    slider.querySelector('.w-slider-arrow-left')?.addEventListener('click', () => go(index - 1));
    slider.querySelector('.w-slider-arrow-right')?.addEventListener('click', () => go(index + 1));

    if (slider.dataset.disableSwipe !== 'true') {
      let startX: number | null = null;
      mask.addEventListener('pointerdown', (e) => { startX = e.clientX; });
      mask.addEventListener('pointerup', (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      });
    }

    if (autoplay) window.setInterval(() => go(index + 1), delay + duration);
    go(0);
  });
}

export function initLightbox() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[data-lightbox]')];
  if (!links.length) return;

  let backdrop: HTMLElement | null = null;
  let items: string[] = [];
  let current = 0;

  const close = () => {
    const el = backdrop;
    backdrop = null;
    if (el) {
      el.style.opacity = '0';
      window.setTimeout(() => el.remove(), 300);
    }
    document.documentElement.classList.remove('w-lightbox-noscroll');
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  };

  const show = (i: number) => {
    if (!backdrop) return;
    current = (i + items.length) % items.length;
    const img = backdrop.querySelector<HTMLImageElement>('.w-lightbox-image')!;
    img.src = items[current];
    backdrop.querySelectorAll('.w-lightbox-item').forEach((t, n) => t.classList.toggle('w-lightbox-active', n === current));
    const single = items.length < 2;
    backdrop.querySelector('.w-lightbox-left')!.classList.toggle('w-lightbox-inactive', single);
    backdrop.querySelector('.w-lightbox-right')!.classList.toggle('w-lightbox-inactive', single);
  };

  const open = (group: string | undefined, src: string) => {
    items = group
      ? links.filter((l) => l.dataset.lightboxGroup === group).map((l) => l.dataset.lightbox!)
      : [src];
    items = [...new Set(items)];
    backdrop = document.createElement('div');
    backdrop.className = 'w-lightbox-backdrop';
    backdrop.tabIndex = 0;
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = `
      <div class="w-lightbox-container">
        <div class="w-lightbox-content${items.length > 1 ? ' w-lightbox-group' : ''}">
          <div class="w-lightbox-view" style="opacity:1"><div class="w-lightbox-frame">
            <figure class="w-lightbox-figure"><img class="w-lightbox-img w-lightbox-image" alt=""></figure>
          </div></div>
          <div class="w-lightbox-control w-lightbox-left" role="button" aria-label="previous image"></div>
          <div class="w-lightbox-control w-lightbox-right" role="button" aria-label="next image"></div>
          <div class="w-lightbox-control w-lightbox-close" role="button" aria-label="close lightbox"></div>
        </div>
        <div class="w-lightbox-strip" role="tablist">
          ${items.length > 1 ? items.map((u) => `<div class="w-lightbox-item" role="tab"><div class="w-lightbox-thumbnail"><img class="w-lightbox-thumbnail-image" src="${u}" alt=""></div></div>`).join('') : ''}
        </div>
      </div>`;
    backdrop.querySelector('.w-lightbox-left')!.addEventListener('click', (e) => { e.stopPropagation(); show(current - 1); });
    backdrop.querySelector('.w-lightbox-right')!.addEventListener('click', (e) => { e.stopPropagation(); show(current + 1); });
    backdrop.querySelector('.w-lightbox-close')!.addEventListener('click', close);
    backdrop.querySelectorAll('.w-lightbox-item').forEach((t, n) => t.addEventListener('click', (e) => { e.stopPropagation(); show(n); }));
    backdrop.querySelector('.w-lightbox-image')!.addEventListener('click', (e) => { e.stopPropagation(); show(current + 1); });
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop || (e.target as HTMLElement).classList.contains('w-lightbox-frame')) close(); });
    // webflow.css starts the backdrop at opacity 0; webflow.js faded it in.
    backdrop.style.transition = 'opacity 300ms ease';
    document.body.appendChild(backdrop);
    void backdrop.offsetWidth;
    backdrop.style.opacity = '1';
    document.documentElement.classList.add('w-lightbox-noscroll');
    document.addEventListener('keydown', onKey);
    backdrop.focus();
    show(items.indexOf(src));
  };

  links.forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    open(a.dataset.lightboxGroup, a.dataset.lightbox!);
  }));
}

export function initBackgroundVideos() {
  document.querySelectorAll<HTMLVideoElement>('.w-background-video video').forEach((v) => {
    v.muted = true;
    v.play().catch(() => { /* autoplay blocked: the poster stays */ });
  });
}
