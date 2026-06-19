from pathlib import Path
import fitz, re, json, shutil, zipfile, os, math, base64, csv
from PIL import Image, ImageDraw

OUT = Path('/mnt/data/iloveastro_site')
PDF = Path('/mnt/data/IAU_constellation_charts_all_88.pdf')
PREV = Path('/mnt/data/rebuild_work/night_sky_training_site/data')
if OUT.exists(): shutil.rmtree(OUT)
(OUT/'assets/charts/blank').mkdir(parents=True)
(OUT/'assets/charts/labelled').mkdir(parents=True)
(OUT/'data').mkdir(parents=True)
(OUT/'tools').mkdir(parents=True)

# Load stable training data from earlier build.
constellations = json.loads((PREV/'constellations.json').read_text(encoding='utf-8'))
stars = json.loads((PREV/'stars.json').read_text(encoding='utf-8'))
messier = json.loads((PREV/'messier.json').read_text(encoding='utf-8'))
caldwell = json.loads((PREV/'caldwell.json').read_text(encoding='utf-8'))

# 89 chart pages: 88 constellations, with Serpens split into Caput/Cauda.
chart_pages = [
    ("Andromeda", "And"), ("Antlia", "Ant"), ("Apus", "Aps"), ("Aquarius", "Aqr"), ("Aquila", "Aql"),
    ("Ara", "Ara"), ("Aries", "Ari"), ("Auriga", "Aur"), ("Boötes", "Boo"), ("Caelum", "Cae"),
    ("Camelopardalis", "Cam"), ("Cancer", "Cnc"), ("Canes Venatici", "CVn"), ("Canis Major", "CMa"),
    ("Canis Minor", "CMi"), ("Capricornus", "Cap"), ("Carina", "Car"), ("Cassiopeia", "Cas"),
    ("Centaurus", "Cen"), ("Cepheus", "Cep"), ("Cetus", "Cet"), ("Chamaeleon", "Cha"),
    ("Circinus", "Cir"), ("Columba", "Col"), ("Coma Berenices", "Com"), ("Corona Australis", "CrA"),
    ("Corona Borealis", "CrB"), ("Corvus", "Crv"), ("Crater", "Crt"), ("Crux", "Cru"), ("Cygnus", "Cyg"),
    ("Delphinus", "Del"), ("Dorado", "Dor"), ("Draco", "Dra"), ("Equuleus", "Equ"), ("Eridanus", "Eri"),
    ("Fornax", "For"), ("Gemini", "Gem"), ("Grus", "Gru"), ("Hercules", "Her"), ("Horologium", "Hor"),
    ("Hydra", "Hya"), ("Hydrus", "Hyi"), ("Indus", "Ind"), ("Lacerta", "Lac"), ("Leo", "Leo"),
    ("Leo Minor", "LMi"), ("Lepus", "Lep"), ("Libra", "Lib"), ("Lupus", "Lup"), ("Lynx", "Lyn"),
    ("Lyra", "Lyr"), ("Mensa", "Men"), ("Microscopium", "Mic"), ("Monoceros", "Mon"), ("Musca", "Mus"),
    ("Norma", "Nor"), ("Octans", "Oct"), ("Ophiuchus", "Oph"), ("Orion", "Ori"), ("Pavo", "Pav"),
    ("Pegasus", "Peg"), ("Perseus", "Per"), ("Phoenix", "Phe"), ("Pictor", "Pic"), ("Pisces", "Psc"),
    ("Piscis Austrinus", "PsA"), ("Puppis", "Pup"), ("Pyxis", "Pyx"), ("Reticulum", "Ret"),
    ("Sagitta", "Sge"), ("Sagittarius", "Sgr"), ("Scorpius", "Sco"), ("Sculptor", "Scl"), ("Scutum", "Sct"),
    ("Serpens", "Ser", "Serpens Caput"), ("Serpens", "Ser", "Serpens Cauda"), ("Sextans", "Sex"),
    ("Taurus", "Tau"), ("Telescopium", "Tel"), ("Triangulum", "Tri"), ("Triangulum Australe", "TrA"),
    ("Tucana", "Tuc"), ("Ursa Major", "UMa"), ("Ursa Minor", "UMi"), ("Vela", "Vel"), ("Virgo", "Vir"),
    ("Volans", "Vol"), ("Vulpecula", "Vul")
]
assert len(chart_pages) == 89
const_by_name = {c['name']: c for c in constellations}
name_by_compact = {re.sub(r'[^A-Z]', '', c['name'].upper().replace('Ö','O')): c['name'] for c in constellations}
# Some chart text uses BOOTES instead of BOÖTES.
name_by_compact['BOOTES'] = 'Boötes'

