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
  const SAVE_SLOTS = ['1', '2', '3'];
  const LEGACY_PROGRESS_KEY = 'iloveastroProgress';
  const ACTIVE_SAVE_KEY = 'iloveastroActiveSave';
  const saveSlotKey = slot => `iloveastroProgress.save${slot}`;
  let activeSave = SAVE_SLOTS.includes(localStorage.getItem(ACTIVE_SAVE_KEY)) ? localStorage.getItem(ACTIVE_SAVE_KEY) : '1';

  function loadProgress(slot = activeSave) {
    const key = saveSlotKey(slot);
    if (slot === '1' && !localStorage.getItem(key) && localStorage.getItem(LEGACY_PROGRESS_KEY)) {
      localStorage.setItem(key, localStorage.getItem(LEGACY_PROGRESS_KEY));
    }
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch {
      return {};
    }
  }
  let progress = loadProgress(activeSave);
  function saveProgress() { localStorage.setItem(saveSlotKey(activeSave), JSON.stringify(progress)); }
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

  const DEFAULT_SETTINGS_KEY = 'iloveastroDefaultSkySettings';
  function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }
  function loadDefaultSkySettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(DEFAULT_SETTINGS_KEY) || '{}') || {};
      return {
        fov: clampNumber(saved.fov, 20, 190, 140),
        mag: clampNumber(saved.mag, 4, 6, 5.0)
      };
    } catch {
      return { fov: 140, mag: 5.0 };
    }
  }
  const defaultSkySettings = loadDefaultSkySettings();
  function defaultFov() { return clampNumber(defaultSkySettings.fov, 20, 190, 140); }
  function defaultMag() { return clampNumber(defaultSkySettings.mag, 4, 6, 5.0); }
  function saveDefaultSkySettings() {
    localStorage.setItem(DEFAULT_SETTINGS_KEY, JSON.stringify({ fov: defaultFov(), mag: defaultMag() }));
  }

  const games = [
    { id: 'charts', title: 'Charts' },
    { id: 'skyguessr', title: 'SkyGuessr' },
    { id: 'skyrace', title: 'SkyRace' },
    { id: 'skymap', title: 'Sky Map' },
    { id: 'skyregions', title: 'Constellation Map' },
    { id: 'alphapin', title: 'Find Constellation' },
    { id: 'guessconst', title: 'Guess Constellation' },
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
  let sphereFullscreenActive = false;
  let activeShiftEnterHandler = null;
  function setShiftEnterAction(action) {
    if (activeShiftEnterHandler) document.removeEventListener('keydown', activeShiftEnterHandler);
    activeShiftEnterHandler = null;
    if (!action) return;
    activeShiftEnterHandler = e => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        action();
      }
    };
    document.addEventListener('keydown', activeShiftEnterHandler);
  }

  function setupTabs() {
    tabs.innerHTML = '';
    games.forEach(g => tabs.append(el('button', { type: 'button', class: g.id === activeGame ? 'active' : '', onclick: () => switchGame(g.id) }, [document.createTextNode(g.title)])));
  }
  function switchGame(id) { activeGame = id; setupTabs(); render(); }

  function setupSaveMenu() {
    const button = $('#saveMenuButton');
    const menu = $('#saveMenu');
    if (!button || !menu) return;
    menu.querySelectorAll('[data-save-slot]').forEach(slotButton => {
      const selected = slotButton.dataset.saveSlot === activeSave;
      slotButton.classList.toggle('active', selected);
      slotButton.textContent = `save ${slotButton.dataset.saveSlot}${selected ? ' ✓' : ''}`;
    });
  }
  function closeSaveMenu() {
    const button = $('#saveMenuButton');
    const menu = $('#saveMenu');
    if (!button || !menu) return;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  function switchSave(slot) {
    if (!SAVE_SLOTS.includes(slot) || slot === activeSave) return;
    saveProgress();
    activeSave = slot;
    localStorage.setItem(ACTIVE_SAVE_KEY, activeSave);
    progress = loadProgress(activeSave);
    closeSaveMenu();
    setupSaveMenu();
    render();
  }
  function clearCurrentSave() {
    if (!confirm(`Clear scores in save ${activeSave}?`)) return;
    progress = {};
    saveProgress();
    closeSaveMenu();
    setupSaveMenu();
    render();
  }
  function clearAllSaves() {
    if (!confirm('Clear all three saves?')) return;
    SAVE_SLOTS.forEach(slot => localStorage.removeItem(saveSlotKey(slot)));
    localStorage.removeItem(LEGACY_PROGRESS_KEY);
    progress = {};
    saveProgress();
    closeSaveMenu();
    setupSaveMenu();
    render();
  }

  const saveMenuButton = $('#saveMenuButton');
  const saveMenu = $('#saveMenu');
  if (saveMenuButton && saveMenu) {
    saveMenuButton.addEventListener('click', () => {
      const open = saveMenu.hidden;
      saveMenu.hidden = !open;
      saveMenuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    saveMenu.querySelectorAll('[data-save-slot]').forEach(btn => btn.addEventListener('click', () => switchSave(btn.dataset.saveSlot)));

    const fovSlider = $('#defaultFovSlider');
    const fovInput = $('#defaultFovInput');
    const magSlider = $('#defaultMagSlider');
    const magInput = $('#defaultMagInput');
    function syncDefaultControls() {
      if (fovSlider) { fovSlider.value = defaultFov(); updateRangeVisual(fovSlider); }
      if (fovInput) fovInput.value = defaultFov();
      if (magSlider) { magSlider.value = defaultMag().toFixed(1); updateRangeVisual(magSlider); }
      if (magInput) magInput.value = defaultMag().toFixed(1);
    }
    function setDefaultFov(value) {
      defaultSkySettings.fov = Math.round(clampNumber(value, 20, 190, 140) / 5) * 5;
      saveDefaultSkySettings();
      syncDefaultControls();
    }
    function setDefaultMag(value) {
      defaultSkySettings.mag = Math.round(clampNumber(value, 4, 6, 5.0) * 10) / 10;
      saveDefaultSkySettings();
      syncDefaultControls();
    }
    if (fovSlider) fovSlider.addEventListener('input', e => setDefaultFov(e.target.value));
    if (fovInput) fovInput.addEventListener('input', e => setDefaultFov(e.target.value));
    if (magSlider) magSlider.addEventListener('input', e => setDefaultMag(e.target.value));
    if (magInput) magInput.addEventListener('input', e => setDefaultMag(e.target.value));
    syncDefaultControls();

    $('#resetProgress').addEventListener('click', clearCurrentSave);
    $('#clearAllSaves').addEventListener('click', clearAllSaves);
    document.addEventListener('click', e => {
      if (!saveMenu.hidden && !e.target.closest('.save-menu')) closeSaveMenu();
    });
    setupSaveMenu();
  }

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
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          newQuestion();
        } else if (e.key === 'Enter') e.preventDefault();
      });
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
    setShiftEnterAction(newQuestion);
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

  let timerState = states.timer || (states.timer = { running: false, seconds: 0, interval: null, found: new Set(), next: () => {}, hintName: null, hintLength: 0 });
  if (!timerState.found) timerState.found = new Set();
  if (!('hintName' in timerState)) timerState.hintName = null;
  if (!('hintLength' in timerState)) timerState.hintLength = 0;
  function timerTimeText(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }
  function timerBestText() {
    const p = scoreKey('timer');
    return p.bestTime ? timerTimeText(p.bestTime) : '—';
  }
  function timerMissingNames() {
    return DATA.constellations.map(c => c.name).filter(name => !timerState.found.has(name));
  }
  function focusTimerInput() {
    const input = $('#timerInput');
    if (!input) return;
    try { input.focus({ preventScroll: true }); } catch { input.focus(); }
  }
  function timerAutoStart(raw) {
    if (timerState.running || timerState.found.size || !norm(raw)) return;
    clearInterval(timerState.interval);
    timerState.running = true;
    timerState.seconds = 0;
    timerState.interval = setInterval(timerTick, 1000);
  }
  function timerHint() {
    const input = $('#timerInput');
    if (!input) return;
    const missing = timerMissingNames();
    if (!missing.length) return;
    if (!timerState.hintName || timerState.found.has(timerState.hintName)) {
      timerState.hintName = rand(missing);
      timerState.hintLength = 0;
    }
    timerState.hintLength = Math.min(timerState.hintName.length, (timerState.hintLength || 0) + 1);
    input.value = timerState.hintName.slice(0, timerState.hintLength);
    focusTimerInput();
  }
  function timerGiveUp() {
    clearInterval(timerState.interval);
    timerState.running = false;
    timerState.hintName = null;
    timerState.hintLength = 0;
    const missing = timerMissingNames();
    const msg = $('#timerMsg');
    const list = $('#missingList');
    if (msg) msg.textContent = missing.length ? `missing: ${missing.length}` : 'complete';
    if (list) list.innerHTML = missing.length ? `<h3>missing</h3>${missing.map(n => `<span class="pill">${esc(n)}</span>`).join('')}` : '';
    focusTimerInput();
  }
  function timerClear() {
    clearInterval(timerState.interval);
    timerState.running = false;
    timerState.seconds = 0;
    timerState.found = new Set();
    timerState.hintName = null;
    timerState.hintLength = 0;
    const input = $('#timerInput');
    const clock = $('#timerClock');
    const progress = $('#timerProgress');
    const foundList = $('#foundList');
    const missingList = $('#missingList');
    const msg = $('#timerMsg');
    if (input) input.value = '';
    if (clock) clock.textContent = timerTimeText(0);
    if (progress) progress.textContent = '0/88';
    if (foundList) foundList.innerHTML = '';
    if (missingList) missingList.innerHTML = '';
    if (msg) msg.textContent = '';
    focusTimerInput();
  }
  function renderTimer() {
    app.innerHTML = '';
    const timeText = timerTimeText(timerState.seconds);
    const found = [...timerState.found].sort();
    const input = el('input', { id: 'timerInput', autocomplete: 'off', placeholder: 'type constellation names' });
    input.addEventListener('input', () => {
      timerAutoStart(input.value);
      timerCheck(input);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        timerAutoStart(input.value);
        timerCheck(input);
      }
    });
    const keepFocus = e => e.preventDefault();
    app.append(el('section', { class: 'panel' }, [
      el('h2', {}, [document.createTextNode('88 Timer')]),
      el('p', { html: `<strong id="timerClock">${timeText}</strong> <span id="timerProgress">${found.length}/88</span> · best: <strong id="timerBest">${timerBestText()}</strong>` }),
      el('div', { class: 'controls' }, [
        el('button', { type: 'button', onclick: timerClear }, [document.createTextNode('clear')]),
        el('button', { type: 'button', onpointerdown: keepFocus, onclick: timerHint }, [document.createTextNode('hint')]),
        el('button', { type: 'button', onclick: timerGiveUp }, [document.createTextNode('give up')])
      ]),
      input,
      el('div', { id: 'timerMsg', class: 'message' }),
      el('h3', {}, [document.createTextNode('found')]),
      el('div', { id: 'foundList', html: found.map(n => `<span class="pill">${esc(n)}</span>`).join('') }),
      el('div', { id: 'missingList' }),
]));
    setTimeout(() => $('#timerInput') && $('#timerInput').focus(), 0);
  }
  function timerTick() { timerState.seconds++; const clock = $('#timerClock'); if (clock) clock.textContent = timerTimeText(timerState.seconds); }
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

    if (timerState.found.has(hit.name)) {
      if (longer) return; // keep prefixes so longer names can be completed, e.g. Leo Minor or Triangulum Australe.
      input.value = '';
      return;
    }

    input.value = '';
    timerState.found.add(hit.name);
    if (timerState.hintName === hit.name) {
      timerState.hintName = null;
      timerState.hintLength = 0;
    }
    updateTimerDisplay();
    if (timerState.found.size === 88) {
      clearInterval(timerState.interval);
      timerState.running = false;
      const p = scoreKey('timer');
      if (!p.bestTime || timerState.seconds < p.bestTime) p.bestTime = timerState.seconds;
      record('timer', true);
      saveProgress();
      const best = $('#timerBest');
      if (best) best.textContent = timerBestText();
      const msg = $('#timerMsg');
      if (msg) msg.textContent = 'complete';
    }
  }

  function renderAtlas() {
    const state = states.atlas || (states.atlas = { page: '' });
    if (state.page) { renderConstellationPage(state.page); return; }
    if (state.escHandler) {
      document.removeEventListener('keydown', state.escHandler);
      state.escHandler = null;
    }
    app.innerHTML = '<h2>Atlas</h2><input id="atlasSearch" placeholder="search constellation name"><div class="atlas-grid" id="atlasGrid"></div>';
    const search = $('#atlasSearch'), grid = $('#atlasGrid');
    function draw() {
      const q = norm(search.value);
      grid.innerHTML = '';
      DATA.constellations.forEach(c0 => {
        const name = c0.name, info = DATA.constellationInfo[name], chart = chartByName.get(name);
        const aliases = [name, c0.abbr, ...(c0.aliases || [])];
        if (q && !aliases.some(x => norm(x).includes(q))) return;
        const card = el('div', { class: 'atlas-card', onclick: () => renderConstellationPage(name) });
        card.innerHTML = `${chart ? chartImg(chart, true, '', `${name} labelled chart`) : ''}<h3>${esc(name)}</h3><p class="small">${esc(info.meaning)}</p><p class="small">${info.asterisms.length ? info.asterisms.map(esc).join(', ') : '&nbsp;'}</p>`;
        grid.append(card);
      });
    }
    search.addEventListener('input', draw); draw(); search.focus();
  }
  function renderConstellationPage(name) {
    const atlasState = states.atlas || (states.atlas = { page: '' });
    atlasState.page = name;
    if (atlasState.escHandler) document.removeEventListener('keydown', atlasState.escHandler);
    atlasState.escHandler = e => {
      if (activeGame !== 'atlas' || e.key !== 'Escape') return;
      if (document.querySelector('.image-zoom-overlay')) return;
      atlasState.page = '';
      document.removeEventListener('keydown', atlasState.escHandler);
      atlasState.escHandler = null;
      renderAtlas();
    };
    document.addEventListener('keydown', atlasState.escHandler);
    const info = DATA.constellationInfo[name], charts = chartsByName.get(name) || [];
    const relatedAsterisms = DATA.asterisms.filter(a => (a.constellations || []).includes(name));
    const asterismRows = relatedAsterisms.length ? relatedAsterisms.map(a => `<tr><td>${esc(a.name)}</td><td>${(a.members || []).map(esc).join(', ') || '—'}</td><td>${esc(a.clue || '')}</td></tr>`).join('') : '<tr><td colspan="3">No listed asterism in the current catalogue.</td></tr>';
    const starRows = info.stars.length ? info.stars.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.designation)}</td><td>${esc(s.note)}</td></tr>`).join('') : '<tr><td colspan="3">No star in the current curated named-star list.</td></tr>';
    const dsoRows = info.dsos.length ? info.dsos.map(o => `<tr><td>${esc(o.code)}</td><td>${esc(o.commonName)}</td><td>${esc(o.type)}</td></tr>`).join('') : '<tr><td colspan="3">No Messier/Caldwell object in the current list.</td></tr>';
    const chartHtml = charts.length ? charts.map((ch, i) => `<div class="chart-detail-box atlas-chart-box"><h3>${esc(ch.displayName || name)}${charts.length > 1 ? ` chart ${i + 1}` : ''}</h3>${chartImg(ch, true, 'chart-img detail-chart atlas-zoomable-chart', `${ch.displayName || name} labelled chart`)}</div>`).join('') : '';
    const atlasNotes = (info.atlasNotes || []).length ? `<h3>Sky picture</h3>${info.atlasNotes.map(x => `<p>${esc(x)}</p>`).join('')}` : '';
    const facts = (info.funFacts || []).filter(Boolean);
    const order = DATA.constellations.map(c => c.name);
    const hereIndex = order.indexOf(name);
    const prevName = order[(hereIndex - 1 + order.length) % order.length];
    const nextName = order[(hereIndex + 1) % order.length];
    app.innerHTML = `<div class="controls atlas-page-nav"><button type="button" id="prevAtlas" title="previous constellation">←</button><button type="button" id="backAtlas">atlas</button><button type="button" id="nextAtlas" title="next constellation">→</button></div><h2>${esc(name)}</h2><div class="detail-grid"><section class="panel"><h3>Memory hook</h3><p><strong>${esc(info.meaning)}</strong></p><p>${esc(info.myth)}</p>${atlasNotes}<h3>Bordering / nearby chart labels</h3><p>${info.neighbours.length ? info.neighbours.map(n => `<button type="button" class="linkbtn" data-const="${esc(n)}">${esc(n)}</button>`).join(' ') : 'none listed'}</p><h3>Asterisms and sky groups</h3><div class="table-wrap"><table><thead><tr><th>asterism</th><th>member stars</th><th>description</th></tr></thead><tbody>${asterismRows}</tbody></table></div>${facts.length ? `<h3>Fun facts / pointing tricks</h3><ul>${facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section><section class="panel">${chartHtml}</section></div><section class="panel"><h3>Stars inside</h3><table><thead><tr><th>star</th><th>designation</th><th>note</th></tr></thead><tbody>${starRows}</tbody></table><h3>Messier + Caldwell DSOs inside</h3><table><thead><tr><th>code</th><th>common name</th><th>type</th></tr></thead><tbody>${dsoRows}</tbody></table><div class="atlas-map-layout"><div class="atlas-map-controls"><label>Limiting magnitude<div class="slider-text-row"><input id="atlasMapMagSlider" type="range" min="4" max="6" step="0.1" value="6"><input id="atlasMapMag" type="number" min="4" max="6" step="0.1" value="6"></div></label><label class="checkline"><input id="atlasMapDso" type="checkbox"><span>DSOs</span></label><div id="atlasConstMsg" class="message"></div></div><div class="atlas-map-canvas-wrap"><canvas id="atlasConstMap" width="900" height="900" aria-label="${esc(name)} star map"></canvas><button type="button" id="atlasMapZoom" class="atlas-map-zoom-button" title="enlarge map" aria-label="enlarge star map">⛶</button></div></div></section>`;
    $('#backAtlas').addEventListener('click', () => {
      const atlasState = states.atlas || (states.atlas = { page: '' });
      atlasState.page = '';
      if (atlasState.escHandler) {
        document.removeEventListener('keydown', atlasState.escHandler);
        atlasState.escHandler = null;
      }
      renderAtlas();
    });
    $('#prevAtlas').addEventListener('click', () => renderConstellationPage(prevName));
    $('#nextAtlas').addEventListener('click', () => renderConstellationPage(nextName));
    document.querySelectorAll('[data-const]').forEach(b => b.addEventListener('click', () => renderConstellationPage(b.dataset.const)));
    function openAtlasImageZoom(img) {
      const overlay = el('div', { class: 'image-zoom-overlay' });
      const close = el('button', { type: 'button', class: 'image-zoom-close', 'aria-label': 'close zoom' }, [document.createTextNode('×')]);
      const zoomImg = el('img', { src: img.currentSrc || img.src, alt: img.alt || 'zoomed chart' });
      overlay.append(close, zoomImg);
      function closeZoom() {
        overlay.remove();
        document.removeEventListener('keydown', escClose);
      }
      function escClose(e) {
        if (e.key === 'Escape') closeZoom();
      }
      overlay.addEventListener('click', e => { if (e.target === overlay) closeZoom(); });
      close.addEventListener('click', closeZoom);
      document.addEventListener('keydown', escClose);
      document.body.append(overlay);
    }
    document.querySelectorAll('.atlas-zoomable-chart').forEach(img => img.addEventListener('click', () => openAtlasImageZoom(img)));
    initRangeVisuals(app);
    const atlasCanvas = $('#atlasConstMap');
    if (atlasCanvas) {
      let atlasMagLimit = 6;
      let atlasShowDso = false;
      let atlasStars = [];
      let atlasDsos = [];
      function redrawAtlasMap() {
        atlasStars = drawConstellationStarMap(atlasCanvas, name, { magLimit: atlasMagLimit, rotation: 0, showDso: atlasShowDso });
        atlasDsos = atlasStars.dsos || [];
      }
      function setAtlasMag(value) {
        atlasMagLimit = Math.max(4, Math.min(6, parseFloat(value) || 6));
        atlasMagLimit = Math.round(atlasMagLimit * 10) / 10;
        const mag = $('#atlasMapMag');
        const slider = $('#atlasMapMagSlider');
        if (mag) mag.value = atlasMagLimit.toFixed(1);
        if (slider) { slider.value = atlasMagLimit.toFixed(1); updateRangeVisual(slider); }
        redrawAtlasMap();
      }
      function setAtlasDso(value) {
        atlasShowDso = !!value;
        const dso = $('#atlasMapDso');
        if (dso) dso.checked = atlasShowDso;
        redrawAtlasMap();
      }
      function selectFromDrawn(clientX, clientY, canvasEl, msgEl) {
        const hit = pickConstellationMapObject(canvasEl, name, { magLimit: atlasMagLimit, rotation: 0, showDso: atlasShowDso }, clientX, clientY);
        if (!hit) return;
        msgEl.innerHTML = hit.type === 'dso' ? dsoInfoHtml(hit.dso) : starInfoHtml(hit.star);
      }
      function selectAtlasObject(e) {
        selectFromDrawn(e.clientX, e.clientY, atlasCanvas, $('#atlasConstMsg'));
      }
      function openAtlasStarMapZoom() {
        const overlay = el('div', { class: 'image-zoom-overlay atlas-star-map-zoom' });
        const close = el('button', { type: 'button', class: 'image-zoom-close', 'aria-label': 'close zoom' }, [document.createTextNode('×')]);
        const layout = el('div', { class: 'atlas-star-map-zoom-layout' });
        const controls = el('div', { class: 'atlas-map-controls atlas-star-map-zoom-controls' });
        controls.innerHTML = `<label>Limiting magnitude<div class="slider-text-row"><input id="atlasZoomMagSlider" type="range" min="4" max="6" step="0.1" value="${atlasMagLimit.toFixed(1)}"><input id="atlasZoomMag" type="number" min="4" max="6" step="0.1" value="${atlasMagLimit.toFixed(1)}"></div></label><label class="checkline"><input id="atlasZoomDso" type="checkbox" ${atlasShowDso ? 'checked' : ''}><span>DSOs</span></label><div id="atlasZoomMsg" class="message"></div>`;
        const zoomCanvas = el('canvas', { id: 'atlasZoomConstMap', width: '1200', height: '1200', 'aria-label': `${esc(name)} enlarged star map`, title: 'click a star or DSO for info' });
        layout.append(controls, zoomCanvas);
        overlay.append(close, layout);
        document.body.append(overlay);
        initRangeVisuals(overlay);
        let zoomStars = [];
        let zoomDsos = [];
        function redrawZoom() {
          zoomStars = drawConstellationStarMap(zoomCanvas, name, { magLimit: atlasMagLimit, rotation: 0, showDso: atlasShowDso });
          zoomDsos = zoomStars.dsos || [];
        }
        function syncZoomControls() {
          const mag = $('#atlasZoomMag');
          const slider = $('#atlasZoomMagSlider');
          const dso = $('#atlasZoomDso');
          if (mag) mag.value = atlasMagLimit.toFixed(1);
          if (slider) { slider.value = atlasMagLimit.toFixed(1); updateRangeVisual(slider); }
          if (dso) dso.checked = atlasShowDso;
        }
        function setZoomMag(value) {
          setAtlasMag(value);
          syncZoomControls();
          redrawZoom();
        }
        function setZoomDso(value) {
          setAtlasDso(value);
          syncZoomControls();
          redrawZoom();
        }
        $('#atlasZoomMag').addEventListener('input', e => setZoomMag(e.target.value));
        $('#atlasZoomMagSlider').addEventListener('input', e => setZoomMag(e.target.value));
        $('#atlasZoomDso').addEventListener('change', e => setZoomDso(e.target.checked));
        zoomCanvas.addEventListener('click', e => selectFromDrawn(e.clientX, e.clientY, zoomCanvas, $('#atlasZoomMsg')));
        function closeZoom() {
          overlay.remove();
          document.removeEventListener('keydown', escClose);
        }
        function escClose(e) {
          if (e.key === 'Escape') closeZoom();
        }
        overlay.addEventListener('click', e => { if (e.target === overlay) closeZoom(); });
        close.addEventListener('click', closeZoom);
        document.addEventListener('keydown', escClose);
        redrawZoom();
      }
      $('#atlasMapMag').addEventListener('input', e => setAtlasMag(e.target.value));
      $('#atlasMapMagSlider').addEventListener('input', e => setAtlasMag(e.target.value));
      $('#atlasMapDso').addEventListener('change', e => setAtlasDso(e.target.checked));
      $('#atlasMapZoom').addEventListener('click', openAtlasStarMapZoom);
      atlasCanvas.addEventListener('click', selectAtlasObject);
      atlasCanvas.addEventListener('dblclick', openAtlasStarMapZoom);
      redrawAtlasMap();
      Promise.all([loadSkyData(), loadConstellationBounds().catch(() => []), loadDsoCoordinateData().catch(() => new Map())]).then(() => { buildSkyDsoObjects(); redrawAtlasMap(); });
    }
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

  let skyDsoObjects = [];
  let skyDsoCoordinateMap = new Map();
  let skyDsoCoordinatePromise = null;
  const OPENNGC_CSV_URLS = [
    'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv',
    'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/database_files/NGC.csv'
  ];

  function detectCsvDelimiter(text) {
    const firstLine = String(text || '').split(/\r?\n/, 1)[0] || '';
    const counts = [
      { delimiter: ';', count: (firstLine.match(/;/g) || []).length },
      { delimiter: ',', count: (firstLine.match(/,/g) || []).length },
      { delimiter: '\t', count: (firstLine.match(/\t/g) || []).length }
    ];
    counts.sort((a, b) => b.count - a.count);
    return counts[0].count ? counts[0].delimiter : ',';
  }
  function csvRows(text, delimiter = ',') {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delimiter) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x || '').trim()));
  }

  function hmsToDegrees(value) {
    const parts = String(value || '').trim().split(/[:\s]+/).filter(Boolean).map(Number);
    if (!parts.length || !Number.isFinite(parts[0])) return null;
    const h = parts[0], m = Number.isFinite(parts[1]) ? parts[1] : 0, s = Number.isFinite(parts[2]) ? parts[2] : 0;
    return (h + m / 60 + s / 3600) * 15;
  }

  function dmsToDegrees(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const sign = raw.startsWith('-') ? -1 : 1;
    const parts = raw.replace(/^[+-]/, '').split(/[:\s]+/).filter(Boolean).map(Number);
    if (!parts.length || !Number.isFinite(parts[0])) return null;
    const d = Math.abs(parts[0]), m = Number.isFinite(parts[1]) ? parts[1] : 0, s = Number.isFinite(parts[2]) ? parts[2] : 0;
    return sign * (d + m / 60 + s / 3600);
  }

  function dsoKey(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    const compacted = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = compacted.match(/^(NGC|IC|M|MESSIER|C|CALDWELL)0*([0-9]+)[A-Z]*$/);
    if (!m) return compacted;
    const prefix = m[1] === 'MESSIER' ? 'M' : m[1] === 'CALDWELL' ? 'C' : m[1];
    return `${prefix}${parseInt(m[2], 10)}`;
  }

  function dsoIdentifierKeys(o) {
    const values = [o.code, o.commonName, ...(o.aliases || []), ...(o.accepted || [])];
    return [...new Set(values.map(dsoKey).filter(Boolean))];
  }

  function catalogueRowKeys(row) {
    const values = [];
    ['Name', 'M', 'Messier', 'NGC', 'IC', 'Identifiers', 'Common names', 'Common name', 'Other names'].forEach(k => {
      if (row[k]) values.push(...String(row[k]).split(/[;,]/));
    });
    if (row.M) values.push(`M${row.M}`, `Messier ${row.M}`);
    if (row.NGC) values.push(`NGC${row.NGC}`);
    if (row.IC) values.push(`IC${row.IC}`);
    return [...new Set(values.map(dsoKey).filter(Boolean))];
  }

  function parseOpenNgc(text) {
    const rows = csvRows(text, detectCsvDelimiter(text));
    if (rows.length < 2) return new Map();
    const header = rows[0].map(x => String(x || '').trim());
    const objectCoordsByKey = new Map();

    for (const cells of rows.slice(1)) {
      const row = {};
      header.forEach((h, i) => row[h] = cells[i] || '');
      const ra = hmsToDegrees(row.RA || row.ra);
      const dec = dmsToDegrees(row.Dec || row.DEC || row.dec);
      if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;
      catalogueRowKeys(row).forEach(key => objectCoordsByKey.set(key, { ra, dec }));
    }

    const coords = new Map();
    DATA.dso.forEach(o => {
      for (const key of dsoIdentifierKeys(o)) {
        if (objectCoordsByKey.has(key)) {
          coords.set(o.code, objectCoordsByKey.get(key));
          break;
        }
      }
    });
    return coords;
  }

  async function loadDsoCoordinateData() {
    if (skyDsoCoordinateMap.size) return skyDsoCoordinateMap;
    if (skyDsoCoordinatePromise) return skyDsoCoordinatePromise;

    skyDsoCoordinatePromise = (async () => {
      let lastError = null;
      for (const url of OPENNGC_CSV_URLS) {
        try {
          const res = await fetch(url, { cache: 'force-cache' });
          if (!res.ok) throw new Error(`OpenNGC HTTP ${res.status}`);
          const parsed = parseOpenNgc(await res.text());
          if (parsed.size) {
            skyDsoCoordinateMap = parsed;
            skyDsoObjects = [];
            return skyDsoCoordinateMap;
          }
        } catch (err) {
          lastError = err;
        }
      }
      throw lastError || new Error('DSO coordinate data unavailable');
    })();

    return skyDsoCoordinatePromise;
  }
  function hashUnit(value, salt = '') {
    const s = String(value || '') + '|' + salt;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
  }
  function seededUnitVec(seed, attempt = 0) {
    const z = hashUnit(seed, `z${attempt}`) * 2 - 1;
    const a = hashUnit(seed, `a${attempt}`) * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    return { x: r * Math.cos(a), y: r * Math.sin(a), z };
  }
  function dsoCategory(o) {
    const t = compact(o.type || '');
    if (t.includes('nebula')) return 'nebula';
    if (t.includes('opencluster')) return 'open';
    if (t.includes('globularcluster')) return 'globular';
    if (t.includes('galaxy') || t.includes('galaxies')) return 'galaxy';
    return 'misc';
  }
  function dsoColour(o) {
    const category = dsoCategory(o);
    if (category === 'nebula') return '#8a2be2';
    if (category === 'open') return '#d4a600';
    if (category === 'globular') return '#198754';
    if (category === 'galaxy') return '#1f6feb';
    return '#d63384';
  }
  function buildSkyDsoObjects() {
    if (skyDsoObjects.length) return skyDsoObjects;
    skyDsoObjects = DATA.dso.map(o => {
      let v = null;
      const catalogueCoord = skyDsoCoordinateMap.get(o.code);
      if (catalogueCoord && Number.isFinite(catalogueCoord.ra) && Number.isFinite(catalogueCoord.dec)) {
        v = vecFromRaDec(catalogueCoord.ra, catalogueCoord.dec);
      }
      if (!v && Number.isFinite(o.ra) && Number.isFinite(o.dec)) v = vecFromRaDec(o.ra, o.dec);
      if (!v && skyBoundsFeatures.length) {
        for (let i = 0; i < 220; i++) {
          const candidate = seededUnitVec(o.code || o.commonName || o.constellation, i);
          if (officialConstellationAtVec(candidate) === o.constellation) { v = candidate; break; }
        }
      }
      if (!v) v = skyConstCentres.get(o.constellation) || vecFromRaDec(0, 0);
      return { ...o, v, colour: dsoColour(o), category: dsoCategory(o), hasCataloguePosition: Boolean(catalogueCoord) };
    });
    return skyDsoObjects;
  }
  function localBasisFromForward(forward) {
    const f = normVec(forward);
    const ref = Math.abs(f.z) > 0.96 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
    let right = normVec(cross(f, ref));
    if (!Number.isFinite(right.x)) right = { x: 1, y: 0, z: 0 };
    let up = normVec(cross(right, f));
    right = normVec(cross(f, up));
    return { f, right, up };
  }
  const CONSTELLATION_GENITIVE = {
    'Andromeda': 'Andromedae', 'Antlia': 'Antliae', 'Apus': 'Apodis', 'Aquarius': 'Aquarii', 'Aquila': 'Aquilae', 'Ara': 'Arae', 'Aries': 'Arietis', 'Auriga': 'Aurigae',
    'Boötes': 'Boötis', 'Caelum': 'Caeli', 'Camelopardalis': 'Camelopardalis', 'Cancer': 'Cancri', 'Canes Venatici': 'Canum Venaticorum', 'Canis Major': 'Canis Majoris', 'Canis Minor': 'Canis Minoris',
    'Capricornus': 'Capricorni', 'Carina': 'Carinae', 'Cassiopeia': 'Cassiopeiae', 'Centaurus': 'Centauri', 'Cepheus': 'Cephei', 'Cetus': 'Ceti', 'Chamaeleon': 'Chamaeleontis',
    'Circinus': 'Circini', 'Columba': 'Columbae', 'Coma Berenices': 'Comae Berenices', 'Corona Australis': 'Coronae Australis', 'Corona Borealis': 'Coronae Borealis',
    'Corvus': 'Corvi', 'Crater': 'Crateris', 'Crux': 'Crucis', 'Cygnus': 'Cygni', 'Delphinus': 'Delphini', 'Dorado': 'Doradus', 'Draco': 'Draconis', 'Equuleus': 'Equulei',
    'Eridanus': 'Eridani', 'Fornax': 'Fornacis', 'Gemini': 'Geminorum', 'Grus': 'Gruis', 'Hercules': 'Herculis', 'Horologium': 'Horologii', 'Hydra': 'Hydrae', 'Hydrus': 'Hydri',
    'Indus': 'Indi', 'Lacerta': 'Lacertae', 'Leo': 'Leonis', 'Leo Minor': 'Leonis Minoris', 'Lepus': 'Leporis', 'Libra': 'Librae', 'Lupus': 'Lupi', 'Lynx': 'Lyncis',
    'Lyra': 'Lyrae', 'Mensa': 'Mensae', 'Microscopium': 'Microscopii', 'Monoceros': 'Monocerotis', 'Musca': 'Muscae', 'Norma': 'Normae', 'Octans': 'Octantis',
    'Ophiuchus': 'Ophiuchi', 'Orion': 'Orionis', 'Pavo': 'Pavonis', 'Pegasus': 'Pegasi', 'Perseus': 'Persei', 'Phoenix': 'Phoenicis', 'Pictor': 'Pictoris',
    'Pisces': 'Piscium', 'Piscis Austrinus': 'Piscis Austrini', 'Puppis': 'Puppis', 'Pyxis': 'Pyxidis', 'Reticulum': 'Reticuli', 'Sagitta': 'Sagittae', 'Sagittarius': 'Sagittarii',
    'Scorpius': 'Scorpii', 'Sculptor': 'Sculptoris', 'Scutum': 'Scuti', 'Serpens': 'Serpentis', 'Sextans': 'Sextantis', 'Taurus': 'Tauri', 'Telescopium': 'Telescopii',
    'Triangulum': 'Trianguli', 'Triangulum Australe': 'Trianguli Australis', 'Tucana': 'Tucanae', 'Ursa Major': 'Ursae Majoris', 'Ursa Minor': 'Ursae Minoris',
    'Vela': 'Velorum', 'Virgo': 'Virginis', 'Volans': 'Volantis', 'Vulpecula': 'Vulpeculae'
  };
  const GREEK_BAYER_SYMBOLS = [
    ['alpha', 'α'], ['alp', 'α'], ['beta', 'β'], ['bet', 'β'], ['gamma', 'γ'], ['gam', 'γ'], ['delta', 'δ'], ['del', 'δ'], ['epsilon', 'ε'], ['eps', 'ε'],
    ['zeta', 'ζ'], ['zet', 'ζ'], ['eta', 'η'], ['theta', 'θ'], ['the', 'θ'], ['iota', 'ι'], ['iot', 'ι'], ['kappa', 'κ'], ['kap', 'κ'], ['lambda', 'λ'], ['lam', 'λ'],
    ['mu', 'μ'], ['nu', 'ν'], ['xi', 'ξ'], ['omicron', 'ο'], ['omi', 'ο'], ['pi', 'π'], ['rho', 'ρ'], ['sig', 'σ'], ['sigma', 'σ'], ['tau', 'τ'], ['upsilon', 'υ'], ['ups', 'υ'],
    ['phi', 'φ'], ['chi', 'χ'], ['psi', 'ψ'], ['omega', 'ω'], ['ome', 'ω']
  ];
  function greekBayerSymbol(value) {
    const c = compact(value);
    if (!c) return '';
    for (const [key, symbol] of GREEK_BAYER_SYMBOLS) {
      if (c.includes(key)) return symbol;
    }
    return '';
  }
  function starDisplayName(s) {
    return String(s.name || '').trim();
  }
  function starDesignation(s) {
    const symbol = greekBayerSymbol(s.bayer) || greekBayerSymbol(s.bf);
    if (!symbol) return '';
    return `${symbol} ${CONSTELLATION_GENITIVE[s.constellation] || s.constellation}`;
  }
  function starInfoHtml(s) {
    const lines = [];
    const name = starDisplayName(s);
    const designation = starDesignation(s);
    if (name) lines.push(`<strong>${esc(name)}</strong>`);
    if (designation) lines.push(`designation: ${esc(designation)}`);
    lines.push(`constellation: ${esc(s.constellation)}`);
    lines.push(`magnitude: ${Number(s.mag).toFixed(2)}`);
    return lines.join('<br>');
  }
  function dsoInfoHtml(o) {
    const lines = [];
    if (String(o.commonName || '').trim()) lines.push(`<strong>${esc(o.commonName)}</strong>`);
    lines.push(`tag: ${esc(o.code)}`);
    lines.push(`constellation: ${esc(o.constellation)}`);
    lines.push(`type: ${esc(o.type)}`);
    return lines.join('<br>');
  }
  function uniqueSkyStars(list) {
    const seen = new Set();
    const out = [];
    list.forEach(s => {
      const key = `${Number(s.ra).toFixed(6)}:${Number(s.dec).toFixed(6)}:${compact(s.name)}:${compact(s.bayer)}:${compact(s.bf)}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    });
    return out.sort((a, b) => a.mag - b.mag);
  }
  function starsForConstellation(name, magLimit = 6) {
    const byCatalogue = skyStars.filter(s => s.mag <= magLimit && s.constellation === name);
    const byBoundary = skyStars.filter(s => s.mag <= magLimit && officialConstellationAtVec(s.v) === name);
    return uniqueSkyStars([...byCatalogue, ...byBoundary]);
  }
  const GUESS_CONTEXT_STARS = {
    Pegasus: ['Alpheratz'],
    Auriga: ['Elnath', 'Alnath']
  };
  function findSkyStarByAnyName(names, magLimit = 6) {
    const keys = names.map(compact).filter(Boolean);
    return skyStars
      .filter(s => s.mag <= magLimit)
      .find(s => keys.includes(compact(s.name)) || keys.includes(compact(starDisplayName(s))));
  }
  function guessStarsForConstellation(name, magLimit = 6) {
    const stars = starsForConstellation(name, magLimit).slice();
    const contextNames = GUESS_CONTEXT_STARS[name] || [];
    contextNames.forEach(label => {
      const star = findSkyStarByAnyName([label], magLimit);
      if (star) stars.push({ ...star, constellation: name, contextStar: true, actualConstellation: star.constellation });
    });
    return uniqueSkyStars(stars);
  }
  function constellationStarSubset(name, magLimit = 6) {
    return starsForConstellation(name, magLimit);
  }
  function colourIdFill(ctx, id) {
    const r = id & 255, g = (id >> 8) & 255, b = (id >> 16) & 255;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
  }
  function colourIdRead(data) {
    return (data[0] || 0) + ((data[1] || 0) << 8) + ((data[2] || 0) << 16);
  }
  function buildPickLookup(canvas) {
    const pickCanvas = document.createElement('canvas');
    pickCanvas.width = canvas.width;
    pickCanvas.height = canvas.height;
    const pickCtx = pickCanvas.getContext('2d', { willReadFrequently: true });
    pickCtx.clearRect(0, 0, pickCanvas.width, pickCanvas.height);
    return { canvas: pickCanvas, ctx: pickCtx, map: new Map(), targets: [], nextId: 1 };
  }
  function registerPickCircle(pick, x, y, r, payload) {
    const id = pick.nextId++;
    pick.map.set(id, payload);
    pick.targets.push({ x, y, r, payload });
    pick.ctx.beginPath();
    colourIdFill(pick.ctx, id);
    pick.ctx.arc(x, y, r, 0, Math.PI * 2);
    pick.ctx.fill();
  }
  function pickFromLayer(pick, x, y) {
    if (!pick) return null;
    let best = null;
    for (const target of pick.targets || []) {
      const d = Math.hypot(target.x - x, target.y - y);
      if (d > target.r) continue;
      const score = d / Math.max(1, target.r);
      if (!best || score < best.score || (score === best.score && d < best.d)) best = { score, d, payload: target.payload };
    }
    if (best) return best.payload;

    const px = Math.round(x), py = Math.round(y);
    const probes = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
    for (const [dx, dy] of probes) {
      const sx = px + dx, sy = py + dy;
      if (sx < 0 || sy < 0 || sx >= pick.canvas.width || sy >= pick.canvas.height) continue;
      const data = pick.ctx.getImageData(sx, sy, 1, 1).data;
      const id = colourIdRead(data);
      if (id && pick.map.has(id)) return pick.map.get(id);
    }
    return null;
  }

  function drawConstellationStarMap(canvas, name, options = {}) {
    const ctx = canvas.getContext('2d');
    const magLimit = Number.isFinite(options.magLimit) ? options.magLimit : 6;
    const rotation = Number.isFinite(options.rotation) ? options.rotation : 0;
    const stars = options.stars || constellationStarSubset(name, magLimit);
    const showDso = options.showDso === true;
    const dsos = showDso ? buildSkyDsoObjects().filter(o => o.constellation === name && String(o.commonName || '').trim()) : [];
    const vectors = [...stars.map(s => s.v), ...dsos.map(o => o.v)];
    const pick = buildPickLookup(canvas);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    if (!skyStars.length) {
      ctx.fillStyle = 'black'; ctx.font = '18px Arial'; ctx.fillText('loading stars...', 24, 40);
      canvas._pickLayer = pick;
      return [];
    }
    if (!vectors.length) {
      canvas._pickLayer = pick;
      return [];
    }

    const sum = vectors.reduce((v, p) => ({ x: v.x + p.x, y: v.y + p.y, z: v.z + p.z }), { x: 0, y: 0, z: 0 });
    const centre = normVec(sum);
    const b = localBasisFromForward(centre);
    const c = Math.cos(rotation), sr = Math.sin(rotation);
    const toMapPoint = (v, item) => {
      const x0 = dot(v, b.right), y0 = dot(v, b.up);
      return { ...item, x: x0 * c - y0 * sr, y: x0 * sr + y0 * c };
    };
    const rawStars = stars.map(star => toMapPoint(star.v, { star }));
    const rawDsos = dsos.map(dso => toMapPoint(dso.v, { dso }));
    const maxAbs = Math.max(0.0001, ...[...rawStars, ...rawDsos].map(p => Math.max(Math.abs(p.x), Math.abs(p.y))));
    const scale = Math.min(canvas.width, canvas.height) * 0.39 / maxAbs;
    const drawn = [];
    const drawnDsos = [];

    ctx.fillStyle = 'black';
    rawStars.sort((a, b) => b.star.mag - a.star.mag).forEach(p => {
      const x = canvas.width / 2 + p.x * scale;
      const y = canvas.height / 2 - p.y * scale;
      const r = Math.max(1.2, Math.min(6, 5.2 - p.star.mag * 0.62));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      const hitR = Math.max(10, r + 7);
      registerPickCircle(pick, x, y, hitR, { type: 'star', star: p.star });
      drawn.push({ x, y, r: hitR, star: p.star });
    });

    if (showDso) {
      rawDsos.forEach(p => {
        const x = canvas.width / 2 + p.x * scale;
        const y = canvas.height / 2 - p.y * scale;
        ctx.fillStyle = p.dso.colour;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        registerPickCircle(pick, x, y, 11, { type: 'dso', dso: p.dso });
        drawnDsos.push({ x, y, r: 11, dso: p.dso });
      });
    }

    canvas._pickLayer = pick;
    drawn.dsos = drawnDsos;
    return drawn;
  }
  function pickConstellationMapObject(canvas, name, options = {}, clientX, clientY) {
    const magLimit = Number.isFinite(options.magLimit) ? options.magLimit : 6;
    const rotation = Number.isFinite(options.rotation) ? options.rotation : 0;
    const showDso = options.showDso === true;
    if (!canvas._pickLayer) drawConstellationStarMap(canvas, name, { magLimit, rotation, showDso });
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * canvas.width / rect.width;
    const y = (clientY - rect.top) * canvas.height / rect.height;
    return pickFromLayer(canvas._pickLayer, x, y);
  }

  function setupSphereFullscreen() {
    const layout = document.querySelector('.sky-layout');
    const panel = layout ? layout.querySelector('.sky-panel') : null;
    if (!layout || !panel) return;
    const button = el('button', { type: 'button', class: 'sphere-fullscreen-button', title: 'toggle full screen' }, [document.createTextNode('⛶')]);
    panel.append(button);
    function update() {
      layout.classList.toggle('sphere-fullscreen', sphereFullscreenActive);
      button.textContent = sphereFullscreenActive ? '×' : '⛶';
      button.title = sphereFullscreenActive ? 'minimise' : 'full screen';
    }
    button.addEventListener('click', () => {
      sphereFullscreenActive = !sphereFullscreenActive;
      update();
    });
    update();
  }

  function renderSkyGuessr() {
    const state = states.skyguessr || (states.skyguessr = { loaded: false, loading: false, error: '', fov: defaultFov(), magLimit: defaultMag(), autoMag: false, target: null, answered: false, message: '', score: scoreKey('skyguessr'), orient: null });
    app.innerHTML = `<h2>SkyGuessr</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="skyCanvas" width="900" height="900" tabindex="0" aria-label="celestial sphere"></canvas></section><aside class="panel"><label>FOV degrees<div class="slider-text-row"><input id="skyFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="skyFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label class="checkline"><input id="skyAutoMag" type="checkbox" ${state.autoMag !== false ? "checked" : ""}><span>adaptive star density</span></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="skyMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="skyMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><div class="sky-nav-grid" aria-label="sky movement controls"><button type="button" data-move="-1,-1">↖</button><button type="button" data-move="0,-1">↑</button><button type="button" data-move="1,-1">↗</button><button type="button" data-move="-1,0">←</button><button type="button" id="skyCentre">X</button><button type="button" data-move="1,0">→</button><button type="button" data-move="-1,1">↙</button><button type="button" data-move="0,1">↓</button><button type="button" data-move="1,1">↘</button></div><div class="controls"><button type="button" id="skyRollCCW">↺ rotate</button><button type="button" id="skyRollCW">rotate ↻</button></div><input id="skyAnswer" autocomplete="off" placeholder="constellation at the X"><div class="controls"><button type="button" id="skyReveal">reveal</button></div><div class="controls new-round-controls"><button type="button" id="skyNew" class="new-round-button">new location</button></div><div id="skyMsg" class="message">${esc(state.message || '')}</div><div class="stats">${formatScore('skyguessr')}</div></aside></div>`;
    initRangeVisuals(app);
    setupSphereFullscreen();
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
    function randomUnitVec() {
      const z = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.max(0, 1 - z * z));
      return { x: r * Math.cos(a), y: r * Math.sin(a), z };
    }
    function randomSkyTarget() {
      for (let i = 0; i < 80; i++) {
        const v = randomUnitVec();
        const constellation = officialConstellationAtVec(v);
        if (constellation) return { v, constellation };
      }
      const fallback = rand(skyStars.filter(s => s.constellation));
      return fallback ? { v: fallback.v, constellation: fallback.constellation } : null;
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
        state.target = randomSkyTarget();
        randomViewAroundTarget(false);
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
    function randomRoll() {
      const b = ensureOrientation();
      rotateBasis(b.f, Math.random() * Math.PI * 2);
    }
    function randomViewAroundTarget(redraw = true) {
      if (!state.target) return;
      const targetBasis = makeBasisFromForward(state.target.v);
      const maxOffset = (state.fov * Math.PI / 180) * 0.46;
      const offset = Math.sqrt(Math.random()) * maxOffset;
      const angle = Math.random() * Math.PI * 2;
      const side = {
        x: targetBasis.right.x * Math.cos(angle) + targetBasis.up.x * Math.sin(angle),
        y: targetBasis.right.y * Math.cos(angle) + targetBasis.up.y * Math.sin(angle),
        z: targetBasis.right.z * Math.cos(angle) + targetBasis.up.z * Math.sin(angle)
      };
      const forward = normVec({
        x: state.target.v.x * Math.cos(offset) + side.x * Math.sin(offset),
        y: state.target.v.y * Math.cos(offset) + side.y * Math.sin(offset),
        z: state.target.v.z * Math.cos(offset) + side.z * Math.sin(offset)
      });
      setOrientationForward(forward);
      randomRoll();
      if (redraw) draw();
    }
    function nearbyAnswers() {
      if (!state.target) return [];
      const target = state.target.constellation;
      const centreLimit = Math.max(10, Math.min(18, state.fov * 0.16));
      const nearby = new Set();
      const targetVec = state.target.v;
      skyConstCentres.forEach((v, name) => { if (name !== target && angularDeg(targetVec, v) <= centreLimit) nearby.add(name); });
      const chart = chartByName.get(target);
      if (chart) (chart.neighbours || []).forEach(n => { const cv = skyConstCentres.get(n); if (cv && angularDeg(targetVec, cv) <= centreLimit + 5) nearby.add(n); });
      return [...nearby];
    }
    function solved(value) {
      if (!state.target || state.answered) return;
      const target = state.target.constellation;
      const msg = $('#skyMsg');
      if (answerMatches(value, [target])) {
        state.answered = true;
        record('skyguessr', true);
        state.message = `correct: ${target}`;
        if (msg) msg.textContent = state.message;
        return;
      }
      if (answerMatches(value, nearbyAnswers())) {
        state.message = 'close';
        if (msg) msg.textContent = state.message;
        return;
      }
      state.message = '';
      if (msg) msg.textContent = '';
    }
    function newTarget() {
      if (!skyStars.length) return;
      state.fov = defaultFov();
      state.magLimit = defaultMag();
      state.target = randomSkyTarget();
      randomViewAroundTarget(false);
      state.answered = false; state.message = ''; answer.value = ''; renderSkyGuessr();
    }
    function reveal() {
      if (!state.target || state.answered) return;
      state.answered = true;
      record('skyguessr', false);
      state.message = `answer: ${state.target.constellation}`;
      $('#skyMsg').textContent = state.message;
    }

    answer.addEventListener('input', () => solved(answer.value));
    answer.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        newTarget();
      }
    });
    setShiftEnterAction(newTarget);
    fovInput.addEventListener('input', e => setFov(parseFloat(e.target.value) || defaultFov()));
    fovSlider.addEventListener('input', e => setFov(parseFloat(e.target.value) || defaultFov()));
    function turnOffAutoMag() {
      if (state.autoMag !== false) {
        state.autoMag = false;
        $('#skyAutoMag').checked = false;
      }
    }
    function setSkyMag(v) {
      turnOffAutoMag();
      state.magLimit = Math.max(4, Math.min(6, parseFloat(v) || defaultMag()));
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
    $('#skyCentre').addEventListener('click', () => { setFov(defaultFov()); centreOnTarget(true); focusCanvas(); });
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
      Promise.all([loadSkyData(), loadConstellationBounds()]).then(() => {
        state.loaded = true;
        state.loading = false;
        ensureTarget();
        draw();
        answer.focus();
      }).catch(err => { state.error = 'sky data unavailable'; state.loading = false; draw(); });
    }
    ensureTarget(); draw(); setTimeout(() => answer.focus(), 0);
  }



  function renderSkyMap() {
    const state = states.skymap || (states.skymap = {
      loaded: false,
      loading: false,
      error: '',
      fov: defaultFov(),
      magLimit: defaultMag(),
      showDso: true,
      message: '',
      orient: null
    });

    app.innerHTML = `<h2>Sky Map</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="skyMapCanvas" width="900" height="900" tabindex="0" aria-label="sky map sphere"></canvas></section><aside class="panel"><label>FOV degrees<div class="slider-text-row"><input id="mapFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="mapFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="mapMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="mapMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><label class="checkline"><input id="mapDso" type="checkbox" ${state.showDso !== false ? "checked" : ""}><span>DSOs</span></label><label>Search sky<input id="mapSearch" list="mapSearchList" autocomplete="off" placeholder="star or DSO"></label><datalist id="mapSearchList"></datalist><div class="sky-nav-grid" aria-label="sky map movement controls"><button type="button" data-move="-1,-1">↖</button><button type="button" data-move="0,-1">↑</button><button type="button" data-move="1,-1">↗</button><button type="button" data-move="-1,0">←</button><button type="button" id="mapCentre">○</button><button type="button" data-move="1,0">→</button><button type="button" data-move="-1,1">↙</button><button type="button" data-move="0,1">↓</button><button type="button" data-move="1,1">↘</button></div><div class="controls"><button type="button" id="mapZoomIn">zoom in</button><button type="button" id="mapZoomOut">zoom out</button></div><div class="controls"><button type="button" id="mapRollCCW">↺ rotate</button><button type="button" id="mapRollCW">rotate ↻</button><button type="button" id="mapClear">deselect</button></div><div class="dso-legend small"><span><b style="background:#8a2be2"></b>nebula</span><span><b style="background:#d4a600"></b>open cluster</span><span><b style="background:#198754"></b>globular</span><span><b style="background:#1f6feb"></b>galaxy</span><span><b style="background:#d63384"></b>misc</span></div><div id="mapMsg" class="message">${state.message || ''}</div></aside></div>`;

    initRangeVisuals(app);
    setupSphereFullscreen();

    const canvas = $('#skyMapCanvas');
    const ctx = canvas.getContext('2d');
    const fovInput = $('#mapFov');
    const fovSlider = $('#mapFovSlider');
    const magInput = $('#mapMag');
    const magSlider = $('#mapMagSlider');
    const searchInput = $('#mapSearch');
    const searchList = $('#mapSearchList');
    const msg = $('#mapMsg');

    function focusCanvas() {
      try { canvas.focus({ preventScroll: true }); }
      catch { canvas.focus(); }
    }

    function cleanBasis(b) {
      const f = normVec(b.f);
      let right = b.right || { x: 1, y: 0, z: 0 };
      const proj = dot(right, f);
      right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
      if (!Number.isFinite(right.x)) return localBasisFromForward(f);
      const up = normVec(cross(right, f));
      return { f, right: normVec(cross(f, up)), up };
    }

    function ensureOrientation() {
      if (!state.orient) state.orient = localBasisFromForward(vecFromRaDec(0, 0));
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

    function setFov(value) {
      state.fov = Math.max(20, Math.min(190, parseFloat(value) || defaultFov()));
      const v = Number(state.fov.toFixed(1));
      fovInput.value = v;
      fovSlider.value = v;
      updateRangeVisual(fovSlider);
      draw();
    }

    function setMag(value) {
      state.magLimit = Math.max(4, Math.min(6, parseFloat(value) || defaultMag()));
      const v = Number(state.magLimit.toFixed(1));
      magInput.value = v;
      magSlider.value = v;
      updateRangeVisual(magSlider);
      draw();
    }

    function project(v, basis, radius, fovRad) {
      const z = dot(v, basis.f);
      const ang = Math.acos(Math.max(-1, Math.min(1, z)));
      if (ang > fovRad / 2) return null;
      const x = dot(v, basis.right);
      const y = dot(v, basis.up);
      const sin = Math.sin(ang) || 1e-9;
      const rr = (ang / (fovRad / 2)) * radius;
      return {
        x: canvas.width / 2 + rr * x / sin,
        y: canvas.height / 2 - rr * y / sin,
        z
      };
    }

    function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
    }

    function draw() {
      clearCanvas();

      const pick = buildPickLookup(canvas);
      canvas._pickLayer = pick;

      if (!state.loaded) {
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.fillText(state.error || 'loading sky...', 24, 40);
        return;
      }

      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const fovRad = state.fov * Math.PI / 180;
      const basis = ensureOrientation();

      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.clip();

      const visibleStars = skyStars
        .filter(star => star.mag <= state.magLimit)
        .sort((a, b) => b.mag - a.mag);

      ctx.fillStyle = 'black';
      for (const star of visibleStars) {
        const p = project(star.v, basis, radius, fovRad);
        if (!p) continue;
        const r = Math.max(0.8, Math.min(4.6, 4.1 - star.mag * 0.54));

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        registerPickCircle(pick, p.x, p.y, Math.max(12, r + 8), { type: 'star', star });
      }

      if (state.showDso !== false) {
        for (const dso of buildSkyDsoObjects().filter(o => String(o.commonName || '').trim())) {
          const p = project(dso.v, basis, radius, fovRad);
          if (!p) continue;

          ctx.fillStyle = dso.colour;
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          registerPickCircle(pick, p.x, p.y, 11, { type: 'dso', dso });
        }
      }

      if (state.searchMarker && state.searchMarker.v) {
        const p = project(state.searchMarker.v, basis, radius, fovRad);
        if (p) {
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
          ctx.stroke();
          registerPickCircle(pick, p.x, p.y, 14, state.searchMarker.payload);
        }
      }

      ctx.restore();

      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    function selectAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * canvas.width / rect.width;
      const y = (clientY - rect.top) * canvas.height / rect.height;
      const hit = pickFromLayer(canvas._pickLayer, x, y);
      if (!hit) {
        state.message = '';
        state.searchMarker = null;
        msg.textContent = '';
        draw();
        return;
      }

      const v = hit.type === 'dso' ? hit.dso.v : hit.star.v;
      state.searchMarker = { v, payload: hit };
      state.message = hit.type === 'dso' ? dsoInfoHtml(hit.dso) : starInfoHtml(hit.star);
      msg.innerHTML = state.message;
      draw();
    }

    function skySearchKey(value) {
      const greekNames = {
        α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ο: 'omicron', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega'
      };
      return compact(String(value || '').replace(/[αβγδεζηθικλμνξοπρστυφχψω]/gi, ch => greekNames[ch.toLowerCase()] || ch));
    }

    function starSearchLabels(star) {
      const labels = [starDisplayName(star), starDesignation(star), star.bayer, star.bf];
      const genitive = CONSTELLATION_GENITIVE[star.constellation] || star.constellation;
      const abbr = DATA.constellations.find(c => c.name === star.constellation)?.abbr || '';
      const symbol = greekBayerSymbol(star.bayer) || greekBayerSymbol(star.bf);
      if (star.bayer) {
        labels.push(`${star.bayer} ${genitive}`, `${star.bayer} ${star.constellation}`, `${star.bayer} ${abbr}`);
      }
      if (symbol) {
        labels.push(`${symbol} ${genitive}`, `${symbol} ${star.constellation}`, `${symbol} ${abbr}`);
      }
      const curated = DATA.stars.find(s => s.constellation === star.constellation && compact(s.name) === compact(star.name));
      if (curated) labels.push(curated.designation, `${curated.designation} ${curated.name}`);
      return labels.filter(x => String(x || '').trim());
    }

    function dsoSearchLabels(dso) {
      return [dso.code, dso.commonName, ...(dso.aliases || []), ...(dso.accepted || [])].filter(x => String(x || '').trim());
    }

    function addSearchCandidate(candidates, query, labels, result) {
      for (const label of labels) {
        const key = skySearchKey(label);
        if (!key) continue;
        let score = Infinity;
        if (key === query) score = 0;
        else if (key.startsWith(query)) score = 1;
        else if (query.length >= 5 && key.length >= query.length && oneSubstitutionTypo(key.slice(0, query.length), query)) score = 1.5;
        else if (key.includes(query)) score = 2;
        else if (query.length >= 5 && key.length === query.length && oneSubstitutionTypo(key, query)) score = 2.5;
        if (score < Infinity) candidates.push({ ...result, label, score });
      }
    }

    function findMapSearchResult(value) {
      const query = skySearchKey(value);
      if (!query) return null;
      const candidates = [];

      skyStars.forEach(star => {
        addSearchCandidate(candidates, query, starSearchLabels(star), {
          kind: 'star',
          star,
          v: star.v,
          priority: 1 + Math.max(-2, Math.min(6, star.mag)) / 100
        });
      });

      buildSkyDsoObjects().filter(dso => String(dso.commonName || '').trim()).forEach(dso => {
        addSearchCandidate(candidates, query, dsoSearchLabels(dso), {
          kind: 'dso',
          dso,
          v: dso.v,
          priority: 2
        });
      });

      candidates.sort((a, b) => a.score - b.score || a.priority - b.priority || String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
      return candidates[0] || null;
    }

    function searchMessage(result) {
      return result.kind === 'dso' ? dsoInfoHtml(result.dso) : starInfoHtml(result.star);
    }

    function runMapSearch() {
      if (!state.loaded) {
        state.message = 'sky data still loading';
        msg.textContent = state.message;
        return;
      }
      const result = findMapSearchResult(searchInput.value);
      if (!result || !result.v) {
        state.searchMarker = null;
        state.message = 'not found';
        msg.textContent = state.message;
        draw();
        return;
      }

      state.orient = localBasisFromForward(result.v);
      state.message = searchMessage(result);
      state.searchMarker = {
        v: result.v,
        payload: result.kind === 'star' ? { type: 'star', star: result.star } : { type: 'dso', dso: result.dso }
      };
      searchInput.value = String(result.label || searchInput.value);
      msg.innerHTML = state.message;
      draw();
      focusCanvas();
    }

    function populateMapSearchList() {
      const values = [];
      skyStars.forEach(star => {
        const name = starDisplayName(star);
        const designation = starDesignation(star);
        if (name) values.push(name);
        if (designation) values.push(designation);
      });
      buildSkyDsoObjects().forEach(dso => {
        values.push(dso.code);
        if (String(dso.commonName || '').trim()) values.push(dso.commonName);
      });
      searchList.innerHTML = [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })).map(v => `<option value="${esc(v)}"></option>`).join('');
    }

    function move(dx, dy, multiplier = 1) {
      const b = ensureOrientation();
      const anglePerPx = (state.fov * Math.PI / 180) / Math.min(canvas.width, canvas.height) * multiplier;
      rotateBasis(b.up, -dx * anglePerPx);
      rotateBasis(ensureOrientation().right, -dy * anglePerPx);
      draw();
    }

    function rollFrame(direction) {
      const b = ensureOrientation();
      rotateBasis(b.f, direction * 10 * Math.PI / 180);
      draw();
      focusCanvas();
    }

    fovInput.addEventListener('input', e => setFov(e.target.value));
    fovSlider.addEventListener('input', e => setFov(e.target.value));
    magInput.addEventListener('input', e => setMag(e.target.value));
    magSlider.addEventListener('input', e => setMag(e.target.value));
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runMapSearch();
      }
    });

    $('#mapDso').addEventListener('change', e => {
      state.showDso = e.target.checked;
      draw();
      focusCanvas();
    });

    $('#mapCentre').addEventListener('click', () => {
      state.searchMarker = null;
      state.orient = localBasisFromForward(vecFromRaDec(0, 0));
      setFov(defaultFov());
      focusCanvas();
    });

    function zoomOnSelection(factor) {
      if (state.searchMarker && state.searchMarker.v) state.orient = localBasisFromForward(state.searchMarker.v);
      setFov(state.fov * factor);
      focusCanvas();
    }
    $('#mapZoomIn').addEventListener('click', () => zoomOnSelection(0.8));
    $('#mapZoomOut').addEventListener('click', () => zoomOnSelection(1.25));
    $('#mapRollCCW').addEventListener('click', () => rollFrame(-1));
    $('#mapRollCW').addEventListener('click', () => rollFrame(1));
    $('#mapClear').addEventListener('click', () => {
      state.message = '';
      state.searchMarker = null;
      msg.textContent = '';
      draw();
      focusCanvas();
    });

    document.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => {
      const [x, y] = btn.dataset.move.split(',').map(Number);
      move(x * Math.min(canvas.width, canvas.height) * 0.05, y * Math.min(canvas.width, canvas.height) * 0.05, 1);
      focusCanvas();
    }));

    let drag = null;
    let pinch = null;

    function pointerPosition(e) {
      return { id: e.pointerId, x: e.clientX, y: e.clientY };
    }

    const active = new Map();

    function pointerDistance() {
      const points = [...active.values()];
      if (points.length < 2) return null;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    canvas.addEventListener('pointerdown', e => {
      active.set(e.pointerId, pointerPosition(e));
      canvas.setPointerCapture(e.pointerId);
      focusCanvas();

      if (active.size === 1) drag = { start: pointerPosition(e), last: pointerPosition(e), moved: 0 };
      if (active.size >= 2) pinch = pointerDistance();
    });

    canvas.addEventListener('pointermove', e => {
      if (!active.has(e.pointerId)) return;
      const next = pointerPosition(e);
      active.set(e.pointerId, next);

      if (active.size >= 2) {
        const d = pointerDistance();
        if (d && pinch) setFov(state.fov * pinch / d);
        pinch = d;
        return;
      }

      if (!drag) return;
      const dx = next.x - drag.last.x;
      const dy = next.y - drag.last.y;
      drag.moved += Math.hypot(dx, dy);
      move(dx, dy, 0.9);
      drag.last = next;
    });

    function finishPointer(e) {
      const last = active.get(e.pointerId) || pointerPosition(e);
      active.delete(e.pointerId);

      if (drag && drag.start && drag.moved < 6) selectAt(last.x, last.y);

      drag = active.size === 1 ? { start: [...active.values()][0], last: [...active.values()][0], moved: 0 } : null;
      pinch = active.size >= 2 ? pointerDistance() : null;
    }

    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);
    canvas.addEventListener('lostpointercapture', finishPointer);

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        setFov(state.fov * Math.exp(e.deltaY * 0.002));
        return;
      }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.height : 1;
      move((e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit, (e.shiftKey ? 0 : e.deltaY) * unit, 0.45);
    }, { passive: false });

    canvas.addEventListener('keydown', e => {
      const step = e.shiftKey ? 28 : 12;
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { e.preventDefault(); move(-step, 0); }
      if (['ArrowRight', 'd', 'D'].includes(e.key)) { e.preventDefault(); move(step, 0); }
      if (['ArrowUp', 'w', 'W'].includes(e.key)) { e.preventDefault(); move(0, -step); }
      if (['ArrowDown', 's', 'S'].includes(e.key)) { e.preventDefault(); move(0, step); }
    });

    if (!state.loaded && !state.loading) {
      state.loading = true;
      Promise.all([loadSkyData(), loadConstellationBounds().catch(() => []), loadDsoCoordinateData().catch(() => new Map())]).then(() => {
        buildSkyDsoObjects();
        state.loaded = true;
        state.loading = false;
        populateMapSearchList();
        draw();
        focusCanvas();
      }).catch(() => {
        state.error = 'sky data unavailable';
        state.loading = false;
        draw();
      });
    }

    if (state.loaded) populateMapSearchList();
    draw();
    setTimeout(focusCanvas, 0);
  }

  function renderGuessConstellation() {
    const state = states.guessconst || (states.guessconst = {
      loaded: false,
      loading: false,
      error: '',
      mode: 1,
      targets: [],
      target: '',
      stars: [],
      rotation: 0,
      message: '',
      answered: false,
      autoCheck: false,
      magLimit: defaultMag()
    });

    if (!state.mode) state.mode = 1;
    if (!Array.isArray(state.targets)) state.targets = state.target ? [state.target] : [];
    state.mode = [1, 3, 5].includes(Number(state.mode)) ? Number(state.mode) : 1;
    if (typeof state.autoCheck !== 'boolean') state.autoCheck = false;

    const scoreId = () => state.mode === 1 ? 'guessconst' : `guessconst${state.mode}`;
    app.innerHTML = `<h2>Guess Constellation</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="guessConstCanvas" width="900" height="900" aria-label="single constellation star map"></canvas></section><aside class="panel"><div class="prompt">Which constellation${state.mode > 1 ? 's are these' : ' is this'}?</div><div class="guess-mode-row"><select id="guessConstMode" aria-label="guess constellation mode"><option value="1" ${state.mode === 1 ? 'selected' : ''}>1 constellation</option><option value="3" ${state.mode === 3 ? 'selected' : ''}>3 constellations</option><option value="5" ${state.mode === 5 ? 'selected' : ''}>5 constellations</option></select></div><label>Limiting magnitude<div class="slider-text-row"><input id="guessConstMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="guessConstMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><div class="controls"><button type="button" id="guessConstRollCCW">↺ rotate</button><button type="button" id="guessConstRollCW">rotate ↻</button></div>${state.mode > 1 ? `<label class="checkline"><input id="guessConstAuto" type="checkbox" ${state.autoCheck ? 'checked' : ''}><span>autocheck</span></label>` : ''}<div id="guessConstInputs" class="guess-const-inputs">${Array.from({ length: state.mode }, (_, i) => `<input class="guessConstAnswer" autocomplete="off" placeholder="constellation ${state.mode > 1 ? i + 1 : 'name'}">`).join('')}</div><div class="controls"><button type="button" id="guessConstReveal">reveal</button></div><div class="controls new-round-controls"><button type="button" id="guessConstNew" class="new-round-button">new constellation</button></div><div id="guessConstMsg" class="message">${state.message || ''}</div><div id="guessConstStats" class="stats">${formatScore(scoreId())}</div></aside></div>`;
    initRangeVisuals(app);

    const canvas = $('#guessConstCanvas'), ctx = canvas.getContext('2d');
    const msg = $('#guessConstMsg');
    const stats = $('#guessConstStats');

    function updateStats() {
      if (stats) stats.innerHTML = formatScore(scoreId());
    }

    function fallbackGuessGraph() {
      const graph = new Map(DATA.constellations.map(c => [c.name, new Set()]));
      DATA.constellations.forEach(c => {
        const info = DATA.constellationInfo[c.name] || {};
        (info.neighbours || []).forEach(n => {
          if (!graph.has(n) || n === c.name) return;
          graph.get(c.name).add(n);
          graph.get(n).add(c.name);
        });
      });
      return graph;
    }

    function guessConstellationGraph() {
      const graph = new Map(DATA.constellations.map(c => [c.name, new Set()]));
      if (!SKY_RACE_GRAPH) return fallbackGuessGraph();
      SKY_RACE_GRAPH.forEach((neighbours, rawName) => {
        const a = skyRaceBaseName(rawName);
        if (!graph.has(a)) return;
        neighbours.forEach(rawNeighbour => {
          const b = skyRaceBaseName(rawNeighbour);
          if (!graph.has(b) || a === b) return;
          graph.get(a).add(b);
          graph.get(b).add(a);
        });
      });
      const edgeCount = [...graph.values()].reduce((sum, ns) => sum + ns.size, 0) / 2;
      return edgeCount ? graph : fallbackGuessGraph();
    }

    function connectedConstellationSet(count) {
      if (count <= 1) return [rand(DATA.constellations).name];
      const graph = guessConstellationGraph();
      const names = [...graph.entries()].filter(([, ns]) => ns.size).map(([name]) => name);

      // Prefer an actual bordering path: A borders B, B borders C, etc.
      for (let attempt = 0; attempt < 1200; attempt++) {
        const chosen = [rand(names)];
        while (chosen.length < count) {
          const here = chosen[chosen.length - 1];
          const options = [...(graph.get(here) || [])].filter(n => !chosen.includes(n));
          if (!options.length) break;
          chosen.push(rand(options));
        }
        if (chosen.length === count) return chosen;
      }

      // Last-resort connected component growth, still never disconnected.
      for (let attempt = 0; attempt < 300; attempt++) {
        const chosen = [rand(names)];
        while (chosen.length < count) {
          const frontier = [...new Set(chosen.flatMap(n => [...(graph.get(n) || [])]).filter(n => !chosen.includes(n)))];
          if (!frontier.length) break;
          chosen.push(rand(frontier));
        }
        if (chosen.length === count) return chosen;
      }

      return DATA.constellations.slice(0, count).map(c => c.name);
    }

    function starsInConstellations(names) {
      return uniqueSkyStars(names.flatMap(name => guessStarsForConstellation(name, state.magLimit)));
    }

    function chooseQuestion() {
      state.targets = connectedConstellationSet(state.mode);
      state.target = state.targets[0] || '';
      state.stars = starsInConstellations(state.targets);
      state.rotation = Math.random() * Math.PI * 2;
      state.message = '';
      state.answered = false;
    }

    let drawnGuessStars = [];
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      if (!state.loaded) {
        ctx.fillStyle = 'black';
        ctx.font = '20px Arial';
        ctx.fillText(state.error || 'loading constellation...', 24, 40);
        return;
      }
      if (!state.targets.length || state.targets.length !== state.mode) chooseQuestion();
      drawnGuessStars = drawConstellationStarMap(canvas, state.target || state.targets[0], { magLimit: state.magLimit, rotation: state.rotation, stars: state.stars });
    }

    function selectGuessStar(clientX, clientY) {
      if (!state.answered) return;
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * canvas.width / rect.width;
      const y = (clientY - rect.top) * canvas.height / rect.height;
      const hit = drawnGuessStars.map(p => ({ p, d: Math.hypot(p.x - x, p.y - y) })).filter(x => x.d <= x.p.r).sort((a, b) => a.d - b.d)[0]?.p;
      if (!hit) return;
      msg.innerHTML = `${state.targets.join(', ')}<br>${starInfoHtml(hit.star)}`;
    }
    canvas.addEventListener('click', e => selectGuessStar(e.clientX, e.clientY));

    function clearInputs() {
      document.querySelectorAll('.guessConstAnswer').forEach(input => input.value = '');
    }

    function targetMatches(value, target) {
      return answerMatches(value, [target]);
    }

    function matchedTargets() {
      const used = new Set();
      document.querySelectorAll('.guessConstAnswer').forEach(input => {
        const value = input.value.trim();
        if (!value) return;
        const match = state.targets.find(t => !used.has(t) && targetMatches(value, t));
        if (match) used.add(match);
      });
      return [...used];
    }

    function allInputsFilled() {
      return [...document.querySelectorAll('.guessConstAnswer')].every(input => input.value.trim());
    }

    function checkAnswers() {
      if (!state.targets.length || state.answered) return;
      const matched = matchedTargets();
      if (state.mode > 1 && state.autoCheck) {
        state.message = matched.length ? `${matched.length}/${state.mode} correct: ${matched.join(', ')}` : '';
        msg.textContent = state.message;
      }
      if (matched.length === state.mode && (state.mode === 1 || allInputsFilled())) {
        state.answered = true;
        record(scoreId(), true);
        state.message = state.mode === 1 ? `correct: ${state.targets[0]}` : `correct: ${state.targets.join(', ')}`;
        msg.textContent = state.message;
        updateStats();
      }
    }

    function newQuestion() {
      if (!state.loaded) return;
      chooseQuestion();
      clearInputs();
      renderGuessConstellation();
    }

    function reveal() {
      if (!state.targets.length || state.answered) return;
      state.answered = true;
      record(scoreId(), false);
      state.message = `answer: ${state.targets.join(', ')}`;
      msg.textContent = state.message;
      updateStats();
    }

    function setGuessMag(value) {
      state.magLimit = Math.max(4, Math.min(6, parseFloat(value) || defaultMag()));
      state.magLimit = Math.round(state.magLimit * 10) / 10;
      const mag = $('#guessConstMag');
      const slider = $('#guessConstMagSlider');
      if (mag) mag.value = state.magLimit.toFixed(1);
      if (slider) { slider.value = state.magLimit.toFixed(1); updateRangeVisual(slider); }
      if (state.loaded && state.targets.length) {
        state.stars = starsInConstellations(state.targets);
        draw();
      }
    }

    function rotateGuess(direction) {
      state.rotation += direction * 10 * Math.PI / 180;
      draw();
    }

    $('#guessConstMode').addEventListener('change', e => {
      state.mode = Number(e.target.value);
      state.autoCheck = false;
      state.targets = [];
      state.target = '';
      state.message = '';
      state.answered = false;
      renderGuessConstellation();
    });
    $('#guessConstMag').addEventListener('input', e => setGuessMag(e.target.value));
    $('#guessConstMagSlider').addEventListener('input', e => setGuessMag(e.target.value));
    $('#guessConstRollCCW').addEventListener('click', () => rotateGuess(-1));
    $('#guessConstRollCW').addEventListener('click', () => rotateGuess(1));
    if ($('#guessConstAuto')) $('#guessConstAuto').addEventListener('change', e => {
      state.autoCheck = e.target.checked;
      if (state.autoCheck) checkAnswers();
      else if (!state.answered) { state.message = ''; msg.textContent = ''; }
    });
    document.querySelectorAll('.guessConstAnswer').forEach((input, index, inputs) => {
      input.addEventListener('input', checkAnswers);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          newQuestion();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const next = inputs[index + 1];
          if (next) next.focus();
        }
      });
    });
    $('#guessConstReveal').addEventListener('click', reveal);
    $('#guessConstNew').addEventListener('click', newQuestion);
    setShiftEnterAction(newQuestion);

    if (!state.loaded && !state.loading) {
      state.loading = true;
      Promise.all([loadSkyData(), loadConstellationBounds().catch(() => []), ensureSkyRaceGraph()]).then(() => {
        state.loaded = true;
        state.loading = false;
        chooseQuestion();
        renderGuessConstellation();
      }).catch(err => {
        state.error = 'sky data unavailable';
        state.loading = false;
        draw();
      });
    }
    draw();
    setTimeout(() => {
      const first = document.querySelector('.guessConstAnswer');
      if (first) first.focus();
    }, 0);
  }

  function renderAlphaPin() {
    const state = states.alphapin || (states.alphapin = { loaded: false, loading: false, error: '', fov: defaultFov(), magLimit: defaultMag(), target: null, selectedVec: null, result: '', submitted: false, orient: null });
    app.innerHTML = `<h2>Find Constellation</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="alphaCanvas" width="900" height="900" tabindex="0" aria-label="alpha star guessing sphere"></canvas></section><aside class="panel"><div class="prompt">Find&nbsp;<strong>${esc(state.target ? state.target.constellation : '...')}</strong>.</div><label>FOV degrees<div class="slider-text-row"><input id="alphaFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="alphaFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="alphaMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="alphaMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><div class="sky-nav-grid" aria-label="alpha movement controls"><button type="button" data-amove="-1,-1">↖</button><button type="button" data-amove="0,-1">↑</button><button type="button" data-amove="1,-1">↗</button><button type="button" data-amove="-1,0">←</button><button type="button" id="alphaCentre">○</button><button type="button" data-amove="1,0">→</button><button type="button" data-amove="-1,1">↙</button><button type="button" data-amove="0,1">↓</button><button type="button" data-amove="1,1">↘</button></div><div class="controls"><button type="button" id="alphaRollCCW">↺ rotate</button><button type="button" id="alphaRollCW">rotate ↻</button></div><div class="controls"><button type="button" id="alphaSubmit">submit</button><button type="button" id="alphaZoomIn">zoom in</button><button type="button" id="alphaZoomOut">zoom out</button></div><div class="controls new-round-controls"><button type="button" id="alphaNew" class="new-round-button">new constellation</button></div><div id="alphaMsg" class="message">${esc(state.result || '')}</div><div class="stats">${formatPointScore('alphapin')}</div><div class="small alpha-pin-hint">(pin the alpha star)</div></aside></div>`;
    initRangeVisuals(app);
    setupSphereFullscreen();
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
      state.fov = defaultFov();
      state.magLimit = defaultMag();
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
      state.magLimit = Math.max(4, Math.min(6, parseFloat(v) || defaultMag()));
      const value = Number(state.magLimit.toFixed(1));
      $('#alphaMag').value = value;
      $('#alphaMagSlider').value = value;
      updateRangeVisual($('#alphaMagSlider'));
      draw();
    }
    $('#alphaFov').addEventListener('input', e => setFov(parseFloat(e.target.value) || defaultFov()));
    $('#alphaFovSlider').addEventListener('input', e => setFov(parseFloat(e.target.value) || defaultFov()));
    $('#alphaMag').addEventListener('input', e => setAlphaMag(e.target.value));
    $('#alphaMagSlider').addEventListener('input', e => setAlphaMag(e.target.value));
    $('#alphaSubmit').addEventListener('click', submitGuess);
    $('#alphaZoomIn').addEventListener('click', () => zoomAlpha(-10));
    $('#alphaZoomOut').addEventListener('click', () => zoomAlpha(10));
    $('#alphaNew').addEventListener('click', newTarget);
    setShiftEnterAction(newTarget);
    $('#alphaCentre').addEventListener('click', () => { state.orient = makeBasisFromForward(vecFromRaDec(0, 0)); setFov(defaultFov()); focusCanvas(); });
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
      if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); e.stopPropagation(); newTarget(); }
      else if (e.key === 'Enter') { e.preventDefault(); submitGuess(); }
    });
    if (!state.loaded && !state.loading) {
      state.loading = true;
      loadSkyData().then(() => { state.loaded = true; state.loading = false; skyAlphaCache = null; ensureTarget(); renderAlphaPin(); }).catch(err => { state.error = 'sky data unavailable'; state.loading = false; draw(); });
    }
    ensureTarget(); draw(); setTimeout(() => canvas.focus(), 0);
  }

  function renderSkyRegions() {
    const state = states.skyregions || (states.skyregions = { loaded: false, loading: false, error: '', fov: defaultFov(), message: '', selected: '', showBoundaries: true, showStars: true, magLimit: defaultMag(), orient: null });
    app.innerHTML = `<h2>Constellation Map</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="regionCanvas" width="900" height="900" tabindex="0" aria-label="constellation region sphere"></canvas></section><aside class="panel"><label>FOV degrees<div class="slider-text-row"><input id="regionFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="regionFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label class="checkline"><input id="regionBounds" type="checkbox" ${state.showBoundaries !== false ? "checked" : ""}><span>boundaries</span></label><label class="checkline"><input id="regionStars" type="checkbox" ${state.showStars !== false ? "checked" : ""}><span>stars</span></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="regionMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="regionMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><label>Search constellation<input id="regionSearch" list="regionSearchList" autocomplete="off" placeholder="full constellation name"></label><datalist id="regionSearchList">${DATA.constellations.map(c => `<option value="${esc(c.name)}"></option>`).join('')}</datalist><div class="controls"><button type="button" id="regionSearchBtn">search</button></div><div class="sky-nav-grid" aria-label="region movement controls"><button type="button" data-rmove="-1,-1">↖</button><button type="button" data-rmove="0,-1">↑</button><button type="button" data-rmove="1,-1">↗</button><button type="button" data-rmove="-1,0">←</button><button type="button" id="regionReset">○</button><button type="button" data-rmove="1,0">→</button><button type="button" data-rmove="-1,1">↙</button><button type="button" data-rmove="0,1">↓</button><button type="button" data-rmove="1,1">↘</button></div><div class="controls"><button type="button" id="regionRollCCW">↺ rotate</button><button type="button" id="regionRollCW">rotate ↻</button><button type="button" id="regionClear">deselect</button></div><div id="regionMsg" class="message">${state.message || ''} </div></aside></div>`;
    initRangeVisuals(app);
    setupSphereFullscreen();
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
      setFov(defaultFov());
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
      state.magLimit = Math.max(4, Math.min(6, parseFloat(v) || defaultMag()));
      const value = Number(state.magLimit.toFixed(1));
      $('#regionMag').value = value;
      $('#regionMagSlider').value = value;
      updateRangeVisual($('#regionMagSlider'));
      draw();
    }
    fovInput.addEventListener('input', e => setFov(parseFloat(e.target.value) || defaultFov()));
    fovSlider.addEventListener('input', e => setFov(parseFloat(e.target.value) || defaultFov()));
    boundsInput.addEventListener('change', e => { state.showBoundaries = e.target.checked; draw(); });
    $('#regionStars').addEventListener('change', e => { state.showStars = e.target.checked; draw(); });
    $('#regionMag').addEventListener('input', e => setRegionMag(e.target.value));
    $('#regionMagSlider').addEventListener('input', e => setRegionMag(e.target.value));
    $('#regionSearchBtn').addEventListener('click', runRegionSearch);
    $('#regionSearch').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runRegionSearch(); } });
    $('#regionReset').addEventListener('click', () => { state.orient = makeBasisFromForward(vecFromRaDec(0, 0)); setFov(defaultFov()); focusCanvas(); });
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

  function skyRaceEmptyGraph() {
    const names = new Set(DATA.constellations.map(c => c.name).filter(name => name !== 'Serpens'));
    names.add(SERPENS_CAPUT);
    names.add(SERPENS_CAUDA);
    return new Map([...names].map(name => [name, new Set()]));
  }
  function skyRaceAddEdge(graph, a, b) {
    if (!graph.has(a) || !graph.has(b) || a === b) return;
    graph.get(a).add(b);
    graph.get(b).add(a);
  }
  function skyRaceCoordKey(coord) {
    const lon = Math.round(raToLon180(coord[0]) * 100000) / 100000;
    const lat = Math.round(Number(coord[1]) * 100000) / 100000;
    return `${lon},${lat}`;
  }
  function skyRaceSegmentKey(a, b) {
    const ka = skyRaceCoordKey(a), kb = skyRaceCoordKey(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  }
  function skyRaceFallbackGraph() {
    const graph = skyRaceEmptyGraph();
    DATA.constellations.forEach(c => {
      if (c.name === 'Serpens') return;
      const info = DATA.constellationInfo[c.name] || {};
      (info.neighbours || []).forEach(n => {
        if (n === 'Serpens') return;
        skyRaceAddEdge(graph, c.name, n);
      });
    });
    SERPENS_CAPUT_BORDERS.forEach(n => skyRaceAddEdge(graph, SERPENS_CAPUT, n));
    SERPENS_CAUDA_BORDERS.forEach(n => skyRaceAddEdge(graph, SERPENS_CAUDA, n));
    return graph;
  }
  function skyRaceGraphFromBounds(features) {
    const graph = skyRaceEmptyGraph();
    const bySegment = new Map();

    (features || []).forEach(feature => {
      const name = feature.name;
      if (!graph.has(name)) return;
      feature.rings.forEach(poly => {
        poly.forEach(ring => {
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i], b = ring[(i + 1) % ring.length];
            if (!a || !b || (a[0] === b[0] && a[1] === b[1])) continue;
            const key = skyRaceSegmentKey(a, b);
            if (!bySegment.has(key)) bySegment.set(key, new Set());
            bySegment.get(key).add(name);
          }
        });
      });
    });

    bySegment.forEach(names => {
      const arr = [...names].filter(name => graph.has(name));
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) skyRaceAddEdge(graph, arr[i], arr[j]);
      }
    });

    SERPENS_CAPUT_BORDERS.forEach(n => skyRaceAddEdge(graph, SERPENS_CAPUT, n));
    SERPENS_CAUDA_BORDERS.forEach(n => skyRaceAddEdge(graph, SERPENS_CAUDA, n));

    const edgeCount = [...graph.values()].reduce((sum, ns) => sum + ns.size, 0) / 2;
    return edgeCount > 150 ? graph : skyRaceFallbackGraph();
  }
  let SKY_RACE_GRAPH = null;
  let skyRaceGraphPromise = null;
  function ensureSkyRaceGraph() {
    if (SKY_RACE_GRAPH) return Promise.resolve(SKY_RACE_GRAPH);
    if (!skyRaceGraphPromise) {
      skyRaceGraphPromise = loadConstellationBounds()
        .then(features => {
          SKY_RACE_GRAPH = skyRaceGraphFromBounds(features);
          return SKY_RACE_GRAPH;
        })
        .catch(() => {
          SKY_RACE_GRAPH = skyRaceFallbackGraph();
          return SKY_RACE_GRAPH;
        });
    }
    return skyRaceGraphPromise;
  }

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
    if (!SKY_RACE_GRAPH) {
      app.innerHTML = '<h2>SkyRace</h2><section class="panel"><p>loading borders...</p></section>';
      ensureSkyRaceGraph().then(() => renderSkyRace());
      return;
    }
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
      app.innerHTML = `<h2>SkyRace</h2><div class="sky-race-layout"><aside class="panel"><p class="sky-race-task"><strong>${esc(state.start)} → ${esc(state.target)}</strong></p><p><strong>current:</strong> ${esc(state.current)}</p><p><strong>clicks:</strong> ${Math.max(0, state.route.length - 1)}</p>${splitNote}<h3>Bordering constellations</h3><div id="skyRaceBorders" class="sky-race-neighbours">${ns.map(n => `<button type="button" class="linkbtn ${n === state.target ? 'sky-race-target-option' : ''}" data-race-border="${esc(n)}">${esc(n)}</button>`).join(' ')}</div><div class="message">${state.message || ''}</div><div class="controls new-round-controls"><button type="button" id="skyRaceNew" class="new-round-button">new race</button></div><h3>Route</h3><p class="small">${routeText}</p><div class="stats">${formatPointScore('skyrace')}</div></aside><section class="panel"><h3>${esc(state.current)}</h3>${currentChart()}</section></div>`;
      $('#skyRaceNew').addEventListener('click', newRace);
      setShiftEnterAction(newRace);
      document.querySelectorAll('[data-race-border]').forEach(btn => btn.addEventListener('click', () => jump(btn.dataset.raceBorder)));
    }
    draw();
  }

  function renderTables() {
    const state = states.tables || (states.tables = { mode: 'constellations', sort: {}, dsoFilters: { messier: true, caldwell: true } });
    if (!state.sort) state.sort = {};
    if (!state.dsoFilters) state.dsoFilters = { messier: true, caldwell: true }; delete state.dsoFilters.unnamed;
    const tableModes = [
      { id: 'constellations', label: 'constellations' },
      { id: 'stars', label: 'stars' },
      { id: 'dso', label: 'DSOs' },
      { id: 'asterisms', label: 'asterisms' }
    ];
    app.innerHTML = `<h2>Tables</h2><div class="table-tabs">${tableModes.map(m => `<button type="button" class="${m.id === state.mode ? 'active' : ''}" data-table-mode="${m.id}">${m.label}</button>`).join('')}</div><input id="tableSearch" placeholder="search"><div id="tableOptions" class="table-options"></div><div id="tableWrap" class="table-wrap"></div>`;
    const search = $('#tableSearch'), options = $('#tableOptions'), wrap = $('#tableWrap');

    function alphaSortGroup(value) {
      const s = String(value || '').trim();
      if (!s) return 2;
      return /^[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s) ? 0 : 1;
    }
    function naturalCompare(a, b) {
      const ga = alphaSortGroup(a), gb = alphaSortGroup(b);
      if (ga !== gb) return ga - gb;
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
    function compareValues(a, b, kind, dir = 'asc') {
      if (kind === 'dsoCode') return (dir === 'desc' ? -1 : 1) * dsoCodeCompare(a, b);
      const ga = alphaSortGroup(a), gb = alphaSortGroup(b);
      if (ga !== gb) return ga - gb;
      const base = String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
      return (dir === 'desc' ? -1 : 1) * base;
    }
    function dsoKind(code) {
      const c = compact(code);
      if (c.startsWith('m')) return 'messier';
      if (c.startsWith('c') || c.startsWith('caldwell')) return 'caldwell';
      return 'other';
    }
    function passesDsoFilters(o) {
      const kind = dsoKind(o.code);
      if (kind === 'messier' && !state.dsoFilters.messier) return false;
      if (kind === 'caldwell' && !state.dsoFilters.caldwell) return false;
      return true;
    }
    function renderTableOptions() {
      if (state.mode !== 'dso') {
        options.innerHTML = '';
        return;
      }
      options.innerHTML = `<label class="checkline"><input type="checkbox" data-dso-filter="messier" ${state.dsoFilters.messier ? 'checked' : ''}><span>Messier</span></label><label class="checkline"><input type="checkbox" data-dso-filter="caldwell" ${state.dsoFilters.caldwell ? 'checked' : ''}><span>Caldwell</span></label>`;
      options.querySelectorAll('[data-dso-filter]').forEach(box => box.addEventListener('change', () => {
        state.dsoFilters[box.dataset.dsoFilter] = box.checked;
        redraw();
      }));
    }

    function table(columns, rows) {
      const q = norm(search.value);
      let filtered = rows.filter(r => !q || norm(r.join(' ')).includes(q));
      const sort = state.sort[state.mode];
      if (sort && columns[sort.index] && columns[sort.index].sortable) {
        const col = columns[sort.index];
        filtered = filtered.slice().sort((a, b) => compareValues(a[sort.index], b[sort.index], col.sortType, sort.dir));
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
      renderTableOptions();
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
        ], DATA.dso.filter(passesDsoFilters).map(o => [o.code, o.commonName, o.type, o.constellation]));
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
    setShiftEnterAction(null);
    if (activeGame === 'charts') makeQuestionGame('charts', 'Charts', { make: chartQuestion });
    else if (activeGame === 'skyguessr') renderSkyGuessr();
    else if (activeGame === 'skymap') renderSkyMap();
    else if (activeGame === 'skyregions') renderSkyRegions();
    else if (activeGame === 'skyrace') renderSkyRace();
    else if (activeGame === 'alphapin') renderAlphaPin();
    else if (activeGame === 'guessconst') renderGuessConstellation();
    else if (activeGame === 'neighbours') makeQuestionGame('neighbours', 'Neighbours', { make: neighbourQuestion });
    else if (activeGame === 'stars') makeQuestionGame('stars', 'Stars', { modes: starModes, defaultMode: 'starToConstellation', make: starQuestion });
    else if (activeGame === 'dso') makeQuestionGame('dso', 'DSOs', { modes: dsoModes, defaultMode: 'codeToName', make: dsoQuestion });
    else if (activeGame === 'timer') renderTimer();
    else if (activeGame === 'atlas') renderAtlas();
    else if (activeGame === 'tables') renderTables();
  }
  setupTabs(); render();
})();
