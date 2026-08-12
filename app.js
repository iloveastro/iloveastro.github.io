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

  const LOADING_WORD_FRAMES = window.__iloveastroLoadingFrames || [
    'i', 'il', 'ilo', 'ilov', 'ilove', 'ilovea', 'iloveas', 'iloveast', 'iloveastr', 'iloveastro',
    'loveastro', 'oveastro', 'veastro', 'eastro', 'astro', 'stro', 'tro', 'ro', 'o'
  ];
  let loadingOverlayTimer = null;

  function stopLaunchLoader() {
    if (window.__iloveastroLaunchLoader) {
      clearInterval(window.__iloveastroLaunchLoader);
      window.__iloveastroLaunchLoader = null;
    }
  }

  function ensureLoadingOverlay() {
    const appRoot = document.getElementById('app') || document.body;
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('section');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="loading-card"><div class="loading-word" aria-live="polite"></div><div class="loading-note">loading...</div></div>`;
      appRoot.append(overlay);
    } else if (overlay.parentElement !== appRoot && appRoot !== document.body) {
      appRoot.append(overlay);
    }
    return overlay;
  }

  function showLoadingOverlay(label = '') {
    stopLaunchLoader();
    const overlay = ensureLoadingOverlay();
    delete overlay.dataset.launch;
    const note = overlay.querySelector('.loading-note');
    if (note) note.textContent = 'loading...';
    const word = overlay.querySelector('.loading-word');
    if (loadingOverlayTimer) clearInterval(loadingOverlayTimer);
    let i = 0;
    if (word) word.textContent = LOADING_WORD_FRAMES[i];
    loadingOverlayTimer = setInterval(() => {
      const current = document.getElementById('loadingOverlay');
      const currentWord = current ? current.querySelector('.loading-word') : null;
      if (!currentWord) return;
      i = (i + 1) % LOADING_WORD_FRAMES.length;
      currentWord.textContent = LOADING_WORD_FRAMES[i];
    }, window.__iloveastroLoaderMs || 70);
  }

  function hideLoadingOverlay() {
    stopLaunchLoader();
    if (loadingOverlayTimer) {
      clearInterval(loadingOverlayTimer);
      loadingOverlayTimer = null;
    }
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
  }

  function hideLaunchLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay || !overlay.dataset.launch) return;
    const started = window.__iloveastroLaunchStartedAt || Date.now();
    const minMs = window.__iloveastroMinLaunchMs || (LOADING_WORD_FRAMES.length * (window.__iloveastroLoaderMs || 70));
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, minMs - elapsed);
    const removeLaunch = () => {
      const later = document.getElementById('loadingOverlay');
      if (later && later.dataset.launch) hideLoadingOverlay();
      launchState.active = false;
    };
    if (remaining) setTimeout(removeLaunch, remaining);
    else removeLaunch();
  }

  window.addEventListener('error', () => hideLaunchLoadingOverlay());
  window.addEventListener('unhandledrejection', () => hideLaunchLoadingOverlay());

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

  function answerMatches(input, answers) {
    const n = norm(input), c = compact(input);
    if (!n) return false;
    return answers.some(a => norm(a) === n || compact(a) === c);
  }
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];
  const byConstellation = (items, key = 'constellation') => {
    const m = new Map();
    items.forEach(item => { if (!m.has(item[key])) m.set(item[key], []); m.get(item[key]).push(item); });
    return m;
  };
  const starByConst = byConstellation(DATA.stars);
  let namedStarCatalogueReady = false;
  let namedStarCataloguePromise = null;
  function sortStarCatalogueRows(a, b) {
    const ca = String(a.constellation || ''), cb = String(b.constellation || '');
    if (ca !== cb) return ca.localeCompare(cb);
    const ma = Number.isFinite(a.mag) ? a.mag : 99;
    const mb = Number.isFinite(b.mag) ? b.mag : 99;
    if (ma !== mb) return ma - mb;
    return String(a.name || '').localeCompare(String(b.name || ''));
  }
  function addStarToConstellationMap(star) {
    if (!starByConst.has(star.constellation)) starByConst.set(star.constellation, []);
    const arr = starByConst.get(star.constellation);
    if (!arr.some(s => compact(s.name) === compact(star.name))) {
      arr.push(star);
      arr.sort(sortStarCatalogueRows);
    }
  }
  function addStarToConstellationInfo(star) {
    const info = DATA.constellationInfo[star.constellation];
    if (!info || !Array.isArray(info.stars)) return;
    if (!info.stars.some(s => compact(s.name) === compact(star.name))) {
      info.stars.push(star);
      info.stars.sort(sortStarCatalogueRows);
    }
  }
  function namedStarDesignationFromSky(star) {
    return starDesignation(star) || String(star.bf || star.bayer || '').trim();
  }
  function isNormalNamedStarName(name) {
    const s = String(name || '').trim();
    if (!s) return false;
    if (/\d/.test(s)) return false;
    if (/\bG\.?\b/i.test(s)) return false;
    if (/\bGroombridge\b/i.test(s)) return false;
    if (/^[a-z]\s+[A-Z][a-z]+/i.test(s)) return false;
    return /[A-Za-z]/.test(s);
  }
  function addStarAliasName(entry, alias) {
    const value = String(alias || '').trim();
    if (!entry || !value) return;
    if (compact(value) === compact(entry.name)) return;
    if (!Array.isArray(entry.accepted)) entry.accepted = [entry.name, entry.designation].filter(Boolean);
    if (!entry.accepted.some(x => compact(x) === compact(value))) entry.accepted.push(value);
  }
  function attachSkyStarIdentity(entry, star) {
    if (!entry || !star) return;
    entry.skyHip = Number.isFinite(star.hip) ? star.hip : null;
    entry.skyRa = Number.isFinite(star.ra) ? star.ra : null;
    entry.skyDec = Number.isFinite(star.dec) ? star.dec : null;
    entry.skyMag = Number.isFinite(star.mag) ? star.mag : null;
    entry.skySpect = String(star.spect || '').trim();
    entry.skyAbsMag = Number.isFinite(star.absmag) ? star.absmag : null;
    entry.skyDist = Number.isFinite(star.dist) ? star.dist : null;
    entry.skyCi = Number.isFinite(star.ci) ? star.ci : null;
    entry.skyHd = String(star.hd || '').trim();
    entry.skyHr = String(star.hr || '').trim();
    entry.skyBayer = String(star.bayer || '').trim();
    entry.skyBf = String(star.bf || '').trim();
  }
  function addNamedStarCatalogueEntry(star) {
    const name = String(star.name || '').trim();
    if (!name || !star.constellation) return false;
    const nameKey = compact(name);
    const constKey = compact(star.constellation);
    const group = starCommonNameGroup(star);
    const sameName = DATA.stars.filter(s => compact(s.name) === nameKey);
    const samePhysical = group ? DATA.stars.find(s => starCommonNameGroup(s)?.key === group.key) : null;
    if (samePhysical) {
      attachSkyStarIdentity(samePhysical, star);
      addStarAliasName(samePhysical, name);
      (group.names || []).forEach(alias => addStarAliasName(samePhysical, alias));
      if (!Number.isFinite(samePhysical.mag) && Number.isFinite(star.mag)) samePhysical.mag = star.mag;
      if (!samePhysical.designation) samePhysical.designation = namedStarDesignationFromSky(star);
      addStarToConstellationMap(samePhysical);
      addStarToConstellationInfo(samePhysical);
      return false;
    }
    const existing = sameName.find(s => compact(s.constellation) === constKey);
    if (existing) {
      attachSkyStarIdentity(existing, star);
      if (group) (group.names || []).forEach(alias => addStarAliasName(existing, alias));
      if (!Number.isFinite(existing.mag) && Number.isFinite(star.mag)) existing.mag = star.mag;
      if (!existing.designation) existing.designation = namedStarDesignationFromSky(star);
      addStarToConstellationMap(existing);
      addStarToConstellationInfo(existing);
      return false;
    }
    if (sameName.length) {
      // Avoid ambiguous one-word duplicate proper names across constellations.
      // Example: HYG has Gienah in Cygnus, while the curated list uses Gienah for Gamma Corvi.
      // Creating both would make typing/flashcard prompts ambiguous.
      return false;
    }
    const entry = {
      name,
      designation: namedStarDesignationFromSky(star),
      constellation: star.constellation,
      note: `catalogued common/proper star name${Number.isFinite(star.mag) ? `; mag ${star.mag.toFixed(2)}` : ''}`,
      mag: Number.isFinite(star.mag) ? star.mag : undefined,
      generated: true
    };
    attachSkyStarIdentity(entry, star);
    if (group) (group.names || []).forEach(alias => addStarAliasName(entry, alias));
    DATA.stars.push(entry);
    addStarToConstellationMap(entry);
    addStarToConstellationInfo(entry);
    return true;
  }

  function augmentNamedStarCatalogueFromSky() {
    if (namedStarCatalogueReady) return;
    skyStars.filter(star => isNormalNamedStarName(star.name)).forEach(addNamedStarCatalogueEntry);
    DATA.stars.sort(sortStarCatalogueRows);
    namedStarCatalogueReady = true;
  }
  function ensureNamedStarCatalogue() {
    if (namedStarCatalogueReady) return Promise.resolve();
    if (namedStarCataloguePromise) return namedStarCataloguePromise;
    namedStarCataloguePromise = loadSkyData().then(() => {
      augmentNamedStarCatalogueFromSky();
    });
    return namedStarCataloguePromise;
  }
  function deferForNamedStars(title, thenRender) {
    app.innerHTML = `<h2>${esc(title)}</h2><section class="panel"><p>loading common-name star catalogue...</p></section>`;
    showLoadingOverlay('loading common-name stars');
    ensureNamedStarCatalogue()
      .then(() => { hideLoadingOverlay(); thenRender(); })
      .catch(() => { hideLoadingOverlay(); app.innerHTML = `<h2>${esc(title)}</h2><section class="panel"><p>could not load the extended star catalogue.</p></section>`; });
  }
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
  function encodeUtf8Base64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }
  function decodeUtf8Base64(text) {
    return decodeURIComponent(escape(atob(text)));
  }
  function progressExportText() {
    const payload = {
      version: 2,
      slot: activeSave,
      progress: loadProgress(activeSave)
    };
    return `iloveastro-save-v2:${encodeUtf8Base64(JSON.stringify(payload))}`;
  }
  function progressImportText(raw) {
    const text = String(raw || '').trim();
    if (!text) throw new Error('empty import');
    let payload = null;
    if (text.startsWith('iloveastro-save-v2:')) {
      payload = JSON.parse(decodeUtf8Base64(text.slice('iloveastro-save-v2:'.length)));
      if (!payload || typeof payload !== 'object' || !payload.progress || typeof payload.progress !== 'object') throw new Error('invalid import');
      progress = payload.progress;
    } else if (text.startsWith('iloveastro-progress-v1:')) {
      payload = JSON.parse(decodeUtf8Base64(text.slice('iloveastro-progress-v1:'.length)));
      if (!payload || typeof payload !== 'object' || !payload.slots || typeof payload.slots !== 'object') throw new Error('invalid import');
      const importedSlot = SAVE_SLOTS.includes(payload.activeSave) ? payload.activeSave : activeSave;
      const value = payload.slots[importedSlot];
      progress = value && typeof value === 'object' ? value : {};
    } else {
      payload = JSON.parse(text);
      if (payload && typeof payload === 'object' && payload.progress && typeof payload.progress === 'object') progress = payload.progress;
      else if (payload && typeof payload === 'object') progress = payload;
      else throw new Error('invalid import');
    }
    saveProgress();
    return true;
  }
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
    { id: 'skyguessr', title: 'SkyGuessr' },
    { id: 'skyrace', title: 'SkyRace' },
    { id: 'skymap', title: 'Sky Map' },
    { id: 'skyregions', title: 'Constellation Map' },
    { id: 'alphapin', title: 'Find Constellation' },
    { id: 'guessconst', title: 'Guess Constellation' },
    { id: 'stars', title: 'Stars' },
    { id: 'dso', title: 'DSOs' },
    { id: 'timer', title: '88 Timer' },
    { id: 'atlas', title: 'Atlas' },
    { id: 'tables', title: 'Tables' },
    { id: 'misc', title: 'Misc' }
  ];

  let activeGame = 'skyguessr';
  const launchState = { active: !!document.querySelector('#loadingOverlay[data-launch]') };
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
  function cleanupTransientGameState() {
    ['starChallenge', 'dsoChallenge'].forEach(key => {
      const state = states[key];
      if (state && state.blinkTimer) {
        clearInterval(state.blinkTimer);
        state.blinkTimer = null;
        state.blinkOn = true;
      }
    });
    const analemmaState = states.analemma;
    if (analemmaState && analemmaState.timer) {
      clearInterval(analemmaState.timer);
      analemmaState.timer = null;
    }
  }
  function switchGame(id) {
    cleanupTransientGameState();
    sphereFullscreenActive = false;
    activeGame = id;
    setupTabs();
    if (!launchState.active) render();
  }

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

    const backupText = $('#scoreBackupText');
    const backupMsg = $('#scoreBackupMsg');
    const exportButton = $('#scoreExport');
    const importButton = $('#scoreImport');
    if (exportButton && backupText) exportButton.addEventListener('click', () => {
      backupText.value = progressExportText();
      backupText.select();
      if (backupMsg) backupMsg.textContent = `exported save ${activeSave}`;
    });
    if (importButton && backupText) importButton.addEventListener('click', () => {
      if (!confirm(`Are you sure you want to import into save ${activeSave}? This overrides the current save.`)) return;
      try {
        progressImportText(backupText.value);
        if (backupMsg) backupMsg.textContent = `imported into save ${activeSave}`;
        setupSaveMenu();
        render();
      } catch (err) {
        if (backupMsg) backupMsg.textContent = 'import failed';
      }
    });

    $('#resetProgress').addEventListener('click', clearCurrentSave);
    $('#clearAllSaves').addEventListener('click', clearAllSaves);
    document.addEventListener('click', e => {
      if (!saveMenu.hidden && !e.target.closest('.save-menu')) closeSaveMenu();
    });
    setupSaveMenu();
  }


  let timerState = states.timer || (states.timer = { running: false, seconds: 0, interval: null, found: new Set(), next: () => {}, hintName: null, hintLength: 0, disqualified: false });
  if (!timerState.found) timerState.found = new Set();
  if (!('hintName' in timerState)) timerState.hintName = null;
  if (!('hintLength' in timerState)) timerState.hintLength = 0;
  if (!('disqualified' in timerState)) timerState.disqualified = false;
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
    if (timerState.running || timerState.found.size || timerState.disqualified || !norm(raw)) return;
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
    clearInterval(timerState.interval);
    timerState.running = false;
    timerState.disqualified = true;
    if (!timerState.hintName || timerState.found.has(timerState.hintName)) {
      timerState.hintName = rand(missing);
      timerState.hintLength = 0;
    }
    timerState.hintLength = Math.min(timerState.hintName.length, (timerState.hintLength || 0) + 1);
    input.value = timerState.hintName.slice(0, timerState.hintLength);
    const msg = $('#timerMsg');
    if (msg) msg.textContent = 'invalid';
    focusTimerInput();
  }
  function timerGiveUp() {
    clearInterval(timerState.interval);
    timerState.running = false;
    timerState.hintName = null;
    timerState.hintLength = 0;
    timerState.disqualified = true;
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
    timerState.disqualified = false;
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
      el('p', { html: `<strong id="timerClock">${timeText}</strong> <span id="timerProgress">${found.length}/88</span> · best: <strong id="timerBest">${timerBestText()}</strong>${timerState.disqualified ? ' · invalid' : ''}` }),
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
      if (!timerState.disqualified && (!p.bestTime || timerState.seconds < p.bestTime)) p.bestTime = timerState.seconds;
      record('timer', true);
      saveProgress();
      const best = $('#timerBest');
      if (best) best.textContent = timerBestText();
      const msg = $('#timerMsg');
      if (msg) msg.textContent = timerState.disqualified ? 'complete invalid' : 'complete';
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
    if (!namedStarCatalogueReady) {
      deferForNamedStars('Atlas', () => { if (activeGame === 'atlas') renderConstellationPage(name); });
      return;
    }
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
    const starRows = info.stars.length ? info.stars.map(s => `<tr><td>${starNameChoiceHtml(s)}</td><td>${esc(s.designation)}</td><td>${esc(s.note)}</td></tr>`).join('') : '<tr><td colspan="3">No star in the current curated named-star list.</td></tr>';
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
  const CONSTELLATION_LINES_URL = 'constellation_lines.json?v=151';
  const CON_ABBR_TO_NAME = new Map(DATA.constellations.map(c => [compact(c.abbr), c.name]));
  CON_ABBR_TO_NAME.set('ser1', 'Serpens');
  CON_ABBR_TO_NAME.set('ser2', 'Serpens');
  let skyDataPromise = null;
  let skyStars = [];
  let skyHipByNumber = new Map();
  let skyConstCentres = new Map();
  let skyConstellationLineDb = null;
  let skyConstellationLinePromise = null;
  let skyLineEdgesCache = null;

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
      const hipI = pickColumn(headers, ['hip', 'HIP', 'hipparcos', 'hipparcos_id', 'hip_id', 'hip_num', 'hip_number']);
      const nameI = pickColumn(headers, ['proper', 'name', 'star_name']);
      const bayerI = pickColumn(headers, ['bayer', 'Bayer']);
      const bfI = pickColumn(headers, ['bf', 'bayer_flamsteed', 'Bayer Flamsteed']);
      const distI = pickColumn(headers, ['dist', 'distance']);
      const absmagI = pickColumn(headers, ['absmag', 'abs_mag', 'absolute_magnitude']);
      const spectI = pickColumn(headers, ['spect', 'spectrum', 'spectral_type']);
      const ciI = pickColumn(headers, ['ci', 'color_index', 'colour_index']);
      const hdI = pickColumn(headers, ['hd', 'HD']);
      const hrI = pickColumn(headers, ['hr', 'HR']);
      if (raI < 0 || decI < 0 || magI < 0 || conI < 0) throw new Error('sky data unavailable.');
      const raw = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = parseCsvLine(lines[i]);
        const ra = sexaToDeg(row[raI], true), dec = sexaToDeg(row[decI], false), mag = parseFloat(row[magI]);
        if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag) || mag > 6.5) continue;
        let con = String(row[conI] || '').trim();
        let constellation = CON_ABBR_TO_NAME.get(compact(con)) || DATA.constellations.find(c => compact(c.name) === compact(con))?.name;
        if (!constellation) continue;
        const hipText = hipI >= 0 ? String(row[hipI] || '') : '';
        const hipMatch = hipText.match(/\d+/);
        const hip = hipMatch ? parseInt(hipMatch[0], 10) : NaN;
        const v = vecFromRaDec(ra, dec);
        const dist = distI >= 0 ? parseFloat(row[distI]) : NaN;
        const absmag = absmagI >= 0 ? parseFloat(row[absmagI]) : NaN;
        const ci = ciI >= 0 ? parseFloat(row[ciI]) : NaN;
        raw.push({
          ra, dec, mag,
          hip: Number.isFinite(hip) ? hip : null,
          constellation,
          name: nameI >= 0 ? row[nameI] : '',
          bayer: bayerI >= 0 ? row[bayerI] : '',
          bf: bfI >= 0 ? row[bfI] : '',
          dist: Number.isFinite(dist) ? dist : null,
          absmag: Number.isFinite(absmag) ? absmag : null,
          spect: spectI >= 0 ? String(row[spectI] || '').trim() : '',
          ci: Number.isFinite(ci) ? ci : null,
          hd: hdI >= 0 ? String(row[hdI] || '').trim() : '',
          hr: hrI >= 0 ? String(row[hrI] || '').trim() : '',
          v
        });
      }
      skyStars = raw.sort((a, b) => a.mag - b.mag);
      skyHipByNumber = new Map();
      skyStars.forEach(star => {
        if (Number.isFinite(star.hip) && !skyHipByNumber.has(star.hip)) skyHipByNumber.set(star.hip, star);
      });
      if (!skyHipByNumber.size) console.warn('iloveastro: HYG sky data did not expose HIP identifiers; constellation line overlay cannot be drawn.');

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
  const OPENNGC_CATALOG_URL_SETS = [
    [
      'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv',
      'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv'
    ],
    [
      'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/database_files/NGC.csv',
      'https://cdn.jsdelivr.net/gh/mattiaverga/OpenNGC@master/database_files/addendum.csv'
    ]
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
    const pushRow = () => {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delimiter) { row.push(cell); cell = ''; }
      else if (ch === '\n') pushRow();
      else if (ch === '\r') {
        if (next === '\n') continue;
        pushRow();
      } else cell += ch;
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
    [
      'Name', 'name', 'M', 'Messier', 'NGC', 'IC',
      'Identifiers', 'Identifier', 'Common names', 'Common name',
      'CommonNames', 'Other names', 'OtherNames'
    ].forEach(k => {
      if (row[k]) values.push(...String(row[k]).split(/[;,|]/));
    });
    if (row.M) values.push(`M${row.M}`, `Messier ${row.M}`);
    if (row.NGC) values.push(`NGC${row.NGC}`);
    if (row.IC) values.push(`IC${row.IC}`);
    return [...new Set(values.map(dsoKey).filter(Boolean))];
  }

  function parseOpenNgc(text) {
    const rows = csvRows(text, detectCsvDelimiter(text));
    if (rows.length < 2) return new Map();

    const headerIndex = rows.findIndex(r => {
      const h = r.map(x => String(x || '').trim().toLowerCase());
      return h.includes('ra') && (h.includes('dec') || h.includes('declination')) && h.includes('name');
    });
    if (headerIndex < 0 || headerIndex >= rows.length - 1) return new Map();

    const header = rows[headerIndex].map(x => String(x || '').trim());
    const objectCoordsByKey = new Map();

    for (const cells of rows.slice(headerIndex + 1)) {
      const row = {};
      header.forEach((h, i) => row[h] = cells[i] || '');
      const ra = hmsToDegrees(row.RA || row.ra);
      const dec = dmsToDegrees(row.Dec || row.DEC || row.dec || row.Declination || row.declination);
      if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;
      catalogueRowKeys(row).forEach(key => objectCoordsByKey.set(key, { ra, dec, source: 'OpenNGC' }));
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

  async function fetchDsoCatalogSet(urls) {
    const merged = new Map();
    let lastError = null;

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) throw new Error(`OpenNGC HTTP ${res.status} for ${url}`);
        const parsed = parseOpenNgc(await res.text());
        parsed.forEach((coord, key) => {
          if (!merged.has(key)) merged.set(key, coord);
        });
      } catch (err) {
        lastError = err;
      }
    }

    if (!merged.size && lastError) throw lastError;
    return merged;
  }

  async function loadDsoCoordinateData() {
    if (skyDsoCoordinateMap.size) return skyDsoCoordinateMap;
    if (skyDsoCoordinatePromise) return skyDsoCoordinatePromise;

    skyDsoCoordinatePromise = (async () => {
      let lastError = null;
      for (const urls of OPENNGC_CATALOG_URL_SETS) {
        try {
          const parsed = await fetchDsoCatalogSet(urls);
          if (parsed.size) {
            skyDsoCoordinateMap = parsed;
            skyDsoObjects = [];
            console.info(`iloveastro: loaded ${skyDsoCoordinateMap.size} DSO coordinate matches from OpenNGC/addendum.`);
            return skyDsoCoordinateMap;
          }
        } catch (err) {
          lastError = err;
        }
      }
      console.warn('iloveastro: DSO coordinate catalogue unavailable; coordinate-less DSOs will not be plotted.', lastError);
      skyDsoCoordinateMap = new Map();
      skyDsoObjects = [];
      return skyDsoCoordinateMap;
    })();

    return skyDsoCoordinatePromise;
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
      let coordinateSource = '';
      const catalogueCoord = skyDsoCoordinateMap.get(o.code);
      if (catalogueCoord && Number.isFinite(catalogueCoord.ra) && Number.isFinite(catalogueCoord.dec)) {
        v = vecFromRaDec(catalogueCoord.ra, catalogueCoord.dec);
        coordinateSource = catalogueCoord.source || 'catalogue';
      } else if (Number.isFinite(o.ra) && Number.isFinite(o.dec)) {
        v = vecFromRaDec(o.ra, o.dec);
        coordinateSource = 'local';
      }

      return {
        ...o,
        v,
        colour: dsoColour(o),
        category: dsoCategory(o),
        hasReliablePosition: Boolean(v),
        hasCataloguePosition: Boolean(catalogueCoord),
        coordinateSource
      };
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
  const STAR_NAME_PREFS_KEY = 'iloveastroStarNamePreferences';
  const STAR_COMMON_NAME_GROUPS = [
    { key: 'beta-crucis', constellation: 'Crux', designation: 'Beta Crucis', names: ['Mimosa', 'Becrux'] },
    { key: 'epsilon-leonis', constellation: 'Leo', designation: 'Epsilon Leonis', names: ['Algenubi', 'Ras Elased Australis'] },
    { key: 'beta-centauri', constellation: 'Centaurus', designation: 'Beta Centauri', names: ['Hadar', 'Agena'] },
    { key: 'eta-ursae-majoris', constellation: 'Ursa Major', designation: 'Eta Ursae Majoris', names: ['Alkaid', 'Benetnasch'] },
    { key: 'beta-ceti', constellation: 'Cetus', designation: 'Beta Ceti', names: ['Diphda', 'Deneb Kaitos'] },
    { key: 'alpha-andromedae', constellation: 'Andromeda', designation: 'Alpha Andromedae', names: ['Alpheratz', 'Sirrah'] },
    { key: 'beta-canis-majoris', constellation: 'Canis Major', designation: 'Beta Canis Majoris', names: ['Mirzam', 'Murzim'] },
    { key: 'gamma-ursae-majoris', constellation: 'Ursa Major', designation: 'Gamma Ursae Majoris', names: ['Phecda', 'Phad'] },
    { key: 'beta-tauri', constellation: 'Taurus', designation: 'Beta Tauri', names: ['Elnath', 'El Nath'] },
    { key: 'alpha-cassiopeiae', constellation: 'Cassiopeia', designation: 'Alpha Cassiopeiae', names: ['Schedar', 'Shedir'] },
    { key: 'alpha-librae', constellation: 'Libra', designation: 'Alpha Librae', names: ['Zubenelgenubi', 'Kiffa Australis'] },
    { key: 'beta-librae', constellation: 'Libra', designation: 'Beta Librae', names: ['Zubeneschamali', 'Kiffa Borealis'] }
  ];
  function loadStarNamePrefs() {
    try {
      const value = JSON.parse(localStorage.getItem(STAR_NAME_PREFS_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }
  let starNamePrefs = loadStarNamePrefs();
  function saveStarNamePrefs() {
    try { localStorage.setItem(STAR_NAME_PREFS_KEY, JSON.stringify(starNamePrefs)); } catch {}
  }
  function starNameCandidates(star) {
    return [star?.name, star?.designation, ...(star?.accepted || []), star?.sky?.name, starDesignation(star || {}), star?.bf, star?.bayer].filter(Boolean);
  }
  function starCommonNameGroup(star) {
    if (!star) return null;
    const constKey = compact(star.constellation);
    const candidates = starNameCandidates(star).map(compact).filter(Boolean);
    return STAR_COMMON_NAME_GROUPS.find(group => {
      if (group.constellation && constKey && compact(group.constellation) !== constKey) return false;
      const groupKeys = [group.designation, ...group.names].map(compact);
      return groupKeys.some(k => candidates.includes(k));
    }) || null;
  }
  function starPreferredName(star) {
    const group = starCommonNameGroup(star);
    if (!group) return String(star?.name || '').trim();
    const saved = starNamePrefs[group.key];
    if (saved && group.names.some(n => compact(n) === compact(saved))) return saved;
    const current = String(star?.name || '').trim();
    const match = group.names.find(n => compact(n) === compact(current));
    return match || group.names[0];
  }
  function setStarPreferredName(groupKey, name) {
    const group = STAR_COMMON_NAME_GROUPS.find(g => g.key === groupKey);
    if (!group || !group.names.some(n => compact(n) === compact(name))) return;
    starNamePrefs[group.key] = name;
    saveStarNamePrefs();
  }
  document.addEventListener('change', e => {
    const select = e.target?.closest?.('[data-star-name-group]');
    if (!select) return;
    setStarPreferredName(select.dataset.starNameGroup, select.value);
    if (activeGame !== 'tables') render();
  });
  function starAnswerNames(star) {
    const group = starCommonNameGroup(star);
    return [...new Set([star?.name, starPreferredName(star), ...(group ? group.names : []), star?.designation, ...(star?.accepted || [])].filter(Boolean))];
  }
  function starDisplayName(s) {
    return starPreferredName(s);
  }
  function starDesignation(s) {
    const symbol = greekBayerSymbol(s?.bayer) || greekBayerSymbol(s?.bf) || greekBayerSymbol(s?.skyBayer) || greekBayerSymbol(s?.skyBf);
    if (symbol) return `${symbol} ${CONSTELLATION_GENITIVE[s.constellation] || s.constellation}`;
    return greekDesignationText(s?.designation || '');
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
    if (o.coordinateSource) lines.push(`position: ${esc(o.coordinateSource)}`);
    return lines.join('<br>');
  }

  function wikiUrl(title) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title || '').trim().replace(/\s+/g, '_'))}`;
  }
  function externalLink(url, label, className = 'wiki-link') {
    if (!url || !label) return esc(label || '');
    return `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  }

  const STAR_WIKI_TITLES = {
    Rigil_Kentaurus: 'Alpha Centauri',
    'Rigil Kentaurus': 'Alpha Centauri',
    Hadar: 'Beta Centauri',
    Acrux: 'Acrux',
    Gacrux: 'Gacrux',
    Alpheratz: 'Alpha Andromedae',
    Elnath: 'Beta Tauri',
    Kaus_Australis: 'Kaus Australis',
    'Kaus Australis': 'Kaus Australis',
    Kaus_Media: 'Kaus Media',
    'Kaus Media': 'Kaus Media',
    Kaus_Borealis: 'Kaus Borealis',
    'Kaus Borealis': 'Kaus Borealis'
  };

  const DSO_WIKI_TITLES = {
    C14: 'Double Cluster',
    C41: 'Hyades (star cluster)',
    M1: 'Crab Nebula',
    M8: 'Lagoon Nebula',
    M11: 'Wild Duck Cluster',
    M13: 'Messier 13',
    M16: 'Eagle Nebula',
    M17: 'Omega Nebula',
    M20: 'Trifid Nebula',
    M22: 'Messier 22',
    M27: 'Dumbbell Nebula',
    M31: 'Andromeda Galaxy',
    M33: 'Triangulum Galaxy',
    M42: 'Orion Nebula',
    M44: 'Beehive Cluster',
    M45: 'Pleiades',
    M51: 'Whirlpool Galaxy',
    M57: 'Ring Nebula',
    M81: "Bode's Galaxy",
    M82: 'Cigar Galaxy',
    M87: 'Messier 87',
    M97: 'Owl Nebula',
    M104: 'Sombrero Galaxy'
  };

  function starWikiTitle(star) {
    const preferred = starPreferredName(star);
    const primary = String(star?.name || '').trim();
    return STAR_WIKI_TITLES[preferred] || STAR_WIKI_TITLES[preferred.replace(/\s+/g, '_')] || STAR_WIKI_TITLES[primary] || STAR_WIKI_TITLES[primary.replace(/\s+/g, '_')] || preferred || primary || star?.designation || '';
  }
  function starWikiLink(star, label = null) {
    const title = starWikiTitle(star);
    return title ? externalLink(wikiUrl(title), label || starPreferredName(star) || String(title), 'wiki-link') : esc(label || '');
  }
  function starNameChoiceHtml(star) {
    const group = starCommonNameGroup(star);
    const current = starPreferredName(star);
    const link = starWikiLink(star, current);
    if (!group || group.names.length < 2) return link;
    const options = group.names.map(name => `<option value="${esc(name)}" ${compact(name) === compact(current) ? 'selected' : ''}>${esc(name)}</option>`).join('');
    return `<span class="star-name-choice" title="choose common name">${link}<select class="star-name-select" data-star-name-group="${esc(group.key)}" aria-label="choose common name for ${esc(current)}">${options}</select></span>`;
  }
  function constellationWikiLink(name) {
    return externalLink(wikiUrl(`${name} constellation`), name, 'wiki-link');
  }
  function dsoWikiTitle(o) {
    if (!o) return '';
    if (DSO_WIKI_TITLES[o.code]) return DSO_WIKI_TITLES[o.code];
    const common = String(o.commonName || '').trim();
    if (common) return common;
    const parts = String(o.code || '').match(/^([MC])\s*(\d+)/i);
    if (parts && parts[1].toUpperCase() === 'M') return `Messier ${parseInt(parts[2], 10)}`;
    if (parts && parts[1].toUpperCase() === 'C') return `Caldwell ${parseInt(parts[2], 10)}`;
    return String(o.code || '').trim();
  }
  function dsoWikiLink(o, label = null) {
    const title = dsoWikiTitle(o);
    return title ? externalLink(wikiUrl(title), label || String(o?.commonName || o?.code || title), 'wiki-link') : esc(label || '');
  }
  function asterismWikiTitle(a) {
    return a?.wikiTitle || a?.name || '';
  }
  function asterismWikiLink(a, label = null) {
    const title = asterismWikiTitle(a);
    return title ? externalLink(wikiUrl(title), label || String(a?.name || title), 'wiki-link') : esc(label || '');
  }
  function dsoLabelPlain(o) {
    return o.commonName ? `${o.code} - ${o.commonName}` : o.code;
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

  function loadSkyConstellationLines() {
    if (skyConstellationLineDb) return Promise.resolve(skyConstellationLineDb);
    if (skyConstellationLinePromise) return skyConstellationLinePromise;
    skyConstellationLinePromise = fetch(CONSTELLATION_LINES_URL, { cache: 'no-cache' })
      .then(res => {
        if (!res.ok) throw new Error('constellation line database unavailable.');
        return res.json();
      })
      .then(data => {
        skyConstellationLineDb = data;
        console.info(`iloveastro: loaded constellation line database ${data?.metadata?.custom_version || 'unknown version'}.`);
        skyLineEdgesCache = null;
        return skyConstellationLineDb;
      })
      .catch(err => {
        console.warn('iloveastro: could not load constellation_lines.json; constellation lines disabled.', err);
        skyConstellationLineDb = { constellations: [] };
        skyLineEdgesCache = [];
        return skyConstellationLineDb;
      });
    return skyConstellationLinePromise;
  }

  function skyLineStarByHip(entry, hip) {
    return skyHipByNumber.get(hip) || null;
  }

  function skyLineEdgesFromDatabase() {
    if (skyLineEdgesCache) return skyLineEdgesCache;
    const out = [];
    const missing = new Map();
    if (!skyConstellationLineDb || !Array.isArray(skyConstellationLineDb.constellations)) return out;

    skyConstellationLineDb.constellations.forEach(entry => {
      const seen = new Set();
      (entry.edges || []).forEach(edge => {
        const a = Number(edge.from), b = Number(edge.to);
        if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) return;
        seen.add(key);

        const s1 = skyLineStarByHip(entry, a);
        const s2 = skyLineStarByHip(entry, b);
        if (!s1 || !s2) {
          if (!missing.has(entry.pdf_code || entry.iau || entry.name || 'unknown')) missing.set(entry.pdf_code || entry.iau || entry.name || 'unknown', []);
          if (!s1) missing.get(entry.pdf_code || entry.iau || entry.name || 'unknown').push(a);
          if (!s2) missing.get(entry.pdf_code || entry.iau || entry.name || 'unknown').push(b);
          return;
        }
        out.push({ constellation: entry.name, fromHip: a, toHip: b, s1, s2 });
      });
    });

    if (missing.size && !skyConstellationLineDb._missingHipWarningShown) {
      const detail = [...missing.entries()].map(([name, hips]) => `${name}: ${[...new Set(hips)].join(', ')}`).join(' | ');
      console.warn(`iloveastro: some constellation-line HIP endpoints are missing from the loaded sky data, so those segments were skipped. ${detail}`);
      skyConstellationLineDb._missingHipWarningShown = true;
    }

    skyLineEdgesCache = out;
    return skyLineEdgesCache;
  }

  function drawSkyAsterismLines(ctx, project, basis, radius, fovRad) {
    if (!skyConstellationLineDb || !skyHipByNumber.size) return;

    const edgeMarginRad = Math.min(Math.PI, Math.max(35 * Math.PI / 180, fovRad * 0.45));
    const projectLineEndpoint = v => {
      const z = dot(v, basis.f);
      const ang = Math.acos(Math.max(-1, Math.min(1, z)));
      if (ang > Math.min(Math.PI, fovRad / 2 + edgeMarginRad)) return null;
      const x = dot(v, basis.right), y = dot(v, basis.up);
      const sin = Math.sin(ang) || 1e-9;
      const rr = (ang / (fovRad / 2)) * radius;
      return { x: ctx.canvas.width / 2 + rr * x / sin, y: ctx.canvas.height / 2 - rr * y / sin, z };
    };

    ctx.save();
    ctx.strokeStyle = '#777';
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    skyLineEdgesFromDatabase().forEach(edge => {
      if (angularDeg(edge.s1.v, edge.s2.v) > 60) return;
      const p1 = projectLineEndpoint(edge.s1.v);
      const p2 = projectLineEndpoint(edge.s2.v);
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    ctx.restore();
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
    const hits = [];
    for (const target of pick.targets || []) {
      const d = Math.hypot(target.x - x, target.y - y);
      if (d <= target.r) hits.push({ d, payload: target.payload });
    }
    hits.sort((a, b) => a.d - b.d);
    if (hits.length) {
      if (hits[0].d <= 6) return hits[0].payload;
      if (hits[1] && hits[1].d - hits[0].d < 4) return null;
      return hits[0].payload;
    }

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
    const showLines = options.showLines === true && !!skyConstellationLineDb && !!skyHipByNumber.size;
    const targetConstellationNames = (Array.isArray(options.constellations) && options.constellations.length ? options.constellations : [name]).filter(Boolean);
    const lineNames = targetConstellationNames.map(compact);
    const lineNameSet = new Set(lineNames);
    const lineEdges = showLines ? skyLineEdgesFromDatabase().filter(edge => lineNameSet.has(compact(edge.constellation))) : [];
    const dsos = showDso ? buildSkyDsoObjects().filter(o => o.v && o.hasReliablePosition && o.constellation === name && String(o.commonName || '').trim()) : [];
    const vectors = [...stars.map(s => s.v), ...dsos.map(o => o.v), ...lineEdges.flatMap(edge => [edge.s1.v, edge.s2.v])];
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

    if (options.projection === 'sphere') {
      const cleanBasis = basis => {
        if (!basis || !basis.f || !basis.right || !basis.up) return null;
        const f = normVec(basis.f);
        let right = basis.right;
        const proj = dot(right, f);
        right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
        if (!Number.isFinite(right.x)) return null;
        const up = normVec(cross(right, f));
        return { f, right: normVec(cross(f, up)), up };
      };
      const sum = vectors.reduce((v, p) => ({ x: v.x + p.x, y: v.y + p.y, z: v.z + p.z }), { x: 0, y: 0, z: 0 });
      const centre = normVec(sum);
      const basis = cleanBasis(options.viewBasis) || localBasisFromForward(centre);
      const rollAxis = options.rollCentre && Number.isFinite(options.rollCentre.x) && Number.isFinite(options.rollCentre.y) && Number.isFinite(options.rollCentre.z) ? normVec(options.rollCentre) : centre;
      const rollVector = v => {
        if (!rotation) return v;
        const ca = Math.cos(rotation), sa = Math.sin(rotation), d = dot(rollAxis, v), cr = cross(rollAxis, v);
        return normVec({
          x: v.x * ca + cr.x * sa + rollAxis.x * d * (1 - ca),
          y: v.y * ca + cr.y * sa + rollAxis.y * d * (1 - ca),
          z: v.z * ca + cr.z * sa + rollAxis.z * d * (1 - ca)
        });
      };
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const baseFovDeg = clampNumber(options.fovDeg, 12, 190, 45);
      const viewZoom = clampNumber(options.zoom, 0.55, 4.5, 1);
      const fovDeg = clampNumber(baseFovDeg / viewZoom, 8, 190, baseFovDeg);
      const fovRad = fovDeg * Math.PI / 180;
      const projectSphere = v => {
        v = rollVector(v);
        const z = dot(v, basis.f);
        const ang = Math.acos(Math.max(-1, Math.min(1, z)));
        if (ang > fovRad / 2) return null;
        const x = dot(v, basis.right), y = dot(v, basis.up);
        const sin = Math.sin(ang) || 1e-9;
        const rr = (ang / (fovRad / 2)) * radius;
        return { x: canvas.width / 2 + rr * x / sin, y: canvas.height / 2 - rr * y / sin, z };
      };
      const drawn = [];
      const drawnDsos = [];
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.clip();

      if (showLines && lineEdges.length) {
        ctx.save();
        ctx.strokeStyle = '#777';
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 1.25;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        lineEdges.forEach(edge => {
          if (angularDeg(edge.s1.v, edge.s2.v) > 60) return;
          const p1 = projectSphere(edge.s1.v);
          const p2 = projectSphere(edge.s2.v);
          if (!p1 || !p2) return;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        });
        ctx.restore();
      }

      ctx.fillStyle = 'black';
      stars.slice().sort((a, b) => b.mag - a.mag).forEach(star => {
        const p = projectSphere(star.v);
        if (!p) return;
        const r = Math.max(1.2, Math.min(6, 5.2 - star.mag * 0.62));
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        const hitR = Math.max(10, r + 7);
        registerPickCircle(pick, p.x, p.y, hitR, { type: 'star', star });
        drawn.push({ x: p.x, y: p.y, r: hitR, star });
      });

      if (showDso) {
        dsos.forEach(dso => {
          const p = projectSphere(dso.v);
          if (!p) return;
          ctx.fillStyle = dso.colour;
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          registerPickCircle(pick, p.x, p.y, 11, { type: 'dso', dso });
          drawnDsos.push({ x: p.x, y: p.y, r: 11, dso });
        });
      }

      ctx.restore();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
      ctx.stroke();

      canvas._pickLayer = pick;
      drawn.dsos = drawnDsos;
      return drawn;
    }

    const centreVectors = targetConstellationNames.map(n => skyConstCentres.get(n)).filter(Boolean);
    const centreSource = centreVectors.length ? centreVectors : vectors;
    const sum = centreSource.reduce((v, p) => ({ x: v.x + p.x, y: v.y + p.y, z: v.z + p.z }), { x: 0, y: 0, z: 0 });
    const centre = normVec(sum);
    const baseBasis = localBasisFromForward(centre);
    const cleanBasis = basis => {
      if (!basis || !basis.f || !basis.right || !basis.up) return null;
      const f = normVec(basis.f);
      let right = basis.right;
      const proj = dot(right, f);
      right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
      if (!Number.isFinite(right.x)) return null;
      const up = normVec(cross(right, f));
      return { f, right: normVec(cross(f, up)), up };
    };
    const viewBasis = cleanBasis(options.viewBasis) || baseBasis;
    const c = Math.cos(rotation), sr = Math.sin(rotation);
    const toMapPointWithBasis = (basis, v, item) => {
      const x0 = dot(v, basis.right), y0 = dot(v, basis.up);
      return { ...item, x: x0 * c - y0 * sr, y: x0 * sr + y0 * c };
    };
    const makeRaw = basis => {
      const rawStars = stars.map(star => toMapPointWithBasis(basis, star.v, { star }));
      const rawDsos = dsos.map(dso => toMapPointWithBasis(basis, dso.v, { dso }));
      const rawLineEdges = lineEdges.map(edge => ({
        edge,
        a: toMapPointWithBasis(basis, edge.s1.v, {}),
        b: toMapPointWithBasis(basis, edge.s2.v, {})
      }));
      return { rawStars, rawDsos, rawLineEdges };
    };

    const baseRaw = makeRaw(baseBasis);
    const basePoints = [...baseRaw.rawStars, ...baseRaw.rawDsos, ...baseRaw.rawLineEdges.flatMap(edge => [edge.a, edge.b])];
    const minX = Math.min(...basePoints.map(p => p.x));
    const maxX = Math.max(...basePoints.map(p => p.x));
    const minY = Math.min(...basePoints.map(p => p.y));
    const maxY = Math.max(...basePoints.map(p => p.y));
    const spanX = Math.max(0.0001, maxX - minX);
    const spanY = Math.max(0.0001, maxY - minY);
    const centreX = (minX + maxX) / 2;
    const centreY = (minY + maxY) / 2;

    const activeRaw = makeRaw(viewBasis);
    const rawStars = activeRaw.rawStars;
    const rawDsos = activeRaw.rawDsos;
    const rawLineEdges = activeRaw.rawLineEdges;

    const viewZoom = clampNumber(options.zoom, 0.75, 3.5, 1);
    const scale = Math.min(canvas.width * 0.88 / spanX, canvas.height * 0.88 / spanY) * viewZoom;
    const mapX = p => canvas.width / 2 + (p.x - centreX) * scale;
    const mapY = p => canvas.height / 2 - (p.y - centreY) * scale;
    const drawn = [];
    const drawnDsos = [];

    if (showLines && rawLineEdges.length) {
      ctx.save();
      ctx.strokeStyle = '#777';
      ctx.globalAlpha = 0.72;
      ctx.lineWidth = 1.25;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      rawLineEdges.forEach(({ edge, a, b }) => {
        if (angularDeg(edge.s1.v, edge.s2.v) > 60) return;
        const x1 = mapX(a);
        const y1 = mapY(a);
        const x2 = mapX(b);
        const y2 = mapY(b);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.fillStyle = 'black';
    rawStars.sort((a, b) => b.star.mag - a.star.mag).forEach(p => {
      const x = mapX(p);
      const y = mapY(p);
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
        const x = mapX(p);
        const y = mapY(p);
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
    const state = states.skyguessr || (states.skyguessr = { loaded: false, loading: false, error: '', fov: defaultFov(), magLimit: defaultMag(), showLines: false, target: null, answered: false, message: '', score: scoreKey('skyguessr'), orient: null });
    app.innerHTML = `<h2>SkyGuessr</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="skyCanvas" width="900" height="900" tabindex="0" aria-label="celestial sphere"></canvas></section><aside class="panel"><label>FOV degrees<div class="slider-text-row"><input id="skyFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="skyFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label class="checkline"><input id="skyLines" type="checkbox" ${state.showLines === true ? "checked" : ""}><span>constellation lines</span></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="skyMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="skyMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><div class="sky-nav-grid" aria-label="sky movement controls"><button type="button" data-move="-1,-1">↖</button><button type="button" data-move="0,-1">↑</button><button type="button" data-move="1,-1">↗</button><button type="button" data-move="-1,0">←</button><button type="button" id="skyCentre">X</button><button type="button" data-move="1,0">→</button><button type="button" data-move="-1,1">↙</button><button type="button" data-move="0,1">↓</button><button type="button" data-move="1,1">↘</button></div><div class="controls"><button type="button" id="skyRollCCW">↺ rotate</button><button type="button" id="skyRollCW">rotate ↻</button></div><input id="skyAnswer" autocomplete="off" placeholder="constellation at the X"><div class="controls"><button type="button" id="skyReveal">reveal</button></div><div class="controls new-round-controls"><button type="button" id="skyNew" class="new-round-button">new location</button></div><div id="skyMsg" class="message">${esc(state.message || '')}</div><div class="stats">${formatScore('skyguessr')}</div></aside></div>`;
    initRangeVisuals(app);
    setupSphereFullscreen();
    const canvas = $('#skyCanvas'), ctx = canvas.getContext('2d');
    function focusCanvas() { try { canvas.focus({ preventScroll: true }); } catch { focusCanvas(); } }
    const answer = $('#skyAnswer');
    const fovInput = $('#skyFov');
    const fovSlider = $('#skyFovSlider');

    function ensureSkyGuessrLinesLoadedThenDraw() {
      if (!state.loaded || state.showLines !== true) return;
      if (skyConstellationLineDb) {
        draw();
        return;
      }
      loadSkyConstellationLines().then(draw).catch(err => {
        console.warn('iloveastro: SkyGuessr constellation lines could not be loaded.', err);
        draw();
      });
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
      if (state.showLines === true && skyConstellationLineDb) drawSkyAsterismLines(ctx, project, b, radius, fovRad);
      const visible = skyStars.filter(s => s.mag <= state.magLimit).sort((a, b) => b.mag - a.mag);
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
    function setSkyMag(v) {
      state.magLimit = Math.max(4, Math.min(6, parseFloat(v) || defaultMag()));
      const value = Number(state.magLimit.toFixed(1));
      $('#skyMag').value = value;
      $('#skyMagSlider').value = value;
      updateRangeVisual($('#skyMagSlider'));
      draw();
    }
    $('#skyLines').addEventListener('change', e => {
      state.showLines = e.target.checked;
      if (state.showLines === true) ensureSkyGuessrLinesLoadedThenDraw();
      else draw();
      focusCanvas();
    });
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
      state.loading = true; showLoadingOverlay('loading sky data');
      Promise.all([loadSkyData(), loadConstellationBounds()]).then(() => {
        state.loaded = true;
        hideLoadingOverlay(); state.loading = false;
        ensureTarget();
        draw();
        if (state.showLines === true) ensureSkyGuessrLinesLoadedThenDraw();
        answer.focus();
      }).catch(err => { state.error = 'sky data unavailable'; hideLoadingOverlay(); state.loading = false; draw(); });
    }
    ensureTarget(); draw();
    if (state.loaded && state.showLines === true && !skyConstellationLineDb) ensureSkyGuessrLinesLoadedThenDraw();
    setTimeout(() => answer.focus(), 0);
  }



  function renderSkyMap() {
    const state = states.skymap || (states.skymap = {
      loaded: false,
      loading: false,
      error: '',
      fov: defaultFov(),
      magLimit: defaultMag(),
      showLines: false,
      showDso: false,
      noteMode: false,
      noteEdges: [],
      noteSelected: null,
      noteHistory: [],
      noteRedo: [],
      dsoDefaultVersion: 116,
      message: '',
      orient: null
    });
    if (state.dsoDefaultVersion !== 116) {
      state.showDso = false;
      state.dsoDefaultVersion = 116;
    }
    if (!Array.isArray(state.noteEdges)) state.noteEdges = [];
    if (!Array.isArray(state.noteHistory)) state.noteHistory = [];
    if (!Array.isArray(state.noteRedo)) state.noteRedo = [];
    if (typeof state.noteMode !== 'boolean') state.noteMode = false;
    if (!('noteSelected' in state)) state.noteSelected = null;

    app.innerHTML = `<h2>Sky Map</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="skyMapCanvas" width="900" height="900" tabindex="0" aria-label="sky map sphere"></canvas></section><aside class="panel"><label>FOV degrees<div class="slider-text-row"><input id="mapFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="mapFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="mapMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="mapMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><label class="checkline"><input id="mapLines" type="checkbox" ${state.showLines === true ? "checked" : ""}><span>constellation lines</span></label><label class="checkline"><input id="mapDso" type="checkbox" ${state.showDso === true ? "checked" : ""}><span>DSOs</span></label><label class="checkline"><input id="mapNotes" type="checkbox" ${state.noteMode === true ? "checked" : ""}><span>make notes</span></label><div id="mapNoteControls" class="controls map-note-controls" ${state.noteMode === true ? "" : 'style="display:none"'}><button type="button" id="mapUndoNotes">undo</button><button type="button" id="mapClearNotes">clear notes</button></div><label>Search sky<input id="mapSearch" list="mapSearchList" autocomplete="off" placeholder="star or DSO"></label><datalist id="mapSearchList"></datalist><div class="sky-nav-grid" aria-label="sky map movement controls"><button type="button" data-move="-1,-1">↖</button><button type="button" data-move="0,-1">↑</button><button type="button" data-move="1,-1">↗</button><button type="button" data-move="-1,0">←</button><button type="button" id="mapCentre">○</button><button type="button" data-move="1,0">→</button><button type="button" data-move="-1,1">↙</button><button type="button" data-move="0,1">↓</button><button type="button" data-move="1,1">↘</button></div><div class="controls"><button type="button" id="mapZoomOut">− zoom</button><button type="button" id="mapZoomIn">zoom +</button></div><div class="controls"><button type="button" id="mapRollCCW">↺ rotate</button><button type="button" id="mapRollCW">rotate ↻</button><button type="button" id="mapClear">deselect</button></div><div class="dso-legend small"><span><b style="background:#8a2be2"></b>nebula</span><span><b style="background:#d4a600"></b>open cluster</span><span><b style="background:#198754"></b>globular</span><span><b style="background:#1f6feb"></b>galaxy</span><span><b style="background:#d63384"></b>misc</span></div><div id="mapMsg" class="message">${state.message || ''}</div></aside></div>`;

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

    function ensureConstellationLinesLoadedThenDraw() {
      if (!state.loaded || state.showLines !== true) return;
      if (skyConstellationLineDb) {
        draw();
        return;
      }
      state.linesLoading = true;
      if (msg && !state.message) msg.textContent = 'loading constellation lines...';
      loadSkyConstellationLines().then(() => {
        state.linesLoading = false;
        if (msg && !state.message) msg.textContent = '';
        draw();
      }).catch(err => {
        state.linesLoading = false;
        console.warn('iloveastro: constellation lines could not be loaded.', err);
        if (msg && !state.message) msg.textContent = 'constellation lines unavailable';
        draw();
      });
    }

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

    function vectorFromCanvasPoint(x, y, basis, radius, fovRad) {
      const sx = x - canvas.width / 2;
      const sy = canvas.height / 2 - y;
      const rho = Math.hypot(sx, sy);
      if (rho > radius) return null;
      if (rho < 1e-9) return basis.f;
      const ang = (rho / radius) * (fovRad / 2);
      const tx = sx / rho, ty = sy / rho;
      return normVec({
        x: basis.f.x * Math.cos(ang) + (basis.right.x * tx + basis.up.x * ty) * Math.sin(ang),
        y: basis.f.y * Math.cos(ang) + (basis.right.y * tx + basis.up.y * ty) * Math.sin(ang),
        z: basis.f.z * Math.cos(ang) + (basis.right.z * tx + basis.up.z * ty) * Math.sin(ang)
      });
    }

    function formatRaDec(v) {
      const { ra, dec } = raDecFromVec(v);
      const totalSeconds = ra / 15 * 3600;
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds - h * 3600) / 60);
      const s = totalSeconds - h * 3600 - m * 60;
      const sign = dec < 0 ? '−' : '+';
      const absDec = Math.abs(dec);
      const d = Math.floor(absDec);
      const dm = Math.floor((absDec - d) * 60);
      const ds = (absDec - d - dm / 60) * 3600;
      return `RA ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${s.toFixed(1).padStart(4, '0')}s<br>Dec ${sign}${String(d).padStart(2, '0')}° ${String(dm).padStart(2, '0')}′ ${ds.toFixed(0).padStart(2, '0')}″`;
    }

    function raDecInfoHtml(v) {
      return `<strong>RA/Dec</strong><br>${formatRaDec(v)}`;
    }

    function noteStarId(star) {
      if (Number.isFinite(star.hip)) return `hip:${star.hip}`;
      const name = compact(star.name || starDisplayName(star) || star.bayer || star.bf);
      return `pos:${Number(star.ra).toFixed(6)}:${Number(star.dec).toFixed(6)}:${name}`;
    }

    function noteEdgeKeyFromIds(a, b) {
      return [String(a), String(b)].sort().join('|');
    }

    function normaliseNoteEdges() {
      const seen = new Set();
      state.noteEdges = (state.noteEdges || []).filter(edge => {
        if (!edge || !edge.a || !edge.b || edge.a === edge.b) return false;
        const key = noteEdgeKeyFromIds(edge.a, edge.b);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function noteEdgeIndex(a, b) {
      const key = noteEdgeKeyFromIds(a, b);
      return state.noteEdges.findIndex(edge => noteEdgeKeyFromIds(edge.a, edge.b) === key);
    }

    function projectNoteLineEndpoint(v, basis, radius, fovRad) {
      const edgeMarginRad = Math.min(Math.PI, Math.max(35 * Math.PI / 180, fovRad * 0.45));
      const z = dot(v, basis.f);
      const ang = Math.acos(Math.max(-1, Math.min(1, z)));
      if (ang > Math.min(Math.PI, fovRad / 2 + edgeMarginRad)) return null;
      const x = dot(v, basis.right), y = dot(v, basis.up);
      const sin = Math.sin(ang) || 1e-9;
      const rr = (ang / (fovRad / 2)) * radius;
      return { x: canvas.width / 2 + rr * x / sin, y: canvas.height / 2 - rr * y / sin, z };
    }

    function noteVisibleTargets(visibleStars, basis, radius, fovRad) {
      const targets = [];
      const byId = new Map();
      const starById = new Map();
      for (const star of visibleStars) {
        const id = noteStarId(star);
        if (!starById.has(id)) starById.set(id, star);
        const p = project(star.v, basis, radius, fovRad);
        if (!p) continue;
        const r = Math.max(0.8, Math.min(4.6, 4.1 - star.mag * 0.54));
        const target = { id, star, x: p.x, y: p.y, r, snap: Math.max(12, r + 8) };
        targets.push(target);
        if (!byId.has(id)) byId.set(id, target);
      }
      canvas._noteTargets = targets;
      canvas._noteTargetIds = new Set(targets.map(t => t.id));
      return { targets, byId, starById };
    }

    function drawNoteEdges(byId, starById, basis, radius, fovRad) {
      normaliseNoteEdges();
      ctx.save();
      ctx.strokeStyle = '#111';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      state.noteEdges.forEach(edge => {
        const aStar = starById.get(edge.a);
        const bStar = starById.get(edge.b);
        if (!aStar || !bStar) return;
        const a = byId.get(edge.a) || projectNoteLineEndpoint(aStar.v, basis, radius, fovRad);
        const b = byId.get(edge.b) || projectNoteLineEndpoint(bStar.v, basis, radius, fovRad);
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawNoteSelection(byId) {
      if (!state.noteSelected) return;
      const selected = byId.get(state.noteSelected);
      if (!selected) return;
      ctx.save();
      ctx.strokeStyle = '#111';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, Math.max(8, selected.r + 5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function nearestNoteTarget(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * canvas.width / rect.width;
      const y = (clientY - rect.top) * canvas.height / rect.height;
      const hits = (canvas._noteTargets || [])
        .map(t => ({ target: t, d: Math.hypot(t.x - x, t.y - y) }))
        .filter(hit => hit.d <= hit.target.snap)
        .sort((a, b) => a.d - b.d);
      if (!hits.length) return null;
      if (hits[0].d <= 8) return hits[0].target;
      if (hits[1] && hits[1].d - hits[0].d < 4) return null;
      return hits[0].target;
    }

    function handleNoteClick(clientX, clientY) {
      const hit = nearestNoteTarget(clientX, clientY);
      if (!hit) {
        state.noteSelected = null;
        draw();
        return;
      }

      if (state.noteSelected && !(canvas._noteTargetIds || new Set()).has(state.noteSelected)) {
        state.noteSelected = null;
      }

      if (state.noteSelected === hit.id) {
        state.noteSelected = null;
        draw();
        return;
      }

      if (!state.noteSelected) {
        state.noteSelected = hit.id;
        draw();
        return;
      }

      const edge = { a: state.noteSelected, b: hit.id };
      const existing = noteEdgeIndex(edge.a, edge.b);
      if (existing >= 0) {
        const removed = state.noteEdges.splice(existing, 1)[0];
        state.noteHistory.push({ type: 'remove', edge: removed });
        state.noteRedo = [];
      } else {
        state.noteEdges.push(edge);
        state.noteHistory.push({ type: 'add', edge });
        state.noteRedo = [];
      }
      state.noteSelected = hit.id;
      draw();
    }

    function applyNoteAction(action) {
      if (!action) return;
      if (action.type === 'add' && action.edge) {
        if (noteEdgeIndex(action.edge.a, action.edge.b) < 0) state.noteEdges.push(action.edge);
      } else if (action.type === 'remove' && action.edge) {
        const index = noteEdgeIndex(action.edge.a, action.edge.b);
        if (index >= 0) state.noteEdges.splice(index, 1);
      } else if (action.type === 'clear') {
        state.noteEdges = [];
        state.noteSelected = null;
      }
    }

    function undoNoteAction(action) {
      if (!action) return;
      if (action.type === 'add' && action.edge) {
        const index = noteEdgeIndex(action.edge.a, action.edge.b);
        if (index >= 0) state.noteEdges.splice(index, 1);
      } else if (action.type === 'remove' && action.edge) {
        if (noteEdgeIndex(action.edge.a, action.edge.b) < 0) state.noteEdges.push(action.edge);
      } else if (action.type === 'clear' && Array.isArray(action.edges)) {
        state.noteEdges = action.edges.slice();
      }
    }

    function undoMapNote() {
      const action = state.noteHistory.pop();
      if (!action) return;
      undoNoteAction(action);
      state.noteRedo.push(action);
      draw();
      focusCanvas();
    }

    function redoMapNote() {
      const action = state.noteRedo.pop();
      if (!action) return;
      applyNoteAction(action);
      state.noteHistory.push(action);
      draw();
      focusCanvas();
    }

    function clearMapNotes() {
      if (state.noteEdges.length) {
        state.noteHistory.push({ type: 'clear', edges: state.noteEdges.slice() });
        state.noteRedo = [];
      }
      state.noteEdges = [];
      state.noteSelected = null;
      draw();
      focusCanvas();
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
      canvas._noteTargets = [];
      canvas._noteTargetIds = new Set();

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

      if (state.showLines === true && skyConstellationLineDb) drawSkyAsterismLines(ctx, project, basis, radius, fovRad);

      const visibleStars = skyStars
        .filter(star => star.mag <= state.magLimit)
        .sort((a, b) => b.mag - a.mag);

      const noteTargets = (state.noteMode || state.noteEdges.length) ? noteVisibleTargets(visibleStars, basis, radius, fovRad) : null;
      if (noteTargets) drawNoteEdges(noteTargets.byId, noteTargets.starById, basis, radius, fovRad);

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

      if (state.showDso === true) {
        for (const dso of buildSkyDsoObjects().filter(o => o.v && o.hasReliablePosition && String(o.commonName || '').trim())) {
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
        }
      }

      if (state.noteMode && noteTargets) drawNoteSelection(noteTargets.byId);

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
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const fovRad = state.fov * Math.PI / 180;
      const basis = ensureOrientation();
      const clickedVec = vectorFromCanvasPoint(x, y, basis, radius, fovRad);
      const hit = pickFromLayer(canvas._pickLayer, x, y);

      if (!hit) {
        if (!clickedVec) {
          state.message = '';
          state.searchMarker = null;
          msg.textContent = '';
          draw();
          return;
        }
        state.searchMarker = { v: clickedVec, payload: { type: 'position', v: clickedVec } };
        state.message = raDecInfoHtml(clickedVec);
        msg.innerHTML = state.message;
        draw();
        return;
      }

      const v = hit.type === 'dso' ? hit.dso.v : hit.star.v;
      state.searchMarker = { v, payload: hit };
      const info = hit.type === 'dso' ? dsoInfoHtml(hit.dso) : starInfoHtml(hit.star);
      state.message = `${info}<br>${raDecInfoHtml(v)}`;
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
      if (curated) labels.push(curated.designation, `${curated.designation} ${starPreferredName(curated)}`, ...starAnswerNames(curated));
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

      buildSkyDsoObjects().filter(dso => dso.v && dso.hasReliablePosition && String(dso.commonName || '').trim()).forEach(dso => {
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
      buildSkyDsoObjects().filter(dso => dso.v && dso.hasReliablePosition).forEach(dso => {
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

    $('#mapLines').addEventListener('change', e => {
      state.showLines = e.target.checked;
      if (state.showLines === true) ensureConstellationLinesLoadedThenDraw();
      else draw();
      focusCanvas();
    });

    $('#mapDso').addEventListener('change', e => {
      state.showDso = e.target.checked;
      draw();
      focusCanvas();
    });

    $('#mapNotes').addEventListener('change', e => {
      state.noteMode = e.target.checked;
      if (!state.noteMode) state.noteSelected = null;
      const noteControls = $('#mapNoteControls');
      if (noteControls) noteControls.style.display = state.noteMode ? '' : 'none';
      draw();
      focusCanvas();
    });
    $('#mapUndoNotes').addEventListener('click', undoMapNote);
    $('#mapClearNotes').addEventListener('click', clearMapNotes);

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

      if (drag && drag.start && drag.moved < 6) {
        if (state.noteMode) handleNoteClick(last.x, last.y);
        else selectAt(last.x, last.y);
      }

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
      if (state.noteMode && (e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'z') {
        e.preventDefault();
        undoMapNote();
        return;
      }
      if (state.noteMode && (e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'y') {
        e.preventDefault();
        redoMapNote();
        return;
      }
      const step = e.shiftKey ? 28 : 12;
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { e.preventDefault(); move(-step, 0); }
      if (['ArrowRight', 'd', 'D'].includes(e.key)) { e.preventDefault(); move(step, 0); }
      if (['ArrowUp', 'w', 'W'].includes(e.key)) { e.preventDefault(); move(0, -step); }
      if (['ArrowDown', 's', 'S'].includes(e.key)) { e.preventDefault(); move(0, step); }
    });

    if (!state.loaded && !state.loading) {
      state.loading = true; showLoadingOverlay('loading sky data');
      Promise.all([loadSkyData(), loadConstellationBounds().catch(() => []), loadDsoCoordinateData().catch(() => new Map())]).then(() => {
        buildSkyDsoObjects();
        state.loaded = true;
        hideLoadingOverlay(); state.loading = false;
        populateMapSearchList();
        draw();
        if (state.showLines === true) ensureConstellationLinesLoadedThenDraw();
        focusCanvas();
      }).catch(err => {
        console.warn('iloveastro: Sky Map loading failed.', err);
        state.error = 'sky data unavailable';
        hideLoadingOverlay(); state.loading = false;
        draw();
      });
    }

    if (state.loaded) populateMapSearchList();
    draw();
    if (state.loaded && state.showLines === true && !skyConstellationLineDb && !state.linesLoading) ensureConstellationLinesLoadedThenDraw();
    setTimeout(focusCanvas, 0);
  }

  function renderGuessConstellation() {
    const state = states.guessconst || (states.guessconst = {
      loaded: false,
      loading: false,
      error: '',
      mode: '1',
      targets: [],
      target: '',
      stars: [],
      rotation: 0,
      message: '',
      answered: false,
      autoCheck: false,
      magLimit: defaultMag(),
      showLines: false,
      inputs: [],
      found: [],
      roundPools: {},
      viewZoom: 1,
      viewOrient: null,
      noteMode: false,
      noteEdges: [],
      noteSelected: null,
      noteHistory: [],
      noteRedo: []
    });

    function normaliseMode(value) {
      const v = String(value || '1');
      return ['1', '3', '5'].includes(v) ? v : '1';
    }

    state.mode = normaliseMode(state.mode);
    if (!Array.isArray(state.targets)) state.targets = state.target ? [state.target] : [];
    if (!Array.isArray(state.inputs)) state.inputs = [];
    if (!Array.isArray(state.found)) state.found = [];
    if (!state.roundPools || typeof state.roundPools !== 'object') state.roundPools = {};
    if (typeof state.autoCheck !== 'boolean') state.autoCheck = false;
    if (!Number.isFinite(state.viewZoom)) state.viewZoom = 1;
    if (!state.viewOrient || typeof state.viewOrient !== 'object') state.viewOrient = null;
    if (typeof state.noteMode !== 'boolean') state.noteMode = false;
    if (!Array.isArray(state.noteEdges)) state.noteEdges = [];
    if (!Array.isArray(state.noteHistory)) state.noteHistory = [];
    if (!Array.isArray(state.noteRedo)) state.noteRedo = [];
    if (state.noteSelected !== null && typeof state.noteSelected !== 'string') state.noteSelected = null;

    const modeCount = Number(state.mode);
    const scoreId = () => state.mode === '1' ? 'guessconst' : `guessconst${state.mode}`;
    const savedValue = i => esc(state.inputs[i] || '');

    app.innerHTML = `<h2>Guess Constellation</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="guessConstCanvas" width="900" height="900" aria-label="constellation guess map"></canvas></section><aside class="panel"><div class="prompt">Which constellation${modeCount > 1 ? 's are these' : ' is this'}?</div><div class="guess-mode-row"><select id="guessConstMode" aria-label="guess constellation mode"><option value="1" ${state.mode === '1' ? 'selected' : ''}>1 constellation</option><option value="3" ${state.mode === '3' ? 'selected' : ''}>3 constellations</option><option value="5" ${state.mode === '5' ? 'selected' : ''}>5 constellations</option></select></div><label>Limiting magnitude<div class="slider-text-row"><input id="guessConstMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="guessConstMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><label class="checkline"><input id="guessConstLines" type="checkbox" ${state.showLines === true ? 'checked' : ''}><span>constellation lines</span></label><label class="checkline"><input id="guessConstNotes" type="checkbox" ${state.noteMode === true ? 'checked' : ''}><span>make notes</span></label><div id="guessConstNoteControls" class="controls map-note-controls" ${state.noteMode === true ? "" : 'style="display:none"'}><button type="button" id="guessConstUndoNotes">undo</button><button type="button" id="guessConstClearNotes">clear notes</button></div><div class="controls"><button type="button" id="guessConstRollCCW">↺ rotate</button><button type="button" id="guessConstRollCW">rotate ↻</button></div><div class="controls"><button type="button" id="guessConstZoomOut">− zoom</button><button type="button" id="guessConstZoomIn">zoom +</button><button type="button" id="guessConstResetView">reset view</button></div>${modeCount > 1 ? `<label class="checkline"><input id="guessConstAuto" type="checkbox" ${state.autoCheck ? 'checked' : ''}><span>autocheck</span></label>` : ''}<div id="guessConstInputs" class="guess-const-inputs">${Array.from({ length: modeCount }, (_, i) => `<input class="guessConstAnswer" autocomplete="off" value="${savedValue(i)}" placeholder="constellation ${modeCount > 1 ? i + 1 : 'name'}">`).join('')}</div><div class="controls"><button type="button" id="guessConstReveal">reveal</button></div><div class="controls new-round-controls"><button type="button" id="guessConstNew" class="new-round-button">${modeCount > 1 ? 'new constellations' : 'new constellation'}</button></div><div id="guessConstMsg" class="message">${state.message || ''}</div><div id="guessConstStats" class="stats">${formatScore(scoreId())}</div></aside></div>`;
    initRangeVisuals(app);
    setupSphereFullscreen();

    const canvas = $('#guessConstCanvas'), ctx = canvas.getContext('2d');
    const msg = $('#guessConstMsg');
    const stats = $('#guessConstStats');

    function ensureGuessConstellationLinesLoadedThenDraw() {
      if (!state.loaded || state.showLines !== true) return;
      if (skyConstellationLineDb) {
        draw();
        return;
      }
      if (msg && !state.message) msg.textContent = 'loading constellation lines...';
      loadSkyConstellationLines().then(() => {
        if (msg && !state.message) msg.textContent = '';
        draw();
      }).catch(err => {
        console.warn('iloveastro: Guess Constellation lines could not be loaded.', err);
        if (msg && !state.message) msg.textContent = 'constellation lines unavailable';
        draw();
      });
    }

    function updateStats() {
      if (stats) stats.innerHTML = formatScore(scoreId());
    }

    function constellationNamesForBalance() {
      return DATA.constellations.map(c => c.name);
    }

    function shuffledCopy(list) {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }

    function zeroExposureMap(names = constellationNamesForBalance()) {
      return new Map(names.map(name => [name, 0]));
    }

    function exposureSum(exposure, targets) {
      return targets.reduce((sum, name) => sum + (exposure.get(name) || 0), 0);
    }

    function addExposure(exposure, targets) {
      targets.forEach(name => exposure.set(name, (exposure.get(name) || 0) + 1));
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

    function makeSingleConstellationPool() {
      return shuffledCopy(constellationNamesForBalance()).map(name => ({
        targets: [name],
        rotation: Math.random() * Math.PI * 2
      }));
    }

    function connectedSetForAnchor(anchor, count, graph, exposure) {
      if (count <= 1) return [anchor];
      let best = null;

      for (let attempt = 0; attempt < 120; attempt++) {
        const chosen = [anchor];
        while (chosen.length < count) {
          const frontier = [...new Set(chosen.flatMap(n => [...(graph.get(n) || [])]).filter(n => !chosen.includes(n)))];
          if (!frontier.length) break;
          frontier.sort((a, b) => ((exposure.get(a) || 0) - (exposure.get(b) || 0)) || (Math.random() - 0.5));
          const shortlist = frontier.slice(0, Math.min(5, frontier.length));
          chosen.push(rand(shortlist));
        }
        if (chosen.length !== count) continue;
        const score = exposureSum(exposure, chosen) + Math.random() * 0.05;
        if (!best || score < best.score) best = { targets: chosen, score };
      }
      if (best) return best.targets;

      const fallback = [anchor];
      while (fallback.length < count) {
        const frontier = [...new Set(fallback.flatMap(n => [...(graph.get(n) || [])]).filter(n => !fallback.includes(n)))];
        if (!frontier.length) break;
        fallback.push(frontier.sort((a, b) => (exposure.get(a) || 0) - (exposure.get(b) || 0))[0]);
      }
      return fallback.length === count ? fallback : constellationNamesForBalance().slice(0, count);
    }

    function makeConnectedConstellationPool(count) {
      const graph = guessConstellationGraph();
      const names = shuffledCopy([...graph.entries()].filter(([, ns]) => ns.size).map(([name]) => name));
      const exposure = zeroExposureMap();
      const rounds = [];

      names.forEach(anchor => {
        const targets = connectedSetForAnchor(anchor, count, graph, exposure);
        rounds.push({ targets, rotation: Math.random() * Math.PI * 2 });
        addExposure(exposure, targets);
      });

      return shuffledCopy(rounds);
    }

    function makeBalancedRoundPool(mode) {
      if (mode === '1') return makeSingleConstellationPool();
      if (mode === '3') return makeConnectedConstellationPool(3);
      if (mode === '5') return makeConnectedConstellationPool(5);
      return makeSingleConstellationPool();
    }

    function nextBalancedRound(mode) {
      if (!state.roundPools[mode] || !state.roundPools[mode].length) state.roundPools[mode] = makeBalancedRoundPool(mode);
      return state.roundPools[mode].pop();
    }

    function starsInConstellations(names) {
      return uniqueSkyStars(names.flatMap(name => guessStarsForConstellation(name, state.magLimit)));
    }

    function guessViewVectors() {
      const out = state.stars.map(s => s.v);
      if (state.showLines === true && skyConstellationLineDb && skyHipByNumber.size) {
        const wanted = new Set(state.targets.map(compact));
        skyLineEdgesFromDatabase().forEach(edge => {
          if (!wanted.has(compact(edge.constellation))) return;
          out.push(edge.s1.v, edge.s2.v);
        });
      }
      return out.length ? out : state.stars.map(s => s.v);
    }

    function guessProjectedFitCoordinates(basis, vectors) {
      return vectors.map(v => {
        const z = dot(v, basis.f);
        const ang = Math.acos(Math.max(-1, Math.min(1, z)));
        const sin = Math.sin(ang) || 1e-9;
        return {
          x: ang * dot(v, basis.right) / sin,
          y: ang * dot(v, basis.up) / sin
        };
      });
    }

    function guessBestFitMetrics() {
      const vectors = guessViewVectors();
      const sum = vectors.reduce((v, p) => ({ x: v.x + p.x, y: v.y + p.y, z: v.z + p.z }), { x: 0, y: 0, z: 0 });
      let basis = localBasisFromForward(normVec(sum));
      for (let i = 0; i < 6; i++) {
        const pts = guessProjectedFitCoordinates(basis, vectors);
        const minX = Math.min(...pts.map(p => p.x));
        const maxX = Math.max(...pts.map(p => p.x));
        const minY = Math.min(...pts.map(p => p.y));
        const maxY = Math.max(...pts.map(p => p.y));
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        if (Math.hypot(midX, midY) < 0.0005) break;
        let f = rotateGuessVector(basis.f, basis.up, -midX);
        f = rotateGuessVector(f, basis.right, midY);
        basis = localBasisFromForward(f);
      }
      const pts = guessProjectedFitCoordinates(basis, vectors);
      const radius = Math.max(...pts.map(p => Math.hypot(p.x, p.y)), 4 * Math.PI / 180);
      return { basis, radius };
    }

    function guessViewCentre() {
      return guessBestFitMetrics().basis.f;
    }

    function guessAngularRadius() {
      return guessBestFitMetrics().radius;
    }

    function guessFovDeg() {
      const radiusDeg = guessBestFitMetrics().radius * 180 / Math.PI;
      return Math.max(10, Math.min(170, radiusDeg * 2.08 + 0.8));
    }

    function rotateGuessVector(v, axis, angle) {
      const c = Math.cos(angle), s = Math.sin(angle), d = dot(axis, v), cr = cross(axis, v);
      return normVec({
        x: v.x * c + cr.x * s + axis.x * d * (1 - c),
        y: v.y * c + cr.y * s + axis.y * d * (1 - c),
        z: v.z * c + cr.z * s + axis.z * d * (1 - c)
      });
    }

    function cleanGuessBasis(basis) {
      const f = normVec(basis.f);
      let right = basis.right;
      const proj = dot(right, f);
      right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
      if (!Number.isFinite(right.x)) return localBasisFromForward(f);
      const up = normVec(cross(right, f));
      return { f, right: normVec(cross(f, up)), up };
    }

    function clampGuessView() {
      const fit = guessBestFitMetrics();
      const centre = fit.basis.f;
      const limit = fit.radius;
      const b = cleanGuessBasis(state.viewOrient || fit.basis);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot(centre, b.f))));
      if (angle <= limit + 1e-6) {
        state.viewOrient = b;
        return;
      }
      const axis = normVec(cross(centre, b.f));
      if (!Number.isFinite(axis.x)) {
        state.viewOrient = fit.basis;
        return;
      }
      const f = rotateGuessVector(centre, axis, limit);
      state.viewOrient = localBasisFromForward(f);
    }

    function ensureGuessViewOrient() {
      if (!state.viewOrient || !state.viewOrient.f || !state.viewOrient.right || !state.viewOrient.up) {
        state.viewOrient = guessBestFitMetrics().basis;
      }
      state.viewOrient = cleanGuessBasis(state.viewOrient);
      clampGuessView();
      return state.viewOrient;
    }

    function rotateGuessView(axis, angle) {
      const b = ensureGuessViewOrient();
      state.viewOrient = cleanGuessBasis({
        f: rotateGuessVector(b.f, axis, angle),
        right: rotateGuessVector(b.right, axis, angle),
        up: rotateGuessVector(b.up, axis, angle)
      });
      clampGuessView();
    }

    function applyRound(round) {
      state.targets = round?.targets || [];
      state.target = state.targets[0] || '';
      state.rotation = Number.isFinite(round?.rotation) ? round.rotation : Math.random() * Math.PI * 2;
      state.stars = starsInConstellations(state.targets);
      state.message = '';
      state.answered = false;
      state.showLines = false;
      state.viewZoom = 1;
      state.viewOrient = null;
      state.found = [];
      state.inputs = Array.from({ length: modeCount }, (_, i) => state.inputs[i] || '');
      state.noteEdges = [];
      state.noteSelected = null;
      state.noteHistory = [];
      state.noteRedo = [];
    }

    function chooseQuestion() {
      applyRound(nextBalancedRound(state.mode));
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
      if (!state.targets.length || state.targets.length !== modeCount) chooseQuestion();
      drawnGuessStars = drawConstellationStarMap(canvas, state.target || state.targets[0], {
        magLimit: state.magLimit,
        rotation: state.rotation,
        stars: state.stars,
        showLines: state.showLines === true && !!skyConstellationLineDb,
        constellations: state.targets,
        projection: 'sphere',
        fovDeg: guessFovDeg(),
        zoom: state.viewZoom,
        viewBasis: ensureGuessViewOrient(),
        rollCentre: guessBestFitMetrics().basis.f
      });
      drawGuessNotes();
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

    function guessNoteStarId(star) {
      if (star?.hip) return `hip:${star.hip}`;
      const label = compact(star?.name || star?.designation || '');
      const ra = Math.round((star?.ra || 0) * 1000);
      const dec = Math.round((star?.dec || 0) * 1000);
      return `star:${label}:${ra}:${dec}`;
    }

    function guessNoteEdgeKey(a, b) {
      return [a, b].sort().join('|');
    }

    function normaliseGuessNoteEdges() {
      const seen = new Set();
      state.noteEdges = state.noteEdges.filter(edge => {
        if (!edge || typeof edge.a !== 'string' || typeof edge.b !== 'string' || edge.a === edge.b) return false;
        const key = guessNoteEdgeKey(edge.a, edge.b);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function guessNoteTargets() {
      const byId = new Map();
      drawnGuessStars.forEach(p => {
        const id = guessNoteStarId(p.star);
        if (!byId.has(id)) byId.set(id, { ...p, id });
      });
      return byId;
    }

    function drawGuessNotes() {
      normaliseGuessNoteEdges();
      if (!state.noteMode && !state.noteEdges.length) return;
      const byId = guessNoteTargets();
      if (state.noteEdges.length) {
        ctx.save();
        ctx.strokeStyle = '#111';
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        state.noteEdges.forEach(edge => {
          const a = byId.get(edge.a);
          const b = byId.get(edge.b);
          if (!a || !b) return;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
        ctx.restore();
      }
      if (state.noteMode && state.noteSelected) {
        const selected = byId.get(state.noteSelected);
        if (selected) {
          ctx.save();
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(selected.x, selected.y, Math.max(9, selected.r + 2), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    function nearestGuessNoteTarget(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = (clientX - rect.left) * canvas.width / rect.width;
      const y = (clientY - rect.top) * canvas.height / rect.height;
      const hits = [...guessNoteTargets().values()]
        .map(target => ({ target, d: Math.hypot(target.x - x, target.y - y) }))
        .filter(hit => hit.d <= Math.max(12, hit.target.r + 8))
        .sort((a, b) => a.d - b.d);
      if (!hits.length) return null;
      if (hits[0].d <= 8) return hits[0].target;
      if (hits[1] && hits[1].d - hits[0].d < 4) return null;
      return hits[0].target;
    }

    function applyGuessNoteAction(action) {
      if (!action) return;
      if (action.type === 'add') {
        state.noteEdges.push({ a: action.a, b: action.b });
      } else if (action.type === 'remove') {
        const key = guessNoteEdgeKey(action.a, action.b);
        state.noteEdges = state.noteEdges.filter(edge => guessNoteEdgeKey(edge.a, edge.b) !== key);
      } else if (action.type === 'clear') {
        state.noteEdges = [];
        state.noteSelected = null;
      }
      normaliseGuessNoteEdges();
    }

    function undoGuessNoteAction(action) {
      if (!action) return;
      if (action.type === 'add') applyGuessNoteAction({ type: 'remove', a: action.a, b: action.b });
      else if (action.type === 'remove') applyGuessNoteAction({ type: 'add', a: action.a, b: action.b });
      else if (action.type === 'clear') {
        state.noteEdges = action.edges.map(edge => ({ ...edge }));
        normaliseGuessNoteEdges();
      }
    }

    function handleGuessNoteClick(clientX, clientY) {
      const target = nearestGuessNoteTarget(clientX, clientY);
      if (!target) {
        state.noteSelected = null;
        draw();
        return;
      }
      if (!state.noteSelected) {
        state.noteSelected = target.id;
        draw();
        return;
      }
      if (state.noteSelected === target.id) {
        state.noteSelected = null;
        draw();
        return;
      }
      const a = state.noteSelected;
      const b = target.id;
      const key = guessNoteEdgeKey(a, b);
      const exists = state.noteEdges.some(edge => guessNoteEdgeKey(edge.a, edge.b) === key);
      const action = exists ? { type: 'remove', a, b } : { type: 'add', a, b };
      applyGuessNoteAction(action);
      state.noteHistory.push(action);
      state.noteRedo = [];
      state.noteSelected = target.id;
      draw();
    }

    function undoGuessNotes() {
      const action = state.noteHistory.pop();
      if (!action) return;
      undoGuessNoteAction(action);
      state.noteRedo.push(action);
      draw();
    }

    function redoGuessNotes() {
      const action = state.noteRedo.pop();
      if (!action) return;
      applyGuessNoteAction(action);
      state.noteHistory.push(action);
      draw();
    }

    function clearGuessNotes() {
      if (!state.noteEdges.length && !state.noteSelected) return;
      const edges = state.noteEdges.map(edge => ({ ...edge }));
      state.noteHistory.push({ type: 'clear', edges });
      state.noteRedo = [];
      state.noteEdges = [];
      state.noteSelected = null;
      draw();
    }
    let guessDrag = null;
    function canvasDelta(e, previous) {
      const rect = canvas.getBoundingClientRect();
      return {
        dx: (e.clientX - previous.x) * canvas.width / rect.width,
        dy: (e.clientY - previous.y) * canvas.height / rect.height
      };
    }
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      guessDrag = { id: e.pointerId, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: 0 };
    });
    function rotateGuessViewByPixels(dx, dy, multiplier = 1) {
      const b = ensureGuessViewOrient();
      const anglePerPx = (guessFovDeg() * Math.PI / 180) / Math.max(1, Math.min(canvas.width, canvas.height)) / Math.max(0.6, state.viewZoom) * multiplier;
      rotateGuessView(b.up, -dx * anglePerPx);
      rotateGuessView(ensureGuessViewOrient().right, -dy * anglePerPx);
      draw();
    }
    canvas.addEventListener('pointermove', e => {
      if (!guessDrag || guessDrag.id !== e.pointerId) return;
      const delta = canvasDelta(e, { x: guessDrag.lastX, y: guessDrag.lastY });
      guessDrag.moved += Math.hypot(e.clientX - guessDrag.lastX, e.clientY - guessDrag.lastY);
      guessDrag.lastX = e.clientX;
      guessDrag.lastY = e.clientY;
      if (guessDrag.moved >= 3) rotateGuessViewByPixels(delta.dx, delta.dy, 1);
    });
    function finishGuessPointer(e) {
      if (!guessDrag || guessDrag.id !== e.pointerId) return;
      const moved = guessDrag.moved;
      guessDrag = null;
      if (moved < 6) {
        if (state.noteMode) handleGuessNoteClick(e.clientX, e.clientY);
        else selectGuessStar(e.clientX, e.clientY);
      }
    }
    canvas.addEventListener('pointerup', finishGuessPointer);
    canvas.addEventListener('pointercancel', () => { guessDrag = null; });
    canvas.addEventListener('lostpointercapture', () => { guessDrag = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const factor = Math.exp(-e.deltaY * 0.0032);
        state.viewZoom = clampNumber(state.viewZoom * factor, 0.55, 4.5, 1);
        draw();
        return;
      }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.height : 1;
      const dx = (e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit;
      const dy = (e.shiftKey ? 0 : e.deltaY) * unit;
      rotateGuessViewByPixels(dx, dy, 0.45);
    }, { passive: false });

    function targetMatches(value, target) {
      return answerMatches(value, [target]);
    }

    function matchedTargets() {
      const used = new Set();
      document.querySelectorAll('.guessConstAnswer').forEach((input, i) => {
        const value = input.value.trim();
        state.inputs[i] = input.value;
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
      if (state.mode !== '1' && state.autoCheck) {
        state.message = matched.length ? `${matched.length}/${modeCount} correct: ${matched.join(', ')}` : '';
        msg.textContent = state.message;
      }
      if (matched.length === modeCount && (state.mode === '1' || allInputsFilled())) {
        state.answered = true;
        record(scoreId(), true);
        state.message = state.mode === '1' ? `correct: ${state.targets[0]}` : `correct: ${state.targets.join(', ')}`;
        msg.textContent = state.message;
        updateStats();
      }
    }

    function newQuestion() {
      if (!state.loaded) return;
      state.inputs = [];
      chooseQuestion();
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

    function setGuessZoom(factor) {
      state.viewZoom = clampNumber(state.viewZoom * factor, 0.55, 4.5, 1);
      draw();
    }

    function resetGuessView() {
      state.viewZoom = 1;
      state.viewOrient = guessBestFitMetrics().basis;
      draw();
    }

    $('#guessConstMode').addEventListener('change', e => {
      state.mode = normaliseMode(e.target.value);
      state.targets = [];
      state.target = '';
      state.message = '';
      state.answered = false;
      state.inputs = [];
      state.found = [];
      renderGuessConstellation();
    });
    $('#guessConstMag').addEventListener('input', e => setGuessMag(e.target.value));
    $('#guessConstMagSlider').addEventListener('input', e => setGuessMag(e.target.value));
    $('#guessConstLines').addEventListener('change', e => {
      state.showLines = e.target.checked;
      if (state.showLines === true) ensureGuessConstellationLinesLoadedThenDraw();
      else draw();
    });
    $('#guessConstNotes').addEventListener('change', e => {
      state.noteMode = e.target.checked;
      if (!state.noteMode) state.noteSelected = null;
      const noteControls = $('#guessConstNoteControls');
      if (noteControls) noteControls.style.display = state.noteMode ? '' : 'none';
      draw();
    });
    $('#guessConstUndoNotes').addEventListener('click', undoGuessNotes);
    $('#guessConstClearNotes').addEventListener('click', clearGuessNotes);
    $('#guessConstRollCCW').addEventListener('click', () => rotateGuess(-1));
    $('#guessConstRollCW').addEventListener('click', () => rotateGuess(1));
    $('#guessConstZoomOut').addEventListener('click', () => setGuessZoom(1 / 1.28));
    $('#guessConstZoomIn').addEventListener('click', () => setGuessZoom(1.28));
    $('#guessConstResetView').addEventListener('click', resetGuessView);
    if ($('#guessConstAuto')) $('#guessConstAuto').addEventListener('change', e => {
      state.autoCheck = e.target.checked;
      if (state.autoCheck) checkAnswers();
      else if (!state.answered) { state.message = ''; msg.textContent = ''; }
    });
    document.querySelectorAll('.guessConstAnswer').forEach((input, index, inputs) => {
      input.addEventListener('input', e => {
        state.inputs[index] = e.target.value;
        checkAnswers();
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          newQuestion();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          checkAnswers();
          const next = inputs[index + 1];
          if (next) next.focus();
        }
      });
    });
    $('#guessConstReveal').addEventListener('click', reveal);
    $('#guessConstNew').addEventListener('click', newQuestion);
    app.addEventListener('keydown', e => {
      if (!state.noteMode || !(e.ctrlKey || e.metaKey)) return;
      const key = String(e.key || '').toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        undoGuessNotes();
      } else if (key === 'y') {
        e.preventDefault();
        redoGuessNotes();
      }
    });
    setShiftEnterAction(newQuestion);

    if (!state.loaded && !state.loading) {
      state.loading = true; showLoadingOverlay('loading sky data');
      Promise.all([loadSkyData(), loadConstellationBounds().catch(() => []), ensureSkyRaceGraph()]).then(() => {
        state.loaded = true;
        hideLoadingOverlay(); state.loading = false;
        chooseQuestion();
        renderGuessConstellation();
      }).catch(() => {
        state.error = 'sky data unavailable';
        hideLoadingOverlay(); state.loading = false;
        draw();
      });
    }
    draw();
    if (state.loaded && state.showLines === true && !skyConstellationLineDb) ensureGuessConstellationLinesLoadedThenDraw();
    setTimeout(() => {
      const first = document.querySelector('.guessConstAnswer');
      if (first) first.focus();
    }, 0);
  }

  function renderAlphaPin() {
    const state = states.alphapin || (states.alphapin = { loaded: false, loading: false, error: '', fov: defaultFov(), magLimit: defaultMag(), showLines: false, target: null, selectedVec: null, result: '', submitted: false, orient: null });
    app.innerHTML = `<h2>Find Constellation</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="alphaCanvas" width="900" height="900" tabindex="0" aria-label="alpha star guessing sphere"></canvas></section><aside class="panel"><div class="prompt">Find&nbsp;<strong>${esc(state.target ? state.target.constellation : '...')}</strong>.</div><label>FOV degrees<div class="slider-text-row"><input id="alphaFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="alphaFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label><label>Star density / faintest magnitude<div class="slider-text-row"><input id="alphaMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="alphaMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label><label class="checkline"><input id="alphaLines" type="checkbox" ${state.showLines === true ? 'checked' : ''}><span>constellation lines</span></label><div class="sky-nav-grid" aria-label="alpha movement controls"><button type="button" data-amove="-1,-1">↖</button><button type="button" data-amove="0,-1">↑</button><button type="button" data-amove="1,-1">↗</button><button type="button" data-amove="-1,0">←</button><button type="button" id="alphaCentre">○</button><button type="button" data-amove="1,0">→</button><button type="button" data-amove="-1,1">↙</button><button type="button" data-amove="0,1">↓</button><button type="button" data-amove="1,1">↘</button></div><div class="controls"><button type="button" id="alphaRollCCW">↺ rotate</button><button type="button" id="alphaRollCW">rotate ↻</button></div><div class="controls"><button type="button" id="alphaSubmit">submit</button><button type="button" id="alphaZoomOut">− zoom</button><button type="button" id="alphaZoomIn">zoom +</button></div><div class="controls new-round-controls"><button type="button" id="alphaNew" class="new-round-button">new constellation</button></div><div id="alphaMsg" class="message">${esc(state.result || '')}</div><div class="stats">${formatPointScore('alphapin')}</div><div class="small alpha-pin-hint">(pin the alpha star)</div></aside></div>`;
    initRangeVisuals(app);
    setupSphereFullscreen();
    const canvas = $('#alphaCanvas'), ctx = canvas.getContext('2d');
    function focusCanvas() { try { canvas.focus({ preventScroll: true }); } catch { focusCanvas(); } }
    function ensureAlphaConstellationLinesLoadedThenDraw() {
      if (!state.loaded || state.showLines !== true) return;
      if (skyConstellationLineDb) {
        draw();
        return;
      }
      const msg = $('#alphaMsg');
      if (msg && !state.result) msg.textContent = 'loading constellation lines...';
      loadSkyConstellationLines().then(() => {
        if (msg && !state.result) msg.textContent = '';
        draw();
      }).catch(err => {
        console.warn('iloveastro: Find Constellation lines could not be loaded.', err);
        if (msg && !state.result) msg.textContent = 'constellation lines unavailable';
        draw();
      });
    }

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
      if (state.showLines === true && skyConstellationLineDb) drawSkyAsterismLines(ctx, project, b, radius, fovRad);
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
    $('#alphaLines').addEventListener('change', e => {
      state.showLines = e.target.checked;
      if (state.showLines === true) ensureAlphaConstellationLinesLoadedThenDraw();
      else draw();
      focusCanvas();
    });
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
      state.loading = true; showLoadingOverlay('loading sky data');
      loadSkyData().then(() => { state.loaded = true; hideLoadingOverlay(); state.loading = false; skyAlphaCache = null; ensureTarget(); renderAlphaPin(); }).catch(err => { state.error = 'sky data unavailable'; hideLoadingOverlay(); state.loading = false; draw(); });
    }
    ensureTarget(); draw();
    if (state.loaded && state.showLines === true && !skyConstellationLineDb) ensureAlphaConstellationLinesLoadedThenDraw();
    setTimeout(() => canvas.focus(), 0);
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
      state.loading = true; showLoadingOverlay('loading sky data');
      Promise.all([loadSkyData(), loadConstellationBounds().catch(() => [])]).then(() => { state.loaded = true; hideLoadingOverlay(); state.loading = false; draw(); focusCanvas(); }).catch(err => { state.error = 'sky data unavailable'; hideLoadingOverlay(); state.loading = false; draw(); });
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
  function skyRaceUnifySerpensGraph(graph) {
    if (!graph.has(SERPENS_CAPUT) || !graph.has(SERPENS_CAUDA)) return graph;
    const union = new Set([
      ...SERPENS_CAPUT_BORDERS,
      ...SERPENS_CAUDA_BORDERS,
      ...(graph.get(SERPENS_CAPUT) || []),
      ...(graph.get(SERPENS_CAUDA) || [])
    ]);
    union.delete(SERPENS_CAPUT);
    union.delete(SERPENS_CAUDA);
    union.forEach(n => {
      skyRaceAddEdge(graph, SERPENS_CAPUT, n);
      skyRaceAddEdge(graph, SERPENS_CAUDA, n);
    });
    skyRaceAddEdge(graph, SERPENS_CAPUT, SERPENS_CAUDA);
    return graph;
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
    return skyRaceUnifySerpensGraph(graph);
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
    skyRaceUnifySerpensGraph(graph);

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
      showLoadingOverlay('loading borders');
      ensureSkyRaceGraph().then(() => { hideLoadingOverlay(); renderSkyRace(); });
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
      const splitNote = state.current === SERPENS_CAPUT || state.current === SERPENS_CAUDA ? '<p class="small">Serpens is split on the chart; both halves use the full Serpens border set.</p>' : '';
      app.innerHTML = `<h2>SkyRace</h2><div class="sky-race-layout"><aside class="panel"><p class="sky-race-task"><strong>${esc(state.start)} → ${esc(state.target)}</strong></p><p><strong>current:</strong> ${esc(state.current)}</p><p><strong>clicks:</strong> ${Math.max(0, state.route.length - 1)}</p>${splitNote}<h3>Bordering constellations</h3><div id="skyRaceBorders" class="sky-race-neighbours">${ns.map(n => `<button type="button" class="linkbtn ${n === state.target ? 'sky-race-target-option' : ''}" data-race-border="${esc(n)}">${esc(n)}</button>`).join(' ')}</div><div class="message">${state.message || ''}</div><div class="controls new-round-controls"><button type="button" id="skyRaceNew" class="new-round-button">new race</button></div><h3>Route</h3><p class="small">${routeText}</p><div class="stats">${formatPointScore('skyrace')}</div></aside><section class="panel"><h3>${esc(state.current)}</h3>${currentChart()}</section></div>`;
      $('#skyRaceNew').addEventListener('click', newRace);
      setShiftEnterAction(newRace);
      document.querySelectorAll('[data-race-border]').forEach(btn => btn.addEventListener('click', () => jump(btn.dataset.raceBorder)));
    }
    draw();
  }

  function renderTables() {
    if (!namedStarCatalogueReady) {
      deferForNamedStars('Tables', () => { if (activeGame === 'tables') renderTables(); });
      return;
    }
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

    function cellText(cell) {
      if (cell && typeof cell === 'object') return String(cell.text ?? cell.value ?? '');
      return String(cell ?? '');
    }
    function cellHtml(cell) {
      if (cell && typeof cell === 'object' && 'html' in cell) return String(cell.html || '');
      return esc(cellText(cell));
    }
    function table(columns, rows) {
      const q = norm(search.value);
      let filtered = rows.filter(r => !q || norm(r.map(cellText).join(' ')).includes(q));
      const sort = state.sort[state.mode];
      if (sort && columns[sort.index] && columns[sort.index].sortable) {
        const col = columns[sort.index];
        filtered = filtered.slice().sort((a, b) => compareValues(cellText(a[sort.index]), cellText(b[sort.index]), col.sortType, sort.dir));
      }
      wrap.innerHTML = `<table><thead><tr>${columns.map((col, i) => {
        if (!col.sortable) return `<th>${esc(col.label)}</th>`;
        const active = sort && sort.index === i;
        const mark = active ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : '';
        return `<th><button type="button" class="table-sort ${active ? 'active' : ''}" data-sort-index="${i}">${esc(col.label)}${mark}</button></th>`;
      }).join('')}</tr></thead><tbody>${filtered.map(r => `<tr>${r.map(x => `<td>${cellHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      document.querySelectorAll('[data-sort-index]').forEach(btn => btn.addEventListener('click', () => {
        const index = Number(btn.dataset.sortIndex);
        const current = state.sort[state.mode];
        state.sort[state.mode] = current && current.index === index && current.dir === 'asc' ? { index, dir: 'desc' } : { index, dir: 'asc' };
        redraw();
      }));
      wrap.querySelectorAll('[data-star-name-group]').forEach(select => select.addEventListener('change', () => {
        setStarPreferredName(select.dataset.starNameGroup, select.value);
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
          { label: 'mag', sortable: true },
          { label: 'note', sortable: false }
        ], DATA.stars.map(s => [{ text: [starPreferredName(s), ...starAnswerNames(s)].join(' '), value: starPreferredName(s), html: starNameChoiceHtml(s) }, starDesignation(s) || greekDesignationText(s.designation), s.constellation, Number.isFinite(s.mag) ? s.mag.toFixed(2) : '', s.note]));
      } else if (state.mode === 'dso') {
        table([
          { label: 'code', sortable: true, sortType: 'dsoCode' },
          { label: 'common name', sortable: true },
          { label: 'type', sortable: true },
          { label: 'constellation', sortable: true }
        ], DATA.dso.filter(passesDsoFilters).map(o => [o.code, { text: o.commonName, html: o.commonName ? dsoWikiLink(o, o.commonName) : '' }, o.type, o.constellation]));
      } else if (state.mode === 'asterisms') {
        table([
          { label: 'asterism', sortable: true },
          { label: 'constellations', sortable: false },
          { label: 'member stars', sortable: false },
          { label: 'description', sortable: false }
        ], DATA.asterisms.map(a => [{ text: a.name, html: asterismWikiLink(a, a.name) }, a.constellations.join(', '), (a.members || []).join(', '), a.clue]));
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



  const OBJECT_GAME_LABELS = {
    stars: { title: 'Stars', singular: 'star', plural: 'stars', find: 'Find Star', identify: 'Identify Star', marathon: 'Star Marathon' },
    dso: { title: 'DSOs', singular: 'DSO', plural: 'DSOs', find: 'Find DSO', identify: 'Identify DSO', marathon: 'DSO Marathon' }
  };

  const GREEK_DESIGNATION_WORDS = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ',
    iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π',
    rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω'
  };
  function greekDesignationText(value) {
    return String(value || '').trim().replace(/\b(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)\b/ig, m => GREEK_DESIGNATION_WORDS[m.toLowerCase()] || m);
  }
  function objectSkyKey(star) {
    if (!star) return '';
    if (Number.isFinite(star.hip)) return `hip:${star.hip}`;
    return `pos:${Number(star.ra).toFixed(6)}:${Number(star.dec).toFixed(6)}:${compact(star.name || starDisplayName(star) || star.bayer || star.bf)}`;
  }

  function compactObjectKey(kind, item) {
    return kind === 'stars'
      ? `star:${compact(item.name)}:${compact(item.constellation)}`
      : `dso:${compact(item.code)}`;
  }

  function challengeRaDecHtml(v) {
    if (!v) return 'not available';
    const { ra, dec } = raDecFromVec(v);
    const totalMinutes = ra / 15 * 60;
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes - h * 60);
    const sign = dec < 0 ? '−' : '+';
    const absDec = Math.abs(dec);
    const d = Math.floor(absDec);
    const dm = Math.round((absDec - d) * 60);
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m / ${sign}${String(d).padStart(2, '0')}° ${String(dm).padStart(2, '0')}′`;
  }

  function spectralClassLetter(spect) {
    const m = String(spect || '').trim().toUpperCase().match(/[OBAFGKM]/);
    return m ? m[0] : '';
  }

  function spectralTypeLabel(spect) {
    const letter = spectralClassLetter(spect);
    return letter ? `${letter} type` : 'not listed';
  }

  function starChallengeRecord(entry) {
    const nameKey = compact(entry.name);
    const constKey = compact(entry.constellation);
    const designationKey = compact(entry.designation);
    let sky = null;

    if (Number.isFinite(entry.skyHip)) {
      sky = skyHipByNumber.get(entry.skyHip) || null;
    }

    if (!sky && Number.isFinite(entry.skyRa) && Number.isFinite(entry.skyDec)) {
      sky = skyStars.find(s => Math.abs(s.ra - entry.skyRa) < 1e-6 && Math.abs(s.dec - entry.skyDec) < 1e-6) || null;
    }

    if (!sky && designationKey) {
      sky = skyStars.find(s => compact(s.constellation) === constKey && (
        compact(starDesignation(s)) === designationKey ||
        compact(s.bf) === designationKey ||
        compact(s.bayer) === designationKey
      )) || null;
    }

    if (!sky && nameKey) {
      sky = skyStars.find(s => compact(s.constellation) === constKey && compact(s.name) === nameKey) ||
            skyStars.find(s => compact(s.constellation) === constKey && compact(s.name).startsWith(`${nameKey}`)) ||
            null;
    }

    if (!sky && nameKey) {
      const exactNameMatches = skyStars.filter(s => compact(s.name) === nameKey);
      if (exactNameMatches.length === 1) sky = exactNameMatches[0];
    }

    if (!sky || !sky.v) return null;
    const cleanName = String(entry.name || sky.name || starDisplayName(sky) || '').trim();
    return {
      ...entry,
      name: cleanName,
      constellation: sky.constellation || entry.constellation,
      sky,
      v: sky.v,
      ra: sky.ra,
      dec: sky.dec,
      mag: Number.isFinite(sky.mag) ? sky.mag : entry.mag,
      designation: greekDesignationText(starDesignation(sky) || entry.designation || sky.bf || sky.bayer || ''),
      spect: sky.spect || entry.skySpect || '',
      absmag: Number.isFinite(sky.absmag) ? sky.absmag : null,
      dist: Number.isFinite(sky.dist) ? sky.dist : null,
      ci: Number.isFinite(sky.ci) ? sky.ci : null,
      hip: sky.hip,
      hd: sky.hd,
      hr: sky.hr
    };
  }

  function starChallengeItems() {
    const seen = new Set();
    const out = [];
    DATA.stars.forEach(entry => {
      if (!isNormalNamedStarName(entry.name)) return;
      const item = starChallengeRecord(entry);
      if (!item || !String(item.name || '').trim()) return;
      const key = compactObjectKey('stars', item);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
    return out.sort((a, b) => {
      const ma = Number.isFinite(a.mag) ? a.mag : 99;
      const mb = Number.isFinite(b.mag) ? b.mag : 99;
      if (ma !== mb) return ma - mb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function dsoChallengeItems() {
    return buildSkyDsoObjects()
      .filter(o => o.v && o.hasReliablePosition && String(o.commonName || '').trim() && ['M', 'C'].includes(String(o.catalog || '').toUpperCase()))
      .sort((a, b) => {
        const ca = String(a.catalog || ''), cb = String(b.catalog || '');
        if (ca !== cb) return ca.localeCompare(cb);
        return (Number(a.number) || 9999) - (Number(b.number) || 9999);
      });
  }

  function challengeItems(kind) {
    return kind === 'stars' ? starChallengeItems() : dsoChallengeItems();
  }

  function objectGameName(kind, item) {
    return kind === 'stars' ? starPreferredName(item) : dsoLabelPlain(item);
  }

  function objectGameScoreId(kind, mode) {
    const prefix = kind === 'stars' ? 'stars' : 'dso';
    if (mode === 'find') return `${prefix}Find`;
    if (mode === 'identify') return `${prefix}Identify`;
    return `${prefix}Marathon`;
  }

  function objectGameScoreHtml(kind, mode) {
    return mode === 'find' || mode === 'identify' ? `<div id="objectGameStats" class="stats">${formatScore(objectGameScoreId(kind, mode))}</div>` : '';
  }

  function objectGameAnswers(kind, item) {
    if (kind === 'stars') {
      return [
        ...starAnswerNames(item),
        item.sky?.name,
        starDesignation(item.sky || {}),
        item.sky?.bf,
        item.sky?.bayer
      ].filter(Boolean);
    }
    return [item.code, item.commonName, ...(item.accepted || []), ...(item.aliases || [])].filter(Boolean);
  }

  function objectGameCard(kind, item, result = '') {
    if (!item) return '';
    if (kind === 'stars') {
      const fields = [
        ['designation', esc(item.designation || 'not listed')],
        ['constellation', constellationWikiLink(item.constellation)],
        ['spectral type', esc(spectralTypeLabel(item.spect))],
        ['RA/Dec', challengeRaDecHtml(item.v)]
      ];
      return `<div class="study-card object-info-card ${result ? 'answered-card' : ''}"><h3>${starWikiLink(item)}</h3>${result ? `<p class="object-result">${esc(result)}</p>` : ''}
        <dl class="study-facts">${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
      </div>`;
    }

    const aliases = [item.code, item.commonName, ...(item.aliases || [])].filter(Boolean);
    const fields = [
      ['catalogue', esc(item.code)],
      ['common name', esc(item.commonName || 'not listed')],
      ['type', esc(item.type || 'not listed')],
      ['constellation', constellationWikiLink(item.constellation)],
      ['RA/Dec', challengeRaDecHtml(item.v)],
      ['aliases', aliases.length ? aliases.map(esc).join(' · ') : 'not listed']
    ];
    return `<div class="study-card object-info-card ${result ? 'answered-card' : ''}"><h3>${dsoWikiLink(item, dsoLabelPlain(item))}</h3>${result ? `<p class="object-result">${esc(result)}</p>` : ''}
      <dl class="study-facts">${fields.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>
    </div>`;
  }

  function objectGameStarRadius(s) {
    return Math.max(0.9, Math.min(4.8, 4.2 - Number(s.mag || 6) * 0.55));
  }

  function objectGameObjectRadius(kind, item) {
    if (kind === 'stars') return Math.max(5.2, Math.min(9.2, 9.2 - Number(item.mag || 4) * 0.78));
    return 6.7;
  }

  function objectGameCleanBasis(b) {
    if (!b || !b.f || !b.right || !b.up) return null;
    const f = normVec(b.f);
    let right = b.right;
    const proj = dot(right, f);
    right = normVec({ x: right.x - proj * f.x, y: right.y - proj * f.y, z: right.z - proj * f.z });
    if (!Number.isFinite(right.x)) return null;
    const up = normVec(cross(right, f));
    return { f, right: normVec(cross(f, up)), up };
  }

  function objectGameProject(v, basis, radius, fovRad, canvas) {
    const z = dot(v, basis.f);
    const ang = Math.acos(Math.max(-1, Math.min(1, z)));
    if (ang > fovRad / 2) return null;
    const x = dot(v, basis.right);
    const y = dot(v, basis.up);
    const sin = Math.sin(ang) || 1e-9;
    const rr = (ang / (fovRad / 2)) * radius;
    return { x: canvas.width / 2 + rr * x / sin, y: canvas.height / 2 - rr * y / sin, z };
  }

  function objectGameRotateVector(v, axis, angle) {
    const c = Math.cos(angle), s = Math.sin(angle), d = dot(axis, v), cr = cross(axis, v);
    return normVec({
      x: v.x * c + cr.x * s + axis.x * d * (1 - c),
      y: v.y * c + cr.y * s + axis.y * d * (1 - c),
      z: v.z * c + cr.z * s + axis.z * d * (1 - c)
    });
  }

  function objectGameRandomBasisForTarget(v, fovDeg = 75) {
    const b = localBasisFromForward(v);
    const maxOffset = (fovDeg * Math.PI / 180) * 0.25;
    const offset = Math.sqrt(Math.random()) * maxOffset;
    const angle = Math.random() * Math.PI * 2;
    const f = normVec({
      x: v.x * Math.cos(offset) + (b.right.x * Math.cos(angle) + b.up.x * Math.sin(angle)) * Math.sin(offset),
      y: v.y * Math.cos(offset) + (b.right.y * Math.cos(angle) + b.up.y * Math.sin(angle)) * Math.sin(offset),
      z: v.z * Math.cos(offset) + (b.right.z * Math.cos(angle) + b.up.z * Math.sin(angle)) * Math.sin(offset)
    });
    const out = localBasisFromForward(f);
    const roll = Math.random() * Math.PI * 2;
    return objectGameCleanBasis({
      f: out.f,
      right: objectGameRotateVector(out.right, out.f, roll),
      up: objectGameRotateVector(out.up, out.f, roll)
    }) || out;
  }

  function objectGameEnsureOrientation(state, target = null) {
    if (state.mode === 'identify') {
      if (!state.identifyBasis || !target || state.identifyTargetKey !== state.targetKey) {
        state.identifyBasis = objectGameRandomBasisForTarget(target?.v || vecFromRaDec(0, 0), 105);
        state.identifyTargetKey = state.targetKey;
      }
      state.orient = objectGameCleanBasis(state.identifyBasis) || localBasisFromForward(target?.v || vecFromRaDec(0, 0));
      if (target?.v) {
        const targetAngle = Math.acos(Math.max(-1, Math.min(1, dot(target.v, state.orient.f))));
        const safeLimit = (105 * Math.PI / 180) * 0.43;
        if (targetAngle > safeLimit) {
          state.identifyBasis = localBasisFromForward(target.v);
          state.identifyTargetKey = state.targetKey;
          state.orient = state.identifyBasis;
        }
      }
      return state.orient;
    }
    if (!state.orient) state.orient = localBasisFromForward(vecFromRaDec(0, 0));
    state.orient = objectGameCleanBasis(state.orient) || localBasisFromForward(vecFromRaDec(0, 0));
    return state.orient;
  }

  function objectGameInterestStarColour(kind, item, state, targetKey, wrongKey, found) {
    if (kind !== 'stars' || !item) return 'black';
    const key = compactObjectKey(kind, item);
    if (state.mode === 'identify') return 'black';
    if (state.mode === 'marathon') return found.has(key) ? '#55ff00' : '#e60012';
    if (state.mode === 'find') return '#8b42ff';
    return 'black';
  }

  function objectGameVisibleBackgroundStars(kind, items, state) {
    const visible = skyStars.filter(s => s.mag <= clampNumber(state.magLimit, 4, 6, defaultMag()));
    if (kind !== 'stars') return visible;
    const extra = [];
    items.forEach(item => {
      if (!item.sky) return;
      if (state.mode === 'identify' && compactObjectKey(kind, item) !== state.targetKey) return;
      extra.push(item.sky);
    });
    return uniqueSkyStars([...visible, ...extra]);
  }

  function objectGameDrawMap(canvas, kind, items, state, target = null) {
    const ctx = canvas.getContext('2d');
    const radius = Math.min(canvas.width, canvas.height) * 0.48;
    const fovDeg = state.mode === 'identify' ? 105 : clampNumber(state.fov, 20, 190, 140);
    const fovRad = fovDeg * Math.PI / 180;
    const basis = objectGameEnsureOrientation(state, target);
    const found = new Set(state.found || []);
    const selectedKey = state.selectedKey || '';
    const wrongKey = state.wrongKey || '';
    const targetKey = target ? compactObjectKey(kind, target) : '';
    const targets = [];

    const project = v => objectGameProject(v, basis, radius, fovRad, canvas);
    const itemBySkyKey = new Map();
    if (kind === 'stars') {
      items.forEach(item => { if (item.sky) itemBySkyKey.set(objectSkyKey(item.sky), item); });
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
    ctx.clip();

    if (state.showLines === true && skyConstellationLineDb) {
      drawSkyAsterismLines(ctx, project, basis, radius, fovRad);
    }

    const visible = objectGameVisibleBackgroundStars(kind, items, state).sort((a, b) => b.mag - a.mag);
    ctx.globalAlpha = 1;
    for (const s of visible) {
      const p = project(s.v);
      if (!p) continue;
      const interest = kind === 'stars' ? itemBySkyKey.get(objectSkyKey(s)) : null;
      const key = interest ? compactObjectKey(kind, interest) : '';
      const r = objectGameStarRadius(s);
      const hiddenBlinkTarget = state.mode === 'identify' && kind === 'stars' && target?.v && state.blinkOn === false && angularDeg(s.v, target.v) <= 0.25;
      if (!hiddenBlinkTarget) {
        ctx.fillStyle = interest ? objectGameInterestStarColour(kind, interest, state, targetKey, wrongKey, found) : 'black';
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (interest && key === selectedKey && (state.mode === 'find' || state.mode === 'marathon')) {
        ctx.save();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(7, r + 5), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (interest) targets.push({ key, item: interest, x: p.x, y: p.y, r: Math.max(13, r + 8) });
    }

    if (kind === 'dso') {
      items.forEach(item => {
        const p = project(item.v);
        if (!p) return;
        const key = compactObjectKey(kind, item);
        const isWrong = wrongKey === key;
        const isTarget = targetKey === key;
        let fill = '#8b42ff';
        if (state.mode === 'identify') {
          if (!isTarget) return;
          fill = '#8b42ff';
        } else if (state.mode === 'marathon') {
          fill = found.has(key) ? '#55ff00' : '#e60012';
        } else if (state.mode === 'find') {
          fill = '#8b42ff';
        }
        const r = objectGameObjectRadius(kind, item);
        ctx.fillStyle = fill;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = key === selectedKey ? 2.4 : 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (key === selectedKey && (state.mode === 'find' || state.mode === 'marathon')) {
          ctx.save();
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        targets.push({ key, item, x: p.x, y: p.y, r: Math.max(13, r + 7) });
      });
    }

    ctx.restore();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
    ctx.stroke();

    canvas._objectGameTargets = targets;
    canvas._objectGameBasis = basis;
    canvas._objectGameRadius = radius;
    canvas._objectGameFovRad = fovRad;
  }

  function objectGameNearest(canvas, x, y, requireInside = true) {
    const targets = canvas._objectGameTargets || [];
    let best = null;
    targets.forEach(t => {
      const d = Math.hypot(t.x - x, t.y - y);
      if (!best || d < best.d) best = { ...t, d };
    });
    if (!best) return null;
    if (requireInside && best.d > best.r) return null;
    return best;
  }

  function ensureObjectGameTarget(kind, state, items) {
    if (!items.length || state.mode === 'marathon') return null;
    if (!state.targetKey || !items.some(item => compactObjectKey(kind, item) === state.targetKey)) {
      const pick = rand(items);
      state.targetKey = compactObjectKey(kind, pick);
      state.answered = false;
      state.answerCard = '';
      state.message = '';
      state.wrongKey = '';
      state.identifyBasis = null;
      state.identifyTargetKey = '';
    }
    return items.find(item => compactObjectKey(kind, item) === state.targetKey) || items[0];
  }

  function nextObjectGameQuestion(kind, state, items) {
    if (!items.length) return;
    const oldKey = state.targetKey;
    let pick = rand(items);
    if (items.length > 1) {
      let guard = 0;
      while (compactObjectKey(kind, pick) === oldKey && guard < 30) {
        pick = rand(items);
        guard++;
      }
    }
    state.targetKey = compactObjectKey(kind, pick);
    state.answered = false;
    state.answerCard = '';
    state.message = '';
    state.selectedKey = '';
    state.wrongKey = '';
    state.identifyBasis = null;
    state.identifyTargetKey = '';
  }

  function resetObjectGameMarathon(state) {
    state.found = [];
    state.selectedKey = '';
    state.wrongKey = '';
    state.message = '';
    state.answerCard = '';
  }

  function objectDefaultModeMap(kind, mode) {
    return {
      fov: mode === 'identify' ? 105 : kind === 'stars' ? 140 : 150,
      magLimit: defaultMag(),
      showLines: false,
      orient: null,
      identifyBasis: null,
      identifyTargetKey: ''
    };
  }

  function objectEnsureModeMaps(kind, state) {
    if (!state.modeMaps || typeof state.modeMaps !== 'object') state.modeMaps = {};
    ['find', 'identify', 'marathon'].forEach(mode => {
      if (!state.modeMaps[mode] || typeof state.modeMaps[mode] !== 'object') state.modeMaps[mode] = objectDefaultModeMap(kind, mode);
      const d = objectDefaultModeMap(kind, mode);
      if (!Number.isFinite(state.modeMaps[mode].fov)) state.modeMaps[mode].fov = d.fov;
      if (!Number.isFinite(state.modeMaps[mode].magLimit)) state.modeMaps[mode].magLimit = d.magLimit;
      if (typeof state.modeMaps[mode].showLines !== 'boolean') state.modeMaps[mode].showLines = false;
      if (mode === 'identify') {
        state.modeMaps[mode].fov = 105;
        state.modeMaps[mode].magLimit = 6;
        state.modeMaps[mode].showLines = false;
      }
    });
  }

  function objectSaveModeMap(state) {
    if (!state.modeMaps || !state.modeMaps[state.mode]) return;
    const m = state.modeMaps[state.mode];
    m.fov = state.mode === 'identify' ? 105 : state.fov;
    m.magLimit = state.mode === 'identify' ? 6 : state.magLimit;
    m.showLines = state.mode === 'identify' ? false : state.showLines === true;
    m.orient = state.orient || m.orient || null;
    m.identifyBasis = state.identifyBasis || m.identifyBasis || null;
    m.identifyTargetKey = state.identifyTargetKey || m.identifyTargetKey || '';
  }

  function objectApplyModeMap(kind, state) {
    objectEnsureModeMaps(kind, state);
    if (state.activeModeMap === state.mode) return;
    const m = state.modeMaps[state.mode] || objectDefaultModeMap(kind, state.mode);
    state.fov = state.mode === 'identify' ? 105 : m.fov;
    state.magLimit = state.mode === 'identify' ? 6 : m.magLimit;
    state.showLines = state.mode === 'identify' ? false : m.showLines === true;
    state.orient = m.orient || null;
    state.identifyBasis = m.identifyBasis || null;
    state.identifyTargetKey = m.identifyTargetKey || '';
    state.activeModeMap = state.mode;
  }

  function renderObjectChallengeGame(kind) {
    const cfg = OBJECT_GAME_LABELS[kind];
    const stateKey = kind === 'stars' ? 'starChallenge' : 'dsoChallenge';
    const state = states[stateKey] || (states[stateKey] = {
      loaded: false,
      loading: false,
      error: '',
      mode: 'find',
      targetKey: '',
      selectedKey: '',
      wrongKey: '',
      found: [],
      message: '',
      answerCard: '',
      answered: false,
      fov: kind === 'stars' ? 140 : 150,
      magLimit: defaultMag(),
      showLines: false,
      orient: null,
      identifyBasis: null,
      identifyTargetKey: '',
      modeMaps: null,
      activeModeMap: '',
      blinkOn: true,
      blinkTimer: null
    });

    if (!Array.isArray(state.found)) state.found = [];
    if (!['find', 'identify', 'marathon'].includes(state.mode)) state.mode = 'find';
    objectApplyModeMap(kind, state);

    if (!state.loaded) {
      if (!state.loading) {
        state.loading = true;
        app.innerHTML = `<h2>${cfg.title}</h2><section class="panel"><p>loading sky catalogue...</p></section>`;
        showLoadingOverlay(`loading ${cfg.plural}`);
        const tasks = kind === 'stars'
          ? [ensureNamedStarCatalogue(), loadSkyData(), loadSkyConstellationLines()]
          : [loadSkyData(), loadSkyConstellationLines(), loadDsoCoordinateData()];
        Promise.all(tasks).then(() => {
          if (kind === 'dso') buildSkyDsoObjects();
          state.loaded = true;
          state.loading = false;
          hideLoadingOverlay();
          if ((kind === 'stars' && activeGame === 'stars') || (kind === 'dso' && activeGame === 'dso')) renderObjectChallengeGame(kind);
        }).catch(err => {
          state.error = `could not load ${cfg.plural}`;
          state.loading = false;
          hideLoadingOverlay();
          app.innerHTML = `<h2>${cfg.title}</h2><section class="panel"><p>${esc(state.error)}</p></section>`;
          console.warn(`iloveastro: ${cfg.title} game failed to load`, err);
        });
      } else {
        app.innerHTML = `<h2>${cfg.title}</h2><section class="panel"><p>loading sky catalogue...</p></section>`;
      }
      return;
    }

    const items = challengeItems(kind);
    if (!items.length) {
      app.innerHTML = `<h2>${cfg.title}</h2><section class="panel"><p>no positioned ${cfg.plural} available.</p></section>`;
      return;
    }

    const target = ensureObjectGameTarget(kind, state, items);
    const found = new Set(state.found || []);
    const selected = items.find(item => compactObjectKey(kind, item) === state.selectedKey) || null;
    const selectedAlreadyFound = selected && found.has(compactObjectKey(kind, selected));
    const targetName = target ? objectGameName(kind, target) : '';
    const modeTitle = state.mode === 'find' ? cfg.find : state.mode === 'identify' ? cfg.identify : cfg.marathon;
    const counter = `${found.size} / ${items.length}`;
    const canShowSelectedCard = state.mode === 'marathon' && selected && selectedAlreadyFound;

    app.innerHTML = `<h2>${cfg.title}</h2><div class="sky-layout object-game-layout"><section class="panel sky-panel object-game-map-panel"><canvas id="objectGameCanvas" width="900" height="900" tabindex="0" aria-label="${esc(cfg.title)} sky map"></canvas></section><aside class="panel object-game-side">
      <label>Gamemode<select id="objectGameMode"><option value="find" ${state.mode === 'find' ? 'selected' : ''}>${esc(cfg.find)}</option><option value="identify" ${state.mode === 'identify' ? 'selected' : ''}>${esc(cfg.identify)}</option><option value="marathon" ${state.mode === 'marathon' ? 'selected' : ''}>${esc(cfg.marathon)}</option></select></label>
      <h3>${esc(modeTitle)}</h3>
      ${state.mode === 'find' ? `<p>Find <strong>${kind === 'stars' ? starWikiLink(target) : dsoWikiLink(target, targetName)}</strong></p>` : ''}
      ${state.mode === 'identify' ? `` : ''}
      ${state.mode === 'marathon' ? `<p><strong>${esc(counter)}</strong> named</p>` : ''}
      ${state.mode !== 'identify' ? `<label>FOV degrees<div class="slider-text-row"><input id="objectGameFovSlider" type="range" min="20" max="190" step="5" value="${state.fov}"><input id="objectGameFov" type="number" min="20" max="190" step="5" value="${state.fov}"></div></label>` : ''}
      ${state.mode !== 'identify' ? `<label>Star density / faintest magnitude<div class="slider-text-row"><input id="objectGameMagSlider" type="range" min="4" max="6" step="0.1" value="${state.magLimit}"><input id="objectGameMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></div></label>` : ''}
      <label class="checkline"><input id="objectGameLines" type="checkbox" ${state.showLines === true ? 'checked' : ''}><span>constellation lines</span></label>
      ${state.mode !== 'identify' ? `<div class="sky-nav-grid" aria-label="${esc(cfg.title)} map movement controls"><button type="button" data-move="-1,-1">↖</button><button type="button" data-move="0,-1">↑</button><button type="button" data-move="1,-1">↗</button><button type="button" data-move="-1,0">←</button><button type="button" id="objectGameCentre">○</button><button type="button" data-move="1,0">→</button><button type="button" data-move="-1,1">↙</button><button type="button" data-move="0,1">↓</button><button type="button" data-move="1,1">↘</button></div>
      <div class="controls"><button type="button" id="objectGameZoomOut">− zoom</button><button type="button" id="objectGameZoomIn">zoom +</button></div>` : ''}
      <div class="controls"><button type="button" id="objectGameRollCCW">↺ rotate</button><button type="button" id="objectGameRollCW">rotate ↻</button></div>
      ${state.mode !== 'find' ? `<input id="objectGameAnswer" autocomplete="off" placeholder="${state.mode === 'marathon' ? selected && !selectedAlreadyFound ? `name this ${cfg.singular}` : `click a ${cfg.singular} first` : `type ${cfg.singular} name`}">` : ''}
      <div class="controls">
        ${state.mode === 'find' || state.mode === 'identify' || state.mode === 'marathon' ? `<button type="button" id="objectGameSubmit">submit</button>` : ''}
        <button type="button" id="objectGameReveal">reveal</button>
        ${state.mode !== 'marathon' ? `<button type="button" id="objectGameNext">new question</button>` : `<button type="button" id="objectGameReset">reset marathon</button>`}
      </div>
      <div id="objectGameMsg" class="message">${esc(state.message || '')}</div>
      <div id="objectGameCard">${state.answerCard || (canShowSelectedCard ? objectGameCard(kind, selected, 'already named') : '')}</div>
      ${objectGameScoreHtml(kind, state.mode)}
    </aside></div>`;

    initRangeVisuals(app);
    setupSphereFullscreen();

    const canvas = $('#objectGameCanvas');
    const msg = $('#objectGameMsg');
    const answer = $('#objectGameAnswer');
    const fovInput = $('#objectGameFov');
    const fovSlider = $('#objectGameFovSlider');
    const magInput = $('#objectGameMag');
    const magSlider = $('#objectGameMagSlider');

    function draw() {
      objectGameDrawMap(canvas, kind, items, state, ensureObjectGameTarget(kind, state, items));
      if (msg) msg.textContent = state.message || '';
    }

    function setFov(value) {
      if (state.mode === 'identify') return;
      state.fov = Math.max(20, Math.min(190, parseFloat(value) || 140));
      const v = Number(state.fov.toFixed(1));
      fovInput.value = v;
      fovSlider.value = v;
      updateRangeVisual(fovSlider);
      draw();
    }

    function setMag(value) {
      if (state.mode === 'identify') return;
      state.magLimit = Math.max(4, Math.min(6, parseFloat(value) || defaultMag()));
      const v = Number(state.magLimit.toFixed(1));
      if (magInput) magInput.value = v;
      if (magSlider) {
        magSlider.value = v;
        updateRangeVisual(magSlider);
      }
      objectSaveModeMap(state);
      draw();
    }

    function focusCanvas() {
      try { canvas.focus({ preventScroll: true }); }
      catch { canvas.focus(); }
    }

    function rotateBasis(axis, angle) {
      const b = objectGameEnsureOrientation(state, ensureObjectGameTarget(kind, state, items));
      state.orient = objectGameCleanBasis({
        f: objectGameRotateVector(b.f, axis, angle),
        right: objectGameRotateVector(b.right, axis, angle),
        up: objectGameRotateVector(b.up, axis, angle)
      });
      if (state.mode === 'identify') state.identifyBasis = state.orient;
      objectSaveModeMap(state);
    }

    function move(dx, dy, multiplier = 1) {
      if (state.mode === 'identify') return;
      const b = objectGameEnsureOrientation(state, ensureObjectGameTarget(kind, state, items));
      const anglePerPx = (state.fov * Math.PI / 180) / Math.min(canvas.width, canvas.height) * multiplier;
      rotateBasis(b.up, -dx * anglePerPx);
      rotateBasis(objectGameEnsureOrientation(state, ensureObjectGameTarget(kind, state, items)).right, -dy * anglePerPx);
      draw();
    }

    function moveButton(x, y) {
      const px = Math.min(canvas.width, canvas.height) * 0.05;
      move(x * px, y * px, 1);
      focusCanvas();
    }

    function rollFrame(direction) {
      const b = objectGameEnsureOrientation(state, ensureObjectGameTarget(kind, state, items));
      rotateBasis(b.f, direction * 10 * Math.PI / 180);
      draw();
      focusCanvas();
    }

    function centreOnObject(item) {
      if (!item?.v) return;
      state.orient = localBasisFromForward(item.v);
      objectSaveModeMap(state);
    }

    function revealObjectAnswer() {
      if (state.mode === 'marathon') {
        const sel = items.find(item => compactObjectKey(kind, item) === state.selectedKey);
        if (!sel) {
          state.message = `click a ${cfg.singular} first`;
          if (msg) msg.textContent = state.message;
          return;
        }
        state.message = `answer: ${objectGameName(kind, sel)}`;
        state.answerCard = objectGameCard(kind, sel, 'revealed');
        renderObjectChallengeGame(kind);
        return;
      }
      const t = ensureObjectGameTarget(kind, state, items);
      if (!t) return;
      if ((state.mode === 'find' || state.mode === 'identify') && !state.answered) record(objectGameScoreId(kind, state.mode), false);
      state.answered = true;
      state.selectedKey = compactObjectKey(kind, t);
      state.wrongKey = '';
      state.message = `answer: ${objectGameName(kind, t)}`;
      state.answerCard = objectGameCard(kind, t, 'revealed');
      if (state.mode === 'find') centreOnObject(t);
      renderObjectChallengeGame(kind);
    }

    function centreMap() {
      if (state.mode === 'identify') return;
      state.orient = localBasisFromForward(vecFromRaDec(0, 0));
      objectSaveModeMap(state);
      draw();
      focusCanvas();
    }

    $('#objectGameMode').addEventListener('change', e => {
      const nextMode = e.target.value;
      if (!nextMode || nextMode === state.mode) return;
      objectSaveModeMap(state);
      state.mode = nextMode;
      state.activeModeMap = '';
      objectApplyModeMap(kind, state);
      state.message = '';
      state.answerCard = '';
      state.answered = false;
      state.selectedKey = '';
      state.wrongKey = '';
      if (state.mode !== 'marathon') nextObjectGameQuestion(kind, state, items);
      renderObjectChallengeGame(kind);
    });

    if ($('#objectGameNext')) $('#objectGameNext').addEventListener('click', () => {
      nextObjectGameQuestion(kind, state, items);
      renderObjectChallengeGame(kind);
    });

    if ($('#objectGameReset')) $('#objectGameReset').addEventListener('click', () => {
      resetObjectGameMarathon(state);
      renderObjectChallengeGame(kind);
    });

    if (fovInput) fovInput.addEventListener('input', e => setFov(e.target.value));
    if (fovSlider) fovSlider.addEventListener('input', e => setFov(e.target.value));
    if (magInput) magInput.addEventListener('input', e => setMag(e.target.value));
    if (magSlider) magSlider.addEventListener('input', e => setMag(e.target.value));
    if ($('#objectGameLines')) $('#objectGameLines').addEventListener('change', e => {
      state.showLines = e.target.checked;
      objectSaveModeMap(state);
      draw();
      focusCanvas();
    });
    document.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', () => {
      const [x, y] = btn.dataset.move.split(',').map(Number);
      moveButton(x, y);
    }));
    if ($('#objectGameCentre')) $('#objectGameCentre').addEventListener('click', centreMap);
    if ($('#objectGameZoomOut')) $('#objectGameZoomOut').addEventListener('click', () => setFov(state.fov * 1.25));
    if ($('#objectGameZoomIn')) $('#objectGameZoomIn').addEventListener('click', () => setFov(state.fov * 0.8));
    if ($('#objectGameRollCCW')) $('#objectGameRollCCW').addEventListener('click', () => rollFrame(1)); // visual anticlockwise
    if ($('#objectGameRollCW')) $('#objectGameRollCW').addEventListener('click', () => rollFrame(-1)); // visual clockwise

    function submitTypedAnswer() {
      if (state.mode === 'find') {
        if (state.answered) {
          state.message = 'already submitted';
          if (msg) msg.textContent = state.message;
          return;
        }
        const t = ensureObjectGameTarget(kind, state, items);
        const sel = items.find(item => compactObjectKey(kind, item) === state.selectedKey);
        if (!t || !sel) {
          state.message = `click a ${cfg.singular} first`;
          if (msg) msg.textContent = state.message;
          return;
        }
        const hit = compactObjectKey(kind, sel) === compactObjectKey(kind, t);
        record(objectGameScoreId(kind, state.mode), hit);
        state.answered = true;
        state.wrongKey = hit ? '' : compactObjectKey(kind, sel);
        state.message = hit ? 'correct' : 'wrong';
        state.answerCard = objectGameCard(kind, t, hit ? 'correct' : 'answer');
        renderObjectChallengeGame(kind);
        return;
      }

      if (!answer) return;
      const value = answer.value;
      if (state.mode === 'identify') {
        if (state.answered) {
          state.message = 'already submitted';
          if (msg) msg.textContent = state.message;
          return;
        }
        const t = ensureObjectGameTarget(kind, state, items);
        if (!t) return;
        const ok = answerMatches(value, objectGameAnswers(kind, t));
        record(objectGameScoreId(kind, state.mode), ok);
        state.answered = true;
        state.message = ok ? 'correct' : `answer: ${objectGameName(kind, t)}`;
        state.answerCard = objectGameCard(kind, t, ok ? 'correct' : 'revealed');
        renderObjectChallengeGame(kind);
        return;
      }

      if (state.mode === 'marathon') {
        const sel = items.find(item => compactObjectKey(kind, item) === state.selectedKey);
        if (!sel) {
          state.message = `click a ${cfg.singular} first`;
          if (msg) msg.textContent = state.message;
          return;
        }
        const key = compactObjectKey(kind, sel);
        if (found.has(key)) {
          state.message = 'already named';
          state.answerCard = objectGameCard(kind, sel, 'already named');
          renderObjectChallengeGame(kind);
          return;
        }
        const ok = answerMatches(value, objectGameAnswers(kind, sel));
        if (ok) {
          if (!state.found.includes(key)) state.found.push(key);
          state.message = 'correct';
          state.answerCard = objectGameCard(kind, sel, 'named');
          answer.value = '';
          renderObjectChallengeGame(kind);
        } else {
          state.message = 'not quite';
          if (msg) msg.textContent = state.message;
        }
      }
    }

    function shiftEnterNext(e) {
      if (e.key === 'Enter' && e.shiftKey && state.mode !== 'marathon') {
        e.preventDefault();
        nextObjectGameQuestion(kind, state, items);
        renderObjectChallengeGame(kind);
        return true;
      }
      return false;
    }

    if ($('#objectGameSubmit')) $('#objectGameSubmit').addEventListener('click', submitTypedAnswer);
    if ($('#objectGameReveal')) $('#objectGameReveal').addEventListener('click', revealObjectAnswer);
    if (answer) {
      answer.addEventListener('keydown', e => {
        if (shiftEnterNext(e)) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          submitTypedAnswer();
        }
      });
      setTimeout(() => answer.focus(), 0);
    }

    canvas.addEventListener('keydown', e => {
      if (shiftEnterNext(e)) return;
      if (e.key === 'Enter' && state.mode === 'find') {
        e.preventDefault();
        submitTypedAnswer();
      }
    });

    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * canvas.width / rect.width;
      const y = (e.clientY - rect.top) * canvas.height / rect.height;
      const near = objectGameNearest(canvas, x, y, state.mode !== 'find');

      if (state.mode === 'find') {
        return;
      }

      if (state.mode === 'marathon') {
        if (!near) {
          state.selectedKey = '';
          state.message = `click a ${cfg.singular}`;
          state.answerCard = '';
          renderObjectChallengeGame(kind);
          return;
        }
        state.selectedKey = near.key;
        state.wrongKey = '';
        if (found.has(near.key)) {
          state.message = 'already named';
          state.answerCard = objectGameCard(kind, near.item, 'already named');
        } else {
          state.message = `${cfg.singular} selected`;
          state.answerCard = '';
        }
        renderObjectChallengeGame(kind);
      }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (state.mode !== 'identify' && (e.ctrlKey || e.metaKey || e.altKey)) {
        const factor = Math.exp(e.deltaY * 0.0016);
        setFov(state.fov * factor);
        return;
      }
      const unit = Math.min(canvas.width, canvas.height) * 0.0018;
      move((e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit, (e.shiftKey ? 0 : e.deltaY) * unit, 1);
    }, { passive: false });

    let dragging = false;
    let last = null;
    let objectPress = null;
    let dragMoved = false;
    canvas.addEventListener('pointerdown', e => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * canvas.width / rect.width;
      const y = (e.clientY - rect.top) * canvas.height / rect.height;
      objectPress = state.mode === 'find' ? objectGameNearest(canvas, x, y, true) : null;
      dragMoved = false;
      dragging = state.mode !== 'identify';
      last = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      focusCanvas();
    });
    canvas.addEventListener('pointermove', e => {
      if (!dragging || !last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (Math.hypot(dx, dy) > 2) dragMoved = true;
      last = { x: e.clientX, y: e.clientY };
      if (state.mode !== 'find' || !objectPress) move(dx, dy, 1);
    });
    canvas.addEventListener('pointerup', e => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * canvas.width / rect.width;
      const y = (e.clientY - rect.top) * canvas.height / rect.height;
      const releaseTarget = state.mode === 'find' ? objectGameNearest(canvas, x, y, true) : null;
      if (state.mode === 'find' && objectPress && releaseTarget && objectPress.key === releaseTarget.key && !dragMoved) {
        state.selectedKey = releaseTarget.key;
        state.wrongKey = '';
        state.answered = false;
        state.answerCard = '';
        state.message = `${cfg.singular} selected`;
        draw();
      }
      objectPress = null;
      dragMoved = false;
      dragging = false;
      last = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    });
    canvas.addEventListener('pointercancel', () => { objectPress = null; dragMoved = false; dragging = false; last = null; });

    if (state.blinkTimer) {
      clearInterval(state.blinkTimer);
      state.blinkTimer = null;
    }
    state.blinkOn = true;
    if (state.mode === 'identify' && kind === 'stars') {
      state.blinkTimer = setInterval(() => {
        if ((kind === 'stars' && activeGame !== 'stars') || (kind === 'dso' && activeGame !== 'dso') || state.mode !== 'identify') {
          clearInterval(state.blinkTimer);
          state.blinkTimer = null;
          return;
        }
        state.blinkOn = !state.blinkOn;
        draw();
      }, 650);
    }
    draw();
    if (!answer) setTimeout(() => focusCanvas(), 0);
  }


  const FORMER_CONSTELLATIONS = [{"name":"Anguilla","meaning":"Eel","date":"1754","creator":"John Hill","position":"between Equuleus, Delphinus, Aquila and Serpens","wiki":"","note":"John Hill's 1754 scheme was an entire lost menagerie: eel, spider, toad, shellfish, seahorse, leech, slug, earthworm, pangolin, limpet, mussel, beetle, tortoise and stargazer fish all appeared in the same proposal. None survived."},{"name":"Anser Americanus","meaning":"American Goose","date":"1627","creator":"Johannes Kepler","position":"Alternative name for Tucana","wiki":""},{"name":"Antinous","meaning":"Antinous","date":"132","creator":"Emperor Hadrian","position":"Southern Aquila","wiki":"https://en.wikipedia.org/wiki/Antinous_(constellation)","note":"This was not an invented monster but Hadrian's real companion. Antinous drowned in the Nile in AD 130; after his death he was deified and a figure of Antinous was placed beneath Aquila. The image remained familiar on European star maps for centuries before its stars were finally absorbed into Aquila. In 2024 the IAU gave θ Aquilae A the official name Antinous, returning the lost figure to the modern sky in miniature.","source":"https://www.ianridpath.com/startales/ptolemy-spare.html","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Delphinus%2C%20Sagitta%2C%20Aquila%2C%20and%20Antinous.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Delphinus,_Sagitta,_Aquila,_and_Antinous.jpg","imageAlt":"Urania's Mirror: Aquila and Antinous"},{"name":"Apes","meaning":"Bees (renamed to Vespa, then Lilium, then to Musca Borealis)","date":"1612","creator":"Petrus Plancius","position":"between Perseus and Aries","wiki":"","note":"This tiny northern insect repeatedly changed identity: bees became a wasp, then a fleur-de-lys, and eventually Musca Borealis."},{"name":"Apis","meaning":"Bee (obsolete name and renamed to Musca Australis, and then shortened to Musca)","date":"1598","creator":"Petrus Plancius","position":"where Musca is now","wiki":"https://en.wikipedia.org/wiki/Apis_(constellation)"},{"name":"Aranea","meaning":"Long-Legged Spider","date":"1754","creator":"John Hill","position":"between Virgo and Corvus","wiki":""},{"name":"Argo Navis","meaning":"The Ship Argo (now divided into Carina, Puppis, and Vela)","date":"2nd century","creator":"Claudius Ptolemy","position":"where Carina, Puppis and Vela reside now","wiki":"https://en.wikipedia.org/wiki/Argo_Navis","note":"The Argo was the ship of Jason and the Argonauts, and one of Ptolemy's ancient 48 constellations. It occupied such an enormous stretch of the southern sky that later astronomers broke it apart: its keel became Carina, its stern Puppis and its sails Vela. The old ship never vanished cleanly—its Bayer-letter sequence still runs across the descendant constellations rather than restarting neatly in each one.","source":"https://www.ianridpath.com/iaulist1.html","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Argo%20Navis%20-%20Mercator.jpeg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Argo_Navis_-_Mercator.jpeg","imageAlt":"Argo Navis on Mercator's 1551 celestial globe"},{"name":"Asselli and Praesepe","meaning":"Dionysus's Asses (Asellus Borealis and Asellus Australis) and Manger (Beehive Cluster)","date":"3rd century BC","creator":"Aratus","position":"middle part of Cancer","wiki":"https://en.wikipedia.org/wiki/Praesepe"},{"name":"Asterion and Chara","meaning":"Northern and Southern Dogs in Canes Venatici","date":"1690","creator":"Johannes Hevelius.","position":"where Canes Venatici is now","wiki":"https://en.wikipedia.org/wiki/Cor_Caroli","note":"Hevelius's two named hunting dogs did not disappear completely: together they became Canes Venatici, and Chara survives as the official name of β Canum Venaticorum.","source":"https://www.ianridpath.com/startales/canesvenatici.html"},{"name":"Battery of Volta","meaning":"Battery","date":"1807","creator":"Thomas Young","position":"between Delphinus and Pegasus","wiki":""},{"name":"Bufo","meaning":"Toad","date":"1754","creator":"John Hill","position":"tail of Hydra","wiki":""},{"name":"Caesaris Thronus","meaning":"Throne of Caesar","date":"44 BC","creator":"Augustus Caesar","position":"North of Cancer","wiki":""},{"name":"Cancer Minor","meaning":"Lesser Crab","date":"1613","creator":"Petrus Plancius","position":"south-western Gemini","wiki":"https://en.wikipedia.org/wiki/Cancer_Minor"},{"name":"Capra and Haedi","meaning":"Goat Amalthea (stars surrounding Capella) and the Kids (Haedus I and Haedus II)","date":"3rd century BC","creator":"Aratus","position":"eastern Auriga","wiki":"https://en.wikipedia.org/wiki/Haedi","note":"These are remnants of an older Auriga picture that makes Capella's name intelligible. The Charioteer carries the she-goat Amalthea on his shoulder with her Kids beside her; Capella literally means 'little she-goat'."},{"name":"Cerberus","meaning":"Cerberus (guardian dog of Hades)","date":"1690","creator":"Johannes Hevelius","position":"eastern Hercules","wiki":"https://en.wikipedia.org/wiki/Cerberus_(constellation)","note":"Hevelius showed Hercules grasping the three-headed guardian of Hades. The figure later merged with the apple-bearing branch Ramus Pomifer, producing the hybrid Cerberus et Ramus before both disappeared back into Hercules."},{"name":"Cor Caroli Regis Martyris","meaning":"Charles's Heart","date":"1673","creator":"Charles Scarborough","position":"central Canes Venatici","wiki":"https://en.wikipedia.org/wiki/Cor_Caroli#Names","note":"The heart-and-crown figure honoured Charles I. A later story connecting Cor Caroli with Charles II and the Restoration was a 19th-century mix-up, but the star name itself survived.","source":"https://www.ianridpath.com/startales/canesvenatici.html"},{"name":"Corona Firmiana","meaning":"Corona Borealis renamed to honour Count Leopold Anton von Firmian","date":"1730","creator":"Corbinianus Thomas","position":"where Corona Borealis is now","wiki":""},{"name":"Custos Messium","meaning":"Keeper of harvests","date":"1775","creator":"Jérôme Lalande","position":"between Cassiopeia and Camelopardalis","wiki":"https://en.wikipedia.org/wiki/Custos_Messium","note":"Lalande's 'Keeper of the Harvests' was an astronomical in-joke. The Latin messium echoed the surname of his friend Charles Messier, so French charts often simply called the constellation Messier. The joke has now outlived the constellation: in December 2025 the IAU officially named BE Camelopardalis Custos.","source":"https://ase.exopla.net/index.php/Custos_Messium","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Camelopardalis%2C%20Tarandus%20and%20Custos%20Messium.png?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Camelopardalis,_Tarandus_and_Custos_Messium.png","imageAlt":"Urania's Mirror: Camelopardalis, Tarandus and Custos Messium"},{"name":"Deltoton","meaning":"Delta (obsolete name for Triangulum Boreale)","date":"1540","creator":"Petrus Apianus","position":"Triangulum","wiki":""},{"name":"Dentalium","meaning":"Tooth Shell","date":"1754","creator":"John Hill","position":"between Aquila and Aquarius","wiki":""},{"name":"Duae Alae","meaning":"Two Wings","date":"1532","creator":"Petrus Apianus","position":"Between Cygnus and Draco","wiki":""},{"name":"Felis","meaning":"Cat","date":"1799","creator":"Jérôme Lalande","position":"southern Hydra","wiki":"https://en.wikipedia.org/wiki/Felis_(constellation)","note":"Lalande openly wanted a cat in the heavens. After filling a lifetime with astronomy, he carved Felis out of faint stars beside Hydra—an unusually personal addition among the many heroic and scientific figures of old atlases. The constellation disappeared, but one of its stars was officially named Felis by the IAU in 2018.","source":"https://www.ianridpath.com/startales/felis.html","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Noctua%2C%20Corvus%2C%20Crater%2C%20Sextans%20Urani%C3%A6%2C%20Hydra%2C%20Felis%2C%20Lupus%2C%20Centaurus%2C%20Antlia%20Pneumatica%2C%20Argo%20Navis%2C%20and%20Pyxis%20Nautica.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Noctua,_Corvus,_Crater,_Sextans_Urani%C3%A6,_Hydra,_Felis,_Lupus,_Centaurus,_Antlia_Pneumatica,_Argo_Navis,_and_Pyxis_Nautica.jpg","imageAlt":"Urania's Mirror showing Felis and neighbouring constellations"},{"name":"Frederici Honores","meaning":"Frederick's Honors","date":"1787","creator":"Johann Elert Bode","position":"Northeastern Andromeda","wiki":"https://en.wikipedia.org/wiki/Frederici_Honores","note":"This patch of northeastern Andromeda was repeatedly recruited for royal symbolism: Royer's Sceptrum et Manus Iustitiae had occupied essentially the same territory before Bode replaced it with Frederick's honours."},{"name":"Gallus","meaning":"Rooster","date":"1613","creator":"Petrus Plancius","position":"Northern Puppis","wiki":"https://en.wikipedia.org/wiki/Gallus_(constellation)"},{"name":"Gladii Electorales Saxonici","meaning":"Crossed Swords of the Electorate of Saxony","date":"1684","creator":"Gottfried Kirch","position":"Between Boötes, Leo, Scutum, and Virgo","wiki":""},{"name":"Globus Aerostaticus","meaning":"Hot air balloon","date":"1798","creator":"Jérôme Lalande","position":"south of Capricornus and Piscis Austrinus","wiki":"https://en.wikipedia.org/wiki/Globus_Aerostaticus","note":"The Montgolfier age reached the sky astonishingly quickly. Only a few years after the first crewed balloon flights, Lalande placed a hot-air balloon among the southern stars. Urania's Mirror even drew it as a fully inflated balloon: a brief moment when the newest human technology looked worthy of becoming eternal mythology.","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Aquarius%2C%20Piscis%20Australis%20%26%20Ballon%20Aerostatique.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Aquarius,_Piscis_Australis_&_Ballon_Aerostatique.jpg","imageAlt":"Urania's Mirror showing the Balloon"},{"name":"Gryphites","meaning":"Gryphaea shellfish","date":"1754","creator":"John Hill","position":"","wiki":""},{"name":"Hippocampus","meaning":"Sea Horse","date":"1754","creator":"John Hill","position":"Between Eridanus, Taurus, and Cetus","wiki":""},{"name":"Hirudo","meaning":"Leech","date":"1754","creator":"John Hill","position":"Northern Orion","wiki":""},{"name":"Jordanus","meaning":"River Jordan","date":"1613","creator":"Petrus Plancius","position":"","wiki":"https://en.wikipedia.org/wiki/Jordanus_(constellation)","note":"Plancius's River Jordan flowed beneath Ursa Major until Hevelius replaced much of the same territory with Canes Venatici, Leo Minor and Lynx.","source":"https://www.ianridpath.com/startales/ptolemy-spare.html"},{"name":"Leo Palatinus","meaning":"Lion to honour the Elector Palatine Charles Theodore and his wife Elisabeth Auguste","date":"1785","creator":"Karl-Joseph König","position":"","wiki":"https://en.wikipedia.org/wiki/Leo_Palatinus"},{"name":"Lilium","meaning":"Fleur de Lys (renamed Musca Borealis)","date":"1679","creator":"Augustin Royer/P. Anthelme","position":"","wiki":"https://en.wikipedia.org/wiki/Lilium_(constellation)"},{"name":"Limax","meaning":"Slug","date":"1754","creator":"John Hill","position":"","wiki":""},{"name":"Linum Piscium","meaning":"The line connecting the fish (renamed by Bode in 1801 from Hevelius's Linum Austrinum and Linum Boreum; known as Lineola too)","date":"1590","creator":"Thomas Hood","position":"","wiki":""},{"name":"Lochium Funis","meaning":"Log line (renamed Linea Nautica in 1888 by Eliza A. Bowen)","date":"1801","creator":"Johann Elert Bode","position":"","wiki":"https://en.wikipedia.org/wiki/Lochium_Funis"},{"name":"Lumbricus","meaning":"Earthworm","date":"1754","creator":"John Hill","position":"","wiki":""},{"name":"Machina Electrica","meaning":"Electricity generator","date":"1800","creator":"Johann Elert Bode","position":"south of Cetus, between Fornax and Sculptor","wiki":"https://en.wikipedia.org/wiki/Machina_Electrica","note":"Bode turned the new science of electricity into a constellation: an electrostatic generator sitting beside other instrument-themed figures in the southern sky. It appeared prominently in his 1801 Uranographia and in later illustrated atlases, but never gained the broad acceptance of Lacaille's surviving scientific constellations.","source":"https://cseligman.com/text/atlas/machinaelectrica.htm","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Psalterium%20Georgii%2C%20Fluvius%20Eridanus%2C%20Cetus%2C%20Officina%20Sculptoris%2C%20Fornax%20Chemica%2C%20and%20Machina%20Electrica.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Psalterium_Georgii,_Fluvius_Eridanus,_Cetus,_Officina_Sculptoris,_Fornax_Chemica,_and_Machina_Electrica.jpg","imageAlt":"Urania's Mirror showing Machina Electrica"},{"name":"Malus","meaning":"Mast","date":"1844","creator":"John Herschel","position":"Where Pyxis is now","wiki":"https://en.wikipedia.org/wiki/Malus_(constellation)"},{"name":"Manis","meaning":"Pangolin","date":"1754","creator":"John Hill","position":"Between Andromeda, Lacerta, and Cygnus","wiki":""},{"name":"Marmor Sculptile","meaning":"Bust of Columbus","date":"1810","creator":"William Croswell","position":"","wiki":""},{"name":"Mons Maenalus","meaning":"Mount Mainalo","date":"1690","creator":"Johannes Hevelius","position":"Southern Boötes","wiki":"https://en.wikipedia.org/wiki/Mons_Maenalus","note":"Hevelius placed Mount Maenalus beneath Boötes's feet, turning the constellation picture into a landscape rather than a lone figure. The mountain came from Arcadian mythology, the homeland of the hunter Arcas. The mountain was later discarded as a constellation, but the name Maenalus survives as a modern star name.","source":"https://www.ianridpath.com/startales/bootes.html","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Bootes2.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Bootes2.jpg","imageAlt":"Bode's Boötes region with Mons Maenalus"},{"name":"Musca Borealis","meaning":"Northern Fly","date":"1690","creator":"Johannes Hevelius","position":"","wiki":"https://en.wikipedia.org/wiki/Musca_Borealis"},{"name":"Noctua","meaning":"Owl","date":"1822","creator":"Alexander Jamieson","position":"","wiki":"https://en.wikipedia.org/wiki/Noctua_(constellation)","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Noctua.JPG?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Noctua.JPG","imageAlt":"Noctua, the Owl","note":"The owl was the final form of a patch of sky that repeatedly changed bird. Le Monnier had first made it Turdus Solitarius, honouring the extinct Rodrigues solitaire; later charts turned it into a mockingbird, and Jamieson finally made it Noctua, the Owl. Urania's Mirror preserves the owl perched above Hydra."},{"name":"Norma Nilotica","meaning":"Nilometer","date":"1822","creator":"Alexander Jamieson","position":"Western edge of Aquarius","wiki":"https://en.wikipedia.org/wiki/Norma_Nilotica_(constellation)"},{"name":"Nubecula Major and Nubecula Minor","meaning":"Magellanic Clouds","date":"1603","creator":"Johann Bayer","position":"","wiki":"https://en.wikipedia.org/wiki/Nubecula_Major"},{"name":"Officina Typographica","meaning":"Printshop","date":"1801","creator":"Johann Elert Bode","position":"east of Sirius, mostly in modern Puppis","wiki":"https://en.wikipedia.org/wiki/Officina_Typographica","note":"Bode commemorated the printing press itself—a fitting monument from an era in which printed atlases were rapidly changing how the sky was standardised and shared. In Urania's Mirror it appears as a little working printshop beside Monoceros and Canis Minor.","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Monoceros%2C%20Canis%20Minor%2C%20and%20Atelier%20Typographique.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Monoceros,_Canis_Minor,_and_Atelier_Typographique.jpg","imageAlt":"Urania's Mirror showing the printing workshop"},{"name":"Patella","meaning":"Limpet","date":"1754","creator":"John Hill","position":"","wiki":""},{"name":"Phaethon","meaning":"Phaethon","date":"Middle Ages","creator":"Aratus/Hyginus","position":"","wiki":""},{"name":"Phoenicopterus","meaning":"Flamingo (an obsolete name for Grus)","date":"early 17th century","creator":"Petrus Plancius/Paulus Merula","position":"where Grus is now","wiki":"https://en.wikipedia.org/wiki/Phoenicopterus_(constellation)"},{"name":"Pinna Marina","meaning":"Mussel","date":"1754","creator":"John Hill","position":"","wiki":""},{"name":"Piscis Notus","meaning":"Southern Fish (obsolete name for Piscis Austrinus)","date":"3rd century BC","creator":"Aratus","position":"where Piscis Austrinus is now","wiki":"https://en.wikipedia.org/wiki/Piscis_Austrinus"},{"name":"Plaustrum","meaning":"Chariot with 3 horses","date":"1524","creator":"Petrus Apianus","position":"Big Dipper","wiki":""},{"name":"Pluteum","meaning":"Parapet (obsolete for Pictor)","date":"1881","creator":"Richard Andree","position":"where Pictor is now","wiki":""},{"name":"Polophylax","meaning":"Guardian of the Pole","date":"1592","creator":"Petrus Plancius","position":"","wiki":"https://en.wikipedia.org/wiki/Polophylax"},{"name":"Pomum Imperiale","meaning":"Leopold's orb","date":"1688","creator":"Gottfried Kirch","position":"","wiki":""},{"name":"Proctor's renamed constellations","meaning":"A proposed replacement vocabulary for 16 existing constellations","date":"1873","creator":"Richard Proctor","position":"across the established northern and southern sky","wiki":""},{"name":"Psalterium Georgii","meaning":"George's Psaltery (renamed to Harp Georgii by Lalande)","date":"1781","creator":"Maximilian Hell","position":"","wiki":"https://en.wikipedia.org/wiki/Psalterium_Georgii","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Psalterium%20Georgii%2C%20Fluvius%20Eridanus%2C%20Cetus%2C%20Officina%20Sculptoris%2C%20Fornax%20Chemica%2C%20and%20Machina%20Electrica.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Psalterium_Georgii,_Fluvius_Eridanus,_Cetus,_Officina_Sculptoris,_Fornax_Chemica,_and_Machina_Electrica.jpg","imageAlt":"Urania's Mirror showing Psalterium Georgii","note":"Maximilian Hell named this small constellation for the psaltery of King George II. Lalande later recast it as Harp Georgii. It is a neat example of how quickly celestial honours could be renamed when a different astronomer redrew the same faint stars."},{"name":"Quadrans Muralis","meaning":"Mural Quadrant","date":"1795","creator":"Jérôme Lalande","position":"between Boötes and Draco","wiki":"https://en.wikipedia.org/wiki/Quadrans_Muralis","note":"Lalande's wall-mounted astronomical quadrant vanished from the official sky, but its ghost is unusually easy to meet: the Quadrantid meteor shower still carries its name because the radiant was originally described inside Quadrans Muralis. In February 2025 the IAU went one step further and officially named 44 Boötis A Quadrans.","source":"https://www.ianridpath.com/startales/draco.html","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%2C%20Bo%C3%B6tes%2C%20Canes%20Venatici%2C%20Coma%20Berenices%2C%20and%20Quadrans%20Muralis%2C%201825.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall,_Bo%C3%B6tes,_Canes_Venatici,_Coma_Berenices,_and_Quadrans_Muralis,_1825.jpg","imageAlt":"Urania's Mirror showing Quadrans Muralis"},{"name":"Quadratum","meaning":"Rhombus (obsolete name for Reticulum Rhomboidalis)","date":"1706","creator":"Carel Allard","position":"","wiki":""},{"name":"Quinque Dromedarii","meaning":"Five Camels","date":"1532","creator":"Petrus Apianus","position":"Southern Draco","wiki":""},{"name":"Ramus Pomifer","meaning":"Apple-bearing Branch","date":"1690","creator":"Johannes Hevelius","position":"","wiki":"https://en.wikipedia.org/wiki/Ramus_Pomifer"},{"name":"Robur Carolinum","meaning":"Charles' Oak","date":"1679","creator":"Edmund Halley","position":"within the old Argo Navis","wiki":"https://en.wikipedia.org/wiki/Robur_Carolinum","note":"Halley invented Charles's Oak after observing the southern sky from St Helena. It commemorated the Royal Oak in which the future Charles II hid after defeat at the Battle of Worcester in 1651. Halley borrowed conspicuous stars from Argo Navis to build the oak, making the chart both astronomy and unmistakable Restoration-era politics.","source":"https://penelope.uchicago.edu/Thayer/E/Gazetteer/Topics/astronomy/_Texts/secondary/ALLSTA/Robur_Carolinum%2A.html","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Halley%27s%20Argo%20and%20Robur%20Carolinum.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Halley's_Argo_and_Robur_Carolinum.jpg","imageAlt":"Halley's Argo Navis and Robur Carolinum"},{"name":"Rosa","meaning":"Rose","date":"1536","creator":"Petrus Apianus","position":"","wiki":""},{"name":"Sagitta Australis","meaning":"Southern Arrow","date":"1613","creator":"Petrus Plancius","position":"","wiki":""},{"name":"Scarabaeus","meaning":"Rhinoceros Beetle","date":"1754","creator":"John Hill","position":"","wiki":""},{"name":"Sceptrum Brandenburgicum","meaning":"Sceptre of Brandenburg","date":"1688","creator":"Gottfried Kirch","position":"","wiki":"https://en.wikipedia.org/wiki/Sceptrum_Brandenburgicum","note":"Kirch made this sceptre to honour Brandenburg. The constellation vanished, but its name was unusually persistent in catalogues; 53 Eridani A now officially carries the star name Sceptrum."},{"name":"Sceptrum et Manus Iustitiae","meaning":"Sceptre and Hand of Justice","date":"1679","creator":"Augustin Royer","position":"Northeastern Andromeda, where Honores Fredirici was","wiki":"https://en.wikipedia.org/wiki/Sceptrum_et_Manus_Iustitiae"},{"name":"Sciurus Volans","meaning":"Flying Squirrel (now part of Camelopardalis)","date":"1810","creator":"William Croswell","position":"","wiki":""},{"name":"Sextans Uraniae","meaning":"Urania's Sextant (obsolete name for Sextans)","date":"1690","creator":"Johannes Hevelius","position":"","wiki":"https://en.wikipedia.org/wiki/Sextans"},{"name":"Siren, Ceneus and Lang","meaning":"Siren, Lapith Caeneus and Lang","date":"early 17th century","creator":"Unknown/Willem Jansz Blaeu","position":"where Chamaeleon, Musca, Tucana and Triangulum Australe now are","wiki":""},{"name":"Solarium","meaning":"Sundial","date":"1822","creator":"Alexander Jamieson","position":"Replacement for Reticulum","wiki":"https://en.wikipedia.org/wiki/Solarium_(constellation)"},{"name":"Sudarium Veronicae","meaning":"Sudarium of Veronica","date":"1643","creator":"Antoine Marie Schyrle de Rheita","position":"between Leo, Hydra and Sextans","wiki":""},{"name":"Tarabellum and Vexillum","meaning":"Drill and flag-like Standard","date":"12th century","creator":"Michael Scot","position":"between Leo and Virgo","wiki":""},{"name":"Tarandus or Rangifer","meaning":"Reindeer","date":"1743","creator":"Pierre Charles Lemonnier","position":"Between Cassiopeia, and Camelopardalis","wiki":"https://en.wikipedia.org/wiki/Rangifer_(constellation)","note":"Le Monnier had travelled with Maupertuis's 1736–37 expedition to Lapland, whose measurements helped establish that Earth is flattened at the poles. There he encountered Sámi reindeer sky tradition; in 1743 he introduced Rangifer, the Reindeer, into a faint northern gap. Later atlases also called it Tarandus. In December 2025 the IAU preserved both names separately as the official star names Rangifer and Tarandus.","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Camelopardalis%2C%20Tarandus%20and%20Custos%20Messium.png?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Camelopardalis,_Tarandus_and_Custos_Messium.png","imageAlt":"Urania's Mirror showing Tarandus","source":"https://xing.fmi.uni-jena.de/mediawiki/index.php/Tarandus"},{"name":"Taurus Poniatovii","meaning":"Poniatowski's Bull","date":"1777","creator":"Marcin Poczobut","position":"between Ophiuchus and Serpens Cauda","wiki":"https://en.wikipedia.org/wiki/Taurus_Poniatovii","note":"Poczobut noticed a compact V-shaped pattern that recalled the Hyades—the V forming the face of Taurus—and used it to create a second bull for King Stanisław August Poniatowski of Poland. The royal bull later disappeared, leaving its stars split between Ophiuchus and Serpens Cauda.","source":"https://www.ianridpath.com/startales/ptolemy-spare.html","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Taurus%20Poniatovii.PNG?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Taurus_Poniatovii.PNG","imageAlt":"Bode's Taurus Poniatovii"},{"name":"Telescopium Herschelii","meaning":"Herschel's Telescope (renamed from Tubus Herschelii Major by Bode in 1801)","date":"1781","creator":"Maximilian Hell","position":"","wiki":"https://en.wikipedia.org/wiki/Telescopium_Herschelii","note":"Hell honoured William Herschel with telescope constellations soon after Herschel's discovery of Uranus. Bode later depicted the larger instrument as Telescopium Herschelii: a celestial monument not to a mythic hero but to a living astronomer and the machine that had just expanded the known Solar System.","image":"https://commons.wikimedia.org/wiki/Special:FilePath/Sidney%20Hall%20-%20Urania%27s%20Mirror%20-%20Lynx%20and%20Telescopium%20Herschilii.jpg?width=900","imagePage":"https://commons.wikimedia.org/wiki/File:Sidney_Hall_-_Urania's_Mirror_-_Lynx_and_Telescopium_Herschilii.jpg","imageAlt":"Urania's Mirror showing Telescopium Herschelii"},{"name":"Testudo","meaning":"Tortoise","date":"1754","creator":"John Hill","position":"Between Cetus and Pisces","wiki":"https://en.wikipedia.org/wiki/Pisces_(constellation)#History_and_mythology"},{"name":"Tigris","meaning":"Tigris River","date":"1613","creator":"Petrus Plancius","position":"","wiki":"https://en.wikipedia.org/wiki/River_Tigris_(constellation)"},{"name":"Triangulum Majus","meaning":"Large Triangle (obsolete name for Triangulum)","date":"1690","creator":"Johannes Hevelius","position":"where Triangulum is now","wiki":"https://en.wikipedia.org/wiki/Triangulum"},{"name":"Triangulum Minus","meaning":"Small Triangle","date":"1690","creator":"Johannes Hevelius","position":"","wiki":"https://en.wikipedia.org/wiki/Triangulum_Minus"},{"name":"Triangulus Antarcticus","meaning":"Obsolete name for Triangulum Australe","date":"1589","creator":"Petrus Plancius","position":"","wiki":""},{"name":"Tubus Herschelii Minor","meaning":"Herschel's Reflector","date":"1781","creator":"Maximilian Hell","position":"","wiki":""},{"name":"Turdus Solitarius","meaning":"Solitary Thrush (renamed to Mocking Bird and then to Noctua). Named in honour of the Rodrigues solitaire, an extinct flightless bird related to the dodo.","date":"1776","creator":"Pierre Charles Lemonnier","position":"","wiki":"https://en.wikipedia.org/wiki/Turdus_Solitarius","note":"Le Monnier named this bird for the Rodrigues solitaire, an extinct flightless relative of the dodo. The same stars later became a mockingbird and then Noctua, the Owl. In 2024 the IAU named 58 Hydrae Solitaire, so the extinct bird and the extinct constellation now survive together in a modern official star name."},{"name":"Turris Eiffel","meaning":"Eiffel Tower","date":"1922","creator":"Ezequiel de Moraes Leme","position":"Between Centaurus and Lupus","wiki":"https://en.wikipedia.org/wiki/Former_constellations#cite_note-53","note":"A startlingly late proposal: Ezequiel de Moraes Leme drew the Eiffel Tower between Centaurus and Lupus in 1922. That was the very year the IAU adopted its first official list of constellations, so Turris Eiffel arrived almost exactly when the era of freely inventing new Western constellations was ending."},{"name":"Uranoscopus","meaning":"Star-Gazer fish","date":"1754","creator":"John Hill","position":"","wiki":""},{"name":"Urna","meaning":"Urn of Aquarius","date":"1596","creator":"Zacharias Bornmann","position":"","wiki":""},{"name":"Vespa","meaning":"Wasp (an obsolete name for Musca Borealis)","date":"1624","creator":"Jakob Bartsch","position":"","wiki":"https://en.wikipedia.org/wiki/Vespa_(constellation)"},{"name":"Xiphias","meaning":"Swordfish (An obsolete name for Dorado)","date":"1627","creator":"Johannes Kepler","position":"Where Dorado is now","wiki":""}];

  const INTERESTING_STAR_STORIES = [{"group":"Names that map the picture","title":"Rasalhague & Unukalhai","stars":"α Ophiuchi · α Serpentis","key":"head of the Serpent Bearer · neck of the Serpent","paragraphs":["Rasalhague comes from Arabic for the head of the serpent-bearer, and α Ophiuchi sits at Ophiuchus's head. Nearby Unukalhai, α Serpentis, is the Serpent's Neck.","Together they turn the sprawling Ophiuchus–Serpens figure into something readable: the man's head beside the neck of the serpent he is holding."],"source":"https://en.wikipedia.org/wiki/Alpha_Ophiuchi","names":[{"name":"Rasalhague","wiki":"https://en.wikipedia.org/wiki/Alpha_Ophiuchi"},{"name":"Unukalhai","wiki":"https://en.wikipedia.org/wiki/Alpha_Serpentis"}]},{"group":"Names that map the picture","title":"The Deneb family","stars":"Deneb · Denebola · Deneb Algedi","key":"tail · Lion's Tail · Goat's Tail","paragraphs":["Arabic dhanab means tail. Deneb is the tail of the Swan, Denebola the tail of Leo, and Deneb Algedi the tail of the Goat.","Once the root is visible, three apparently unrelated proper names become pieces of the same old anatomical vocabulary."],"source":"https://en.wikipedia.org/wiki/Deneb","names":[{"name":"Deneb","wiki":"https://en.wikipedia.org/wiki/Deneb"},{"name":"Denebola","wiki":"https://en.wikipedia.org/wiki/Denebola"},{"name":"Deneb Algedi","wiki":"https://en.wikipedia.org/wiki/Delta_Capricorni"}]},{"group":"Names that map the picture","title":"Virgo's harvest","stars":"Spica · Vindemiatrix","key":"ear of grain · grape-gatherer","paragraphs":["Spica is Latin for an ear of grain, exactly what Virgo holds in traditional artwork. Vindemiatrix is the grape-gatherer: its seasonal appearance became associated with the vintage.","Virgo therefore preserves agriculture twice—one name from the picture in her hand, another from the calendar of harvesting."],"source":"https://en.wikipedia.org/wiki/Spica","names":[{"name":"Spica","wiki":"https://en.wikipedia.org/wiki/Spica"},{"name":"Vindemiatrix","wiki":"https://en.wikipedia.org/wiki/Vindemiatrix"}]},{"group":"Names that map the picture","title":"Orion is almost an anatomical diagram","stars":"Betelgeuse · Rigel · Mintaka · Alnilam · Alnitak · Saiph · Meissa","key":"hand · foot · belt · string · girdle · sword","paragraphs":["Rigel is the foot; Mintaka and Alnitak are belt/girdle names; Alnilam evokes the ordered string of the Belt. Betelgeuse descends from an Arabic 'hand of al-Jawza' expression, attached in Europe to Orion's upper body.","Saiph descends from a phrase for the giant's sword even though the modern star lies down near Orion's lower body. Meissa is stranger still: its name seems to have migrated to λ Orionis after historical confusion with neighbouring Gemini material. The names are not a designed system—they are manuscript fossils."],"source":"https://xing.fmi.uni-jena.de/mediawiki/index.php/Meissa","names":[{"name":"Betelgeuse","wiki":"https://en.wikipedia.org/wiki/Betelgeuse"},{"name":"Rigel","wiki":"https://en.wikipedia.org/wiki/Rigel"},{"name":"Mintaka","wiki":"https://en.wikipedia.org/wiki/Mintaka"},{"name":"Alnilam","wiki":"https://en.wikipedia.org/wiki/Alnilam"},{"name":"Alnitak","wiki":"https://en.wikipedia.org/wiki/Alnitak"},{"name":"Saiph","wiki":"https://en.wikipedia.org/wiki/Saiph"},{"name":"Meissa","wiki":"https://en.wikipedia.org/wiki/Meissa"}]},{"group":"Names that map the picture","title":"Capella and the Kids","stars":"Capella · Haedus I · Haedus II","key":"little she-goat · the Kids","paragraphs":["Capella literally means little she-goat. Traditional Auriga artwork shows the Charioteer carrying the goat Amalthea on his shoulder, with the Haedi—the Kids—beside her.","Without the old picture, a goat inside the Charioteer seems arbitrary. With it, the names fall into place."],"source":"https://en.wikipedia.org/wiki/Capella","names":[{"name":"Capella","wiki":"https://en.wikipedia.org/wiki/Capella"},{"name":"Haedus I","wiki":"https://en.wikipedia.org/wiki/Zeta_Aurigae"},{"name":"Haedus II","wiki":"https://en.wikipedia.org/wiki/Eta_Aurigae"}]},{"group":"Names that map the picture","title":"Fomalhaut","stars":"α Piscis Austrini","key":"mouth of the Southern Fish","paragraphs":["Fomalhaut comes from Arabic for the mouth of the fish, and it lies at the mouth of Piscis Austrinus.","Old artwork makes the placement even better: the stream from Aquarius runs directly into that mouth. Fomalhaut is where two constellation pictures meet."],"source":"https://en.wikipedia.org/wiki/Fomalhaut","names":[{"name":"Fomalhaut","wiki":"https://en.wikipedia.org/wiki/Fomalhaut"}]},{"group":"Names that map the picture","title":"Cetus in fragments","stars":"Menkar · Baten Kaitos · Diphda · Mira","key":"nostril · belly · frog · wonderful","paragraphs":["Menkar marks the sea monster's nostril and Baten Kaitos its belly. Diphda comes from a different 'frog' tradition, while Mira is Latin for wonderful or astonishing.","Cetus is a good reminder that neighbouring star names need not come from one coherent picture: several languages and sky traditions can be layered over the same modern constellation."],"source":"https://en.wikipedia.org/wiki/Cetus","names":[{"name":"Menkar","wiki":"https://en.wikipedia.org/wiki/Alpha_Ceti"},{"name":"Baten Kaitos","wiki":"https://en.wikipedia.org/wiki/Zeta_Ceti"},{"name":"Diphda","wiki":"https://en.wikipedia.org/wiki/Beta_Ceti"},{"name":"Mira","wiki":"https://en.wikipedia.org/wiki/Mira"}]},{"group":"Names that map the picture","title":"Vulpecula's missing goose","stars":"Anser · α Vulpeculae","key":"the Goose","paragraphs":["Hevelius introduced the constellation as Vulpecula cum Ansere—the Little Fox with the Goose—and drew the fox carrying a goose in its jaws.","The official constellation was shortened to Vulpecula, but the goose survived as the name Anser. The vanished picture is still encoded in the surviving constellation and star names."],"source":"https://en.wikipedia.org/wiki/Vulpecula","names":[{"name":"Anser","wiki":"https://en.wikipedia.org/wiki/Alpha_Vulpeculae"}]},{"group":"Names from watching the sky","title":"Alphard","stars":"α Hydrae","key":"the Solitary One","paragraphs":["Arabic al-fard means the solitary one. Alphard sits conspicuously alone in a broad, relatively empty-looking part of the sky.","It is less a mythological label than an observing note that has survived for centuries."],"source":"https://en.wikipedia.org/wiki/Alphard","names":[{"name":"Alphard","wiki":"https://en.wikipedia.org/wiki/Alphard"}]},{"group":"Names from watching the sky","title":"Arcturus","stars":"α Boötis","key":"guardian of the Bear","paragraphs":["Greek Arktouros combines the bear with a guardian or watcher. Boötes follows Ursa Major around the northern sky, so his brightest star is the Bear-Watcher.","The name makes most sense when the northern constellations are read as one scene rather than as separate stick figures."],"source":"https://en.wikipedia.org/wiki/Arcturus","names":[{"name":"Arcturus","wiki":"https://en.wikipedia.org/wiki/Arcturus"}]},{"group":"Names from watching the sky","title":"Procyon","stars":"α Canis Minoris","key":"before the Dog","paragraphs":["Greek pro kyon means before the dog. At many northern latitudes Procyon rises before Sirius, the Dog Star.","The name records an actual sequence in the night sky: watch the eastern horizon and the little dog announces the greater one."],"source":"https://en.wikipedia.org/wiki/Procyon","names":[{"name":"Procyon","wiki":"https://en.wikipedia.org/wiki/Procyon"}]},{"group":"Names from watching the sky","title":"Aldebaran","stars":"α Tauri","key":"the Follower","paragraphs":["Arabic al-dabaran means the Follower. Aldebaran follows the Pleiades across the sky.","The same star is also the eye of Taurus in the Greco-Roman picture. One physical star therefore preserves two completely different ways of reading the same sky."],"source":"https://en.wikipedia.org/wiki/Aldebaran","names":[{"name":"Aldebaran","wiki":"https://en.wikipedia.org/wiki/Aldebaran"}]},{"group":"Names from watching the sky","title":"Antares","stars":"α Scorpii","key":"rival of Ares","paragraphs":["Antares is conventionally read from Greek as the rival or counterpart of Ares—Mars.","The comparison is easy to reproduce: Antares is conspicuously red, Mars is conspicuously red, and Mars sometimes passes through the same zodiacal neighbourhood."],"source":"https://en.wikipedia.org/wiki/Antares","names":[{"name":"Antares","wiki":"https://en.wikipedia.org/wiki/Antares"}]},{"group":"Names from watching the sky","title":"Regulus","stars":"α Leonis","key":"little king","paragraphs":["Regulus is Latin for little king or prince. The star sits at the base of Leo's Sickle and carries a royal tradition much older than the Latin name itself.","It is a useful contrast with the many Arabic anatomical names nearby: not every familiar proper name reached us through the same linguistic route."],"source":"https://en.wikipedia.org/wiki/Regulus","names":[{"name":"Regulus","wiki":"https://en.wikipedia.org/wiki/Regulus"}]},{"group":"Astronomical archaeology","title":"Libra's Scorpion claws","stars":"Zubenelgenubi · Zubeneschamali","key":"Southern Claw · Northern Claw","paragraphs":["Libra is the Scales, yet its two great traditional names mean the Southern and Northern Claws. The mismatch is the point.","These stars belonged conceptually to the claws of a much larger Scorpius before Libra became firmly established as a separate balance. Modern Libra therefore carries older Scorpion anatomy in its star names."],"source":"https://xing.fmi.uni-jena.de/mediawiki/index.php/Zubeneschamali","names":[{"name":"Zubenelgenubi","wiki":"https://en.wikipedia.org/wiki/Alpha_Librae"},{"name":"Zubeneschamali","wiki":"https://en.wikipedia.org/wiki/Beta_Librae"}]},{"group":"Astronomical archaeology","title":"Alpheratz","stars":"α Andromedae · formerly also δ Pegasi","key":"Andromeda star, Pegasus fossil","paragraphs":["Alpheratz is officially α Andromedae but forms the north-eastern corner of the Great Square of Pegasus. Older cataloguing traditions treated the star as shared between the two figures, and it even carried δ Pegasi alongside α Andromedae.","Its traditional name is horse-related. The star's modern constellation, asterism membership and old name preserve three different boundary systems at once."],"source":"https://ase.exopla.net/index.php/Alpheratz","names":[{"name":"Alpheratz","wiki":"https://en.wikipedia.org/wiki/Alpheratz"}]},{"group":"Astronomical archaeology","title":"Algol","stars":"β Persei","key":"head of the ghoul","paragraphs":["Algol descends from Arabic for the head of the ghoul or demon. In the Perseus picture it sits in the severed head of Medusa.","It is also an eclipsing binary whose brightness visibly drops. The sinister name did not arise from modern binary theory, but the coincidence is perfect: Medusa's eye really does fade and return."],"source":"https://en.wikipedia.org/wiki/Algol","names":[{"name":"Algol","wiki":"https://en.wikipedia.org/wiki/Algol"}]},{"group":"Astronomical archaeology","title":"Rasalgethi","stars":"α Herculis","key":"head of the Kneeler","paragraphs":["Rasalgethi is another readable Arabic head-name: ras, head, plus the old description of Hercules as the Kneeler.","After learning Rasalhague and Rasalgethi, ras stops looking like meaningless syllables and becomes a reusable piece of stellar vocabulary."],"source":"https://en.wikipedia.org/wiki/Alpha_Herculis","names":[{"name":"Rasalgethi","wiki":"https://en.wikipedia.org/wiki/Alpha_Herculis"}]},{"group":"Human fingerprints","title":"Sualocin & Rotanev","stars":"α Delphini · β Delphini","key":"NICOLAUS · VENATOR, backwards","paragraphs":["Reverse SUALOCIN and ROTANEV and you get NICOLAUS VENATOR.","That is the Latinised name of Niccolò Cacciatore, assistant and later successor to Giuseppe Piazzi at Palermo. The backwards names appeared in the Palermo catalogue and somehow endured; both are now official IAU star names. It is difficult to find a better reminder that astronomical nomenclature was made by actual people."],"source":"https://xing.fmi.uni-jena.de/mediawiki/index.php/Sualocin","names":[{"name":"Sualocin","wiki":"https://en.wikipedia.org/wiki/Alpha_Delphini"},{"name":"Rotanev","wiki":"https://en.wikipedia.org/wiki/Beta_Delphini"}]},{"group":"Human fingerprints","title":"Cor Caroli","stars":"α Canum Venaticorum","key":"Heart of Charles","paragraphs":["Cor Caroli is straightforward Latin: Heart of Charles. The exact historical association with Charles I versus Charles II became muddled in later retellings.","That ambiguity is part of the charm: even a famous star name can preserve layers of political memory, later reinterpretation and imperfect historical transmission."],"source":"https://en.wikipedia.org/wiki/Cor_Caroli","names":[{"name":"Cor Caroli","wiki":"https://en.wikipedia.org/wiki/Cor_Caroli"}]},{"group":"Human fingerprints","title":"Peacock","stars":"α Pavonis","key":"a modern practical name","paragraphs":["Peacock is not an ancient inheritance. The English name was coined in the twentieth century for practical navigational use and later became the official IAU name of α Pavonis.","So Pavo means Peacock, and its brightest star is simply Peacock—a remarkably modern story beside names that have travelled through Arabic manuscripts for a millennium."],"source":"https://en.wikipedia.org/wiki/Alpha_Pavonis","names":[{"name":"Peacock","wiki":"https://en.wikipedia.org/wiki/Alpha_Pavonis"}]},{"group":"Human fingerprints","title":"Camelopardalis & Kamelos","stars":"HIP 31940","key":"camel + leopard → giraffe","paragraphs":["Camelopardalis comes from the old camel-leopard idea of a giraffe: camel-like in shape, leopard-like in spots. Plancius introduced the faint northern constellation in 1612.","In December 2025 the IAU named a star at the figure's heart Kamelos, Greek for camel—a new name deliberately playing with the constellation's centuries-old etymology."],"source":"https://xing.fmi.uni-jena.de/mediawiki/index.php/Kamelos","names":[{"name":"Kamelos","wiki":""}]},{"group":"Lost constellations returning as stars","title":"Quadrans","stars":"44 Boötis A","key":"Quadrans Muralis remembered","paragraphs":["Quadrans Muralis, Lalande's Mural Quadrant, disappeared from the official constellation map. Its ghost survived in the Quadrantid meteor shower, whose radiant lay in the lost figure.","In February 2025 the IAU officially named 44 Boötis A Quadrans. A constellation created in 1795, abolished by standardisation, and remembered by a meteor shower now has a named-star memorial too."],"source":"https://www.iau.org/IAU/IAU/News/Ann2026/New-Star-Names-2026.aspx","names":[{"name":"Quadrans","wiki":"https://en.wikipedia.org/wiki/44_Bo%C3%B6tis"}]},{"group":"Lost constellations returning as stars","title":"Rangifer & Tarandus","stars":"49 Cassiopeiae A · 2 Ursae Minoris","key":"the lost Reindeer, twice","paragraphs":["Le Monnier introduced Rangifer, the Reindeer, after his Lapland years; later atlases also used the name Tarandus. The constellation disappeared.","In December 2025 the IAU adopted both Rangifer and Tarandus as separate official star names. A faint obsolete constellation now survives twice in the modern catalogue."],"source":"https://xing.fmi.uni-jena.de/mediawiki/index.php/Tarandus","names":[{"name":"Rangifer","wiki":"https://en.wikipedia.org/wiki/49_Cassiopeiae"},{"name":"Tarandus","wiki":"https://en.wikipedia.org/wiki/2_Ursae_Minoris"}]},{"group":"A few Chinese skies","title":"Vega & Altair","stars":"Vega · Altair","key":"Weaver Girl · Cowherd","paragraphs":["In the Chinese story, the Weaver Girl Zhīnǚ and Cowherd Niúláng are separated by the celestial river—the Milky Way—and reunited on the seventh night of the seventh lunar month.","The geography is visible without a chart: Vega on one side of the Milky Way, Altair on the other. The story is still celebrated through Qixi and related East Asian traditions."],"source":"https://en.wikipedia.org/wiki/The_Cowherd_and_the_Weaver_Girl","names":[{"name":"Vega","wiki":"https://en.wikipedia.org/wiki/Vega"},{"name":"Altair","wiki":"https://en.wikipedia.org/wiki/Altair"}]},{"group":"A few Chinese skies","title":"Shēn — the Three Stars","stars":"Orion's Belt","key":"a different Orion","paragraphs":["Chinese astronomy did not inherit one Greek hunter called Orion. The unmistakable Belt belongs to Shēn, the Three Stars, a major traditional asterism and lunar mansion.","The same three evenly spaced stars became central structures in unrelated sky traditions—one of the clearest places to compare how different cultures partitioned the identical sky."],"source":"https://en.wikipedia.org/wiki/Three_Stars_(Chinese_constellation)","names":[{"name":"Alnitak","wiki":"https://en.wikipedia.org/wiki/Alnitak"},{"name":"Alnilam","wiki":"https://en.wikipedia.org/wiki/Alnilam"},{"name":"Mintaka","wiki":"https://en.wikipedia.org/wiki/Mintaka"}]},{"group":"A few Chinese skies","title":"Antares as the Heart","stars":"Antares · 心宿二","key":"middle star of Xīn, the Heart","paragraphs":["In traditional Chinese astronomy Antares is the central star of Xīn, the Heart, and is known as the Second Star of Heart.","Western Scorpius also places the same brilliant red star near the creature's heart. Two different traditions independently gave an unusually conspicuous red star a central anatomical role."],"source":"https://en.wikipedia.org/wiki/Antares","names":[{"name":"Antares","wiki":"https://en.wikipedia.org/wiki/Antares"}]}];

  const HEVELIUS_GALLERY = [{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola Emisfero Boreale.jpg","caption":"Northern hemisphere"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola Emisfero Australe.jpg","caption":"Southern hemisphere"},{"file":"Ursa Minor Hevelius.jpg","caption":"Ursa Minor"},{"file":"Draco Hevelius.jpg","caption":"Draco"},{"file":"Cepheus Hevelius 2.jpg","caption":"Cepheus"},{"file":"Ursa Major Hevelius.jpg","caption":"Ursa Major"},{"file":"Canes Venatici Hevelius.jpg","caption":"Canes Venatici"},{"file":"Bootes.jpg","caption":"Boötes"},{"file":"Hev 10 fig G corona.jpg","caption":"Corona Borealis"},{"file":"Hev 11 fig H hercules et cerberus.jpg","caption":"Hercules & Cerberus"},{"file":"Hev 12 fig I lyra.jpg","caption":"Lyra"},{"file":"Hev 13 fig K cygnus.jpg","caption":"Cygnus"},{"file":"Hev 14 fig L anser et vulpecula.jpg","caption":"Vulpecula & Anser"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola M - Lacerta sive stellio.jpg","caption":"Lacerta"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola N - Cassiopeia.jpg","caption":"Cassiopeia"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola O - Camelopardalus.jpg","caption":"Camelopardalis"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola P - Serpens et Serpentarius.jpg","caption":"Ophiuchus & Serpens"},{"file":"Scutum Hevelius.jpg","caption":"Scutum"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola R - Aquila et Antinous.jpg","caption":"Aquila & Antinous"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola S - Sagitta Delphinus et Equuleus.jpg","caption":"Sagitta, Delphinus & Equuleus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola T - Pegasus.jpg","caption":"Pegasus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola V - Andromeda.jpg","caption":"Andromeda"},{"file":"Perseus Hevelius.jpg","caption":"Perseus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola X - Auriga.jpg","caption":"Auriga"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola Y - Lynx.jpg","caption":"Lynx"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola Z - Leo minor.jpg","caption":"Leo Minor"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola AA - Triangulum Majus Minus et Musca.jpg","caption":"Triangulum & Musca"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola BB - Aries.jpg","caption":"Aries"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola CC - Taurus.jpg","caption":"Taurus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola DD - Gemini.jpg","caption":"Gemini"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola EE - Cancer.jpg","caption":"Cancer"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola FF - Leo.jpg","caption":"Leo"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola GG - Virgo.jpg","caption":"Virgo"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola HH - Libra.jpg","caption":"Libra"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola II - Scorpius.jpg","caption":"Scorpius"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola KK - Sagittarius.jpg","caption":"Sagittarius"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola LL - Capricornus.jpg","caption":"Capricornus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola MM - Aquarius.jpg","caption":"Aquarius"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola NN - Pisces.jpg","caption":"Pisces"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola OO - Cetus.jpg","caption":"Cetus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola PP - Eridanus Phoenix et Toucan.jpg","caption":"Eridanus, Phoenix & Tucana"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola QQ - Orion.jpg","caption":"Orion"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola RR - Monoceros.jpg","caption":"Monoceros"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola SS - Canis Minor.jpg","caption":"Canis Minor"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola TT - Hydra et Robur Carolinum.jpg","caption":"Hydra & Robur Carolinum"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola VV - Sextans Uraniae.jpg","caption":"Sextans"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola WW - Crater et Corvus.jpg","caption":"Crater & Corvus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola XX - Centaurus et Crux.jpg","caption":"Centaurus & Crux"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola YY - Lupus.jpg","caption":"Lupus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola ZZ - Ara Triang Austr et Pavo.jpg","caption":"Ara, Triangulum Australe & Pavo"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola AAA - Corona Australis.jpg","caption":"Corona Australis"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola BBB - Piscis Notius et Grus.jpg","caption":"Piscis Austrinus & Grus"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola CCC - Lepus et Columba.jpg","caption":"Lepus & Columba"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola DDD - Canis Major.jpg","caption":"Canis Major"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola EEE - Argo Navis.jpg","caption":"Argo Navis"},{"file":"Johannes Hevelius - Prodromus Astronomia - Volume III \"Firmamentum Sobiescianum, sive uranographia\" - Tavola FFF - Polus Antarcticus.jpg","caption":"South polar constellations"}];

  const MISC_TOOLS = [
    {
      id: 'analemma',
      title: 'Analemma',
      render: renderAnalemma
    },
    {
      id: 'former-constellations',
      title: 'Former Constellations',
      render: renderFormerConstellations
    },
    {
      id: 'interesting-stars',
      title: 'Interesting Stars',
      render: renderInterestingStars
    },
    {
      id: 'hevelius-gallery',
      title: 'Hevelius Gallery',
      render: renderHeveliusGallery
    }
  ];

  const analemmaRad = x => x * Math.PI / 180;
  const analemmaDeg = x => x * 180 / Math.PI;
  function analemmaSolar(day) {
    const g = 2 * Math.PI / 365 * (day - 1);
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    return { eot, dec };
  }
  function analemmaAltAz(latDeg, timeHours, day) {
    const s = analemmaSolar(day);
    const ast = timeHours + s.eot / 60;
    const H = analemmaRad(15 * (ast - 12));
    const lat = analemmaRad(latDeg);
    const dec = s.dec;
    const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    const y = -Math.sin(H) * Math.cos(dec);
    const x = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H);
    let az = Math.atan2(y, x);
    if (az < 0) az += 2 * Math.PI;
    return { alt: analemmaDeg(alt), az: analemmaDeg(az), dec: analemmaDeg(dec), eot: s.eot };
  }
  function analemmaDayToDate(day) {
    const d = new Date(Date.UTC(2025, 0, 1));
    d.setUTCDate(day);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  function analemmaFmtTime(hours) {
    let h = ((hours % 24) + 24) % 24;
    let hh = Math.floor(h);
    let mm = Math.round((h - hh) * 60);
    if (mm === 60) { hh = (hh + 1) % 24; mm = 0; }
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  function openMiscImageZoom(src, alt) {
    if (!src) return;
    const overlay = el('div', { class: 'image-zoom-overlay misc-image-zoom' });
    const close = el('button', { type: 'button', class: 'image-zoom-close', 'aria-label': 'close zoom' }, [document.createTextNode('×')]);
    const zoomImg = el('img', { src, alt: alt || 'enlarged image' });
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
  function miscTopButtonHtml() {
    return '<button type="button" class="misc-top-button" aria-label="back to top">^</button>';
  }
  function wireMiscTopButton() {
    const button = app.querySelector('.misc-top-button');
    if (button) button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
  function wireMiscImageZoom() {
    app.querySelectorAll('[data-misc-zoom]').forEach(button => button.addEventListener('click', () => {
      openMiscImageZoom(button.dataset.miscZoom, button.dataset.miscZoomAlt || '');
    }));
  }

  function renderMisc() {
    const state = states.misc || (states.misc = { view: 'home' });
    const selectedTool = MISC_TOOLS.find(tool => tool.id === state.view);
    if (selectedTool) {
      selectedTool.render();
      return;
    }
    app.innerHTML = `<h2>Misc</h2><div class="misc-grid">${MISC_TOOLS.map(tool => `<button type="button" class="misc-card" data-misc-tool="${esc(tool.id)}"><strong>${esc(tool.title)}</strong></button>`).join('')}</div>`;
    document.querySelectorAll('[data-misc-tool]').forEach(button => button.addEventListener('click', () => {
      state.view = button.dataset.miscTool;
      renderMisc();
    }));
  }

  function renderFormerConstellations() {
    const miscState = states.misc || (states.misc = { view: 'former-constellations' });
    const state = states.formerConstellations || (states.formerConstellations = { search: '' });
    miscState.view = 'former-constellations';

    app.innerHTML = `<div class="controls misc-back-controls"><button type="button" id="miscBack">← Misc</button></div>
      <h2>Former Constellations</h2>
      <div class="former-toolbar"><input id="formerSearch" type="search" placeholder="search" autocomplete="off" value="${esc(state.search)}"></div>
      <div id="formerConstellationList" class="former-list"></div>${miscTopButtonHtml()}`;

    const search = $('#formerSearch');
    const list = $('#formerConstellationList');

    function renderList() {
      const q = norm(state.search);
      const filtered = q ? FORMER_CONSTELLATIONS.filter(entry => {
        const haystack = norm([entry.name, entry.meaning, entry.creator, entry.date, entry.position, entry.note || ''].join(' '));
        return haystack.includes(q);
      }) : FORMER_CONSTELLATIONS;

      list.innerHTML = filtered.map(entry => {
        const titleUrl = entry.wiki || entry.source || '';
        const title = titleUrl
          ? `<a href="${esc(titleUrl)}" target="_blank" rel="noopener noreferrer">${esc(entry.name)}</a>`
          : esc(entry.name);
        const when = [entry.creator, entry.date].filter(Boolean).join(' · ');
        const sourceLink = entry.source && entry.source !== entry.wiki
          ? ` <a class="former-source" href="${esc(entry.source)}" target="_blank" rel="noopener noreferrer">source ↗</a>`
          : '';
        const image = entry.image
          ? `<div class="former-image-wrap">
               <button type="button" class="former-image-link misc-image-button" data-misc-zoom="${esc(entry.image.replace(/([?&])width=\d+/, '$1width=1800'))}" data-misc-zoom-alt="${esc(entry.imageAlt || entry.name)}">
                 <img class="former-image" src="${esc(entry.image)}" alt="${esc(entry.imageAlt || entry.name)}" loading="lazy" decoding="async">
               </button>
               <a class="former-image-source" href="${esc(entry.imagePage || entry.image)}" target="_blank" rel="noopener noreferrer">Commons ↗</a>
             </div>`
          : '';
        return `<article class="former-entry${entry.image ? ' has-image' : ''}">
          <div class="former-copy">
            <h3>${title}</h3>
            ${entry.meaning ? `<div class="former-meaning">${esc(entry.meaning)}</div>` : ''}
            ${when ? `<div class="former-meta">${esc(when)}</div>` : ''}
            ${entry.position ? `<div class="former-position">${esc(entry.position)}</div>` : ''}
            ${entry.note ? `<p>${esc(entry.note)}${sourceLink}</p>` : ''}
          </div>
          ${image}
        </article>`;
      }).join('');

      list.querySelectorAll('.former-image').forEach(img => img.addEventListener('error', () => {
        const entry = img.closest('.former-entry');
        const wrap = img.closest('.former-image-wrap');
        if (wrap) wrap.remove();
        if (entry) entry.classList.remove('has-image');
      }, { once: true }));
      wireMiscImageZoom();
    }

    search.addEventListener('input', () => {
      state.search = search.value;
      renderList();
    });
    $('#miscBack').addEventListener('click', () => {
      miscState.view = 'home';
      renderMisc();
    });
    wireMiscTopButton();
    renderList();
  }

  function renderInterestingStars() {
    const miscState = states.misc || (states.misc = { view: 'interesting-stars' });
    const state = states.interestingStars || (states.interestingStars = { search: '' });
    miscState.view = 'interesting-stars';

    app.innerHTML = `<div class="controls misc-back-controls"><button type="button" id="miscBack">← Misc</button></div>
      <h2>Interesting Stars</h2>
      <div class="star-story-toolbar"><input id="starStorySearch" type="search" placeholder="search" autocomplete="off" value="${esc(state.search)}"></div>
      <div id="starStoryList" class="star-story-list"></div>${miscTopButtonHtml()}`;

    const search = $('#starStorySearch');
    const list = $('#starStoryList');

    function renderList() {
      const q = norm(state.search);
      const filtered = q ? INTERESTING_STAR_STORIES.filter(entry => {
        const haystack = norm([
          entry.group,
          entry.title,
          entry.stars,
          entry.key,
          ...(entry.paragraphs || [])
        ].join(' '));
        return haystack.includes(q);
      }) : INTERESTING_STAR_STORIES;

      list.innerHTML = filtered.map(entry => {
        const sourceLink = entry.source
          ? `<a class="star-story-source" href="${esc(entry.source)}" target="_blank" rel="noopener noreferrer">source ↗</a>`
          : '';
        const nameItems = entry.names || [];
        const names = nameItems.map(item => item.wiki
          ? `<a href="${esc(item.wiki)}" target="_blank" rel="noopener noreferrer">${esc(item.name)}</a>`
          : `<span>${esc(item.name)}</span>`
        ).join('<span class="star-name-separator"> · </span>');
        const nameText = nameItems.map(item => item.name).join(' · ');
        const starLine = entry.stars && norm(entry.stars) !== norm(nameText)
          ? `<div class="star-story-stars">${esc(entry.stars)}</div>`
          : '';
        return `<article class="star-story-entry">
          <h3 class="star-story-name">${names || esc(entry.title)}</h3>
          ${starLine}
          ${entry.key ? `<div class="star-story-key">${esc(entry.key)}</div>` : ''}
          ${(entry.paragraphs || []).map((paragraph, index) =>
            `<p>${esc(paragraph)}${index === entry.paragraphs.length - 1 ? sourceLink : ''}</p>`
          ).join('')}
        </article>`;
      }).join('');
    }

    search.addEventListener('input', () => {
      state.search = search.value;
      renderList();
    });
    $('#miscBack').addEventListener('click', () => {
      miscState.view = 'home';
      renderMisc();
    });
    wireMiscTopButton();
    renderList();
  }

  const HEVELIUS_CAPTION_WIKI = {
    'Ursa Minor': 'https://en.wikipedia.org/wiki/Ursa_Minor',
    Draco: 'https://en.wikipedia.org/wiki/Draco_(constellation)',
    Cepheus: 'https://en.wikipedia.org/wiki/Cepheus_(constellation)',
    'Ursa Major': 'https://en.wikipedia.org/wiki/Ursa_Major',
    'Canes Venatici': 'https://en.wikipedia.org/wiki/Canes_Venatici',
    'Boötes': 'https://en.wikipedia.org/wiki/Bo%C3%B6tes',
    'Corona Borealis': 'https://en.wikipedia.org/wiki/Corona_Borealis',
    Hercules: 'https://en.wikipedia.org/wiki/Hercules_(constellation)',
    Cerberus: 'https://en.wikipedia.org/wiki/Cerberus_(constellation)',
    Lyra: 'https://en.wikipedia.org/wiki/Lyra',
    Cygnus: 'https://en.wikipedia.org/wiki/Cygnus_(constellation)',
    Vulpecula: 'https://en.wikipedia.org/wiki/Vulpecula',
    Anser: 'https://en.wikipedia.org/wiki/Alpha_Vulpeculae',
    Lacerta: 'https://en.wikipedia.org/wiki/Lacerta',
    Cassiopeia: 'https://en.wikipedia.org/wiki/Cassiopeia_(constellation)',
    Camelopardalis: 'https://en.wikipedia.org/wiki/Camelopardalis',
    Ophiuchus: 'https://en.wikipedia.org/wiki/Ophiuchus',
    Serpens: 'https://en.wikipedia.org/wiki/Serpens',
    Scutum: 'https://en.wikipedia.org/wiki/Scutum_(constellation)',
    Aquila: 'https://en.wikipedia.org/wiki/Aquila_(constellation)',
    Antinous: 'https://en.wikipedia.org/wiki/Antinous_(constellation)',
    Sagitta: 'https://en.wikipedia.org/wiki/Sagitta',
    Delphinus: 'https://en.wikipedia.org/wiki/Delphinus',
    Equuleus: 'https://en.wikipedia.org/wiki/Equuleus',
    Pegasus: 'https://en.wikipedia.org/wiki/Pegasus_(constellation)',
    Andromeda: 'https://en.wikipedia.org/wiki/Andromeda_(constellation)',
    Perseus: 'https://en.wikipedia.org/wiki/Perseus_(constellation)',
    Auriga: 'https://en.wikipedia.org/wiki/Auriga_(constellation)',
    Lynx: 'https://en.wikipedia.org/wiki/Lynx_(constellation)',
    'Leo Minor': 'https://en.wikipedia.org/wiki/Leo_Minor',
    Triangulum: 'https://en.wikipedia.org/wiki/Triangulum',
    Musca: 'https://en.wikipedia.org/wiki/Musca',
    Aries: 'https://en.wikipedia.org/wiki/Aries_(constellation)',
    Taurus: 'https://en.wikipedia.org/wiki/Taurus_(constellation)',
    Gemini: 'https://en.wikipedia.org/wiki/Gemini_(constellation)',
    Cancer: 'https://en.wikipedia.org/wiki/Cancer_(constellation)',
    Leo: 'https://en.wikipedia.org/wiki/Leo_(constellation)',
    Virgo: 'https://en.wikipedia.org/wiki/Virgo_(constellation)',
    Libra: 'https://en.wikipedia.org/wiki/Libra_(constellation)',
    Scorpius: 'https://en.wikipedia.org/wiki/Scorpius',
    Sagittarius: 'https://en.wikipedia.org/wiki/Sagittarius_(constellation)',
    Capricornus: 'https://en.wikipedia.org/wiki/Capricornus',
    Aquarius: 'https://en.wikipedia.org/wiki/Aquarius_(constellation)',
    Pisces: 'https://en.wikipedia.org/wiki/Pisces_(constellation)',
    Cetus: 'https://en.wikipedia.org/wiki/Cetus_(constellation)',
    Eridanus: 'https://en.wikipedia.org/wiki/Eridanus_(constellation)',
    Phoenix: 'https://en.wikipedia.org/wiki/Phoenix_(constellation)',
    Tucana: 'https://en.wikipedia.org/wiki/Tucana',
    Orion: 'https://en.wikipedia.org/wiki/Orion_(constellation)',
    Monoceros: 'https://en.wikipedia.org/wiki/Monoceros',
    'Canis Minor': 'https://en.wikipedia.org/wiki/Canis_Minor',
    Hydra: 'https://en.wikipedia.org/wiki/Hydra_(constellation)',
    'Robur Carolinum': 'https://en.wikipedia.org/wiki/Robur_Carolinum',
    Sextans: 'https://en.wikipedia.org/wiki/Sextans',
    Crater: 'https://en.wikipedia.org/wiki/Crater_(constellation)',
    Corvus: 'https://en.wikipedia.org/wiki/Corvus_(constellation)',
    Centaurus: 'https://en.wikipedia.org/wiki/Centaurus',
    Crux: 'https://en.wikipedia.org/wiki/Crux',
    Lupus: 'https://en.wikipedia.org/wiki/Lupus_(constellation)',
    Ara: 'https://en.wikipedia.org/wiki/Ara_(constellation)',
    'Triangulum Australe': 'https://en.wikipedia.org/wiki/Triangulum_Australe',
    Pavo: 'https://en.wikipedia.org/wiki/Pavo_(constellation)',
    'Corona Australis': 'https://en.wikipedia.org/wiki/Corona_Australis',
    'Piscis Austrinus': 'https://en.wikipedia.org/wiki/Piscis_Austrinus',
    Grus: 'https://en.wikipedia.org/wiki/Grus_(constellation)',
    Lepus: 'https://en.wikipedia.org/wiki/Lepus_(constellation)',
    Columba: 'https://en.wikipedia.org/wiki/Columba_(constellation)',
    'Canis Major': 'https://en.wikipedia.org/wiki/Canis_Major',
    'Argo Navis': 'https://en.wikipedia.org/wiki/Argo_Navis'
  };
  function heveliusCaptionHtml(caption) {
    return String(caption || '').split(/(\s*&\s*|,\s*)/).map(part => {
      if (/^\s*&\s*$/.test(part) || /^,\s*$/.test(part)) return esc(part);
      const url = HEVELIUS_CAPTION_WIKI[part];
      return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(part)}</a>` : esc(part);
    }).join('');
  }

  function renderHeveliusGallery() {
    const miscState = states.misc || (states.misc = { view: 'hevelius-gallery' });
    miscState.view = 'hevelius-gallery';

    const figures = HEVELIUS_GALLERY.map(entry => {
      const encoded = encodeURIComponent(entry.file);
      const thumb = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=900`;
      const large = `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=1800`;
      return `<figure class="hevelius-figure">
        <button type="button" class="hevelius-image-button misc-image-button" data-misc-zoom="${esc(large)}" data-misc-zoom-alt="${esc(entry.caption)}">
          <img class="hevelius-image" src="${esc(thumb)}" alt="${esc(entry.caption)}" loading="lazy" decoding="async">
        </button>
        <figcaption>${heveliusCaptionHtml(entry.caption)}</figcaption>
      </figure>`;
    }).join('');

    app.innerHTML = `<div class="controls misc-back-controls"><button type="button" id="miscBack">← Misc</button></div>
      <h2>Hevelius Gallery</h2>
      <div class="hevelius-work">Firmamentum Sobiescianum · 1690</div>
      <div class="hevelius-grid">${figures}</div>${miscTopButtonHtml()}`;

    $('#miscBack').addEventListener('click', () => {
      miscState.view = 'home';
      renderMisc();
    });
    app.querySelectorAll('.hevelius-image').forEach(img => img.addEventListener('error', () => {
      const figure = img.closest('.hevelius-figure');
      if (figure) figure.remove();
    }, { once: true }));
    wireMiscImageZoom();
    wireMiscTopButton();
  }


  function renderAnalemma() {
    const miscState = states.misc || (states.misc = { view: 'analemma' });
    const state = states.analemma || (states.analemma = {
      lat: 1.35,
      time: 12,
      day: 80,
      dailyPath: true,
      showBelow: false,
      labels: true,
      timer: null
    });
    miscState.view = 'analemma';

    app.innerHTML = `<div class="controls misc-back-controls"><button type="button" id="miscBack">← Misc</button></div>
      <h2>Analemma</h2>
      <div class="analemma-layout">
        <aside class="panel analemma-controls">
          <label for="analemmaLat">Latitude</label>
          <div class="slider-text-row"><input id="analemmaLat" type="range" min="-90" max="90" step="0.5" value="${state.lat}"><input id="analemmaLatNumber" type="number" min="-90" max="90" step="0.5" value="${state.lat}"></div>
          <div id="analemmaLatValue" class="small"></div>

          <label for="analemmaTime">Local mean solar time</label>
          <div class="slider-text-row"><input id="analemmaTime" type="range" min="0" max="24" step="0.05" value="${state.time}"><input id="analemmaTimeNumber" type="number" min="0" max="24" step="0.05" value="${state.time}"></div>
          <div id="analemmaTimeValue" class="small"></div>

          <label for="analemmaDay">Day of year</label>
          <div class="slider-text-row"><input id="analemmaDay" type="range" min="1" max="365" step="1" value="${state.day}"><input id="analemmaDayNumber" type="number" min="1" max="365" step="1" value="${state.day}"></div>
          <div id="analemmaDayValue" class="small"></div>

          <label class="checkline"><input id="analemmaDailyPath" type="checkbox" ${state.dailyPath ? 'checked' : ''}><span>Show Sun's daily path</span></label>
          <label class="checkline"><input id="analemmaBelow" type="checkbox" ${state.showBelow ? 'checked' : ''}><span>Show below-horizon points on rectangular plot</span></label>
          <label class="checkline"><input id="analemmaLabels" type="checkbox" ${state.labels ? 'checked' : ''}><span>Label equinoxes and solstices</span></label>

          <div class="controls analemma-buttons"><button type="button" id="analemmaPlay">play year</button><button type="button" id="analemmaPause">pause</button><button type="button" id="analemmaSingapore">Singapore</button><button type="button" id="analemmaReset">reset</button></div>

          <div class="analemma-stats">
            <div class="stat"><span>solar declination</span><strong id="analemmaDec"></strong></div>
            <div class="stat"><span>equation of time</span><strong id="analemmaEot"></strong></div>
            <div class="stat"><span>altitude</span><strong id="analemmaAlt"></strong></div>
            <div class="stat"><span>azimuth</span><strong id="analemmaAz"></strong></div>
          </div>
        </aside>
        <section class="analemma-views">
          <div class="panel">
            <h3>Altitude–azimuth plot</h3>
            <canvas id="analemmaSky" width="900" height="620" aria-label="analemma altitude-azimuth plot"></canvas>
          </div>
          <div class="panel">
            <h3>Circular horizon view</h3>
            <canvas id="analemmaHorizon" width="700" height="700" aria-label="analemma circular horizon view"></canvas>
          </div>
        </section>
      </div>`;

    const sky = $('#analemmaSky'), ctx = sky.getContext('2d');
    const horizon = $('#analemmaHorizon'), hctx = horizon.getContext('2d');
    const latSlider = $('#analemmaLat'), latNumber = $('#analemmaLatNumber');
    const timeSlider = $('#analemmaTime'), timeNumber = $('#analemmaTimeNumber');
    const daySlider = $('#analemmaDay'), dayNumber = $('#analemmaDayNumber');

    function setLat(value) {
      const n = Math.max(-90, Math.min(90, Number(value)));
      if (!Number.isFinite(n)) return;
      state.lat = n;
      latSlider.value = String(n); latNumber.value = String(n);
      updateRangeVisual(latSlider);
      draw();
    }
    function setTime(value) {
      const n = Math.max(0, Math.min(24, Number(value)));
      if (!Number.isFinite(n)) return;
      state.time = n;
      timeSlider.value = String(n); timeNumber.value = String(n);
      updateRangeVisual(timeSlider);
      draw();
    }
    function setDay(value) {
      const n = Math.max(1, Math.min(365, Math.round(Number(value))));
      if (!Number.isFinite(n)) return;
      state.day = n;
      daySlider.value = String(n); dayNumber.value = String(n);
      updateRangeVisual(daySlider);
      draw();
    }

    function mapX(az) { return 64 + az / 360 * (sky.width - 88); }
    function mapY(alt) { return 24 + (90 - alt) / 120 * (sky.height - 78); }
    function drawLine(points, colour, width = 2, dash = []) {
      ctx.save();
      ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath();
      let started = false, prev = null;
      for (const p of points) {
        if (!p) { started = false; prev = null; continue; }
        if (prev !== null && Math.abs(p.az - prev) > 180) started = false;
        const x = mapX(p.az), y = mapY(p.alt);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        prev = p.az;
      }
      ctx.stroke(); ctx.restore();
    }
    function horizonPoint(az, alt) {
      const cx = horizon.width / 2, cy = horizon.height / 2, R = Math.min(horizon.width, horizon.height) * 0.42;
      const rho = R * (90 - alt) / 90, a = analemmaRad(az);
      return { x: cx + rho * Math.sin(a), y: cy - rho * Math.cos(a) };
    }
    function drawHorizonLine(points, colour, width = 2, dash = []) {
      hctx.save();
      hctx.strokeStyle = colour; hctx.lineWidth = width; hctx.setLineDash(dash); hctx.beginPath();
      let started = false, prev = null;
      for (const p of points) {
        if (!p || p.alt < 0) { started = false; prev = null; continue; }
        if (prev !== null && Math.abs(p.az - prev) > 180) started = false;
        const q = horizonPoint(p.az, p.alt);
        if (!started) { hctx.moveTo(q.x, q.y); started = true; } else hctx.lineTo(q.x, q.y);
        prev = p.az;
      }
      hctx.stroke(); hctx.restore();
    }
    function drawHorizon(now) {
      const W = horizon.width, H = horizon.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42;
      hctx.clearRect(0, 0, W, H); hctx.fillStyle = '#fff'; hctx.fillRect(0, 0, W, H);
      for (const alt of [0, 15, 30, 45, 60, 75]) {
        const rr = R * (90 - alt) / 90;
        hctx.strokeStyle = alt === 0 ? '#777' : '#ddd'; hctx.lineWidth = alt === 0 ? 2 : 1;
        hctx.beginPath(); hctx.arc(cx, cy, rr, 0, 2 * Math.PI); hctx.stroke();
        if (alt > 0) {
          hctx.fillStyle = '#666'; hctx.font = '13px Arial'; hctx.textAlign = 'left'; hctx.textBaseline = 'middle';
          hctx.fillText(`${alt}°`, cx + 6, cy - rr);
        }
      }
      for (let az = 0; az < 360; az += 45) {
        const a = analemmaRad(az);
        hctx.strokeStyle = az % 90 === 0 ? '#aaa' : '#e4e4e4'; hctx.lineWidth = az % 90 === 0 ? 1.4 : 1;
        hctx.beginPath(); hctx.moveTo(cx, cy); hctx.lineTo(cx + R * Math.sin(a), cy - R * Math.cos(a)); hctx.stroke();
      }
      hctx.fillStyle = '#111'; hctx.font = '700 24px Arial'; hctx.textAlign = 'center'; hctx.textBaseline = 'middle';
      for (const [az, label] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']]) {
        const a = analemmaRad(az), rr = R + 30;
        hctx.fillText(label, cx + rr * Math.sin(a), cy - rr * Math.cos(a));
      }
      hctx.font = '600 15px Arial'; hctx.fillStyle = '#555'; hctx.fillText('Z', cx, cy);

      const ana = [];
      for (let d = 1; d <= 365; d++) ana.push(analemmaAltAz(state.lat, state.time, d));
      drawHorizonLine(ana, '#111', 4);
      if (state.dailyPath) {
        const daily = [];
        for (let t = 0; t <= 24; t += 0.04) daily.push(analemmaAltAz(state.lat, t, state.day));
        drawHorizonLine(daily, '#777', 2, [8, 7]);
      }
      if (state.labels) {
        hctx.font = '13px Arial'; hctx.textAlign = 'left'; hctx.textBaseline = 'middle';
        for (const [d, label] of [[80, 'Mar'], [172, 'Jun'], [266, 'Sep'], [355, 'Dec']]) {
          const p = analemmaAltAz(state.lat, state.time, d);
          if (p.alt >= 0) {
            const q = horizonPoint(p.az, p.alt);
            hctx.fillStyle = '#111'; hctx.beginPath(); hctx.arc(q.x, q.y, 4, 0, 2 * Math.PI); hctx.fill();
            hctx.fillStyle = '#333'; hctx.fillText(label, q.x + 8, q.y);
          }
        }
      }
      if (now.alt >= 0) {
        const q = horizonPoint(now.az, now.alt);
        hctx.fillStyle = '#e60012'; hctx.beginPath(); hctx.arc(q.x, q.y, 9, 0, 2 * Math.PI); hctx.fill();
        hctx.strokeStyle = '#fff'; hctx.lineWidth = 2; hctx.beginPath(); hctx.arc(q.x, q.y, 9, 0, 2 * Math.PI); hctx.stroke();
      } else {
        hctx.fillStyle = '#8a2d2d'; hctx.font = '15px Arial'; hctx.textAlign = 'center';
        hctx.fillText('Selected Sun is below the horizon', cx, H - 18);
      }
    }
    function draw() {
      const now = analemmaAltAz(state.lat, state.time, state.day);
      $('#analemmaLatValue').textContent = `${Math.abs(state.lat).toFixed(1)}° ${state.lat >= 0 ? 'N' : 'S'}`;
      $('#analemmaTimeValue').textContent = analemmaFmtTime(state.time);
      $('#analemmaDayValue').textContent = `${state.day} · ${analemmaDayToDate(state.day)}`;
      $('#analemmaDec').textContent = `${now.dec.toFixed(2)}°`;
      $('#analemmaEot').textContent = `${now.eot >= 0 ? '+' : ''}${now.eot.toFixed(1)} min`;
      $('#analemmaAlt').textContent = `${now.alt.toFixed(2)}°`;
      $('#analemmaAz').textContent = `${now.az.toFixed(2)}°`;

      ctx.clearRect(0, 0, sky.width, sky.height); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, sky.width, sky.height);
      ctx.font = '14px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let az = 0; az <= 360; az += 30) {
        const x = mapX(az); ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, mapY(90)); ctx.lineTo(x, mapY(-30)); ctx.stroke();
        ctx.fillStyle = '#666';
        const labels = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' };
        ctx.fillText(labels[az] ?? `${az}°`, x, mapY(-30) + 10);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let alt = -30; alt <= 90; alt += 15) {
        const y = mapY(alt); ctx.strokeStyle = alt === 0 ? '#999' : '#ddd'; ctx.lineWidth = alt === 0 ? 1.8 : 1;
        ctx.beginPath(); ctx.moveTo(mapX(0), y); ctx.lineTo(mapX(360), y); ctx.stroke();
        ctx.fillStyle = '#666'; ctx.fillText(`${alt}°`, mapX(0) - 8, y);
      }
      const ana = [];
      for (let d = 1; d <= 365; d++) {
        const p = analemmaAltAz(state.lat, state.time, d);
        ana.push((state.showBelow || p.alt >= 0) ? p : null);
      }
      drawLine(ana, '#111', 3);
      if (state.dailyPath) {
        const path = [];
        for (let t = 0; t <= 24; t += 0.05) {
          const p = analemmaAltAz(state.lat, t, state.day);
          path.push((state.showBelow || p.alt >= 0) ? p : null);
        }
        drawLine(path, '#777', 1.5, [7, 6]);
      }
      if (state.labels) {
        ctx.font = '13px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (const [d, label] of [[80, 'Mar eqx'], [172, 'Jun sol'], [266, 'Sep eqx'], [355, 'Dec sol']]) {
          const p = analemmaAltAz(state.lat, state.time, d);
          if (state.showBelow || p.alt >= 0) {
            const x = mapX(p.az), y = mapY(p.alt);
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#333'; ctx.fillText(label, x + 7, y);
          }
        }
      }
      if (state.showBelow || now.alt >= 0) {
        const x = mapX(now.az), y = mapY(now.alt);
        ctx.fillStyle = '#e60012'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 7, 0, 2 * Math.PI); ctx.stroke();
      } else {
        ctx.fillStyle = '#8a2d2d'; ctx.textAlign = 'center'; ctx.font = '15px Arial';
        ctx.fillText('Selected Sun position is below the horizon', sky.width / 2, 38);
      }
      ctx.fillStyle = '#222'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = '600 16px Arial';
      ctx.fillText(`Latitude ${Math.abs(state.lat).toFixed(1)}° ${state.lat >= 0 ? 'N' : 'S'} · Fixed time ${analemmaFmtTime(state.time)}`, 72, 34);
      drawHorizon(now);
    }

    latSlider.addEventListener('input', () => setLat(latSlider.value));
    latNumber.addEventListener('change', () => setLat(latNumber.value));
    timeSlider.addEventListener('input', () => setTime(timeSlider.value));
    timeNumber.addEventListener('change', () => setTime(timeNumber.value));
    daySlider.addEventListener('input', () => setDay(daySlider.value));
    dayNumber.addEventListener('change', () => setDay(dayNumber.value));
    $('#analemmaDailyPath').addEventListener('change', e => { state.dailyPath = e.target.checked; draw(); });
    $('#analemmaBelow').addEventListener('change', e => { state.showBelow = e.target.checked; draw(); });
    $('#analemmaLabels').addEventListener('change', e => { state.labels = e.target.checked; draw(); });
    $('#analemmaPlay').addEventListener('click', () => {
      if (state.timer) return;
      state.timer = setInterval(() => setDay(state.day >= 365 ? 1 : state.day + 1), 45);
    });
    $('#analemmaPause').addEventListener('click', () => {
      if (state.timer) clearInterval(state.timer);
      state.timer = null;
    });
    $('#analemmaSingapore').addEventListener('click', () => { setLat(1.35); setTime(12); setDay(80); });
    $('#analemmaReset').addEventListener('click', () => {
      if (state.timer) clearInterval(state.timer);
      state.timer = null;
      state.lat = 1.35; state.time = 12; state.day = 80;
      state.dailyPath = true; state.showBelow = false; state.labels = true;
      renderAnalemma();
    });
    $('#miscBack').addEventListener('click', () => {
      if (state.timer) clearInterval(state.timer);
      state.timer = null;
      miscState.view = 'home';
      renderMisc();
    });
    initRangeVisuals(app);
    draw();
  }


  function render() {
    setShiftEnterAction(null);
    if (activeGame !== 'stars' && activeGame !== 'dso') cleanupTransientGameState();
    if (activeGame === 'skyguessr') renderSkyGuessr();
    else if (activeGame === 'skymap') renderSkyMap();
    else if (activeGame === 'skyregions') renderSkyRegions();
    else if (activeGame === 'skyrace') renderSkyRace();
    else if (activeGame === 'alphapin') renderAlphaPin();
    else if (activeGame === 'guessconst') renderGuessConstellation();
    else if (activeGame === 'stars') {
      if (!namedStarCatalogueReady) deferForNamedStars('Stars', () => { if (activeGame === 'stars') render(); });
      else renderObjectChallengeGame('stars');
    }
    else if (activeGame === 'dso') renderObjectChallengeGame('dso');
    else if (activeGame === 'timer') renderTimer();
    else if (activeGame === 'atlas') renderAtlas();
    else if (activeGame === 'tables') renderTables();
    else if (activeGame === 'misc') renderMisc();
  }
  function finishLaunchThenRender() {
    launchState.active = false;
    hideLoadingOverlay();
    render();
  }

  function beginLaunch() {
    setupTabs();
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay || !overlay.dataset.launch) {
      launchState.active = false;
      render();
      return;
    }
    const started = window.__iloveastroLaunchStartedAt || Date.now();
    const minMs = window.__iloveastroMinLaunchMs || (LOADING_WORD_FRAMES.length * (window.__iloveastroLoaderMs || 70));
    const elapsed = Date.now() - started;
    const remaining = Math.max(0, minMs - elapsed);
    setTimeout(finishLaunchThenRender, remaining);
  }

  beginLaunch();
})();
