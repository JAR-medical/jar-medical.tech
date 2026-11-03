/* The German HTML is complete without JavaScript. Enhancements only switch
   language, open the compact menu, and select explicitly illustrative examples. */
(function () {
  'use strict';

  const english = {
    skip: 'Skip to content',
    nav_idea: 'The idea', nav_tech: 'Transcription', nav_team: 'About us', nav_sectors: 'Applications',
    nav_demo: 'Live demo <span aria-hidden="true">↗</span>',
    hero_eyebrow: 'J.A.R. Medical · Medical speech recognition',
    hero_title: 'More time<br>with people.<br><span>Every word counts.</span>',
    hero_lead: 'We are developing medical speech recognition that turns spoken information into documentation at the point of care.',
    hero_demo: 'Experience the app live <span aria-hidden="true">↗</span>',
    hero_more: 'Our story <span aria-hidden="true">↓</span>',
    hero_note: 'Interactive simulation · Right in your browser',
    hero_bottom: 'Speak. Record. Keep caring.',
    hero_credit: 'Berlin, April 2020 · Koffeeinist / CC BY-SA 4.0',
    partner_eyebrow: 'Moving forward together',
    partner_intro: 'Support from<br>practice and research.',
    partner_drk: 'Pilot projects & practical expertise',
    partner_tum: 'Technology, equipment & research',
    partner_dlr: 'Imaging, data & integration',
    idea_eyebrow: '01 / Making the idea tangible',
    idea_title: 'You speak.<br><span>J.A.R. takes notes.</span>',
    idea_lead: 'Observations and procedures are spoken during care, then written down all over again.',
    idea_body: 'J.A.R. aims to turn those words into useful records. Our AR prototype keeps the information in view.',
    principle_voice: 'Speech as input', principle_edge: 'Local processing', principle_ar: 'Information in view',
    idea_more: 'From words to a record <span aria-hidden="true">↓</span>',
    product_tag: 'Our prototype being tested',
    product_caption: 'Less attention on forms, more attention on the person.',
    tech_eyebrow: '02 / At the heart: transcription',
    tech_title: 'Spoken words.<br><span>Lasting information.</span>',
    tech_intro: 'Transcribe and structure medical language in real time, locally and offline. That is what we are working on.',
    example_label: 'From speech to a record', example_badge: 'Example',
    example_rescue: 'Emergency care', example_care: 'Nursing', field_id: 'Patient ID',
    example_note: 'Fictional example, no live recording.',
    tech_one_title: 'Medicine has its own language.',
    tech_one_body: 'Our goal: high zero-shot accuracy for medical language, without training on site.',
    tech_two_title: 'Designed around the point of care.',
    tech_two_body: 'Processing should run at the point of care, even without a stable connection.',
    tech_three_title: 'More than a long piece of text.',
    tech_three_body: 'Patient ID, observation and time as fields. Clinical review remains with the person providing care.',
    tech_demo: 'Talk to us about a demo <span aria-hidden="true">↗</span>',
    system_eyebrow: '03 / From individual words to the bigger picture',
    system_title: 'One piece of information.<br><span>Many helping hands.</span>',
    system_lead: 'J.A.R. began in disaster response, where information needs to reach incident command quickly.',
    system_body: 'TriARge connects voice records, patient identification, AR and the incident overview. The simulation runs locally, without the cloud.',
    flow_one_title: 'Speak', flow_one_body: 'Record observations and procedures.',
    flow_two_title: 'Connect', flow_two_body: 'Link a record to a verified patient identifier.',
    flow_three_title: 'Keep it in view', flow_three_body: 'Access information through the AR view.',
    flow_four_title: 'Share the overview', flow_four_body: 'See updates on the incident-command dashboard.',
    prototype_note: 'Development prototype for exercises and simulations. Not a certified medical device.',
    system_demo: 'Experience the workflow <span aria-hidden="true">↗</span>',
    team_eyebrow: '04 / The people behind it',
    team_title: 'From an idea<br><span>to a shared project.</span>',
    team_body: 'Johannes Nirschl, Alexander Kluge and Jonas Kaindl started J.A.R. at Gymnasium Neubiberg. We develop the model, hardware and software with input from practice and research.',
    team_contact: 'Start a conversation <span aria-hidden="true">↗</span>',
    team_caption: 'Exchanging ideas with the TUM XR Group.',
    sectors_eyebrow: 'Your next step',
    sectors_title: 'One idea.<br><span>Many places to make a difference.</span>',
    sectors_intro: 'Explore our approach for your field.',
    sector_care_label: 'Nursing', sector_care_title: 'Time for people.',
    sector_care_body: 'Our approach to nursing and everyday documentation.',
    sector_hospital_label: 'Hospital', sector_hospital_title: 'At the bedside.',
    sector_hospital_body: 'Capture spoken information where care takes place.',
    sector_rescue_label: 'Emergency services', sector_rescue_title: 'Through to handover.',
    sector_rescue_body: 'Documentation from first contact to arrival at the hospital.',
    sector_disaster_label: 'Disaster response', sector_disaster_title: 'The bigger picture.',
    sector_disaster_body: 'Explore voice records, AR and a shared incident overview together.',
    closing: 'Bring your perspective to the project.',
    closing_cta: 'Contribute to the project <span aria-hidden="true">↗</span>',
    footer_blurb: 'J.A.R. Medical develops speech recognition for people who care for people: in nursing, disaster response and emergency services. On the device, in real time, even offline.',
    footer_website: 'Website', footer_homecare: 'Home-care services',
    footer_project: 'Project', footer_join: 'Contribute', footer_request: 'Request a demo',
    footer_live: 'Experience the app live', footer_contact: 'Contact',
    legal_imprint: 'Legal notice', legal_privacy: 'Privacy', legal_terms: 'Terms of use',
    credits_title: 'Photo credits',
    credits_note: 'Original files unchanged; cropped and darkened through the page layout. Other photographs supplied by the project. Emergency-response photographs illustrate the context and do not show J.A.R. in use.'
  };
  const englishAlt = {
    product_alt: 'Our prototype being tested: a person wearing AR glasses and medical gloves holds a triage card.',
    exercise_alt: 'A German Red Cross mass-casualty exercise with response vehicles and treatment equipment.',
    team_alt: 'Group photograph of the TUM XR Group.'
  };
  const examples = {
    de: {
      rescue: ['„Patient A7 ist ansprechbar. Übergabe um vierzehn Uhr sieben.“', 'A7', 'Beobachtung', 'Ansprechbar', 'Übergabe', '14:07'],
      care: ['„Bewohnerin P3, Mobilisation begleitet, um acht Uhr dreißig.“', 'P3', 'Maßnahme', 'Mobilisation begleitet', 'Uhrzeit', '08:30']
    },
    en: {
      rescue: ['“Patient A7 is responsive. Handover at fourteen oh seven.”', 'A7', 'Observation', 'Responsive', 'Handover', '14:07'],
      care: ['“Resident P3, assisted mobilisation, at eight thirty.”', 'P3', 'Procedure', 'Assisted mobilisation', 'Time', '08:30']
    }
  };
  const copyNodes = Array.from(document.querySelectorAll('[data-copy]'));
  const altNodes = Array.from(document.querySelectorAll('[data-alt]'));
  const german = new Map(copyNodes.map(node => [node, node.innerHTML]));
  const germanAlt = new Map(altNodes.map(node => [node, node.alt]));
  const originalTitle = document.title;
  const description = document.querySelector('meta[name="description"]');
  const originalDescription = description.content;
  let language = 'de';
  let selectedExample = 'rescue';
  const languageStore = 'jar.info.language';
  let languageChosen = false;

  function renderExample() {
    const ids = ['example-sentence', 'example-id', 'example-detail-label', 'example-detail', 'example-time-label', 'example-time'];
    examples[language][selectedExample].forEach((text, index) => {
      document.getElementById(ids[index]).textContent = text;
    });
    document.querySelectorAll('[data-example]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.example === selectedExample));
    });
  }

  function applyLanguage(nextLanguage) {
    language = nextLanguage === 'en' ? 'en' : 'de';
    document.documentElement.lang = language;
    copyNodes.forEach(node => {
      node.innerHTML = language === 'en' ? english[node.dataset.copy] || german.get(node) : german.get(node);
    });
    altNodes.forEach(node => {
      node.alt = language === 'en' ? englishAlt[node.dataset.alt] : germanAlt.get(node);
    });
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    document.title = language === 'en' ? 'J.A.R. Medical — More time with people. Every word recorded.' : originalTitle;
    description.content = language === 'en' ? 'From spoken words to medical documentation: meet J.A.R. Medical, our AR prototype and the people behind the project. Explore the interactive live demo.' : originalDescription;
    renderExample();
  }

  document.querySelectorAll('[data-language]').forEach(button => {
    button.addEventListener('click', () => {
      languageChosen = true;
      applyLanguage(button.dataset.language);
      try {
        // Only an explicit choice persists; old automatic defaults must not
        // override the country on a later visit. Share it with the main site.
        localStorage.setItem(languageStore, language);
        localStorage.setItem('jar.lang', language);
      } catch (_) { /* Storage is optional. */ }
    });
  });
  document.querySelectorAll('[data-example]').forEach(button => {
    button.addEventListener('click', () => {
      selectedExample = button.dataset.example;
      renderExample();
    });
  });
  document.querySelector('.languages').hidden = false;
  document.querySelector('.example-tabs').hidden = false;
  let savedLanguage;
  try { savedLanguage = localStorage.getItem(languageStore); } catch (_) { /* Storage is optional. */ }
  const browserLanguage = (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  if (savedLanguage === 'de' || savedLanguage === 'en') {
    applyLanguage(savedLanguage);
  } else {
    applyLanguage(browserLanguage);
    // Cloudflare supplies the country on this same-origin endpoint. No GPS,
    // external geolocation service or location data is stored. If unavailable
    // (including a local preview), the browser-language fallback stays in place.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    fetch('/cdn-cgi/trace', { signal: controller.signal, credentials: 'omit', cache: 'no-store' })
      .then(response => response.ok ? response.text() : '')
      .then(trace => {
        if (!languageChosen && /^loc=DE\s*$/m.test(trace)) applyLanguage('de');
      })
      .catch(() => { /* Country lookup is optional. */ })
      .finally(() => clearTimeout(timeout));
  }

  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.menu-toggle');
  toggle.hidden = false;
  function closeMenu() {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelector('.nav-links').addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      closeMenu();
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 801px)').addEventListener('change', closeMenu);
})();
