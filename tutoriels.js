(() => {
  // Add an ID only after the owner supplies the real YouTube link.
  const videos = {
    presentation: 'FUsqPeqcp8o',
    compte: 'zbAkKD4z_5k',
    'premier-post': 'Y1yc605IWtg',
    idees: 'VeOAgi7XpB0',
    parrainage: 'WVPkvjpIdz8'
  };
  document.querySelectorAll('[data-video]').forEach(card => {
    const id = videos[card.dataset.video];
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return;
    const title = card.querySelector('h3').textContent;
    const player = card.querySelector('.player');
    card.querySelector('.pending')?.remove();
    if (!player.querySelector('.play')) {
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'play';
      play.setAttribute('aria-label', 'Lire : ' + title);
      const icon = document.createElement('span');
      icon.textContent = '▶';
      icon.setAttribute('aria-hidden', 'true');
      play.append(icon);
      player.append(play);
      const action = document.createElement('button');
      action.type = 'button';
      action.className = 'text-play';
      action.textContent = 'Lire la vidéo →';
      card.querySelector('.card-body').append(action);
    }
    const load = () => {
      const existing = player.querySelector('iframe');
      if (existing) { existing.focus(); return; }
      const frame = document.createElement('iframe');
      frame.title = title;
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.tabIndex = 0;
      player.replaceChildren(frame);
      frame.focus();
    };
    card.querySelectorAll('.play,.text-play').forEach(button => button.addEventListener('click', load));
  });
})();