UPPER_LABEL_WHITELIST = {'ECLIPTIC', 'IAU', 'SKY', 'TELESCOPE', 'SKY & TELESCOPE', 'SKY TELESCOPE'}
latin_upper_re = re.compile(r'[A-Z]')

def deaccent_upper(s: str) -> str:
    return s.upper().replace('Ö','O').replace('‑','-').replace('–','-').replace('—','-')

def block_lines(block):
    lines=[]
    sizes=[]
    for line in block.get('lines',[]):
        line_text=''.join(span.get('text','') for span in line.get('spans',[])).strip()
        if line_text: lines.append(line_text)
        for span in line.get('spans',[]): sizes.append(span.get('size',0))
    return lines, sizes

def block_bbox(block):
    xs=[]; ys=[]
    for line in block.get('lines',[]):
        for span in line.get('spans',[]):
            x0,y0,x1,y1 = span['bbox']
            xs += [x0,x1]; ys += [y0,y1]
    if not xs: return None
    return (min(xs), min(ys), max(xs), max(ys))

def normalise_label_text(lines):
    # Join line-break hyphenation: CHAMAE- / LEON -> CHAMAELEON; DEL- / PHINUS -> DELPHINUS.
    t = ' '.join(lines)
    t = deaccent_upper(t)
    t = t.replace('/', ' ')
    t = re.sub(r'-\s+', '', t)
    t = t.replace('-', '')
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def compact(s):
    return re.sub(r'[^A-Z]', '', deaccent_upper(s))

def should_mask_constellation_block(lines, sizes):
    if not lines:
        return False
    raw = ' '.join(lines).strip()
    up = normalise_label_text(lines)
    if not latin_upper_re.search(deaccent_upper(raw)):
        return False
    # Preserve numbered DSO labels like IC 342, M31, NGC 7662; constellation labels have no digits.
    if re.search(r'\d', raw):
        return False
    # Preserve mixed-case star names; constellation labels in these PDFs are all uppercase-ish.
    letters = re.sub(r'[^A-Za-zÖö]', '', raw)
    if letters and letters != letters.upper():
        return False
    if up in UPPER_LABEL_WHITELIST:
        return False
    # Keep only larger label-like text, which avoids any tiny accidental all-caps metadata.
    if sizes and max(sizes) < 9.5:
        return False
    # Mask blocks containing only uppercase label components. This catches split names such as SAGIT TA,
    # CHAMAE- / LEON, URSA / MAJOR, CANES / VENATICI, and AUSTRALE / CENTAURUS.
    if re.search(r'[A-Z]{3,}', up):
        return True
    return False

