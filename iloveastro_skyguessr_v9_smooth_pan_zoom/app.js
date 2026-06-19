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
    const exact = answers.some(a => norm(a) === n || compact(a) === c);
    if (exact) return true;
    if (c.length < 4 || /\d/.test(c)) return false;
    if (strictAnswers.has(c)) return false; // e.g. lepus must not count as lupus.
    return answers.some(a => {
      const ac = compact(a);
      return ac.length >= 4 && !/\d/.test(ac) && oneSubstitutionTypo(c, ac);
    });
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

  const games = [
    { id: 'charts', title: 'Charts' },
    { id: 'skyguessr', title: 'SkyGuessr' },
    { id: 'neighbours', title: 'Neighbours' },
    { id: 'stars', title: 'Stars' },
    { id: 'stargroups', title: 'Star groups' },
    { id: 'asterisms', title: 'Asterisms' },
    { id: 'dso', title: 'DSOs' },
    { id: 'dsogroups', title: 'DSO groups' },
    { id: 'mixed', title: 'Mixed' },
    { id: 'timer', title: '88 timer' },
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
      if (state.last) aside.append(el('div', { class: 'last-card', html: state.last }));
      const main = el('section', { class: 'panel', html: q.visual || '' });
      app.append(el('div', { class: 'layout' }, [aside, main]));
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
    return { prompt: 'Name the constellation chart.', answers: c.accepted, visual: chartImg(c, false, 'chart-img', 'blanked constellation chart'), card: () => `<h3>${esc(c.displayName)}</h3>${infoCard(c.name)}${chartImg(c, true, 'chart-img', 'labelled chart')}` };
  }
  function neighbourQuestion() {
    const pool = DATA.charts.filter(c => c.neighbourClues && c.neighbourClues.length);
    const c = rand(pool);
    const target = rand(c.neighbourClues);
    return { prompt: `On the <strong>${esc(c.displayName)}</strong> chart, name ${esc(target.clue)}.`, answers: [target.answer], visual: chartImg(c, false, 'chart-img', 'blanked constellation chart'), card: () => `<h3>${esc(target.answer)}</h3><p>Target neighbour on the ${esc(c.displayName)} chart.</p>${chartImg(c, true, 'chart-img', 'labelled chart')}` };
  }

  const starModes = [
    { id: 'starToConstellation', label: 'star -> constellation' },
    { id: 'designationToStar', label: 'designation -> star' },
    { id: 'starToDesignation', label: 'star -> designation' },
    { id: 'constellationToStar', label: 'constellation -> any listed star' }
  ];
  function starQuestion(mode) {
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
    { id: 'objectToType', label: 'object -> type' }
  ];
  const namedDSO = DATA.dso.filter(o => o.commonName && o.commonName.trim());
  function dsoLabel(o) { return o.commonName ? `${o.code} - ${esc(o.commonName)}` : esc(o.code); }
  function dsoAnswers(o) { return [o.code, o.commonName].filter(Boolean); }
  function dsoQuestion(mode) {
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
    const input = el('input', { id: 'timerInput', autocomplete: 'off', placeholder: 'type constellation names; correct names mark automatically' });
    input.addEventListener('input', () => timerCheck(input));
    app.append(el('section', { class: 'panel' }, [
      el('h2', {}, [document.createTextNode('Name all 88 constellations')]),
      el('p', { html: `<strong id="timerClock">${timeText}</strong> ${found.length}/88` }),
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
    const n = norm(raw), c = compact(raw);
    if (!n) return null;
    const exact = DATA.constellations.find(x => norm(x.name) === n || (x.name === 'Boötes' && n === 'bootes'));
    if (exact) return exact;
    if (c.length < 4 || /\d/.test(c) || strictAnswers.has(c)) return null;
    return DATA.constellations.find(x => oneSubstitutionTypo(c, compact(x.name)) || (x.name === 'Boötes' && oneSubstitutionTypo(c, 'bootes')));
  }
  function timerCheck(input) {
    const raw = input.value, n = norm(raw);
    const hit = findConstellationInput(raw);
    if (!hit) return;
    const exactShort = norm(hit.name) === n || (hit.name === 'Boötes' && n === 'bootes');
    const longer = DATA.constellations.some(c => !timerState.found.has(c.name) && norm(c.name).startsWith(n) && norm(c.name) !== n);
    const forced = /[,;\s]$/.test(raw);
    if (exactShort && longer && !forced) return;
    if (timerState.found.has(hit.name)) { input.value = ''; return; }
    timerState.found.add(hit.name); input.value = '';
    if (timerState.found.size === 88) { clearInterval(timerState.interval); timerState.running = false; record('timer', true); }
    renderTimer();
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
    const starRows = info.stars.length ? info.stars.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.designation)}</td><td>${esc(s.note)}</td></tr>`).join('') : '<tr><td colspan="3">No star in the current curated named-star list.</td></tr>';
    const dsoRows = info.dsos.length ? info.dsos.map(o => `<tr><td>${esc(o.code)}</td><td>${esc(o.commonName)}</td><td>${esc(o.type)}</td></tr>`).join('') : '<tr><td colspan="3">No Messier/Caldwell object in the current list.</td></tr>';
    const chartHtml = charts.length ? charts.map((ch, i) => `<div class="chart-detail-box"><h3>${esc(ch.displayName || name)}${charts.length > 1 ? ` chart ${i + 1}` : ''}</h3>${chartImg(ch, true, 'chart-img detail-chart', `${ch.displayName || name} labelled chart`)}</div>`).join('') : '';
    const atlasNotes = (info.atlasNotes || []).length ? `<h3>Sky picture</h3>${info.atlasNotes.map(x => `<p>${esc(x)}</p>`).join('')}` : '';
    const facts = (info.funFacts || []).filter(Boolean);
    app.innerHTML = `<button type="button" id="backAtlas">← atlas</button><h2>${esc(name)}</h2><div class="detail-grid"><section class="panel"><h3>Memory hook</h3><p><strong>${esc(info.meaning)}</strong></p><p>${esc(info.myth)}</p>${atlasNotes}<h3>Bordering / nearby chart labels</h3><p>${info.neighbours.length ? info.neighbours.map(n => `<button type="button" class="linkbtn" data-const="${esc(n)}">${esc(n)}</button>`).join(' ') : 'none listed'}</p><h3>Asterisms and sky groups</h3><p>${info.asterisms.length ? info.asterisms.map(esc).join(', ') : 'none listed yet'}</p>${facts.length ? `<h3>Fun facts / pointing tricks</h3><ul>${facts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</section><section class="panel">${chartHtml}</section></div><section class="panel"><h3>Stars inside</h3><table><thead><tr><th>star</th><th>designation</th><th>note</th></tr></thead><tbody>${starRows}</tbody></table><h3>Messier + Caldwell DSOs inside</h3><table><thead><tr><th>code</th><th>common name</th><th>type</th></tr></thead><tbody>${dsoRows}</tbody></table></section>`;
    $('#backAtlas').addEventListener('click', renderAtlas);
    document.querySelectorAll('[data-const]').forEach(b => b.addEventListener('click', () => renderConstellationPage(b.dataset.const)));
  }


  const HYG_MAG65_URL = 'https://raw.githubusercontent.com/eleanorlutz/western_constellations_atlas_of_space/refs/heads/main/data/processed/hygdata_processed_mag65.csv';
  const CON_ABBR_TO_NAME = new Map(DATA.constellations.map(c => [compact(c.abbr), c.name]));
  CON_ABBR_TO_NAME.set('ser1', 'Serpens');
  CON_ABBR_TO_NAME.set('ser2', 'Serpens');
  let skyDataPromise = null;
  let skyStars = [];
  let skyConstCentres = new Map();
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
      if (!res.ok) throw new Error('Could not load star catalogue.');
      const text = await res.text();
      const lines = text.trim().split(/\r?\n/);
      const headers = parseCsvLine(lines[0]);
      const raI = pickColumn(headers, ['ra', 'RA', 'ra_hours', 'ra_h', 'right_ascension']);
      const decI = pickColumn(headers, ['dec', 'DEC', 'declination']);
      const magI = pickColumn(headers, ['mag', 'MAG', 'magnitude']);
      const conI = pickColumn(headers, ['con', 'constellation', 'Constellation']);
      const nameI = pickColumn(headers, ['proper', 'name', 'star_name']);
      if (raI < 0 || decI < 0 || magI < 0 || conI < 0) throw new Error('Star catalogue columns were not recognised.');
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
        raw.push({ ra, dec, mag, constellation, name: nameI >= 0 ? row[nameI] : '', v });
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
  function renderSkyGuessr() {
    const state = states.skyguessr || (states.skyguessr = { loaded: false, loading: false, error: '', viewRa: 0, viewDec: 0, fov: 100, magLimit: 4.4, target: null, answered: false, message: '', score: scoreKey('skyguessr') });
    app.innerHTML = `<h2>SkyGuessr</h2><div class="sky-layout"><section class="panel sky-panel"><canvas id="skyCanvas" width="1000" height="700" tabindex="0" aria-label="celestial sphere"></canvas></section><aside class="panel"><label>FOV degrees<input id="skyFov" type="number" min="20" max="190" step="5" value="${state.fov}"></label><label>Star density / faintest magnitude<input id="skyMag" type="number" min="4" max="6" step="0.1" value="${state.magLimit}"></label><div class="sky-nav-grid" aria-label="sky movement controls"><button type="button" data-move="-1,-1">↖</button><button type="button" data-move="0,-1">↑</button><button type="button" data-move="1,-1">↗</button><button type="button" data-move="-1,0">←</button><button type="button" id="skyCentre">X</button><button type="button" data-move="1,0">→</button><button type="button" data-move="-1,1">↙</button><button type="button" data-move="0,1">↓</button><button type="button" data-move="1,1">↘</button></div><input id="skyAnswer" autocomplete="off" placeholder="constellation at the X"><div class="controls"><button type="button" id="skyNew">new location</button><button type="button" id="skyReveal">reveal</button></div><div id="skyMsg" class="message">${esc(state.message || '')}</div><div class="stats">${formatScore('skyguessr')}</div><p class="small">Drag or scroll inside the canvas to move. Pinch/zoom gesture changes FOV. X recentres on the target. Default magnitude is 4.4; raise it towards 6 for more context.</p></aside></div>`;
    const canvas = $('#skyCanvas'), ctx = canvas.getContext('2d');
    const answer = $('#skyAnswer');
    const fovInput = $('#skyFov');

    function targetPool() {
      const limit = Math.min(4.8, Math.max(3.8, state.magLimit + 0.2));
      return skyStars.filter(s => s.mag <= limit && s.constellation);
    }
    function ensureTarget() {
      if (!state.target && skyStars.length) {
        const candidates = targetPool();
        state.target = rand(candidates.length ? candidates : skyStars.filter(s => s.constellation));
        centreOnTarget(false);
        state.answered = false;
      }
    }
    function basis() {
      const f = vecFromRaDec(state.viewRa, state.viewDec);
      const north = Math.abs(f.z) > 0.97 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
      const right = normVec(cross(f, north));
      const up = normVec(cross(right, f));
      return { f, right, up };
    }
    function rotateAround(v, axis, angle) {
      const c = Math.cos(angle), s = Math.sin(angle), d = dot(axis, v), cr = cross(axis, v);
      return normVec({
        x: v.x * c + cr.x * s + axis.x * d * (1 - c),
        y: v.y * c + cr.y * s + axis.y * d * (1 - c),
        z: v.z * c + cr.z * s + axis.z * d * (1 - c)
      });
    }
    function setViewFromVec(v) {
      const rd = raDecFromVec(normVec(v));
      state.viewRa = rd.ra;
      state.viewDec = rd.dec;
    }
    function clampFov(v) { return Math.max(20, Math.min(190, v)); }
    function setFov(v) {
      state.fov = clampFov(v);
      if (fovInput) fovInput.value = Number(state.fov.toFixed(1));
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
    function draw() {
      ensureTarget();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
      if (!state.loaded) {
        ctx.fillStyle = 'black'; ctx.font = '20px Arial'; ctx.fillText(state.error || 'loading bright-star catalogue...', 24, 40); return;
      }
      const radius = Math.min(canvas.width, canvas.height) * 0.48;
      const fovRad = state.fov * Math.PI / 180;
      const b = basis();
      ctx.save();
      ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2); ctx.clip();

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

    // Pan by rotating the viewing direction on the sphere, instead of adding RA/Dec directly.
    // This prevents the sudden jumps near RA=0/360 and near the poles.
    function move(dx, dy, multiplier = 1) {
      const b = basis();
      const anglePerPx = (state.fov * Math.PI / 180) / Math.min(canvas.width, canvas.height) * multiplier;
      let f = b.f;
      f = rotateAround(f, b.up, -dx * anglePerPx);
      f = rotateAround(f, b.right, dy * anglePerPx);
      setViewFromVec(f);
      draw();
    }
    function moveButton(x, y) {
      const px = Math.min(canvas.width, canvas.height) * 0.065;
      move(x * px, y * px, 1);
      canvas.focus();
    }
    function centreOnTarget(redraw = true) {
      if (!state.target) return;
      const rd = raDecFromVec(state.target.v);
      state.viewRa = rd.ra;
      state.viewDec = rd.dec;
      if (redraw) draw();
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
      setTimeout(newTarget, 850);
    }
    function newTarget() {
      if (!skyStars.length) return;
      const candidates = targetPool();
      state.target = rand(candidates.length ? candidates : skyStars.filter(s => s.constellation));
      const rd = raDecFromVec(state.target.v);
      state.viewRa = rd.ra + (Math.random() - 0.5) * Math.min(18, state.fov * 0.22);
      state.viewDec = Math.max(-85, Math.min(85, rd.dec + (Math.random() - 0.5) * Math.min(12, state.fov * 0.15)));
      state.answered = false; state.message = ''; answer.value = ''; renderSkyGuessr();
    }
    function reveal() {
      if (!state.target || state.answered) return;
      const allowed = allowedAnswers();
      state.answered = true;
      record('skyguessr', false);
      state.message = `answer: ${state.target.constellation}${allowed.length > 1 ? ' / nearby accepted: ' + allowed.slice(1).join(', ') : ''}`;
      $('#skyMsg').textContent = state.message;
      setTimeout(newTarget, 1800);
    }

    answer.addEventListener('input', () => solved(answer.value));
    fovInput.addEventListener('input', e => { state.fov = clampFov(parseFloat(e.target.value) || 100); draw(); });
    $('#skyMag').addEventListener('input', e => { state.magLimit = Math.max(4, Math.min(6, parseFloat(e.target.value) || 4.4)); draw(); });
    $('#skyNew').addEventListener('click', newTarget);
    $('#skyReveal').addEventListener('click', reveal);
    $('#skyCentre').addEventListener('click', () => { centreOnTarget(true); canvas.focus(); });
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
      canvas.focus();
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
      if (e.ctrlKey || e.metaKey) {
        setFov(state.fov * Math.exp(e.deltaY * 0.002));
        return;
      }
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.height : 1;
      const dx = (e.deltaX || (e.shiftKey ? e.deltaY : 0)) * unit;
      const dy = (e.shiftKey ? 0 : e.deltaY) * unit;
      move(dx, dy, 0.55);
    }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const step = e.shiftKey ? 42 : 18;
      if (['ArrowLeft','a','A'].includes(e.key)) { e.preventDefault(); move(-step, 0); }
      if (['ArrowRight','d','D'].includes(e.key)) { e.preventDefault(); move(step, 0); }
      if (['ArrowUp','w','W'].includes(e.key)) { e.preventDefault(); move(0, -step); }
      if (['ArrowDown','s','S'].includes(e.key)) { e.preventDefault(); move(0, step); }
    });
    if (!state.loaded && !state.loading) {
      state.loading = true;
      loadSkyData().then(() => { state.loaded = true; state.loading = false; ensureTarget(); draw(); answer.focus(); }).catch(err => { state.error = err.message; state.loading = false; draw(); });
    }
    ensureTarget(); draw(); setTimeout(() => answer.focus(), 0);
  }

  function renderTables() {
    app.innerHTML = '<h2>Tables</h2><select id="tableMode"><option value="constellations">constellations</option><option value="stars">stars</option><option value="dso">Messier + Caldwell</option><option value="asterisms">asterisms</option></select><input id="tableSearch" placeholder="search"><div id="tableWrap" class="table-wrap"></div>';
    const mode = $('#tableMode'), search = $('#tableSearch'), wrap = $('#tableWrap');
    function table(headers, rows) {
      const q = norm(search.value);
      const filtered = rows.filter(r => !q || norm(r.join(' ')).includes(q));
      wrap.innerHTML = `<table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${filtered.map(r => `<tr>${r.map(x => `<td>${esc(x || '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    function redraw() {
      if (mode.value === 'stars') table(['star', 'designation', 'constellation', 'note'], DATA.stars.map(s => [s.name, s.designation, s.constellation, s.note]));
      else if (mode.value === 'dso') table(['code', 'common name', 'type', 'constellation'], DATA.dso.map(o => [o.code, o.commonName, o.type, o.constellation]));
      else if (mode.value === 'asterisms') table(['asterism', 'constellations', 'clue'], DATA.asterisms.map(a => [a.name, a.constellations.join(', '), a.clue]));
      else table(['constellation', 'meaning', 'asterisms'], DATA.constellations.map(c => [c.name, DATA.constellationInfo[c.name].meaning, DATA.constellationInfo[c.name].asterisms.join(', ')]));
    }
    mode.addEventListener('change', redraw); search.addEventListener('input', redraw); redraw(); search.focus();
  }

  function render() {
    if (activeGame === 'charts') makeQuestionGame('charts', 'Charts', { make: chartQuestion });
    else if (activeGame === 'skyguessr') renderSkyGuessr();
    else if (activeGame === 'neighbours') makeQuestionGame('neighbours', 'Neighbours', { make: neighbourQuestion });
    else if (activeGame === 'stars') makeQuestionGame('stars', 'Stars', { modes: starModes, defaultMode: 'starToConstellation', make: starQuestion });
    else if (activeGame === 'stargroups') makeQuestionGame('stargroups', 'Star groups', { make: starGroupQuestion });
    else if (activeGame === 'asterisms') makeQuestionGame('asterisms', 'Asterisms', { modes: asterismModes, defaultMode: 'clueToName', make: asterismQuestion });
    else if (activeGame === 'dso') makeQuestionGame('dso', 'Messier + Caldwell', { modes: dsoModes, defaultMode: 'codeToName', make: dsoQuestion });
    else if (activeGame === 'dsogroups') makeQuestionGame('dsogroups', 'DSO groups', { make: dsoGroupQuestion });
    else if (activeGame === 'mixed') makeQuestionGame('mixed', 'Mixed', { make: mixedQuestion });
    else if (activeGame === 'timer') renderTimer();
    else if (activeGame === 'atlas') renderAtlas();
    else if (activeGame === 'tables') renderTables();
  }
  setupTabs(); render();
})();
