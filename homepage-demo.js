(() => {
  const preview = document.querySelector('.hero-art');
  if (!preview) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...preview.querySelectorAll('.post')];
  if (!cards.length) return;
  const compact = window.matchMedia('(max-width: 900px)');
  const tablist = preview.querySelector('.atelier-tabs');
  const tabs = [...preview.querySelectorAll('[data-demo-target]')];
  const magicTrigger = preview.querySelector('.atelier-magic-trigger');
  const motionAvailable = 'IntersectionObserver' in window && typeof Element.prototype.animate === 'function';
  let selected = cards[0].id;
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
    if (magicTrigger) magicTrigger.disabled = replay.disabled;
  };
  const animate = card => {
    if (running.has(card) || reducedMotion.matches || card.hidden || !motionAvailable) return;
    played.add(card);
    const record = {animations: []};
    running.set(card,record);
    replay.disabled = true;
    if (magicTrigger) magicTrigger.disabled = true;
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
  const caption = preview.querySelector('.atelier-demo-head');
  if (caption) caption.append(replay);
  else preview.querySelector('.flow-caption')?.after(replay);
  const reveal = () => {
    if (running.size) return;
    if (reducedMotion.matches || !motionAvailable) {
      cards.find(card => !card.hidden)?.focus({preventScroll: true});
      return;
    }
    cards.forEach(card => {
      if (card.hidden) {played.delete(card);observer.unobserve(card);return;}
      const rect = card.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) animate(card);
      else {played.delete(card);observer.observe(card);}
    });
  };
  replay.addEventListener('click',reveal);
  magicTrigger?.addEventListener('click',reveal);
  const observer = motionAvailable ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || played.has(entry.target)) return;
      observer.unobserve(entry.target);
      animate(entry.target);
    });
  },{threshold:.18}) : null;
  const observeVisible = () => {
    if (reducedMotion.matches || !observer) return;
    cards.forEach(card => {if (!card.hidden && !played.has(card)) observer.observe(card);});
  };
  const showPlatforms = () => {
    preview.dataset.compact = String(compact.matches);
    if (tablist) tablist.hidden = !compact.matches;
    tabs.forEach(tab => {
      const active = tab.dataset.demoTarget === selected;
      tab.setAttribute('aria-selected',String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    cards.forEach(card => {
      card.hidden = compact.matches && card.id !== selected;
      if (card.hidden) {observer?.unobserve(card);if (running.has(card)) restore(card);}
      if (compact.matches) card.setAttribute('role','tabpanel');
      else card.removeAttribute('role');
      card.setAttribute('aria-labelledby',card.id + (compact.matches ? '-tab' : '-heading'));
      card.tabIndex = compact.matches ? 0 : -1;
    });
    observeVisible();
  };
  const select = tab => {
    selected = tab.dataset.demoTarget;
    showPlatforms();
  };
  tabs.forEach((tab,index) => {
    tab.addEventListener('click',() => select(tab));
    tab.addEventListener('keydown',event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(tabs[next]);
      tabs[next].focus();
    });
  });
  const updateMotion = () => {
    replay.hidden = reducedMotion.matches || !motionAvailable;
    if (replay.hidden) {
      observer?.disconnect();
      [...running.keys()].forEach(restore);
    } else observeVisible();
  };
  compact.addEventListener('change',showPlatforms);
  reducedMotion.addEventListener('change',updateMotion);
  showPlatforms();
  updateMotion();
})();