def detect_visible_constellations(page):
    blocks=[]
    for b in page.get_text('dict')['blocks']:
        lines, sizes = block_lines(b)
        if not should_mask_constellation_block(lines, sizes):
            continue
        bbox=block_bbox(b)
        text=normalise_label_text(lines)
        blocks.append({'text': text, 'compact': compact(text), 'bbox': bbox})
    # Full compact string matching over all constellation names. Handles blocks with two labels.
    visible=set()
    all_text = ' '.join(b['text'] for b in blocks)
    all_compact_words = [b['compact'] for b in blocks]
    all_compact_joined = ' '.join(all_compact_words)
    for c in constellations:
        name = c['name']
        cname = compact(name)
        # Exact compact block match or substring in a block with multiple labels.
        if any(cname in b['compact'] for b in blocks):
            visible.add(name)
    # Handle multi-word/split labels whose words or word pieces are adjacent but in separate blocks.
    # These corrections are derived from common IAU chart splits.
    token_presence = set()
    for b in blocks:
        for token in re.findall(r'[A-Z]{3,}', b['text']):
            token_presence.add(token)
        token_presence.add(b['compact'])
    special_splits = {
        'Triangulum Australe': [('TRIANGULUM','AUSTRALE')],
        'Ursa Major': [('URSA','MAJOR'), ('URSAMAJOR',)],
        'Ursa Minor': [('URSA','MINOR'), ('URSAMINOR',)],
        'Canes Venatici': [('CANES','VENATICI'), ('CANESVENATICI',)],
        'Canis Major': [('CANIS','MAJOR'), ('CANISMAJOR',)],
        'Canis Minor': [('CANIS','MINOR'), ('CANISMINOR',)],
        'Corona Australis': [('CORONA','AUSTRALIS'), ('CORONAAUSTRALIS',)],
        'Corona Borealis': [('CORONA','BOREALIS'), ('CORONABOREALIS',)],
        'Coma Berenices': [('COMA','BERENICES'), ('COMABERENICES',)],
        'Piscis Austrinus': [('PISCIS','AUSTRINUS'), ('PISCISAUSTRINUS',)],
        'Leo Minor': [('LEO','MINOR'), ('LEOMINOR',)],
    }
    for name, patterns in special_splits.items():
        for pat in patterns:
            if all(p in token_presence or p in all_compact_joined for p in pat):
                visible.add(name)
    # If a compound constellation was detected, do not infer its ambiguous one-word component just because the component label is present.
    if 'Triangulum Australe' in visible and 'Triangulum' in visible and not any(b['compact']=='TRIANGULUM' and len(visible)==1 for b in blocks):
        # only remove Triangulum if AUSTRALE is also present as a label; this prevents page 1 false positives.
        if any('AUSTRALE' in b['text'] for b in blocks):
            visible.discard('Triangulum')
    if 'Leo Minor' in visible and 'Leo' in visible:
        # Keep Leo if a standalone LEO label exists apart from LEO MINOR.
        if not any(b['compact']=='LEO' for b in blocks): visible.discard('Leo')
    return sorted(visible), blocks

def mask_line_items(page):
    items = []
    for b in page.get_text('dict')['blocks']:
        for line in b.get('lines', []):
            line_text = ''.join(span.get('text','') for span in line.get('spans', [])).strip()
            sizes = [span.get('size', 0) for span in line.get('spans', [])]
            if not should_mask_constellation_block([line_text], sizes):
                continue
            xs=[]; ys=[]
            for span in line.get('spans', []):
                x0,y0,x1,y1 = span['bbox']
                xs += [x0,x1]; ys += [y0,y1]
            if xs:
                items.append({'text': normalise_label_text([line_text]), 'bbox': (min(xs), min(ys), max(xs), max(ys))})
    return items

# Render and mask charts.
doc = fitz.open(PDF)
assert len(doc)==89, len(doc)
zoom = 2.0
mat = fitz.Matrix(zoom, zoom)
charts=[]
mask_report=[]

