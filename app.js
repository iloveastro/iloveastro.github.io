(() => {
  'use strict';
  const DATA = window.SKY_DATA;
  const $ = sel => document.querySelector(sel);
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    children.forEach(child => node.append(child));
    return node;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));

  function updateRangeVisual(input) {
    if (!input) return;
    const min = parseFloat(input.min || '0');
    const max = parseFloat(input.max || '100');
    const value = parseFloat(input.value || '0');
    const span = max - min || 1;
    const pct = Math.max(0, Math.min(100, ((value - min) / span) * 100));
    input.style.setProperty('--pct', pct + '%');
  }
  function initRangeVisuals(root = document) {
    root.querySelectorAll('input[type="range"]').forEach(input => {
      updateRangeVisual(input);
      if (!input.dataset.rangeVisualBound) {
        input.addEventListener('input', () => updateRangeVisual(input));
        input.addEventListener('change', () => updateRangeVisual(input));
        input.dataset.rangeVisualBound = '1';
      }
    });
  }

  function ensureImageModal() {
    let modal = document.getElementById('imageModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'imageModal';
    modal.className = 'image-modal hidden';
    modal.innerHTML = '<button type="button" class="image-modal-close" aria-label="close image">×</button><img class="image-modal-img" alt="enlarged image">';
    const img = modal.querySelector('.image-modal-img');
    const close = () => modal.classList.add('hidden');
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('.image-modal-close').addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    modal.openImage = (src, alt='') => { img.src = src; img.alt = alt || 'enlarged image'; modal.classList.remove('hidden'); };
    document.body.appendChild(modal);
    return modal;
  }
  function enableAnswerImageZoom(root) {
    const modal = ensureImageModal();
    root.querySelectorAll('.answer-details img').forEach(img => {
      img.classList.add('zoomable-image');
      if (img.dataset.zoomBound) return;
      img.dataset.zoomBound = '1';
      img.addEventListener('click', () => modal.openImage(img.currentSrc || img.src, img.alt || 'enlarged image'));
    });
  }

  window.__iloveastroImgFallback = img => {
    const rest = (img.dataset.fallbacks || '').split('|').filter(Boolean);
    if (!rest.length) return;
    img.dataset.fallbacks = rest.slice(1).join('|');
    img.src = rest[0];
  };
  function chartAssetPaths(c, labelled = false) {
    const id = c.id;
    const primary = labelled ? c.answerImage : c.image;
    const paths = labelled ? [
      primary,
      `assets/charts/labelled/${id}.jpg`,
      `assets/charts/labelled/${id}.webp`,
      `assets/charts-labelled/${id}.webp`,
      `assets/charts-labelled/${id}.jpg`,
      `assets/charts-clean/${id}.webp`,
      `assets/charts-clean/${id}.jpg`
    ] : [
      primary,
      `assets/charts/blank/${id}.jpg`,
      `assets/charts/blank/${id}.webp`,
      `assets/charts-clean/${id}.webp`,
      `assets/charts-clean/${id}.jpg`,
      `assets/charts-constellation-blank/${id}.webp`,
      `assets/charts-constellation-blank/${id}.jpg`
    ];
    return [...new Set(paths.filter(Boolean))];
  }
  function chartImg(c, labelled = false, cls = 'chart-img', alt = 'constellation chart') {
    const paths = chartAssetPaths(c, labelled);
    return `<img class="${esc(cls)}" src="${esc(paths[0])}" data-fallbacks="${esc(paths.slice(1).join('|'))}" onerror="window.__iloveastroImgFallback(this)" loading="lazy" decoding="async" alt="${esc(alt)}">`;
  }
  function chartPanelImg(c, labelled = false, alt = 'constellation chart') {
    return `<div class="main-chart-crop">${chartImg(c, labelled, 'chart-img chart-main-img', alt)}</div>`;
  }

  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const compact = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  function oneSubstitutionTypo(a, b) {
    if (a.length !== b.length) return false;
    let edits = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) edits++;
      if (edits > 1) return false;
    }
    return edits === 1;
  }
  const strictAnswers = new Set();
  function addStrict(v) { const c = compact(v); if (c) strictAnswers.add(c); }
  DATA.constellations.forEach(c => addStrict(c.name));
  DATA.stars.forEach(s => { addStrict(s.name); addStrict(s.designation); });
  DATA.dso.forEach(o => { addStrict(o.code); addStrict(o.commonName); (o.accepted || []).forEach(addStrict); });
  DATA.dso.forEach(o => addStrict(o.type));
  DATA.asterisms.forEach(a => addStrict(a.name));

  function answerMatches(input, answers) {
    const n = norm(input), c = compact(input);
    if (!n) return false;
    return answers.some(a => norm(a) === n || compact(a) === c);
  }
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
  const sample = (arr, n) => shuffle(arr.slice()).slice(0, n);
  const byConstellation = (items, key = 'constellation') => {
    const m = new Map();
    items.forEach(item => { if (!m.has(item[key])) m.set(item[key], []); m.get(item[key]).push(item); });
    return m;
  };
  const starByConst = byConstellation(DATA.stars);
  const dsoByConst = byConstellation(DATA.dso);
  const chartsByName = new Map();
  DATA.charts.forEach(c => { if (!chartsByName.has(c.name)) chartsByName.set(c.name, []); chartsByName.get(c.name).push(c); });
  const chartByName = new Map();
  DATA.charts.forEach(c => { if (!chartByName.has(c.name)) chartByName.set(c.name, c); });
  const progress = JSON.parse(localStorage.getItem('iloveastroProgress') || '{}');
  function saveProgress() { localStorage.setItem('iloveastroProgress', JSON.stringify(progress)); }
  function scoreKey(game) { if (!progress[game]) progress[game] = { seen: 0, correct: 0 }; return progress[game]; }
  function record(game, ok) { const p = scoreKey(game); p.seen++; if (ok) p.correct++; saveProgress(); }
  function formatScore(game) { const p = scoreKey(game); const acc = p.seen ? Math.round(100 * p.correct / p.seen) : 0; return `<div class="stat"><strong>${p.seen}</strong>seen</div><div class="stat"><strong>${p.correct}</strong>correct</div><div class="stat"><strong>${acc}%</strong>accuracy</div>`; }
  function pointScoreKey(game) {
    const p = scoreKey(game);
    if (p.pointMode !== true) {
      p.seen = 0;
      p.correct = 0;
      p.totalScore = 0;
      p.bestScore = 0;
      p.pointMode = true;
    }
    return p;
  }
  function recordPointScore(game, score) {
    const p = pointScoreKey(game);
    p.seen++;
    p.totalScore = (p.totalScore || 0) + score;
    p.bestScore = Math.max(p.bestScore || 0, score);
    saveProgress();
  }
  function formatPointScore(game) {
    const p = pointScoreKey(game);
    const average = p.seen ? Math.round((p.totalScore || 0) / p.seen) : 0;
    return `<div class="stat"><strong>${p.seen}</strong>seen</div><div class="stat"><strong>${average}</strong>avg score</div><div class="stat"><strong>${p.bestScore || 0}</strong>best score</div>`;
  }

  const games = [
    { id: 'charts', title: 'Charts' },
    { id: 'skyguessr', title: 'SkyGuessr' },
    { id: 'skyrace', title: 'SkyRace' },
    { id: 'skyregions', title: 'Sky Map' },
    { id: 'alphapin', title: 'Find Constellation' },
    { id: 'neighbours', title: 'Neighbours' },
    { id: 'stars', title: 'Stars' },
    { id: 'dso', title: 'DSOs' },
    { id: 'timer', title: '88 Timer' },
    { id: 'atlas', title: 'Atlas' },
    { id: 'tables', title: 'Tables' }
  ];

  let activeGame = 'charts';
  const app = $('#app');
  const tabs = $('#tabs');
  const states = {};

  function setupTabs() {
    tabs.innerHTML = '';
    games.forEach(g => tabs.append(el('button', { type: 'button', class: g.id === activeGame ? 'active' : '', onclick: () => switchGame(g.id) }, [document.createTextNode(g.title)])));
  }
  function switchGame(id) { activeGame = id; setupTabs(); render(); }
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.shiftKey) {
      const s = states[activeGame];
      if (s && s.next) { e.preventDefault(); s.next(); }
    }
  });
  $('#resetProgress').addEventListener('click', () => {
    if (confirm('Reset saved scores?')) { Object.keys(progress).forEach(k => delete progress[k]); saveProgress(); render(); }
  });

  function makeQuestionGame(gameId, title, options) {
    const state = states[gameId] || (states[gameId] = { current: null, answered: false, last: '', mode: options.defaultMode || '', next: () => newQuestion() });
    function newQuestion() {
      const modeEl = document.querySelector(`#${gameId}Mode`);
      if (modeEl) state.mode = modeEl.value;
      state.current = options.make(state.mode);
      state.answered = false;
      draw();
      setTimeout(() => { const input = document.querySelector(`#${gameId}Input`); if (input) input.focus(); }, 0);
    }
    function correct(inputValue) {
      if (!state.current || state.answered) return;
      if (!answerMatches(inputValue, state.current.answers)) return;
      state.answered = true;
      record(gameId, true);
      state.last = state.current.card(true);
      newQuestion(); // continuous mode: previous card remains while the next question starts
    }
    function reveal() {
      if (!state.current || state.answered) return;
      state.answered = true;
      record(gameId, false);
      state.last = state.current.card(false);
      newQuestion();
    }
    function draw(revealed = null) {
      const q = state.current || options.make(state.mode);
      state.current = q;
      app.innerHTML = '';
      const aside = el('aside');
      aside.append(el('h2', {}, [document.createTextNode(title)]));
      if (options.modes) {
        const select = el('select', { id: `${gameId}Mode`, onchange: () => newQuestion() });
        options.modes.forEach(m => select.append(el('option', { value: m.id, ...(m.id === (state.mode || options.defaultMode) ? { selected: 'selected' } : {}) }, [document.createTextNode(m.label)])));
        aside.append(el('label', {}, [document.createTextNode('mode'), select]));
      }
      aside.append(el('div', { class: 'prompt', html: q.prompt }));
      const input = el('input', { id: `${gameId}Input`, class: 'answer-input', autocomplete: 'off', placeholder: q.placeholder || 'type answer' });
      input.addEventListener('input', () => correct(input.value));
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) e.preventDefault(); });
      aside.append(input);
      aside.append(el('div', { class: 'message' }));
      aside.append(el('div', { class: 'controls' }, [
        el('button', { type: 'button', onclick: reveal }, [document.createTextNode('reveal')])
      ]));
      aside.append(el('div', { class: 'stats', html: formatScore(gameId) }));
      if (state.last) {
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 850px)').matches;
        const details = el('details', { class: 'last-card answer-details', ...(isMobile ? {} : { open: 'open' }) });
        details.append(el('summary', {}, [document.createTextNode('answer info')]));
        details.append(el('div', { class: 'answer-details-body', html: state.last }));
        aside.append(details);
      }
      const main = el('section', { class: 'panel', html: q.visual || '' });
      app.append(el('div', { class: 'layout' }, [aside, main]));
      enableAnswerImageZoom(app);
    }
    state.next = newQuestion;
    if (!state.current) newQuestion(); else draw();
  }

  function infoCard(name) {
    const info = DATA.constellationInfo[name];
    if (!info) return '';
    const stars = info.stars.length ? info.stars.slice(0, 8).map(s => `${esc(s.name)}${s.designation ? ` (${esc(s.designation)})` : ''}`).join(', ') : 'none in current star list';
    const dsos = info.dsos.length ? info.dsos.slice(0, 10).map(o => `${esc(o.code)}${o.commonName ? ` ${esc(o.commonName)}` : ''}`).join(', ') : 'none in Messier/Caldwell list';
    return `<h3>${esc(name)}</h3><p>${esc(info.myth)}</p><p><strong>asterisms:</strong> ${info.asterisms.length ? info.asterisms.map(esc).join(', ') : 'none listed yet'}</p><p><strong>stars:</strong> ${stars}</p><p><strong>DSOs:</strong> ${dsos}</p>`;
  }
  function chartQuestion() {
    const c = rand(DATA.charts);
    return { prompt: 'Name the constellation chart.', answers: c.accepted, visual: chartPanelImg(c, false, 'blanked constellation chart'), card: () => `<h3>${esc(c.displayName)}</h3>${infoCard(c.name)}${chartImg(c, true, 'chart-img', 'labelled chart')}` };
  }
  function neighbourQuestion() {
    const pool = DATA.charts.filter(c => c.neighbourClues && c.neighbourClues.length);
    const c = rand(pool);
    const target = rand(c.neighbourClues);
    return { prompt: `On the <strong>${esc(c.displayName)}</strong> chart, name ${esc(target.clue)}.`, answers: [target.answer], visual: chartPanelImg(c, false, 'blanked constellation chart'), card: () => `<h3>${esc(target.answer)}</h3><p>Target neighbour on the ${esc(c.displayName)} chart.</p>${chartImg(c, true, 'chart-img', 'labelled chart')}` };
  }

  const starModes = [
    { id: 'starToConstellation', label: 'star -> constellation' },
    { id: 'designationToStar', label: 'designation -> star' },
    { id: 'starToDesignation', label: 'star -> designation' },
    { id: 'constellationToStar', label: 'constellation -> any listed star' },
    { id: 'groupToConstellation', label: 'star group -> constellation' }
  ];
  function starQuestion(mode) {
    if (mode === 'groupToConstellation') return starGroupQuestion();
    const s = rand(DATA.stars);
    if (mode === 'designationToStar') return { prompt: `Which named star has designation <strong>${esc(s.designation)}</strong>?`, answers: [s.name], card: () => `<h3>${esc(s.name)}</h3><p>${esc(s.designation)}. ${esc(s.constellation)}. ${esc(s.note)}.</p>${infoCard(s.constellation)}` };
    if (mode === 'starToDesignation') return { prompt: `What is the designation of <strong>${esc(s.name)}</strong>?`, answers: [s.designation], card: () => `<h3>${esc(s.name)}</h3><p>${esc(s.designation)}. ${esc(s.constellation)}. ${esc(s.note)}.</p>${infoCard(s.constellation)}` };
    if (mode === 'constellationToStar') {
      const entries = [...starByConst.entries()].filter(([, arr]) => arr.length >= 1);
      const [constellation, arr] = rand(entries);
      return { prompt: `Name any listed star in <strong>${esc(constellation)}</strong>.`, answers: arr.map(x => x.name), card: () => `<h3>${esc(constellation)}</h3><p>${arr.map(x => `${esc(x.name)} (${esc(x.designation)})`).join(', ')}</p>${infoCard(constellation)}` };
    }
    return { prompt: `Which constellation contains <strong>${esc(s.name)}</strong>?`, answers: [s.constellation], card: () => `<h3>${esc(s.name)}</h3><p>${esc(s.designation)}. ${esc(s.constellation)}. ${esc(s.note)}.</p>${infoCard(s.constellation)}` };
  }
  function starGroupQuestion() {
    const entries = [...starByConst.entries()].filter(([, arr]) => arr.length >= 2);
    const [constellation, arr] = rand(entries);
    const picks = sample(arr, Math.min(4, arr.length));
    return { prompt: `These stars are in which constellation?<br><strong>${picks.map(x => esc(x.name)).join(', ')}</strong>`, answers: [constellation], card: () => `<h3>${esc(constellation)}</h3><p>${arr.map(x => `${esc(x.name)} (${esc(x.designation)})`).join(', ')}</p>${infoCard(constellation)}` };
  }

  const asterismModes = [
    { id: 'clueToName', label: 'clue -> asterism' },
    { id: 'starsToAsterism', label: 'stars -> asterism' },
    { id: 'asterismToConstellation', label: 'asterism -> constellation' }
  ];
  function asterismQuestion(mode) {
    const a = rand(DATA.asterisms);
    if (mode === 'starsToAsterism' && a.members.length) return { prompt: `Which asterism uses these stars?<br><strong>${a.members.map(esc).join(', ')}</strong>`, answers: [a.name], card: () => `<h3>${esc(a.name)}</h3><p>${esc(a.clue)}</p><p>${a.constellations.map(esc).join(', ')}</p>` };
    if (mode === 'asterismToConstellation') return { prompt: `Name any constellation involved in <strong>${esc(a.name)}</strong>.`, answers: a.constellations, card: () => `<h3>${esc(a.name)}</h3><p>${esc(a.clue)}</p><p>${a.constellations.map(esc).join(', ')}</p>` };
    return { prompt: `What asterism / sky pattern is this?<br><strong>${esc(a.clue)}</strong>`, answers: [a.name], card: () => `<h3>${esc(a.name)}</h3><p>${esc(a.clue)}</p><p>${a.constellations.map(esc).join(', ')}</p>` };
  }
  const dsoModes = [
    { id: 'codeToName', label: 'number -> common name' },
    { id: 'nameToCode', label: 'common name -> number' },
    { id: 'objectToConstellation', label: 'object -> constellation' },
    { id: 'constellationToObject', label: 'constellation -> any listed DSO' },
    { id: 'objectToType', label: 'object -> type' },
    { id: 'groupToConstellation', label: 'DSO group -> constellation' }
  ];
  const namedDSO = DATA.dso.filter(o => o.commonName && o.commonName.trim());
  function dsoLabel(o) { return o.commonName ? `${o.code} - ${esc(o.commonName)}` : esc(o.code); }
  function dsoAnswers(o) { return [o.code, o.commonName].filter(Boolean); }
  function dsoQuestion(mode) {
    if (mode === 'groupToConstellation') return dsoGroupQuestion();
    if (mode === 'nameToCode') { const o = rand(namedDSO); return { prompt: `What catalogue number is <strong>${esc(o.commonName)}</strong>?`, answers: [o.code], card: () => `<h3>${dsoLabel(o)}</h3><p>${esc(o.type)}. ${esc(o.constellation)}.</p>${infoCard(o.constellation)}` }; }
    if (mode === 'objectToConstellation') { const o = rand(DATA.dso); return { prompt: `Which constellation contains <strong>${dsoLabel(o)}</strong>?`, answers: [o.constellation], card: () => `<h3>${dsoLabel(o)}</h3><p>${esc(o.type)}. ${esc(o.constellation)}.</p>${infoCard(o.constellation)}` }; }
    if (mode === 'constellationToObject') {
      const entries = [...dsoByConst.entries()].filter(([, arr]) => arr.length >= 1);
      const [constellation, arr] = rand(entries);
      return { prompt: `Name any listed Messier/Caldwell object in <strong>${esc(constellation)}</strong>.`, answers: arr.flatMap(dsoAnswers), card: () => `<h3>${esc(constellation)}</h3><p>${arr.map(dsoLabel).join(', ')}</p>${infoCard(constellation)}` };
    }
    if (mode === 'objectToType') { const o = rand(DATA.dso); return { prompt: `What type of object is <strong>${dsoLabel(o)}</strong>?`, answers: [o.type], card: () => `<h3>${dsoLabel(o)}</h3><p>${esc(o.type)}. ${esc(o.constellation)}.</p>` }; }
    const o = rand(namedDSO); return { prompt: `What common name is associated with <strong>${esc(o.code)}</strong>?`, answers: [o.commonName], card: () => `<h3>${dsoLabel(o)}</h3><p>${esc(o.type)}. ${esc(o.constellation)}.</p>${infoCard(o.constellation)}` };
  }
  function dsoGroupQuestion() {
    const entries = [...dsoByConst.entries()].filter(([, arr]) => arr.length >= 2);
    const [constellation, arr] = rand(entries);
    const picks = sample(arr, Math.min(5, arr.length));
    return { prompt: `These DSOs belong to which constellation?<br><strong>${picks.map(dsoLabel).join(', ')}</strong>`, answers: [constellation], card: () => `<h3>${esc(constellation)}</h3><p>${arr.map(dsoLabel).join(', ')}</p>${infoCard(constellation)}` };
  }
  function mixedQuestion() {
    const makers = [chartQuestion, neighbourQuestion, () => starQuestion(rand(starModes).id), starGroupQuestion, () => asterismQuestion(rand(asterismModes).id), () => dsoQuestion(rand(dsoModes).id), dsoGroupQuestion];
    const q = rand(makers)(); q.prompt = `<span class="small">mixed</span><br>${q.prompt}`; return q;
  }

  let timerState = states.timer || (states.timer = { running: false, seconds: 0, interval: null, found: new Set(), next: () => {} });
  function renderTimer() {
    app.innerHTML = '';
    const timeText = new Date(timerState.seconds * 1000).toISOString().slice(14, 19);
    const found = [...timerState.found].sort();
    const input = el('input', { id: 'timerInput', autocomplete: 'off', placeholder: 'type constellation names' });
    input.addEventListener('input', () => timerCheck(input));
    app.append(el('section', { class: 'panel' }, [
      el('h2', {}, [document.createTextNode('88 Timer')]),
      el('p', { html: `<strong id="timerClock">${timeText}</strong> <span id="timerProgress">${found.length}/88</span>` }),
      el('div', { class: 'controls' }, [el('button', { type: 'button', onclick: timerStart }, [document.createTextNode('start / restart')]), el('button', { type: 'button', onclick: timerStop }, [document.createTextNode('stop')])]),
      input,
      el('div', { id: 'timerMsg', class: 'message' }),
      el('h3', {}, [document.createTextNode('found')]),
      el('div', { id: 'foundList', html: found.map(n => `<span class="pill">${esc(n)}</span>`).join('') }),
]));
    setTimeout(() => $('#timerInput') && $('#timerInput').focus(), 0);
  }
  function timerTick() { timerState.seconds++; const clock = $('#timerClock'); if (clock) clock.textContent = new Date(timerState.seconds * 1000).toISOString().slice(14, 19); }
  function timerStart() { clearInterval(timerState.interval); timerState.running = true; timerState.seconds = 0; timerState.found = new Set(); timerState.interval = setInterval(timerTick, 1000); renderTimer(); }
  function timerStop() { clearInterval(timerState.interval); timerState.running = false; const msg = $('#timerMsg'); if (msg) msg.textContent = `stopped at ${timerState.found.size}/88`; }
  function findConstellationInput(raw) {
    const n = norm(raw);
    if (!n) return null;
    return DATA.constellations.find(x => norm(x.name) === n) || null;
  }
  function updateTimerDisplay() {
    const found = [...timerState.found].sort();
    const progress = $('#timerProgress');
    const list = $('#foundList');
    if (progress) progress.textContent = `${found.length}/88`;
    if (list) list.innerHTML = found.map(n => `<span class="pill">${esc(n)}</span>`).join('');
  }
  function timerCheck(input) {
    const raw = input.value, n = norm(raw);
    const hit = findConstellationInput(raw);
    if (!hit) return;
    const longer = DATA.constellations.some(c => !timerState.found.has(c.name) && norm(c.name).startsWith(n) && norm(c.name) !== n);
    const forced = /[,;\s]$/.test(raw);
    if (longer && !forced) return;
    input.value = '';
    if (timerState.found.has(hit.name)) return;
    timerState.found.add(hit.name);
    updateTimerDisplay();
    if (timerState.found.size === 88) {
      clearInterval(timerState.interval);
      timerState.running = false;
      record('timer', true);
      const msg = $('#timerMsg');
      if (msg) msg.textContent = 'complete';
    }
  }

  function renderAtlas() {
    app.innerHTML = '<h2>Atlas</h2><input id="atlasSearch" placeholder="search constellations, stars, DSOs, asterisms"><div class="atlas-grid" id="atlasGrid"></div>';
    const search = $('#atlasSearch'), grid = $('#atlasGrid');
    function draw() {
      const q = norm(search.value);
      grid.innerHTML = '';
      DATA.constellations.forEach(c0 => {
        const name = c0.name, info = DATA.constellationInfo[name], chart = chartByName.get(name);
        const blob = [name, info.meaning, info.myth, ...(info.neighbours || []), ...(info.asterisms || []), ...info.stars.map(s => s.name), ...info.dsos.map(o => `${o.code} ${o.commonName}`)].join(' ');
        if (q && !norm(blob).includes(q)) return;
        const card = el('div', { class: 'atlas-card', onclick: () => renderConstellationPage(name) });
        card.innerHTML = `${chart ? chartImg(chart, true, '', `${name} labelled chart`) : ''}<h3>${esc(name)}</h3><p class="small">${esc(info.meaning)}</p><p class="small">${info.asterisms.length ? info.asterisms.map(esc).join(', ') : '&nbsp;'}</p>`;
        grid.append(card);
      });
    }
    search.addEventListener('input', draw); draw(); search.focus();
  }
  function renderConstellationPage(name) {
    const info = DATA.constellationInfo[name], charts = chartsByName.get(name) || [];
    const relatedAsterisms = DATA.asterisms.filter(a => (a.constellations || []).includes(name));
    const asterismRows = relatedAsterisms.length ? relatedAsterisms.map(a => `<tr><td>${esc(a.name)}</td><td>${(a.members || []).map(esc).join(', ') || '—'}</td><td>${esc(a.clue || '')}</td></tr>`).join('') : '<tr><td colspan="3">No listed asterism in the current catalogue.</td></tr>';
    const starRows = info.stars.length ? info.stars.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.designation)}</td><td>${esc(s.note)}</td></tr>`).join('') : '<tr><td colspan="3">No star in the current curated named-star list.</td></tr>';
    const dsoRows = info.dsos.length ? info.dsos.map(o => `<tr><td>${esc(o.code)}</td><td>${esc(o.commonName)}</td><td>${esc(o.type)}</td></tr>`).join('') : '<tr><td colspan="3">No Messier/Caldwell object in the current list.</td></tr>';
    const chartHtml = charts.length ? charts.map((ch, i) => `<div class="chart-detail-box"><h3>${esc(ch.displayName || name)}${charts.length > 1 ? ` chart ${i + 1}` : ''}</h3>${chartImg(ch, true, 'chart-img detail-chart', `${ch.displayName || name} labelled chart`)}</div>`).join('') : '';
    const atlasNotes = (info.atlasNotes || []).length ? `<h3>Sky picture</h3>${info.atlasNotes.map(x => `<p>${esc(x)}</p>`).join('')}` : '';
    const facts = (info.funFacts || []).filter(Boolean);
    const order = DATA.constellations.map(c => c.name);
    const hereIndex = order.indexOf(name);
    const prevName = order[(hereIndex - 1 + order.length) % order.length];
    const nextName = order[(hereIndex + 1) % order.length];
    app.innerHTML = `<div class="controls atlas-page-nav"><button type="button" id="prevAtlas" title="previous constellation">←</button><button type="button" id="backAtlas">atlas</button><button type="button" id="nextAtlas" title="next constellation">→</button></div><h2>${esc(name)}</h2><div class="detail-grid"><section class="panel"><h3>Memory hook</h3><p><strong>${esc(info.meaning)}</strong></p><p>${esc(info.myth)}</p>${atlasNotes}<h3>Bordering / nearby chart labels</h3><p>${info.neighbours.length ? info.neighbours.map(n => `<button type="button" class="linkbtn" data-const="${esc(n)}">${esc(n)}</button>`).join(' ') : 'none listed'}</p><h3>Asterisms and sky groups</h3><div class="table-wrap"><table><thead><tr><th>asterism</th><th>member stars</th><th>description</th></tr></thead><tbody>${asterismRows}</tbody></table></div>${facts.length ? `<h3>Fun facts / pointing tricks</h3><ul>${facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section><section class="panel">${chartHtml}</section></div><section class="panel"><h3>Stars inside</h3><table><thead><tr><th>star</th><th>designation</th><th>note</th></tr></thead><tbody>${starRows}</tbody></table><h3>Messier + Caldwell DSOs inside</h3><table><thead><tr><th>code</th><th>common name</th><th>type</th></tr></thead><tbody>${dsoRows}</tbody></table></section>`;
    $('#backAtlas').addEventListener('click', renderAtlas);
    $('#prevAtlas').addEventListener('click', () => renderConstellationPage(prevName));
    $('#nextAtlas').addEventListener('click', () => renderConstellationPage(nextName));
    document.querySelectorAll('[data-const]').forEach(b => b.addEventListener('click', () => renderConstellationPage(b.dataset.const)));
  }


  const HYG_MAG65_URL = 'https://raw.githubusercontent.com/eleanorlutz/western_constellations_atlas_of_space/refs/heads/main/data/processed/hygdata_processed_mag65.csv';
  const CON_ABBR_TO_NAME = new Map(DATA.constellations.map(c => [compact(c.abbr), c.name]));
  CON_ABBR_TO_NAME.set('ser1', 'Serpens');
  CON_ABBR_TO_NAME.set('ser2', 'Serpens');
  let skyDataPromise = null;
  let skyStars = [];
  let skyConstCentres = new Map();

  const CONSTELLATION_BOUNDS_URL = 'https://cdn.jsdelivr.net/gh/dieghernan/celestial_data@main/data/constellations.bounds.min.geojson';
  let skyBoundsPromise = null;
  let skyBoundsFeatures = [];
  function constellationNameFromFeature(feature) {
    const props = feature.properties || {};
    const values = [feature.id, props.id, props.ID, props.name, props.Name, props.nam, props.desig, props.abbr, props.constellation, props.Constellation, ...Object.values(props)].filter(v => typeof v === 'string');
    for (const v of values) {
      const c = compact(v);
      if (CON_ABBR_TO_NAME.has(c)) return CON_ABBR_TO_NAME.get(c);
      const byName = DATA.constellations.find(x => compact(x.name) === c);
      if (byName) return byName.name;
    }
    return String(values[0] || '');
  }
  function geoRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return [geometry.coordinates];
    if (geometry.type === 'MultiPolygon') return geometry.coordinates;
    return [];
  }
  async function loadConstellationBounds() {
    if (skyBoundsFeatures.length) return skyBoundsFeatures;
    if (skyBoundsPromise) return skyBoundsPromise;
    skyBoundsPromise = fetch(CONSTELLATION_BOUNDS_URL, { cache: 'force-cache' })
      .then(res => { if (!res.ok) throw new Error('boundary data unavailable.'); return res.json(); })
      .then(geo => {
        skyBoundsFeatures = (geo.features || []).map(feature => ({
          name: constellationNameFromFeature(feature),
          rings: geoRings(feature.geometry)
        })).filter(f => f.name && f.rings.length);
        return skyBoundsFeatures;
      });
    return skyBoundsPromise;
  }
  function raToLon180(ra) {
    let lon = ((ra + 180) % 360 + 360) % 360 - 180;
    return lon;
  }
  function pointInRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      const intersects = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }
  function pointInPolygon(lon, lat, polygon) {
    if (!polygon.length || !pointInRing(lon, lat, polygon[0])) return false;
    for (let i = 1; i < polygon.length; i++) if (pointInRing(lon, lat, polygon[i])) return false;
    return true;
  }
  function pointInFeature(lon, lat, feature) {
    return feature.rings.some(poly => pointInPolygon(lon, lat, poly));
  }
  function officialConstellationAtVec(v) {
    if (!skyBoundsFeatures.length) return '';
    const rd = raDecFromVec(v);
    const lonA = raToLon180(rd.ra), lonB = raToLon180(-rd.ra), lat = rd.dec;
    for (const lon of [lonA, lonB]) {
      for (const feature of skyBoundsFeatures) {
        if (pointInFeature(lon, lat, feature)) return feature.name;
      }
    }
    return '';
  }
  function parseCsvLine(line) {
    const out = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = !quoted;
      } else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function pickColumn(headers, names) {
    const lower = headers.map(h => h.toLowerCase().trim());
    for (const n of names) {
      const idx = lower.indexOf(n.toLowerCase());
      if (idx !== -1) return idx;
    }
    return -1;
  }
  function sexaToDeg(value, isRa) {
    const s = String(value || '').trim();
    if (!s) return NaN;
    if (/^[+-]?\d+(\.\d+)?$/.test(s)) {
      const n = parseFloat(s);
      return isRa && Math.abs(n) <= 24.0001 ? n * 15 : n;
    }
    const sign = s.startsWith('-') ? -1 : 1;
    const parts = s.replace(/^[+-]/, '').split(':').map(Number);
    if (parts.some(Number.isNaN)) return NaN;
    const val = (parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
    return isRa ? val * 15 : sign * val;
  }
  function vecFromRaDec(raDeg, decDeg) {
    const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180;
    const cd = Math.cos(dec);
    return { x: cd * Math.cos(ra), y: cd * Math.sin(ra), z: Math.sin(dec) };
  }
  function raDecFromVec(v) {
    const ra = (Math.atan2(v.y, v.x) * 180 / Math.PI + 360) % 360;
    const dec = Math.asin(Math.max(-1, Math.min(1, v.z))) * 180 / Math.PI;
    return { ra, dec };
  }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function normVec(v) { const m = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / m, y: v.y / m, z: v.z / m }; }
  function angularDeg(a, b) { return Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180 / Math.PI; }
  async function loadSkyData() {
    if (skyStars.length) return;
    if (skyDataPromise) return skyDataPromise;
    skyDataPromise = (async () => {
      const res = await fetch(HYG_MAG65_URL, { cache: 'force-cache' });
      if (!res.ok) throw new Error('sky data unavailable.');
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/);
      const headers = parseCsvLine(lines[0]);
      const raI = pickColumn(headers, ['ra', 'RA', 'ra_hours', 'ra_h', 'right_ascension']);
      const decI = pickColumn(headers, ['dec', 'DEC', 'declination']);
      const magI = pickColumn(headers, ['mag', 'MAG', 'magnitude']);
      const conI = pickColumn(headers, ['con', 'constellation', 'Constellation']);
      const nameI = pickColumn(headers, ['proper', 'name', 'star_name']);
      const bayerI = pickColumn(headers, ['bayer', 'Bayer']);
      const bfI = pickColumn(headers, ['bf', 'bayer_flamsteed', 'Bayer Flamsteed']);
      if (raI < 0 || decI < 0 || magI < 0 || conI < 0) throw new Error('sky data unavailable.');
      const raw = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = parseCsvLine(lines[i]);
        const ra = sexaToDeg(row[raI], true), dec = sexaToDeg(row[decI], false), mag = parseFloat(row[magI]);
        if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag) || mag > 6) continue;
        let con = String(row[conI] || '').trim();
        let constellation = CON_ABBR_TO_NAME.get(compact(con)) || DATA.constellations.find(c => compact(c.name) === compact(con))?.name;
        if (!constellation) continue;
        const v = vecFromRaDec(ra, dec);
        raw.push({ ra, dec, mag, constellation, name: nameI >= 0 ? row[nameI] : '', bayer: bayerI >= 0 ? row[bayerI] : '', bf: bfI >= 0 ? row[bfI] : '', v });
      }
      skyStars = raw.sort((a, b) => a.mag - b.mag);
      const sums = new Map();
      skyStars.forEach(s => {
        const cur = sums.get(s.constellation) || { x: 0, y: 0, z: 0, n: 0 };
        cur.x += s.v.x; cur.y += s.v.y; cur.z += s.v.z; cur.n++;
        sums.set(s.constellation, cur);
      });
      skyConstCentres = new Map();
      sums.forEach((s, name) => skyConstCentres.set(name, normVec(s)));
    })();
    return skyDataPromise;
  }

  let skyAlphaCache = null;
  function isAlphaStarRecord(s) {
    const bayer = compact(s.bayer || '');
    const bf = compact(s.bf || '');
    return bayer === 'alp' || bayer === 'alpha' || bf.includes('alp');
  }
  function alphaInfoFromData(constellation) {
    return DATA.stars.find(s => s.constellation === constellation && /^Alpha\b/i.test(s.designation || '')) || null;
  }
  function skyAlphaTargets() {
    if (skyAlphaCache && skyAlphaCache.length) return skyAlphaCache;
    const targets = [];
    for (const c of DATA.constellations) {
      const constellation = c.name;
      const info = alphaInfoFromData(constellation);
      let star = null;
      if (info) star = skyStars.find(s => s.constellation === constellation && compact(s.name) === compact(info.name));
      if (!star) {
        const alphas = skyStars.filter(s => s.constellation === constellation && isAlphaStarRecord(s));
        if (alphas.length) star = alphas.sort((a, b) => a.mag - b.mag)[0];
      }
      if (!star) {
        const fallback = skyStars.filter(s => s.constellation === constellation).sort((a, b) => a.mag - b.mag)[0];
        if (fallback) star = { ...fallback, fallback: true };
      }
      if (star) {
        const label = info ? `${info.designation}${info.name ? ` — ${info.name}` : ''}` : (star.fallback ? `brightest loaded star in ${constellation}` : `Alpha ${constellation}${star.name ? ` — ${star.name}` : ''}`);
        targets.push({ constellation, star, label, fallback: !!star.fallback });
      }
    }
    skyAlphaCache = targets;
    return targets;
  }

  function renderSkyGuessr() {
    const state = states.skyguessr || (states.skyguessr = { loaded: false, loading: false, error: '', fov: 140, magLimit: 5.0, autoMag: true, target: null, answered: false, message: '', score: scoreKey('skyguessr'), orient: null });
    app.innerHTML = `<h2>SkyGuessr</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="skyCanvas" width="900" height="900" tabindex="0" aria-label="celestial sphere"></canvas></section><aside class="panel"><label>FOV degrees<div class="slider-text-row"><input id="skyFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="skyFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label class="checkline"><input id="skyAutoMag" type="checkbox" ${state.autoMag !== false ? "checked" : ""}><span>adaptive star density</span></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="skyMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="skyMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><div class="sky-nav-grid" aria-label="sky movement controls"><button type="button" data-move="-1,-1">↖</button><button type="button" data-move="0,-1">↑</button><button type="button" data-move="1,-1">↗</button><button type="button" data-move="-1,0">←</button><button type="button" id="skyCentre">X</button><button type="button" data-move="1,0">→</button><button type="button" data-move="-1,1">↙</button><button type="button" data-move="0,1">↓</button><button type="button" data-move="1,1">↘</button></div><div class="controls"><button type="button" id="skyRollCCW">↺ rotate</button><button type="button" id="skyRollCW">rotate ↻</button></div><input id="skyAnswer" autocomplete="off" placeholder="constellation at the X"><div class="controls"><button type="button" id="skyReveal">reveal</button></div><div class="controls new-round-controls"><button type="button" id="skyNew" class="new-round-button">new location</button></div><div id="skyMsg" class="message">${esc(state.message || '')}</div><div class="stats">${formatScore('skyguessr')}</div></aside></div>`;
    initRangeVisuals(app);
    const canvas = $('#skyCanvas'), ctx = canvas.getContext('2d');
    function focusCanvas() { try { canvas.focus({ preventScroll: true }); } catch { focusCanvas(); } }
    const answer = $('#skyAnswer');
    const fovInput = $('#skyFov');
    const fovSlider = $('#skyFovSlider');

    function adaptiveMag() {
      if (state.fov >= 130) return 4.6;
      if (state.fov <= 80) return 5.2;
      return 5.2 - (state.fov - 80) * (0.4 / 50);
    }
    function effectiveMag() {
      return state.autoMag !== false ? adaptiveMag() : state.magLimit;
    }
    function syncMagInput() {
      const value = effectiveMag().toFixed(1);
      const mag = $('#skyMag');
      const slider = $('#skyMagSlider');
      if (mag && state.autoMag !== false) mag.value = value;
      if (slider && state.autoMag !== false) { slider.value = value; updateRangeVisual(slider); }
    }
    function targetPool() {
      const base = effectiveMag();
      const limit = Math.min(5.0, Math.max(4.0, base + 0.2));
      return skyStars.filter(s => s.mag <= limit && s.constellation);
    }
    function makeBasisFromForward(forward) {
      const f = normVec(forward);
      const ref = Math.abs(f.z) > 0.96 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
      let right = normVec(cross(f, ref));
      if (!Number.isFinite(right.x)) right = { x: 1, y: 0, z: 0 };
      let up = normVec(cross(right, f));
      right = normVec(cross(f, up));
      return { f, right, up };
    }
    function cleanBasis(b) {
      const f = normVec(b.f);
      let right = b.right;
      const proj = dot(right, f);
      right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
      if (!Number.isFinite(right.x)) return makeBasisFromForward(f);
      const up = normVec(cross(right, f));
      return { f, right: normVec(cross(f, up)), up };
    }
    function setOrientationForward(forward) {
      state.orient = makeBasisFromForward(forward);
    }
    function ensureOrientation() {
      if (!state.orient) setOrientationForward(vecFromRaDec(0, 0));
      state.orient = cleanBasis(state.orient);
      return state.orient;
    }
    function rotateBasis(axis, angle) {
      const b = ensureOrientation();
      state.orient = cleanBasis({
        f: rotateAround(b.f, axis, angle),
        right: rotateAround(b.right, axis, angle),
        up: rotateAround(b.up, axis, angle)
      });
    }
    function rotateAround(v, axis, angle) {
      const c = Math.cos(angle), s = Math.sin(angle), d = dot(axis, v), cr = cross(axis, v);
      return normVec({
        x: v.x * c + cr.x * s + axis.x * d * (1 - c),
        y: v.y * c + cr.y * s + axis.y * d * (1 - c),
        z: v.z * c + cr.z * s + axis.z * d * (1 - c)
      });
    }
    function clampFov(v) { return Math.max(20, Math.min(190, v)); }
    function setFov(v) {
      state.fov = clampFov(v);
      const value = Number(state.fov.toFixed(1));
      if (fovInput) fovInput.value = value;
      if (fovSlider) { fovSlider.value = value; updateRangeVisual(fovSlider); }
      draw();
    }
    function project(v, b, radius, fovRad) {
      const z = dot(v, b.f);
      const ang = Math.acos(Math.max(-1, Math.min(1, z)));
      if (ang > fovRad / 2) return null;
      const x = dot(v, b.right), y = dot(v, b.up);
      const sin = Math.sin(ang) || 1e-9;
      const rr = (ang / (fovRad / 2)) * radius;
      return { x: canvas.width / 2 + rr * x / sin, y: canvas.height / 2 - rr * y / sin, z };
    }
    function ensureTarget() {
      if (!state.target && skyStars.length) {
        const candidates = targetPool();
        state.target = rand(candidates.length ? candidates : skyStars.filter(s => s.constellation));
        centreOnTarget(false);
        state.answered = false;
      }
    }
    function draw() {
      ensureTarget();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      if (!state.loaded) {
        ctx.fillStyle = 'black'; ctx.font = '20px Arial'; ctx.fillText(state.error || 'loading sky...', 24, 40); return;
      }
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const fovRad = state.fov * Math.PI / 180;
      const b = ensureOrientation();
      ctx.save();
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.clip();
      syncMagInput();
      const visible = skyStars.filter(s => s.mag <= effectiveMag()).sort((a, b) => b.mag - a.mag);
      ctx.fillStyle = 'black';
      for (const s of visible) {
        const p = project(s.v, b, radius, fovRad);
        if (!p) continue;
        const r = Math.max(0.9, Math.min(4.8, 4.2 - s.mag * 0.55));
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (state.target) {
        const p = project(state.target.v, b, radius, fovRad);
        if (p) {
          ctx.strokeStyle = 'black'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(p.x - 13, p.y - 13); ctx.lineTo(p.x + 13, p.y + 13); ctx.moveTo(p.x + 13, p.y - 13); ctx.lineTo(p.x - 13, p.y + 13); ctx.stroke();
          ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 19, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.stroke();
    }
    function move(dx, dy, multiplier = 1) {
      const b = ensureOrientation();
      const anglePerPx = (state.fov * Math.PI / 180) / Math.min(canvas.width, canvas.height) * multiplier;
      const yaw = -dx * anglePerPx;
      const pitch = -dy * anglePerPx;
      rotateBasis(b.up, yaw);
      rotateBasis(ensureOrientation().right, pitch);
      draw();
    }
    function moveButton(x, y) {
      const px = Math.min(canvas.width, canvas.height) * 0.05;
      move(x * px, y * px, 1);
      focusCanvas();
    }
    function rollFrame(direction) {
      const b = ensureOrientation();
      rotateBasis(b.f, direction * 10 * Math.PI / 180);
      draw();
      focusCanvas();
    }
    function centreOnTarget(redraw = true) {
      if (!state.target) return;
      setOrientationForward(state.target.v);
      if (redraw) draw();
    }
    function offsetFromTarget() {
      if (!state.target) return;
      setOrientationForward(state.target.v);
      const b = ensureOrientation();
      const yaw = (Math.random() - 0.5) * Math.min(18, state.fov * 0.22) * Math.PI / 180;
      const pitch = (Math.random() - 0.5) * Math.min(12, state.fov * 0.15) * Math.PI / 180;
      rotateBasis(b.up, yaw);
      rotateBasis(ensureOrientation().right, pitch);
    }
    function allowedAnswers() {
      if (!state.target) return [];
      const target = state.target.constellation;
      const centreLimit = Math.max(10, Math.min(18, state.fov * 0.16));
      const allowed = new Set([target]);
      const targetVec = state.target.v;
      skyConstCentres.forEach((v, name) => { if (name !== target && angularDeg(targetVec, v) <= centreLimit) allowed.add(name); });
      const chart = chartByName.get(target);
      if (chart) (chart.neighbours || []).forEach(n => { const cv = skyConstCentres.get(n); if (cv && angularDeg(targetVec, cv) <= centreLimit + 5) allowed.add(n); });
      return [...allowed];
    }
    function solved(value) {
      if (!state.target || state.answered) return;
      const allowed = allowedAnswers();
      if (!answerMatches(value, allowed)) return;
      state.answered = true;
      record('skyguessr', true);
      state.message = `correct: ${state.target.constellation}`;
      $('#skyMsg').textContent = state.message;
    }
    function newTarget() {
      if (!skyStars.length) return;
      const candidates = targetPool();
      state.target = rand(candidates.length ? candidates : skyStars.filter(s => s.constellation));
      offsetFromTarget();
      state.fov = 140;
      state.answered = false; state.message = ''; answer.value = ''; renderSkyGuessr();
    }
    function reveal() {
      if (!state.target || state.answered) return;
      const allowed = allowedAnswers();
      state.answered = true;
      record('skyguessr', false);
      state.message = `answer: ${state.target.constellation}${allowed.length > 1 ? ' / nearby accepted: ' + allowed.slice(1).join(', ') : ''}`;
      $('#skyMsg').textContent = state.message;
    }

    answer.addEventListener('input', () => solved(answer.value));
    fovInput.addEventListener('input', e => setFov(parseFloat(e.target.value) || 100));
    fovSlider.addEventListener('input', e => setFov(parseFloat(e.target.value) || 100));
    function turnOffAutoMag() {
      if (state.autoMag !== false) {
        state.autoMag = false;
        $('#skyAutoMag').checked = false;
      }
    }
    function setSkyMag(v) {
      turnOffAutoMag();
      state.magLimit = Math.max(4, Math.min(6, parseFloat(v) || 5.0));
      const value = Number(state.magLimit.toFixed(1));
      $('#skyMag').value = value;
      $('#skyMagSlider').value = value;
      updateRangeVisual($('#skyMagSlider'));
      draw();
    }
    $('#skyAutoMag').addEventListener('change', e => { state.autoMag = e.target.checked; syncMagInput(); draw(); });
    $('#skyMag').addEventListener('focus', () => turnOffAutoMag());
    $('#skyMagSlider').addEventListener('focus', () => turnOffAutoMag());
    $('#skyMag').addEventListener('input', e => setSkyMag(e.target.value));
    $('#skyMagSlider').addEventListener('input', e => setSkyMag(e.target.value));
    $('#skyNew').addEventListener('click', newTarget);
    $('#skyReveal').addEventListener('click', reveal);
    $('#skyCentre').addEventListener('click', () => { setFov(140); centreOnTarget(true); focusCanvas(); });
    $('#skyRollCCW').addEventListener('click', () => rollFrame(-1));
    $('#skyRollCW').addEventListener('click', () => rollFrame(1));
    document.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => {
      const [x, y] = btn.dataset.move.split(',').map(Number);
      moveButton(x, y);
    }));

    const activePointers = new Map();
    let lastDrag = null, lastPinchDistance = null;
    const pointerDistance = () => {
      const pts = [...activePointers.values()];
      if (pts.length < 2) return null;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    function finishPointer(e) {
      activePointers.delete(e.pointerId);
      lastPinchDistance = activePointers.size >= 2 ? pointerDistance() : null;
      lastDrag = activePointers.size === 1 ? [...activePointers.values()][0] : null;
    }
    canvas.addEventListener('pointerdown', e => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      focusCanvas();
      if (activePointers.size === 1) lastDrag = { x: e.clientX, y: e.clientY };
      if (activePointers.size >= 2) lastPinchDistance = pointerDistance();
    });
    canvas.addEventListener('pointermove', e => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size >= 2) {
        const d = pointerDistance();
        if (d && lastPinchDistance) setFov(state.fov * lastPinchDistance / d);
        lastPinchDistance = d;
        return;
      }
      const p = activePointers.get(e.pointerId);
      if (!lastDrag) { lastDrag = p; return; }
      move(p.x - lastDrag.x, p.y - lastDrag.y, 0.9);
      lastDrag = p;
    });
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);
    canvas.addEventListener('lostpointercapture', finishPointer);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { setFov(state.fov * Math.exp(e.deltaY * 0.002)); return; }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.height : 1;
      const dx = (e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit;
      const dy = (e.shiftKey ? 0 : e.deltaY) * unit;
      move(dx, dy, 0.45);
    }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const step = e.shiftKey ? 28 : 12;
      if (['ArrowLeft','a','A'].includes(e.key)) { e.preventDefault(); move(-step, 0); }
      if (['ArrowRight','d','D'].includes(e.key)) { e.preventDefault(); move(step, 0); }
      if (['ArrowUp','w','W'].includes(e.key)) { e.preventDefault(); move(0, -step); }
      if (['ArrowDown','s','S'].includes(e.key)) { e.preventDefault(); move(0, step); }
    });
    if (!state.loaded && !state.loading) {
      state.loading = true;
      loadSkyData().then(() => { state.loaded = true; state.loading = false; ensureTarget(); draw(); answer.focus(); }).catch(err => { state.error = 'sky data unavailable'; state.loading = false; draw(); });
    }
    ensureTarget(); draw(); setTimeout(() => answer.focus(), 0);
  }



  function renderAlphaPin() {
    const state = states.alphapin || (states.alphapin = { loaded: false, loading: false, error: '', fov: 140, magLimit: 5.0, target: null, selectedVec: null, result: '', submitted: false, orient: null });
    app.innerHTML = `<h2>Find Constellation</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="alphaCanvas" width="900" height="900" tabindex="0" aria-label="alpha star guessing sphere"></canvas></section><aside class="panel"><div class="prompt">Find&nbsp;<strong>${esc(state.target ? state.target.constellation : '...')}</strong>.</div><label>FOV degrees<div class="slider-text-row"><input id="alphaFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="alphaFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="alphaMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="alphaMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><div class="sky-nav-grid" aria-label="alpha movement controls"><button type="button" data-amove="-1,-1">↖</button><button type="button" data-amove="0,-1">↑</button><button type="button" data-amove="1,-1">↗</button><button type="button" data-amove="-1,0">←</button><button type="button" id="alphaCentre">○</button><button type="button" data-amove="1,0">→</button><button type="button" data-amove="-1,1">↙</button><button type="button" data-amove="0,1">↓</button><button type="button" data-amove="1,1">↘</button></div><div class="controls"><button type="button" id="alphaRollCCW">↺ rotate</button><button type="button" id="alphaRollCW">rotate ↻</button></div><div class="controls"><button type="button" id="alphaSubmit">submit</button><button type="button" id="alphaZoomIn">zoom in</button><button type="button" id="alphaZoomOut">zoom out</button></div><div class="controls new-round-controls"><button type="button" id="alphaNew" class="new-round-button">new constellation</button></div><div id="alphaMsg" class="message">${esc(state.result || '')}</div><div class="stats">${formatPointScore('alphapin')}</div><div class="small alpha-pin-hint">(pin the alpha star)</div></aside></div>`;
    initRangeVisuals(app);
    const canvas = $('#alphaCanvas'), ctx = canvas.getContext('2d');
    function focusCanvas() { try { canvas.focus({ preventScroll: true }); } catch { focusCanvas(); } }
    const fovInput = $('#alphaFov');
    const fovSlider = $('#alphaFovSlider');

    function makeBasisFromForward(forward) {
      const f = normVec(forward);
      const ref = Math.abs(f.z) > 0.96 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
      let right = normVec(cross(f, ref));
      if (!Number.isFinite(right.x)) right = { x: 1, y: 0, z: 0 };
      let up = normVec(cross(right, f));
      right = normVec(cross(f, up));
      return { f, right, up };
    }
    function randomUnitVec() {
      const z = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      return { x: r * Math.cos(a), y: r * Math.sin(a), z };
    }
    function randomOrientation() {
      state.orient = makeBasisFromForward(randomUnitVec());
      const b = state.orient;
      state.orient = cleanBasis({
        f: b.f,
        right: rotateAround(b.right, b.f, Math.random() * Math.PI * 2),
        up: rotateAround(b.up, b.f, Math.random() * Math.PI * 2)
      });
    }
    function cleanBasis(b) {
      const f = normVec(b.f);
      let right = b.right;
      const proj = dot(right, f);
      right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
      if (!Number.isFinite(right.x)) return makeBasisFromForward(f);
      const up = normVec(cross(right, f));
      return { f, right: normVec(cross(f, up)), up };
    }
    function ensureOrientation() {
      if (!state.orient) state.orient = makeBasisFromForward(vecFromRaDec(0, 0));
      state.orient = cleanBasis(state.orient);
      return state.orient;
    }
    function rotateAround(v, axis, angle) {
      const c = Math.cos(angle), s = Math.sin(angle), d = dot(axis, v), cr = cross(axis, v);
      return normVec({
        x: v.x * c + cr.x * s + axis.x * d * (1 - c),
        y: v.y * c + cr.y * s + axis.y * d * (1 - c),
        z: v.z * c + cr.z * s + axis.z * d * (1 - c)
      });
    }
    function rotateBasis(axis, angle) {
      const b = ensureOrientation();
      state.orient = cleanBasis({
        f: rotateAround(b.f, axis, angle),
        right: rotateAround(b.right, axis, angle),
        up: rotateAround(b.up, axis, angle)
      });
    }
    function clampFov(v) { return Math.max(20, Math.min(190, v)); }
    function setFov(v) {
      state.fov = clampFov(v);
      const value = Number(state.fov.toFixed(1));
      if (fovInput) fovInput.value = value;
      if (fovSlider) { fovSlider.value = value; updateRangeVisual(fovSlider); }
      draw();
    }
    function project(v, b, radius, fovRad) {
      const z = dot(v, b.f);
      const ang = Math.acos(Math.max(-1, Math.min(1, z)));
      if (ang > fovRad / 2) return null;
      const x = dot(v, b.right), y = dot(v, b.up);
      const sin = Math.sin(ang) || 1e-9;
      const rr = (ang / (fovRad / 2)) * radius;
      return { x: canvas.width / 2 + rr * x / sin, y: canvas.height / 2 - rr * y / sin, z };
    }
    function vecAtCanvasPoint(x, y) {
      const b = ensureOrientation();
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const sx = x - cx, sy = y - cy;
      const rho = Math.hypot(sx, sy) / radius;
      if (rho > 1) return null;
      const ang = rho * (state.fov * Math.PI / 180) / 2;
      if (rho < 1e-9) return b.f;
      const ux = sx / (rho * radius), uy = -sy / (rho * radius);
      return normVec({
        x: b.f.x * Math.cos(ang) + (b.right.x * ux + b.up.x * uy) * Math.sin(ang),
        y: b.f.y * Math.cos(ang) + (b.right.y * ux + b.up.y * uy) * Math.sin(ang),
        z: b.f.z * Math.cos(ang) + (b.right.z * ux + b.up.z * uy) * Math.sin(ang)
      });
    }
    function ensureTarget() {
      if (!state.target && skyStars.length) {
        const targets = skyAlphaTargets();
        state.target = rand(targets);
        state.selectedVec = null;
        state.submitted = false;
        state.result = '';
        if (state.target) randomOrientation();
      }
    }
    function drawCross(p, size, width) {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p.x - size, p.y - size); ctx.lineTo(p.x + size, p.y + size);
      ctx.moveTo(p.x + size, p.y - size); ctx.lineTo(p.x - size, p.y + size);
      ctx.stroke();
    }
    function draw() {
      ensureTarget();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      if (!state.loaded) {
        ctx.fillStyle = 'black'; ctx.font = '20px Arial'; ctx.fillText(state.error || 'loading sky...', 24, 40); return;
      }
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const fovRad = state.fov * Math.PI / 180;
      const b = ensureOrientation();
      ctx.save();
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.clip();
      const visible = skyStars.filter(s => s.mag <= state.magLimit).sort((a, b) => b.mag - a.mag);
      ctx.fillStyle = 'black';
      for (const s of visible) {
        const p = project(s.v, b, radius, fovRad);
        if (!p) continue;
        const r = Math.max(0.8, Math.min(4.5, 4.0 - s.mag * 0.52));
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (state.selectedVec) {
        const p = project(state.selectedVec, b, radius, fovRad);
        if (p) { ctx.strokeStyle = 'black'; drawCross(p, 12, 3); }
      }
      if (state.submitted && state.target) {
        const p = project(state.target.star.v, b, radius, fovRad);
        if (p) {
          ctx.strokeStyle = 'black'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.stroke();
          drawCross(p, 8, 2);
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.stroke();
    }
    function move(dx, dy, multiplier = 1) {
      const b = ensureOrientation();
      const anglePerPx = (state.fov * Math.PI / 180) / Math.min(canvas.width, canvas.height) * multiplier;
      rotateBasis(b.up, -dx * anglePerPx);
      rotateBasis(ensureOrientation().right, -dy * anglePerPx);
      draw();
    }
    function moveButton(x, y) {
      const px = Math.min(canvas.width, canvas.height) * 0.05;
      move(x * px, y * px, 1);
      focusCanvas();
    }
    function rollFrame(direction) {
      const b = ensureOrientation();
      rotateBasis(b.f, direction * 10 * Math.PI / 180);
      draw();
      focusCanvas();
    }
    function newTarget() {
      const targets = skyAlphaTargets();
      if (!targets.length) return;
      state.target = rand(targets);
      state.selectedVec = null;
      state.submitted = false;
      state.result = '';
      state.fov = 140;
      randomOrientation();
      renderAlphaPin();
    }
    function submitGuess() {
      if (!state.target || !state.selectedVec || state.submitted) return;
      const angle = angularDeg(state.selectedVec, state.target.star.v);
      const score = angle >= 45 ? 0 : Math.max(0, Math.min(5000, Math.round(5000 * (1 - angle / 45))));
      state.submitted = true;
      recordPointScore('alphapin', score);
      state.result = `score: ${score}/5000 · angle from α: ${angle.toFixed(1)}°`;
      $('#alphaMsg').textContent = state.result;
      draw();
    }
    function zoomAlpha(delta) {
      if (state.selectedVec) state.orient = makeBasisFromForward(state.selectedVec);
      setFov(Math.max(20, Math.min(190, state.fov + delta)));
      focusCanvas();
    }

    function setAlphaMag(v) {
      state.magLimit = Math.max(4, Math.min(6, parseFloat(v) || 5.0));
      const value = Number(state.magLimit.toFixed(1));
      $('#alphaMag').value = value;
      $('#alphaMagSlider').value = value;
      updateRangeVisual($('#alphaMagSlider'));
      draw();
    }
    $('#alphaFov').addEventListener('input', e => setFov(parseFloat(e.target.value) || 140));
    $('#alphaFovSlider').addEventListener('input', e => setFov(parseFloat(e.target.value) || 140));
    $('#alphaMag').addEventListener('input', e => setAlphaMag(e.target.value));
    $('#alphaMagSlider').addEventListener('input', e => setAlphaMag(e.target.value));
    $('#alphaSubmit').addEventListener('click', submitGuess);
    $('#alphaZoomIn').addEventListener('click', () => zoomAlpha(-10));
    $('#alphaZoomOut').addEventListener('click', () => zoomAlpha(10));
    $('#alphaNew').addEventListener('click', newTarget);
    $('#alphaCentre').addEventListener('click', () => { state.orient = makeBasisFromForward(vecFromRaDec(0, 0)); setFov(140); focusCanvas(); });
    $('#alphaRollCCW').addEventListener('click', () => rollFrame(-1));
    $('#alphaRollCW').addEventListener('click', () => rollFrame(1));
    document.querySelectorAll('[data-amove]').forEach(btn => btn.addEventListener('click', () => {
      const [x, y] = btn.dataset.amove.split(',').map(Number);
      moveButton(x, y);
    }));

    const activePointers = new Map();
    let lastDrag = null, lastPinchDistance = null, totalDrag = 0;
    const pointerDistance = () => {
      const pts = [...activePointers.values()];
      if (pts.length < 2) return null;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    function finishPointer(e) {
      const lastPoint = activePointers.get(e.pointerId);
      activePointers.delete(e.pointerId);
      if (lastPoint && totalDrag < 6 && !state.submitted) {
        const rect = canvas.getBoundingClientRect();
        const v = vecAtCanvasPoint((lastPoint.x - rect.left) * canvas.width / rect.width, (lastPoint.y - rect.top) * canvas.height / rect.height);
        if (v) {
          state.selectedVec = v;
          state.result = 'point selected';
          $('#alphaMsg').textContent = state.result;
          draw();
        }
      }
      lastPinchDistance = activePointers.size >= 2 ? pointerDistance() : null;
      lastDrag = activePointers.size === 1 ? [...activePointers.values()][0] : null;
      totalDrag = 0;
    }
    canvas.addEventListener('pointerdown', e => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      focusCanvas();
      totalDrag = 0;
      if (activePointers.size === 1) lastDrag = { x: e.clientX, y: e.clientY };
      if (activePointers.size >= 2) lastPinchDistance = pointerDistance();
    });
    canvas.addEventListener('pointermove', e => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size >= 2) {
        const d = pointerDistance();
        if (d && lastPinchDistance) setFov(state.fov * lastPinchDistance / d);
        lastPinchDistance = d;
        return;
      }
      const p = activePointers.get(e.pointerId);
      if (!lastDrag) { lastDrag = p; return; }
      const dx = p.x - lastDrag.x, dy = p.y - lastDrag.y;
      totalDrag += Math.hypot(dx, dy);
      move(dx, dy, 0.9);
      lastDrag = p;
    });
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', e => { activePointers.delete(e.pointerId); lastDrag = null; totalDrag = 0; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { setFov(state.fov * Math.exp(e.deltaY * 0.002)); return; }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.height : 1;
      const dx = (e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit;
      const dy = (e.shiftKey ? 0 : e.deltaY) * unit;
      move(dx, dy, 0.45);
    }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const step = e.shiftKey ? 28 : 12;
      if (['ArrowLeft','a','A'].includes(e.key)) { e.preventDefault(); move(-step, 0); }
      if (['ArrowRight','d','D'].includes(e.key)) { e.preventDefault(); move(step, 0); }
      if (['ArrowUp','w','W'].includes(e.key)) { e.preventDefault(); move(0, -step); }
      if (['ArrowDown','s','S'].includes(e.key)) { e.preventDefault(); move(0, step); }
      if (e.key === 'Enter') { e.preventDefault(); submitGuess(); }
    });
    if (!state.loaded && !state.loading) {
      state.loading = true;
      loadSkyData().then(() => { state.loaded = true; state.loading = false; skyAlphaCache = null; ensureTarget(); renderAlphaPin(); }).catch(err => { state.error = 'sky data unavailable'; state.loading = false; draw(); });
    }
    ensureTarget(); draw(); setTimeout(() => canvas.focus(), 0);
  }

  function renderSkyRegions() {
    const state = states.skyregions || (states.skyregions = { loaded: false, loading: false, error: '', fov: 140, message: '', selected: '', showBoundaries: true, showStars: true, magLimit: 5.0, orient: null });
    app.innerHTML = `<h2>Sky Map</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="regionCanvas" width="900" height="900" tabindex="0" aria-label="constellation region sphere"></canvas></section><aside class="panel"><label>FOV degrees<div class="slider-text-row"><input id="regionFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="regionFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label class="checkline"><input id="regionBounds" type="checkbox" ${state.showBoundaries !== false ? "checked" : ""}><span>boundaries</span></label><label class="checkline"><input id="regionStars" type="checkbox" ${state.showStars !== false ? "checked" : ""}><span>stars</span></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="regionMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="regionMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><label>Search constellation<input id="regionSearch" list="regionSearchList" autocomplete="off" placeholder="full constellation name"></label><datalist id="regionSearchList">${DATA.constellations.map(c => `<option value="${esc(c.name)}"></option>`).join('')}</datalist><div class="controls"><button type="button" id="regionSearchBtn">search</button></div><div class="sky-nav-grid" aria-label="region movement controls"><button type="button" data-rmove="-1,-1">↖</button><button type="button" data-rmove="0,-1">↑</button><button type="button" data-rmove="1,-1">↗</button><button type="button" data-rmove="-1,0">←</button><button type="button" id="regionReset">○</button><button type="button" data-rmove="1,0">→</button><button type="button" data-rmove="-1,1">↙</button><button type="button" data-rmove="0,1">↓</button><button type="button" data-rmove="1,1">↘</button></div><div class="controls"><button type="button" id="regionRollCCW">↺ rotate</button><button type="button" id="regionRollCW">rotate ↻</button><button type="button" id="regionClear">deselect</button></div><div id="regionMsg" class="message">${state.message || ''} </div></aside></div>`;
    initRangeVisuals(app);
    const canvas = $('#regionCanvas'), ctx = canvas.getContext('2d');
    function focusCanvas() { try { canvas.focus({ preventScroll: true }); } catch { focusCanvas(); } }
    const fovInput = $('#regionFov');
    const fovSlider = $('#regionFovSlider');
    const boundsInput = $('#regionBounds');

    function makeBasisFromForward(forward) {
      const f = normVec(forward);
      const ref = Math.abs(f.z) > 0.96 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
      let right = normVec(cross(f, ref));
      if (!Number.isFinite(right.x)) right = { x: 1, y: 0, z: 0 };
      let up = normVec(cross(right, f));
      right = normVec(cross(f, up));
      return { f, right, up };
    }
    function cleanBasis(b) {
      const f = normVec(b.f);
      let right = b.right;
      const proj = dot(right, f);
      right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
      if (!Number.isFinite(right.x)) return makeBasisFromForward(f);
      const up = normVec(cross(right, f));
      return { f, right: normVec(cross(f, up)), up };
    }
    function ensureOrientation() {
      if (!state.orient) state.orient = makeBasisFromForward(vecFromRaDec(0, 0));
      state.orient = cleanBasis(state.orient);
      return state.orient;
    }
    function rotateAround(v, axis, angle) {
      const c = Math.cos(angle), s = Math.sin(angle), d = dot(axis, v), cr = cross(axis, v);
      return normVec({
        x: v.x * c + cr.x * s + axis.x * d * (1 - c),
        y: v.y * c + cr.y * s + axis.y * d * (1 - c),
        z: v.z * c + cr.z * s + axis.z * d * (1 - c)
      });
    }
    function rotateBasis(axis, angle) {
      const b = ensureOrientation();
      state.orient = cleanBasis({
        f: rotateAround(b.f, axis, angle),
        right: rotateAround(b.right, axis, angle),
        up: rotateAround(b.up, axis, angle)
      });
    }
    function clampFov(v) { return Math.max(20, Math.min(190, v)); }
    function setFov(v) {
      state.fov = clampFov(v);
      const value = Number(state.fov.toFixed(1));
      if (fovInput) fovInput.value = value;
      if (fovSlider) { fovSlider.value = value; updateRangeVisual(fovSlider); }
      draw();
    }
    function project(v, b, radius, fovRad) {
      const z = dot(v, b.f);
      const ang = Math.acos(Math.max(-1, Math.min(1, z)));
      if (ang > fovRad / 2) return null;
      const x = dot(v, b.right), y = dot(v, b.up);
      const sin = Math.sin(ang) || 1e-9;
      const rr = (ang / (fovRad / 2)) * radius;
      return { x: canvas.width / 2 + rr * x / sin, y: canvas.height / 2 - rr * y / sin, z };
    }
    function centres() {
      return [...skyConstCentres.entries()].map(([name, v]) => ({ name, v }));
    }
    function nearestRegion(v, list = centres()) {
      let best = null, bestDot = -Infinity;
      for (const c of list) {
        const d = dot(v, c.v);
        if (d > bestDot) { bestDot = d; best = c.name; }
      }
      return best || '';
    }

    function pad2(n) { return String(Math.floor(Math.abs(n))).padStart(2, '0'); }
    function formatRA(raDeg) {
      const total = (((raDeg / 15) % 24) + 24) % 24;
      const h = Math.floor(total);
      const m = Math.floor((total - h) * 60);
      return `${pad2(h)}h ${pad2(m)}m`;
    }
    function formatDec(decDeg) {
      const sign = decDeg < 0 ? '−' : '+';
      const a = Math.abs(decDeg);
      const d = Math.floor(a);
      const m = Math.floor((a - d) * 60);
      return `${sign}${pad2(d)}° ${pad2(m)}′`;
    }
    function regionMessage(name, clickedVec) {
      const clicked = raDecFromVec(clickedVec);
      const centreVec = skyConstCentres.get(name);
      const centre = centreVec ? raDecFromVec(centreVec) : null;
      const centreText = centre ? `<br>region centre: RA ${formatRA(centre.ra)}, Dec ${formatDec(centre.dec)}` : '';
      return `<strong>${esc(name)}</strong><br>clicked point: RA ${formatRA(clicked.ra)}, Dec ${formatDec(clicked.dec)}${centreText}`;
    }
    function findConstellationByInput(value) {
      const q = compact(value);
      if (!q) return null;
      const c = DATA.constellations.find(x => compact(x.name) === q);
      return c ? c.name : null;
    }
    function runRegionSearch() {
      const input = $('#regionSearch');
      const name = findConstellationByInput(input.value);
      if (name) {
        centreRegionByName(name);
      } else {
        state.message = 'enter a full constellation name';
        $('#regionMsg').textContent = state.message;
      }
    }
    function centreRegionByName(name) {
      const v = skyConstCentres.get(name);
      if (!v) return false;
      state.orient = makeBasisFromForward(v);
      state.selected = name;
      state.message = regionMessage(name, v);
      $('#regionMsg').innerHTML = state.message;
      setFov(140);
      focusCanvas();
      return true;
    }
    function vecAtCanvasPoint(x, y) {
      const b = ensureOrientation();
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const sx = x - cx, sy = y - cy;
      const rho = Math.hypot(sx, sy) / radius;
      if (rho > 1) return null;
      const ang = rho * (state.fov * Math.PI / 180) / 2;
      if (rho < 1e-9) return b.f;
      const ux = sx / (rho * radius), uy = -sy / (rho * radius);
      return normVec({
        x: b.f.x * Math.cos(ang) + (b.right.x * ux + b.up.x * uy) * Math.sin(ang),
        y: b.f.y * Math.cos(ang) + (b.right.y * ux + b.up.y * uy) * Math.sin(ang),
        z: b.f.z * Math.cos(ang) + (b.right.z * ux + b.up.z * uy) * Math.sin(ang)
      });
    }
    function shadeFor(name) {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
      return 238 + Math.abs(h % 14);
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      if (!state.loaded) {
        ctx.fillStyle = 'black'; ctx.font = '20px Arial'; ctx.fillText(state.error || 'loading sky...', 24, 40); return;
      }
      const list = centres();
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const cx = canvas.width / 2, cy = canvas.height / 2;
      const cell = 7;
      const gw = Math.ceil(canvas.width / cell), gh = Math.ceil(canvas.height / cell);
      const names = Array.from({ length: gh }, () => Array(gw).fill(''));
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          const x = gx * cell + cell / 2, y = gy * cell + cell / 2;
          const v = vecAtCanvasPoint(x, y);
          if (!v) continue;
          const name = officialConstellationAtVec(v) || nearestRegion(v, list);
          names[gy][gx] = name;
          const shade = name === state.selected ? 218 : shadeFor(name);
          ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
          ctx.fillRect(gx * cell, gy * cell, cell + 0.5, cell + 0.5);
        }
      }
      if (state.showBoundaries !== false) {
        ctx.fillStyle = '#555';
        for (let gy = 0; gy < gh; gy++) {
          for (let gx = 0; gx < gw; gx++) {
            const name = names[gy][gx];
            if (!name) continue;
            const right = gx + 1 < gw ? names[gy][gx + 1] : name;
            const down = gy + 1 < gh ? names[gy + 1][gx] : name;
            if (right && right !== name) ctx.fillRect((gx + 1) * cell - 1, gy * cell, 1.2, cell);
            if (down && down !== name) ctx.fillRect(gx * cell, (gy + 1) * cell - 1, cell, 1.2);
          }
        }
      }
      if (state.showStars !== false) {
        const b = ensureOrientation();
        const fovRad = state.fov * Math.PI / 180;
        const visible = skyStars.filter(s => s.mag <= state.magLimit).sort((a, b) => b.mag - a.mag);
        ctx.fillStyle = 'black';
        for (const s of visible) {
          const p = project(s.v, b, radius, fovRad);
          if (!p) continue;
          const r = Math.max(0.75, Math.min(4.3, 3.9 - s.mag * 0.5));
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
      ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    }
    function move(dx, dy, multiplier = 1) {
      const b = ensureOrientation();
      const anglePerPx = (state.fov * Math.PI / 180) / Math.min(canvas.width, canvas.height) * multiplier;
      rotateBasis(b.up, -dx * anglePerPx);
      rotateBasis(ensureOrientation().right, -dy * anglePerPx);
      draw();
    }
    function moveButton(x, y) {
      const px = Math.min(canvas.width, canvas.height) * 0.05;
      move(x * px, y * px, 1);
      focusCanvas();
    }
    function rollFrame(direction) {
      const b = ensureOrientation();
      rotateBasis(b.f, direction * 10 * Math.PI / 180);
      draw();
      focusCanvas();
    }

    function setRegionMag(v) {
      state.magLimit = Math.max(4, Math.min(6, parseFloat(v) || 5.0));
      const value = Number(state.magLimit.toFixed(1));
      $('#regionMag').value = value;
      $('#regionMagSlider').value = value;
      updateRangeVisual($('#regionMagSlider'));
      draw();
    }
    fovInput.addEventListener('input', e => setFov(parseFloat(e.target.value) || 140));
    fovSlider.addEventListener('input', e => setFov(parseFloat(e.target.value) || 140));
    boundsInput.addEventListener('change', e => { state.showBoundaries = e.target.checked; draw(); });
    $('#regionStars').addEventListener('change', e => { state.showStars = e.target.checked; draw(); });
    $('#regionMag').addEventListener('input', e => setRegionMag(e.target.value));
    $('#regionMagSlider').addEventListener('input', e => setRegionMag(e.target.value));
    $('#regionSearchBtn').addEventListener('click', runRegionSearch);
    $('#regionSearch').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runRegionSearch(); } });
    $('#regionReset').addEventListener('click', () => { state.orient = makeBasisFromForward(vecFromRaDec(0, 0)); setFov(140); focusCanvas(); });
    $('#regionRollCCW').addEventListener('click', () => rollFrame(-1));
    $('#regionRollCW').addEventListener('click', () => rollFrame(1));
    $('#regionClear').addEventListener('click', () => { state.selected = ''; state.message = ''; $('#regionMsg').innerHTML = ''; draw(); focusCanvas(); });
    document.querySelectorAll('[data-rmove]').forEach(btn => btn.addEventListener('click', () => {
      const [x, y] = btn.dataset.rmove.split(',').map(Number);
      moveButton(x, y);
    }));

    const activePointers = new Map();
    let lastDrag = null, lastPinchDistance = null, totalDrag = 0;
    const pointerDistance = () => {
      const pts = [...activePointers.values()];
      if (pts.length < 2) return null;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    function finishPointer(e) {
      const lastPoint = activePointers.get(e.pointerId);
      activePointers.delete(e.pointerId);
      if (lastPoint && totalDrag < 6) {
        const rect = canvas.getBoundingClientRect();
        const v = vecAtCanvasPoint((lastPoint.x - rect.left) * canvas.width / rect.width, (lastPoint.y - rect.top) * canvas.height / rect.height);
        if (v) {
          const official = officialConstellationAtVec(v);
          state.selected = official || nearestRegion(v);
          state.message = regionMessage(state.selected, v);
          $('#regionMsg').innerHTML = state.message;
          draw();
        }
      }
      lastPinchDistance = activePointers.size >= 2 ? pointerDistance() : null;
      lastDrag = activePointers.size === 1 ? [...activePointers.values()][0] : null;
      totalDrag = 0;
    }
    canvas.addEventListener('pointerdown', e => {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
      focusCanvas();
      totalDrag = 0;
      if (activePointers.size === 1) lastDrag = { x: e.clientX, y: e.clientY };
      if (activePointers.size >= 2) lastPinchDistance = pointerDistance();
    });
    canvas.addEventListener('pointermove', e => {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointers.size >= 2) {
        const d = pointerDistance();
        if (d && lastPinchDistance) setFov(state.fov * lastPinchDistance / d);
        lastPinchDistance = d;
        return;
      }
      const p = activePointers.get(e.pointerId);
      if (!lastDrag) { lastDrag = p; return; }
      const dx = p.x - lastDrag.x, dy = p.y - lastDrag.y;
      totalDrag += Math.hypot(dx, dy);
      move(dx, dy, 0.9);
      lastDrag = p;
    });
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', e => { activePointers.delete(e.pointerId); lastDrag = null; totalDrag = 0; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { setFov(state.fov * Math.exp(e.deltaY * 0.002)); return; }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.height : 1;
      const dx = (e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit;
      const dy = (e.shiftKey ? 0 : e.deltaY) * unit;
      move(dx, dy, 0.45);
    }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const step = e.shiftKey ? 28 : 12;
      if (['ArrowLeft','a','A'].includes(e.key)) { e.preventDefault(); move(-step, 0); }
      if (['ArrowRight','d','D'].includes(e.key)) { e.preventDefault(); move(step, 0); }
      if (['ArrowUp','w','W'].includes(e.key)) { e.preventDefault(); move(0, -step); }
      if (['ArrowDown','s','S'].includes(e.key)) { e.preventDefault(); move(0, step); }
    });
    if (!state.loaded && !state.loading) {
      state.loading = true;
      Promise.all([loadSkyData(), loadConstellationBounds().catch(() => [])]).then(() => { state.loaded = true; state.loading = false; draw(); focusCanvas(); }).catch(err => { state.error = 'sky data unavailable'; state.loading = false; draw(); });
    }
    draw(); setTimeout(() => canvas.focus(), 0);
  }


  const SERPENS_CAPUT = 'Serpens Caput';
  const SERPENS_CAUDA = 'Serpens Cauda';
  const SERPENS_CAPUT_BORDERS = new Set(['Boötes', 'Corona Borealis', 'Hercules', 'Libra', 'Ophiuchus', 'Virgo']);
  const SERPENS_CAUDA_BORDERS = new Set(['Aquila', 'Ophiuchus', 'Sagittarius', 'Scutum']);

  function skyRaceBaseName(name) {
    return name === SERPENS_CAPUT || name === SERPENS_CAUDA ? 'Serpens' : name;
  }

  function skyRaceGraph() {
    const names = new Set(DATA.constellations.map(c => c.name).filter(name => name !== 'Serpens'));
    names.add(SERPENS_CAPUT);
    names.add(SERPENS_CAUDA);

    const graph = new Map([...names].map(name => [name, new Set()]));
    const addEdge = (a, b) => {
      if (!graph.has(a) || !graph.has(b) || a === b) return;
      graph.get(a).add(b);
      graph.get(b).add(a);
    };

    DATA.constellations.forEach(c => {
      if (c.name === 'Serpens') return;
      const info = DATA.constellationInfo[c.name] || {};
      (info.neighbours || []).forEach(n => {
        if (n === 'Serpens') {
          if (SERPENS_CAPUT_BORDERS.has(c.name)) addEdge(c.name, SERPENS_CAPUT);
          if (SERPENS_CAUDA_BORDERS.has(c.name)) addEdge(c.name, SERPENS_CAUDA);
          return;
        }
        if (!names.has(n) || n === c.name) return;
        addEdge(c.name, n);
      });
    });

    SERPENS_CAPUT_BORDERS.forEach(n => addEdge(SERPENS_CAPUT, n));
    SERPENS_CAUDA_BORDERS.forEach(n => addEdge(SERPENS_CAUDA, n));
    return graph;
  }
  const SKY_RACE_GRAPH = skyRaceGraph();

  function skyRacePath(start, target) {
    if (start === target) return [start];
    const queue = [[start]];
    const seen = new Set([start]);
    while (queue.length) {
      const path = queue.shift();
      const here = path[path.length - 1];
      for (const next of (SKY_RACE_GRAPH.get(here) || [])) {
        if (seen.has(next)) continue;
        const newer = [...path, next];
        if (next === target) return newer;
        seen.add(next);
        queue.push(newer);
      }
    }
    return null;
  }

  function skyRacePair() {
    const names = [...SKY_RACE_GRAPH.entries()].filter(([, ns]) => ns.size).map(([name]) => name);
    let fallback = null;
    for (let i = 0; i < 1000; i++) {
      const start = rand(names), target = rand(names);
      if (start === target) continue;
      const path = skyRacePath(start, target);
      if (!path) continue;
      const clicks = path.length - 1;
      if (clicks < 3) continue; // keep every round at least 3 optimal clicks.
      if (!fallback || clicks < fallback.path.length - 1) fallback = { start, target, path };
      if (clicks <= 7) return { start, target, path };
    }
    if (fallback) return fallback;
    const start = names[0];
    const target = names.find(n => n !== start && !(SKY_RACE_GRAPH.get(start) || new Set()).has(n)) || names[1];
    return { start, target, path: skyRacePath(start, target) || [start, target] };
  }

  function renderSkyRace() {
    const state = states.skyrace || (states.skyrace = { start: '', target: '', current: '', route: [], optimalPath: [], done: false, message: '' });
    function newRace() {
      const pair = skyRacePair();
      state.start = pair.start;
      state.target = pair.target;
      state.current = pair.start;
      state.route = [pair.start];
      state.optimalPath = pair.path;
      state.done = false;
      state.message = '';
      draw();
    }
    function borderingConstellations(name) {
      return [...(SKY_RACE_GRAPH.get(name) || [])].sort((a, b) => a.localeCompare(b));
    }
    function currentChart() {
      const baseName = skyRaceBaseName(state.current);
      const chart = chartByName.get(baseName);
      if (!chart) return `<p>No chart available for ${esc(state.current)}.</p>`;
      return chartImg(chart, true, 'chart-img sky-race-chart', `${state.current} labelled chart`);
    }
    function jump(next) {
      if (state.done || !borderingConstellations(state.current).includes(next)) return;
      state.current = next;
      state.route.push(next);
      if (next === state.target) {
        state.done = true;
        const actual = state.route.length - 1;
        const optimal = Math.max(1, state.optimalPath.length - 1);
        const score = Math.max(0, Math.min(100, 100 - 20 * Math.max(0, actual - optimal)));
        recordPointScore('skyrace', score);
        state.message = `done: ${actual} clicks · optimal: ${optimal} clicks · score: ${score}/100<br>optimal path: ${state.optimalPath.map(esc).join(' → ')}`;
      }
      draw();
    }
    function draw() {
      if (!state.current) { newRace(); return; }
      const ns = borderingConstellations(state.current);
      const routeText = state.route.map(esc).join(' → ');
      const splitNote = state.current === SERPENS_CAPUT || state.current === SERPENS_CAUDA ? '<p class="small">Serpens is treated as Caput and Cauda for border jumps.</p>' : '';
      app.innerHTML = `<h2>SkyRace</h2><div class="sky-race-layout"><aside class="panel"><p class="sky-race-task"><strong>${esc(state.start)} → ${esc(state.target)}</strong></p><p><strong>current:</strong> ${esc(state.current)}</p><p><strong>clicks:</strong> ${Math.max(0, state.route.length - 1)}</p>${splitNote}<h3>Bordering constellations</h3><div id="skyRaceBorders" class="sky-race-neighbours">${ns.map(n => `<button type="button" class="linkbtn" data-race-border="${esc(n)}">${esc(n)}</button>`).join(' ')}</div><div class="message">${state.message || ''}</div><div class="controls new-round-controls"><button type="button" id="skyRaceNew" class="new-round-button">new race</button></div><h3>Route</h3><p class="small">${routeText}</p><div class="stats">${formatPointScore('skyrace')}</div></aside><section class="panel"><h3>${esc(state.current)}</h3>${currentChart()}</section></div>`;
      $('#skyRaceNew').addEventListener('click', newRace);
      document.querySelectorAll('[data-race-border]').forEach(btn => btn.addEventListener('click', () => jump(btn.dataset.raceBorder)));
    }
    draw();
  }

  function renderTables() {
    const state = states.tables || (states.tables = { mode: 'constellations', sort: {} });
    if (!state.sort) state.sort = {};
    const tableModes = [
      { id: 'constellations', label: 'constellations' },
      { id: 'stars', label: 'stars' },
      { id: 'dso', label: 'DSOs' },
      { id: 'asterisms', label: 'asterisms' }
    ];
    app.innerHTML = `<h2>Tables</h2><div class="table-tabs">${tableModes.map(m => `<button type="button" class="${m.id === state.mode ? 'active' : ''}" data-table-mode="${m.id}">${m.label}</button>`).join('')}</div><input id="tableSearch" placeholder="search"><div id="tableWrap" class="table-wrap"></div>`;
    const search = $('#tableSearch'), wrap = $('#tableWrap');

    function naturalCompare(a, b) {
      return String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
    }
    function dsoCodeParts(value) {
      const m = String(value || '').match(/^([A-Za-z]+)\s*0*(\d+)?(.*)$/);
      if (!m) return { prefix: String(value || ''), number: Infinity, rest: '' };
      return { prefix: m[1].toUpperCase(), number: m[2] ? parseInt(m[2], 10) : Infinity, rest: m[3] || '' };
    }
    function dsoCodeCompare(a, b) {
      const x = dsoCodeParts(a), y = dsoCodeParts(b);
      return naturalCompare(x.prefix, y.prefix) || (x.number - y.number) || naturalCompare(x.rest, y.rest);
    }
    function compareValues(a, b, kind) {
      if (kind === 'dsoCode') return dsoCodeCompare(a, b);
      return naturalCompare(a, b);
    }

    function table(columns, rows) {
      const q = norm(search.value);
      let filtered = rows.filter(r => !q || norm(r.join(' ')).includes(q));
      const sort = state.sort[state.mode];
      if (sort && columns[sort.index] && columns[sort.index].sortable) {
        const col = columns[sort.index];
        const dir = sort.dir === 'desc' ? -1 : 1;
        filtered = filtered.slice().sort((a, b) => dir * compareValues(a[sort.index], b[sort.index], col.sortType));
      }
      wrap.innerHTML = `<table><thead><tr>${columns.map((col, i) => {
        if (!col.sortable) return `<th>${esc(col.label)}</th>`;
        const active = sort && sort.index === i;
        const mark = active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '';
        return `<th><button type="button" class="table-sort ${active ? 'active' : ''}" data-sort-index="${i}">${esc(col.label)}${mark}</button></th>`;
      }).join('')}</tr></thead><tbody>${filtered.map(r => `<tr>${r.map(x => `<td>${esc(x || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      document.querySelectorAll('[data-sort-index]').forEach(btn => btn.addEventListener('click', () => {
        const index = Number(btn.dataset.sortIndex);
        const current = state.sort[state.mode];
        state.sort[state.mode] = current && current.index === index && current.dir === 'asc' ? { index, dir: 'desc' } : { index, dir: 'asc' };
        redraw();
      }));
    }

    function redraw() {
      document.querySelectorAll('[data-table-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.tableMode === state.mode));
      if (state.mode === 'stars') {
        table([
          { label: 'star', sortable: true },
          { label: 'designation', sortable: true },
          { label: 'constellation', sortable: true },
          { label: 'note', sortable: false }
        ], DATA.stars.map(s => [s.name, s.designation, s.constellation, s.note]));
      } else if (state.mode === 'dso') {
        table([
          { label: 'code', sortable: true, sortType: 'dsoCode' },
          { label: 'common name', sortable: true },
          { label: 'type', sortable: true },
          { label: 'constellation', sortable: true }
        ], DATA.dso.map(o => [o.code, o.commonName, o.type, o.constellation]));
      } else if (state.mode === 'asterisms') {
        table([
          { label: 'asterism', sortable: true },
          { label: 'constellations', sortable: false },
          { label: 'member stars', sortable: false },
          { label: 'description', sortable: false }
        ], DATA.asterisms.map(a => [a.name, a.constellations.join(', '), (a.members || []).join(', '), a.clue]));
      } else {
        table([
          { label: 'constellation', sortable: true },
          { label: 'meaning', sortable: false },
          { label: 'asterisms', sortable: false }
        ], DATA.constellations.map(c => [c.name, DATA.constellationInfo[c.name].meaning, DATA.constellationInfo[c.name].asterisms.join(', ')]));
      }
    }

    document.querySelectorAll('[data-table-mode]').forEach(btn => btn.addEventListener('click', () => {
      state.mode = btn.dataset.tableMode;
      redraw();
    }));
    search.addEventListener('input', redraw);
    redraw();
    search.focus();
  }

  function render() {
    if (activeGame === 'charts') makeQuestionGame('charts', 'Charts', { make: chartQuestion });
    else if (activeGame === 'skyguessr') renderSkyGuessr();
    else if (activeGame === 'skyregions') renderSkyRegions();
    else if (activeGame === 'skyrace') renderSkyRace();
    else if (activeGame === 'alphapin') renderAlphaPin();
    else if (activeGame === 'neighbours') makeQuestionGame('neighbours', 'Neighbours', { make: neighbourQuestion });
    else if (activeGame === 'stars') makeQuestionGame('stars', 'Stars', { modes: starModes, defaultMode: 'starToConstellation', make: starQuestion });
    else if (activeGame === 'dso') makeQuestionGame('dso', 'DSOs', { modes: dsoModes, defaultMode: 'codeToName', make: dsoQuestion });
    else if (activeGame === 'timer') renderTimer();
    else if (activeGame === 'atlas') renderAtlas();
    else if (activeGame === 'tables') renderTables();
  }
  setupTabs(); render();
})();
