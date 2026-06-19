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
    return `<img class="${esc(cls)}" src="${esc(paths[0])}" data-fallbacks="${esc(paths.slice(1).join('|'))}" onerror="window.__iloveastroImgFallback(this)" alt="${esc(alt)}">`;
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
  const chartByName = new Map(DATA.charts.map(c => [c.name, c]));
  const progress = JSON.parse(localStorage.getItem('iloveastroProgress') || '{}');
  function saveProgress() { localStorage.setItem('iloveastroProgress', JSON.stringify(progress)); }
  function scoreKey(game) { if (!progress[game]) progress[game] = { seen: 0, correct: 0 }; return progress[game]; }
  function record(game, ok) { const p = scoreKey(game); p.seen++; if (ok) p.correct++; saveProgress(); }
  function formatScore(game) { const p = scoreKey(game); const acc = p.seen ? Math.round(100 * p.correct / p.seen) : 0; return `<div class="stat"><strong>${p.seen}</strong>seen</div><div class="stat"><strong>${p.correct}</strong>correct</div><div class="stat"><strong>${acc}%</strong>accuracy</div>`; }

  const games = [
    { id: 'charts', title: 'Charts' },
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
    const info = DATA.constellationInfo[name], chart = chartByName.get(name);
    const starRows = info.stars.length ? info.stars.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.designation)}</td><td>${esc(s.note)}</td></tr>`).join('') : '<tr><td colspan="3">No star in the current curated named-star list.</td></tr>';
    const dsoRows = info.dsos.length ? info.dsos.map(o => `<tr><td>${esc(o.code)}</td><td>${esc(o.commonName)}</td><td>${esc(o.type)}</td></tr>`).join('') : '<tr><td colspan="3">No Messier/Caldwell object in the current list.</td></tr>';
    app.innerHTML = `<button type="button" id="backAtlas">← atlas</button><h2>${esc(name)}</h2><div class="detail-grid"><section class="panel"><h3>Memory hook</h3><p><strong>${esc(info.meaning)}</strong></p><p>${esc(info.myth)}</p><h3>Bordering / nearby chart labels</h3><p>${info.neighbours.length ? info.neighbours.map(n => `<button type="button" class="linkbtn" data-const="${esc(n)}">${esc(n)}</button>`).join(' ') : 'none listed'}</p><h3>Asterisms and sky groups</h3><p>${info.asterisms.length ? info.asterisms.map(esc).join(', ') : 'none listed yet'}</p><h3>Fun facts / pointing tricks</h3>${info.funFacts.length ? `<ul>${info.funFacts.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>Use its chart position, neighbours, stars, and DSOs as the main hook.</p>'}</section><section class="panel">${chart ? chartImg(chart, true, 'chart-img', `${name} labelled chart`) : ''}</section></div><section class="panel"><h3>Stars inside</h3><table><thead><tr><th>star</th><th>designation</th><th>note</th></tr></thead><tbody>${starRows}</tbody></table><h3>Messier + Caldwell DSOs inside</h3><table><thead><tr><th>code</th><th>common name</th><th>type</th></tr></thead><tbody>${dsoRows}</tbody></table></section>`;
    $('#backAtlas').addEventListener('click', renderAtlas);
    document.querySelectorAll('[data-const]').forEach(b => b.addEventListener('click', () => renderConstellationPage(b.dataset.const)));
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
