/* Shared click-to-load video and end-of-video voting invitation. */
(function () {
  'use strict';
  const play = document.querySelector('[data-video-play]');
  const dialog = document.querySelector('.project-vote');
  if (!play || !dialog) return;

  const copy = {
    de: {
      play: 'J.A.R. im Video kennenlernen',
      notice: 'Beim Abspielen wird Vimeo geladen.',
      caption: 'Unser Projektvideo zum BWKI Publikumspreis 2026',
      competition: 'Zum Wettbewerb ↗',
      vote_title: 'Hat dich J.A.R. überzeugt?',
      vote_description: 'Dann unterstütze uns mit deiner Stimme beim BWKI Publikumspreis 2026. Wähle auf der Abstimmungsseite das Projekt J.A.R. aus.',
      vote_action: 'Jetzt für J.A.R. abstimmen ↗',
      vote_close: 'Vielleicht später'
    },
    en: {
      play: 'Meet J.A.R. in our project video',
      notice: 'Playing this video loads Vimeo.',
      caption: 'Our project video for the BWKI Audience Award 2026',
      competition: 'Visit the competition ↗',
      vote_title: 'Did J.A.R. convince you?',
      vote_description: 'Support us with your vote for the BWKI Audience Award 2026. Select the J.A.R. project on the voting page.',
      vote_action: 'Vote for J.A.R. ↗',
      vote_close: 'Maybe later'
    }
  };
  function translate() {
    const language = document.documentElement.lang === 'en' ? 'en' : 'de';
    document.querySelectorAll('[data-video-copy]').forEach(node => {
      node.textContent = copy[language][node.dataset.videoCopy];
    });
  }
  translate();
  new MutationObserver(translate).observe(document.documentElement, {
    attributes: true, attributeFilter: ['lang']
  });

  const close = document.querySelector('[data-video-close]');
  close.addEventListener('click', () => dialog.close());

  play.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const iframe = document.createElement('iframe');
    iframe.src = play.href + '&autoplay=1&loop=0';
    iframe.title = 'J.A.R. · BWKI Publikumspreis 2026';
    iframe.width = '1600';
    iframe.height = '900';
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    play.replaceWith(iframe);
    iframe.focus();

    function connectPlayer() {
      const player = new window.Vimeo.Player(iframe);
      let invited = false;
      player.on('ended', () => {
        if (invited) return;
        invited = true;
        // Leave the iframe's fullscreen view so the page's dialog is visible.
        player.exitFullscreen().catch(() => {}).then(() => {
          translate();
          if (!dialog.open) dialog.showModal();
        });
      });
    }
    if (window.Vimeo && window.Vimeo.Player) {
      connectPlayer();
    } else {
      // Vimeo is contacted only after the visitor chooses to play the video.
      const sdk = document.createElement('script');
      sdk.src = 'https://player.vimeo.com/api/player.js';
      sdk.onload = connectPlayer;
      // Playback and the permanent competition link still work without the SDK.
      sdk.onerror = () => {};
      document.head.appendChild(sdk);
    }
  });
})();
