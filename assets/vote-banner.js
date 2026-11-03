/* Visible through 9 November 2026, inclusive, in Europe/Berlin (CET).
   Defaults stay hidden outside the campaign; no network or storage is used. */
(function () {
  'use strict';
  const starts = Date.parse('2026-11-03T00:00:00+01:00');
  const expires = Date.parse('2026-11-10T00:00:00+01:00');
  let banner;
  let spacer;
  let timer;

  function refresh() {
    clearTimeout(timer);
    const now = Date.now();
    if (now < starts || now >= expires) {
      if (banner) banner.remove();
      if (spacer) spacer.remove();
      banner = spacer = null;
      document.documentElement.classList.remove('jar-vote-active');
      return;
    }
    if (!banner) {
      banner = document.createElement('aside');
      banner.className = 'jar-vote-banner';
      banner.setAttribute('aria-label', 'BWKI Publikumspreis');
      const link = document.createElement('a');
      link.href = 'https://www.bw-ki.de/publikumspreis';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const label = document.createElement('strong');
      label.lang = 'en';
      label.textContent = 'Vote for us ↗';
      const deadline = document.createElement('span');
      deadline.className = 'jar-vote-deadline';
      const competition = document.createElement('span');
      competition.className = 'jar-vote-competition';
      competition.textContent = 'BWKI Publikumspreis · ';
      deadline.append(competition, 'bis 9. Nov.');
      link.append(label, deadline);
      banner.append(link);
      spacer = document.createElement('div');
      spacer.className = 'jar-vote-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      document.body.prepend(banner, spacer);
      document.documentElement.classList.add('jar-vote-active');
    }
    // Remove the notice even when a tab stays open across the deadline.
    timer = setTimeout(refresh, expires - now);
  }

  refresh();
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pageshow', refresh);
})();
