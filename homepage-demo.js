(() => {
  const preview = document.querySelector('.hero-art');
  if (!preview || !('IntersectionObserver' in window)) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...preview.querySelectorAll('.post')];
  if (!cards.length || reducedMotion.matches) return;
  const snapshots = new Map();
  const running = new Map();
  const played = new Set();
  const duration = 460;

  // The original paragraphs stay in place: wrapping and card heights never change.
  cards.forEach(card => {
    const paragraphs = [...card.querySelectorAll('p, .hashtags')];
    snapshots.set(card, paragraphs.map(node => ({node, text: node.textContent})));
  });
  const restore = card => {
    const record = running.get(card);
    record?.animations.forEach(animation => animation.cancel());
    snapshots.get(card).forEach(({node,text}) => node.replaceChildren(document.createTextNode(text)));
    card.querySelector('.magic-card-state')?.remove();
    card.classList.remove('magic-preparing','magic-revealing');
    running.delete(card);
    replay.disabled = running.size > 0;
  };
  const animate = card => {
    if (running.has(card) || reducedMotion.matches) return;
    played.add(card);
    const record = {animations: []};
    running.set(card,record);
    replay.disabled = true;
    card.classList.add('magic-preparing');
    const indicator = document.createElement('span');
    indicator.className = 'magic-card-state';
    indicator.setAttribute('aria-hidden','true');
    indicator.textContent = '✦';
    card.append(indicator);
    const words = [];
    let delay = 460;
    snapshots.get(card).forEach(({node,text}) => {
      const accessible = document.createElement('span');
      accessible.className = 'magic-accessible';
      accessible.textContent = text;
      const visual = document.createElement('span');
      visual.setAttribute('aria-hidden','true');
      visual.className = 'magic-visual';
      for (const token of text.match(/\S+|\s+/gu) || []) {
        if (/^\s+$/u.test(token)) {visual.append(document.createTextNode(token));continue;}
        const word = document.createElement('span');
        word.className = 'magic-word';
        word.textContent = token;
        visual.append(word);
        words.push({word,delay});
        delay += 19;
      }
      delay += 85;
      node.replaceChildren(accessible,visual);
    });
    try {
      const glow = card.animate([
        {boxShadow:'0 0 0 0 rgba(97,53,232,0)'},
        {boxShadow:'0 0 0 3px rgba(97,53,232,.11), 0 16px 38px rgba(97,53,232,.13)',offset:.24},
        {boxShadow:'0 8px 20px rgba(35,23,73,.02)'}
      ],{duration:delay+duration,easing:'ease-out'});
      record.animations.push(glow);
      words.forEach(({word,delay}) => record.animations.push(word.animate([
        {opacity:0,filter:'blur(3px)',transform:'translateY(3px)',color:'#6135e8'},
        {opacity:1,filter:'blur(0)',transform:'translateY(0)',color:'#6135e8',offset:.65},
        {opacity:1,filter:'blur(0)',transform:'translateY(0)',color:'inherit'}
      ],{duration,delay,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'})));
      card.classList.remove('magic-preparing');
      card.classList.add('magic-revealing');
      Promise.all(record.animations.map(animation => animation.finished)).then(() => {
        if (running.get(card) === record) restore(card);
      }).catch(() => {if (running.get(card) === record) restore(card);});
    } catch {restore(card);}
  };
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'magic-replay';
  replay.textContent = '↻ Revoir la magie';
  replay.setAttribute('aria-label','Revoir l’animation des exemples Facebook et Instagram');
  const caption = preview.querySelector('.flow-caption');
  caption.after(replay);
  replay.addEventListener('click',() => {
    if (reducedMotion.matches || running.size) return;
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) animate(card);
      else {played.delete(card);observer.observe(card);}
    });
  });
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || played.has(entry.target)) return;
      observer.unobserve(entry.target);
      animate(entry.target);
    });
  },{threshold:.18});
  cards.forEach(card => observer.observe(card));
  reducedMotion.addEventListener('change',() => {
    if (!reducedMotion.matches) return;
    observer.disconnect();
    [...running.keys()].forEach(restore);
    replay.hidden = true;
  });
})();