MANUAL_PAGE_FIXES = {
    8: {
        'visible': ['Auriga', 'Gemini', 'Lynx', 'Perseus'],
        'rects_px': [
            (170, 585, 270, 635),   # LYNX
            (805, 625, 955, 700),   # PERSEUS
            (400, 835, 530, 895),   # AURIGA
            (205, 1060, 330, 1120), # GEMINI
        ]
    },
    10: {
        'visible': ['Caelum', 'Columba', 'Eridanus', 'Horologium', 'Lepus', 'Pictor'],
        'rects_px': [
            (205, 470, 320, 535),   # LEPUS
            (630, 490, 785, 555),   # ERIDANUS
            (275, 605, 430, 670),   # COLUMBA
            (525, 755, 670, 820),   # CAELUM
            (315, 1000, 440, 1070), # PICTOR
            (735, 1000, 940, 1075), # HOROLOGIUM
        ]
    }
}
for i,page in enumerate(doc):
    name, abbr, *display_extra = chart_pages[i]
    display = display_extra[0] if display_extra else name
    chart_id = f"{i+1:02d}-{abbr.lower()}" + ("-caput" if display.endswith('Caput') else "-cauda" if display.endswith('Cauda') else "")
    visible, blocks = detect_visible_constellations(page)
    mask_items = mask_line_items(page)
    if (i+1) in MANUAL_PAGE_FIXES:
        visible = sorted(set(MANUAL_PAGE_FIXES[i+1]['visible']))
    # Add the target if text detection somehow missed it.
    if name not in visible:
        visible.append(name); visible=sorted(set(visible))
    neighbours = sorted([v for v in visible if v != name])

    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    labelled_path = OUT/'assets/charts/labelled'/f'{chart_id}.jpg'
    img.save(labelled_path, 'JPEG', quality=85)
    blank = img.copy()
    draw = ImageDraw.Draw(blank)
    for b in mask_items:
        x0,y0,x1,y1 = b['bbox']
        x0*=zoom; y0*=zoom; x1*=zoom; y1*=zoom
        w=x1-x0; h=y1-y0
        pad_x=max(9, int(w*0.12)); pad_y=max(5, int(h*0.22))
        draw.rectangle([x0-pad_x, y0-pad_y, x1+pad_x, y1+pad_y], fill='white')
        mask_report.append({'page': i+1, 'chart': display, 'masked_text': b['text'], 'bbox': b['bbox']})
    if (i+1) in MANUAL_PAGE_FIXES:
        for rx0, ry0, rx1, ry1 in MANUAL_PAGE_FIXES[i+1]['rects_px']:
            draw.rectangle([rx0, ry0, rx1, ry1], fill='white')
            mask_report.append({'page': i+1, 'chart': display, 'masked_text': 'MANUAL', 'bbox': (rx0/zoom, ry0/zoom, rx1/zoom, ry1/zoom)})
    blank_path = OUT/'assets/charts/blank'/f'{chart_id}.jpg'
    blank.save(blank_path, 'JPEG', quality=85)
    accepted=[name]
    if name=='Boötes': accepted.append('Bootes')
    if display.endswith('Caput'): accepted += ['Serpens Caput']
    if display.endswith('Cauda'): accepted += ['Serpens Cauda']
    charts.append({
        'id': chart_id, 'page': i+1, 'name': name, 'displayName': display, 'abbr': abbr,
        'accepted': accepted, 'image': f'assets/charts/blank/{chart_id}.jpg',
        'answerImage': f'assets/charts/labelled/{chart_id}.jpg',
        'visibleConstellations': visible, 'neighbours': neighbours
    })

# Save data files.
for filename, data in [('constellations.json', constellations), ('charts.json', charts), ('stars.json', stars), ('messier.json', messier), ('caldwell.json', caldwell), ('dso.json', messier+caldwell)]:
    (OUT/'data'/filename).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
