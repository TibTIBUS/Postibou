(() => {
  const preview = document.querySelector('.hero-art');
  if (!preview || !('IntersectionObserver' in window)) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches) return;
  let played = false;
  const observer = new IntersectionObserver(entries => {
    if (played || !entries.some(entry => entry.isIntersecting)) return;
    played = true;
    observer.disconnect();
    if (reducedMotion.matches) return;
    const cards = [...preview.querySelectorAll('.post')];
    const originals = cards.map(card => ({
      card,
      height: card.getBoundingClientRect().height,
      parts: [...card.querySelectorAll('p, .hashtags')].map(node => ({node, text: node.textContent, height: node.getBoundingClientRect().height}))
    }));
    originals.forEach(({card, height, parts}) => {
      card.style.minHeight = `${height}px`;
      card.classList.add('magic-writing');
      // Keep complete text available to assistive technology during the animation.
      const accessible = document.createElement('span');
      accessible.className = 'magic-accessible';
      accessible.textContent = parts.map(part => part.text).join('\n\n');
      card.append(accessible);
      parts.forEach(({node, height}) => {node.setAttribute('aria-hidden','true'); node.style.minHeight = `${height}px`; node.style.display = 'block'; node.textContent = '';});
    });
    let started;
    const finish = () => originals.forEach(({card, parts}) => {
      parts.forEach(({node,text}) => {node.textContent = text;node.removeAttribute('aria-hidden');node.style.minHeight = '';node.style.display = '';});
      card.querySelector('.magic-accessible')?.remove();
      card.classList.remove('magic-writing');
      card.style.minHeight = '';
    });
    const tick = timestamp => {
      started ??= timestamp;
      const progress = Math.min(1, (timestamp - started) / 6500);
      if (reducedMotion.matches || progress === 1) {finish();return;}
      originals.forEach(({parts}, index) => {
        const fraction = Math.max(0, Math.min(1, (progress - index * .08) / (1 - index * .08)));
        let remaining = Math.floor(parts.reduce((sum,part) => sum + Array.from(part.text).length,0) * fraction);
        parts.forEach(({node,text}) => {
          const letters = Array.from(text);
          const content = letters.slice(0,remaining).join('');
          if (node.textContent !== content) node.textContent = content;
          remaining = Math.max(0,remaining - letters.length);
        });
      });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, {threshold: .1});
  observer.observe(preview);
})();