with open(OUT/'data/mask_report.csv','w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f, fieldnames=['page','chart','masked_text','bbox'])
    w.writeheader(); w.writerows(mask_report)

# Skipped convenience PDF generation to keep the site build fast.

# Website code.
index_html = '''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>iloveastro</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>iloveastro</h1>
    <button id="resetProgress" type="button">reset</button>
  </header>
  <nav id="tabs" aria-label="games"></nav>
  <main id="app"></main>
  <script src="data.js"></script>
  <script src="app.js"></script>
</body>
</html>
'''
(OUT/'index.html').write_text(index_html, encoding='utf-8')

style_css = '''* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: white; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.35; }
header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #ccc; }
h1 { margin: 0; font-size: 24px; font-weight: 700; }
nav { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 14px; border-bottom: 1px solid #ccc; }
button, input, select { font: inherit; }
button { background: white; color: black; border: 1px solid #333; border-radius: 0; padding: 5px 9px; cursor: pointer; }
button:hover, button.active { background: #eee; }
button:disabled { color: #888; cursor: default; }
main { padding: 14px; }
h2 { margin: 0 0 10px; font-size: 21px; }
h3 { margin: 12px 0 6px; font-size: 17px; }
p { margin: 8px 0; }
label { display: block; margin: 8px 0 4px; }
input, select { width: 100%; max-width: 760px; padding: 7px; border: 1px solid #777; background: white; color: black; }
.layout { display: grid; grid-template-columns: minmax(260px, 330px) minmax(0, 1fr); gap: 16px; align-items: start; }
aside, .panel { border: 1px solid #ccc; padding: 10px; background: white; }
.prompt { font-size: 19px; margin: 8px 0 10px; }
.answer-input { margin-top: 8px; }
.message { min-height: 1.5em; margin: 8px 0; font-weight: 700; }
.good { color: #006400; }
.bad { color: #900; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
.stat { border: 1px solid #ddd; padding: 4px 6px; background: #fafafa; }
.stat strong { display: block; font-size: 18px; }
img { max-width: 100%; height: auto; border: 1px solid #ccc; background: white; }
.chart-img { width: 100%; }
.controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.last-card { margin-top: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
.small { font-size: 13px; color: #555; }
.pill { display: inline-block; margin: 3px; padding: 3px 6px; border: 1px solid #ddd; background: #fafafa; }
.atlas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.atlas-card { border: 1px solid #ccc; padding: 8px; cursor: pointer; }
.atlas-card h3 { margin: 7px 0 4px; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { border: 1px solid #ccc; padding: 5px; text-align: left; vertical-align: top; }
th { background: #eee; }
.hidden { display: none; }
.kbd { font-family: monospace; border: 1px solid #ccc; padding: 1px 4px; background: #f8f8f8; }
@media (max-width: 850px) { .layout { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
'''
(OUT/'style.css').write_text(style_css, encoding='utf-8')

# Embed data in data.js to avoid fetch/json loading failures.
site_data = {
    'constellations': constellations,
    'charts': charts,
    'stars': stars,
    'messier': messier,
    'caldwell': caldwell,
    'dso': messier+caldwell,
}
(OUT/'data.js').write_text('window.SKY_DATA = ' + json.dumps(site_data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')

app_js = r'''(() => {
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
  const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const compact = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const answerMatches = (input, answers) => {
    const n = norm(input), c = compact(input);
    if (!n) return false;
    return answers.some(a => norm(a) === n || compact(a) === c);
  };
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
    games.forEach(g => {
      tabs.append(el('button', { type: 'button', class: g.id === activeGame ? 'active' : '', onclick: () => switchGame(g.id) }, [document.createTextNode(g.title)]));
    });
  }
  function switchGame(id) {
    activeGame = id;
    setupTabs();
    render();
  }
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
    const state = states[gameId] || (states[gameId] = { current: null, answered: false, last: '', mode: options.defaultMode || '', timer: null, next: () => newQuestion() });
    function newQuestion() {
      clearTimeout(state.timer);
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
      draw(true);
      state.timer = setTimeout(newQuestion, options.delay || 700);
    }
    function reveal() {
      if (!state.current || state.answered) return;
      state.answered = true;
      record(gameId, false);
      state.last = state.current.card(false);
      draw(false);
      state.timer = setTimeout(newQuestion, options.revealDelay || 1200);
    }
    function draw(justCorrect = null) {
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
      const msg = justCorrect === true ? '<span class="good">correct</span>' : justCorrect === false ? '<span class="bad">revealed</span>' : '';
      aside.append(el('div', { class: 'message', html: msg }));
      aside.append(el('div', { class: 'controls' }, [
        el('button', { type: 'button', onclick: reveal }, [document.createTextNode('reveal')]),
        el('button', { type: 'button', onclick: newQuestion }, [document.createTextNode('skip')])
      ]));
      aside.append(el('div', { class: 'stats', html: formatScore(gameId) }));
      aside.append(el('p', { class: 'small', html: '<span class="kbd">Shift</span> + <span class="kbd">Enter</span> skips.' }));
      if (state.last) aside.append(el('div', { class: 'last-card', html: state.last }));
      const main = el('section', { class: 'panel', html: q.visual || '' });
      app.append(el('div', { class: 'layout' }, [aside, main]));
    }
    state.next = newQuestion;
    if (!state.current) newQuestion(); else draw();
  }

  function chartQuestion() {
    const c = rand(DATA.charts);
    return {
      prompt: 'Name the constellation chart.',
      answers: c.accepted,
      visual: `<img class="chart-img" src="${c.image}" alt="blanked constellation chart">`,
      card: ok => `<h3>${ok ? 'correct' : 'answer'}: ${c.displayName}</h3><p>Visible neighbouring constellations: ${c.neighbours.join(', ') || 'none listed'}.</p><img src="${c.answerImage}" alt="labelled chart">`
    };
  }

  function neighbourQuestion() {
    const pool = DATA.charts.filter(c => c.neighbours && c.neighbours.length);
    const c = rand(pool);
    return {
      prompt: `Name any constellation labelled near <strong>${c.displayName}</strong> on this chart.`,
      answers: c.neighbours,
      visual: `<img class="chart-img" src="${c.image}" alt="blanked constellation chart">`,
      card: ok => `<h3>${ok ? 'correct' : 'answer'}: ${c.displayName}</h3><p>Accepted neighbours: ${c.neighbours.join(', ')}.</p><img src="${c.answerImage}" alt="labelled chart">`
    };
  }

  const starModes = [
    { id: 'starToConstellation', label: 'star -> constellation' },
    { id: 'designationToStar', label: 'designation -> star' },
    { id: 'starToDesignation', label: 'star -> designation' },
    { id: 'constellationToStar', label: 'constellation -> any listed star' }
  ];
  function starQuestion(mode) {
    const s = rand(DATA.stars);
    if (mode === 'designationToStar') return {
      prompt: `Which named star has designation <strong>${s.designation}</strong>?`, answers: [s.name],
      card: ok => `<h3>${s.name}</h3><p>${s.designation}. ${s.constellation}. ${s.note}.</p>`
    };
    if (mode === 'starToDesignation') return {
      prompt: `What is the designation of <strong>${s.name}</strong>?`, answers: [s.designation],
      card: ok => `<h3>${s.name}</h3><p>${s.designation}. ${s.constellation}. ${s.note}.</p>`
    };
    if (mode === 'constellationToStar') {
      const entries = [...starByConst.entries()].filter(([, arr]) => arr.length >= 1);
      const [constellation, arr] = rand(entries);
      return { prompt: `Name any listed star in <strong>${constellation}</strong>.`, answers: arr.map(x => x.name), card: ok => `<h3>${constellation}</h3><p>${arr.map(x => `${x.name} (${x.designation})`).join(', ')}</p>` };
    }
    return { prompt: `Which constellation contains <strong>${s.name}</strong>?`, answers: [s.constellation], card: ok => `<h3>${s.name}</h3><p>${s.designation}. ${s.constellation}. ${s.note}.</p>` };
  }

  function starGroupQuestion() {
    const entries = [...starByConst.entries()].filter(([, arr]) => arr.length >= 2);
    const [constellation, arr] = rand(entries);
    const picks = sample(arr, Math.min(4, arr.length));
    return { prompt: `These stars are in which constellation?<br><strong>${picks.map(x => x.name).join(', ')}</strong>`, answers: [constellation], card: ok => `<h3>${constellation}</h3><p>${arr.map(x => `${x.name} (${x.designation})`).join(', ')}</p>` };
  }

  const dsoModes = [
    { id: 'codeToName', label: 'number -> common name' },
    { id: 'nameToCode', label: 'common name -> number' },
    { id: 'objectToConstellation', label: 'object -> constellation' },
    { id: 'constellationToObject', label: 'constellation -> any listed DSO' },
    { id: 'objectToType', label: 'object -> type' }
  ];
  const namedDSO = DATA.dso.filter(o => o.commonName && o.commonName.trim());
  function dsoLabel(o) { return o.commonName ? `${o.code} - ${o.commonName}` : o.code; }
  function dsoAnswers(o) { return [o.code, o.commonName].filter(Boolean); }
  function dsoQuestion(mode) {
    if (mode === 'nameToCode') { const o = rand(namedDSO); return { prompt: `What catalogue number is <strong>${o.commonName}</strong>?`, answers: [o.code], card: ok => `<h3>${dsoLabel(o)}</h3><p>${o.type}. ${o.constellation}.</p>` }; }
    if (mode === 'objectToConstellation') { const o = rand(DATA.dso); return { prompt: `Which constellation contains <strong>${dsoLabel(o)}</strong>?`, answers: [o.constellation], card: ok => `<h3>${dsoLabel(o)}</h3><p>${o.type}. ${o.constellation}.</p>` }; }
    if (mode === 'constellationToObject') {
      const entries = [...dsoByConst.entries()].filter(([, arr]) => arr.length >= 1);
      const [constellation, arr] = rand(entries);
      return { prompt: `Name any listed Messier/Caldwell object in <strong>${constellation}</strong>.`, answers: arr.flatMap(dsoAnswers), card: ok => `<h3>${constellation}</h3><p>${arr.map(dsoLabel).join(', ')}</p>` };
    }
    if (mode === 'objectToType') { const o = rand(DATA.dso); return { prompt: `What type of object is <strong>${dsoLabel(o)}</strong>?`, answers: [o.type], card: ok => `<h3>${dsoLabel(o)}</h3><p>${o.type}. ${o.constellation}.</p>` }; }
    const o = rand(namedDSO); return { prompt: `What common name is associated with <strong>${o.code}</strong>?`, answers: [o.commonName], card: ok => `<h3>${dsoLabel(o)}</h3><p>${o.type}. ${o.constellation}.</p>` };
  }

  function dsoGroupQuestion() {
    const entries = [...dsoByConst.entries()].filter(([, arr]) => arr.length >= 2);
    const [constellation, arr] = rand(entries);
    const picks = sample(arr, Math.min(5, arr.length));
    return { prompt: `These DSOs belong to which constellation?<br><strong>${picks.map(dsoLabel).join(', ')}</strong>`, answers: [constellation], card: ok => `<h3>${constellation}</h3><p>${arr.map(dsoLabel).join(', ')}</p>` };
  }

  function mixedQuestion() {
    const makers = [chartQuestion, neighbourQuestion, () => starQuestion(rand(starModes).id), starGroupQuestion, () => dsoQuestion(rand(dsoModes).id), dsoGroupQuestion];
    const q = rand(makers)();
    q.prompt = `<span class="small">mixed</span><br>${q.prompt}`;
    return q;
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
      el('div', { class: 'controls' }, [
        el('button', { type: 'button', onclick: timerStart }, [document.createTextNode('start / restart')]),
        el('button', { type: 'button', onclick: timerStop }, [document.createTextNode('stop')])
      ]),
      input,
      el('div', { id: 'timerMsg', class: 'message' }),
      el('h3', {}, [document.createTextNode('found')]),
      el('div', { id: 'foundList', html: found.map(n => `<span class="pill">${n}</span>`).join('') }),
      el('p', { class: 'small', html: 'Ambiguous short names such as Leo or Sagitta wait because they can begin Leo Minor or Sagittarius. Type a comma after the short name to accept it, e.g. <span class="kbd">leo,</span>.' })
    ]));
    setTimeout(() => $('#timerInput') && $('#timerInput').focus(), 0);
  }
  function timerTick() { timerState.seconds++; const clock = $('#timerClock'); if (clock) clock.textContent = new Date(timerState.seconds * 1000).toISOString().slice(14, 19); }
  function timerStart() { clearInterval(timerState.interval); timerState.running = true; timerState.seconds = 0; timerState.found = new Set(); timerState.interval = setInterval(timerTick, 1000); renderTimer(); }
  function timerStop() { clearInterval(timerState.interval); timerState.running = false; const msg = $('#timerMsg'); if (msg) msg.textContent = `stopped at ${timerState.found.size}/88`; }
  function timerCheck(input) {
    const raw = input.value;
    const n = norm(raw);
    if (!n) return;
    const hit = DATA.constellations.find(c => norm(c.name) === n || (c.name === 'Boötes' && n === 'bootes'));
    if (!hit) return;
    const longer = DATA.constellations.some(c => !timerState.found.has(c.name) && norm(c.name).startsWith(n) && norm(c.name) !== n);
    const forced = /[,;]$/.test(raw);
    if (longer && !forced) return;
    if (timerState.found.has(hit.name)) { input.value = ''; return; }
    timerState.found.add(hit.name);
    input.value = '';
    if (timerState.found.size === 88) { clearInterval(timerState.interval); timerState.running = false; record('timer', true); }
    renderTimer();
  }

  function renderAtlas() {
    app.innerHTML = '<h2>Atlas</h2><p>Click a chart to switch between blanked and labelled.</p><div class="atlas-grid" id="atlasGrid"></div>';
    const grid = $('#atlasGrid');
    DATA.charts.forEach(c => {
      const card = el('div', { class: 'atlas-card' });
      card.innerHTML = `<img src="${c.image}" alt="${c.displayName}"><h3>${c.displayName}</h3><p class="small">${c.neighbours.slice(0, 8).join(', ')}</p>`;
      card.dataset.side = 'blank';
      card.addEventListener('click', () => {
        const img = card.querySelector('img');
        if (card.dataset.side === 'blank') { img.src = c.answerImage; card.dataset.side = 'labelled'; }
        else { img.src = c.image; card.dataset.side = 'blank'; }
      });
      grid.append(card);
    });
  }

  function renderTables() {
    app.innerHTML = '<h2>Tables</h2><select id="tableMode"><option value="constellations">constellations</option><option value="stars">stars</option><option value="dso">Messier + Caldwell</option></select><input id="tableSearch" placeholder="search"><div id="tableWrap" class="table-wrap"></div>';
    const mode = $('#tableMode'), search = $('#tableSearch'), wrap = $('#tableWrap');
    function table(headers, rows) {
      const q = norm(search.value);
      const filtered = rows.filter(r => !q || norm(r.join(' ')).includes(q));
      wrap.innerHTML = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${filtered.map(r => `<tr>${r.map(x => `<td>${x || ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    function redraw() {
      if (mode.value === 'stars') table(['star', 'designation', 'constellation', 'note'], DATA.stars.map(s => [s.name, s.designation, s.constellation, s.note]));
      else if (mode.value === 'dso') table(['code', 'common name', 'type', 'constellation'], DATA.dso.map(o => [o.code, o.commonName, o.type, o.constellation]));
      else table(['constellation'], DATA.constellations.map(c => [c.name]));
    }
    mode.addEventListener('change', redraw); search.addEventListener('input', redraw); redraw(); search.focus();
  }

  function render() {
    if (activeGame === 'charts') makeQuestionGame('charts', 'Charts', { make: chartQuestion });
    else if (activeGame === 'neighbours') makeQuestionGame('neighbours', 'Neighbours', { make: neighbourQuestion });
    else if (activeGame === 'stars') makeQuestionGame('stars', 'Stars', { modes: starModes, defaultMode: 'starToConstellation', make: starQuestion });
    else if (activeGame === 'stargroups') makeQuestionGame('stargroups', 'Star groups', { make: starGroupQuestion });
    else if (activeGame === 'dso') makeQuestionGame('dso', 'Messier + Caldwell', { modes: dsoModes, defaultMode: 'codeToName', make: dsoQuestion });
    else if (activeGame === 'dsogroups') makeQuestionGame('dsogroups', 'DSO groups', { make: dsoGroupQuestion });
    else if (activeGame === 'mixed') makeQuestionGame('mixed', 'Mixed', { make: mixedQuestion });
    else if (activeGame === 'timer') renderTimer();
    else if (activeGame === 'atlas') renderAtlas();
    else if (activeGame === 'tables') renderTables();
  }

  setupTabs();
  render();
})();
'''
(OUT/'app.js').write_text(app_js, encoding='utf-8')

readme = '''# iloveastro

A static GitHub Pages night-sky memorisation site.

Upload the contents of this folder to the root of your GitHub Pages repository. The repository root should contain `index.html`, `style.css`, `data.js`, `app.js`, the `assets/` folder, the `data/` folder, and `.nojekyll`.

Games included:

- Charts: identify constellation charts with only constellation names blanked.
- Neighbours: name constellations that appear near a given chart.
- Stars: star-to-constellation, designation-to-star, star-to-designation, and constellation-to-star drills.
- Star groups: infer a constellation from several star names.
- DSOs: Messier/Caldwell common names, numbers, types, and host constellations.
- DSO groups: infer a constellation from several DSOs.
- Mixed: random mixed drill.
- 88 timer: count-up timer with automatic marking.
- Atlas and tables for browsing.

The chart masks are generated directly from the IAU chart PDF text layer. The mask report is in `data/mask_report.csv`.
'''
(OUT/'README.md').write_text(readme, encoding='utf-8')
(OUT/'.nojekyll').write_text('', encoding='utf-8')

# Include this builder script for reproducibility.
shutil.copyfile(__file__, OUT/'tools/build_iloveastro.py')

# Zip the project.
ZIP = Path('/mnt/data/iloveastro_site.zip')
if ZIP.exists(): ZIP.unlink()
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for root, dirs, files in os.walk(OUT):
        for fn in files:
            p=Path(root)/fn
            zf.write(p, p.relative_to(OUT.parent))

print('Wrote', OUT)
print('Zip', ZIP, ZIP.stat().st_size)
print('Charts', len(charts), 'Mask blocks', len(mask_report))
# Print specific chart detection info for earlier failures.
for idx in [7,9,53]:
    print(idx+1, charts[idx]['displayName'], 'visible:', charts[idx]['visibleConstellations'])
