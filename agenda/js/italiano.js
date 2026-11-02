'use strict';
/* Italiano: curso con plan que se corre solo (sin fechas fijas), repetición espaciada tipo Anki
   (tarjetas y repasos de lección), dificultad adaptativa según cómo te va, exámenes y aviso diario.
   Contenido en italiano-data-1/2/3.js. El progreso vive en DB.italian (se sincroniza). */

const IT = {
  view: 'home',      // home | plan | lesson | block | review | topics | config
  lesson: 1,
  step: 'learn',     // learn | practice | exam
  block: 1,
  exam: null,        // { key, kind, lessonId, items, answers, result, rated }
  rev: null,         // sesión de tarjetas { queue, i, shown, done }
  speech: {},
  cards: null,
  voice: null,
  bound: false,
};

const IT_DAY_KEY = 'agendaSemanal:itCheck';
const IT_CAT = { pasos: 'Primeros pasos', verbo: 'El verbo', practico: 'Italiano práctico', gramatica: 'Gramática', glosarios: 'Glosarios' };
const IT_RATINGS = [['Difícil', 'Me costó'], ['Bien', 'Normal'], ['Fácil', 'Me salió solo']];
const IT_LEVELS = {
  1: { name: 'Suave', pace: 1, exam: 'opciones', desc: 'Una lección por día de estudio, exámenes con opciones y más repasos.' },
  2: { name: 'Normal', pace: 1, exam: 'mixto', desc: 'Una lección por día de estudio y exámenes que mezclan opciones con respuestas escritas.' },
  3: { name: 'Intenso', pace: 2, exam: 'escrito', desc: 'Dos lecciones por día de estudio, respuestas escritas y dictados.' },
};

/* ---------- Registros ---------- */

function itRec(id) { return (DB.italian || []).find((r) => r.id === id) || null; }
function itL(l) { return itRec('L:' + l.id) || {}; }
function itLesson(n) { return IT_LESSONS.find((l) => l.n === n); }
function itLessonById(id) { return IT_LESSONS.find((l) => l.id === id); }
function itDone(l) { return !!itL(l).done; }
function itBlockLessons(w) { return IT_LESSONS.filter((l) => l.w === w); }
function itBlockDone(w) { const r = itRec('W:' + w); return !!(r && r.done); }

/* Modifica (o crea) un registro dentro de un commit */
function itGet(d, id, kind) {
  d.italian = d.italian || [];
  let r = d.italian.find((x) => x.id === id);
  if (!r) { r = { id, kind }; d.italian.push(r); }
  return r;
}
function itLog(d, field) {
  const r = itGet(d, 'log', 'log');
  const t = nowInfo().date;
  r.d = r.d || {};
  const day = r.d[t] = Object.assign({ l: 0, r: 0, x: 0 }, r.d[t] || {});
  day[field]++;
}

/* ---------- Ajustes, nivel y ritmo ---------- */

function itSettings() {
  const s = DB.settings;
  return {
    start: isYmd(s.italianStart) ? s.italianStart : '2026-11-20',
    days: Array.isArray(s.italianDays) && s.italianDays.length ? s.italianDays : [1, 2, 3, 4, 5, 6],
    pass: Number(s.italianPass) || 70,
    rate: Number(s.italianRate) || 0.9,
    pace: s.italianPace === 1 || s.italianPace === 2 || s.italianPace === 3 ? s.italianPace : 'auto',
  };
}

/* Nivel según las últimas 3 lecciones: lo que dijiste (difícil / bien / fácil) + la nota del examen */
function itLevel() {
  const rated = IT_LESSONS.filter((l) => itDone(l) && itL(l).rating != null).slice(-3);
  if (!rated.length) return 2;
  const v = rated.map((l) => { const r = itL(l); return r.rating + (r.best >= 90 ? 0.5 : r.best < 75 ? -0.5 : 0); });
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  return avg < 0.75 ? 1 : avg < 1.6 ? 2 : 3;
}
function itPace() { const st = itSettings(); return st.pace === 'auto' ? IT_LEVELS[itLevel()].pace : st.pace; }

function itIsStudyDay(d) { return itSettings().days.includes(weekdayOf(d)); }
function itNextStudyDay(d) { for (let i = 0; i < 14; i++) { if (itIsStudyDay(d)) return d; d = addDays(d, 1); } return d; }
function itDoneOn(d) { return IT_LESSONS.filter((l) => itL(l).doneAt === d).length; }
function itAnyProgress() { return IT_LESSONS.some(itDone); }

/* Fechas sugeridas para las lecciones que faltan: el plan se corre solo según lo que hiciste */
function itProjection() {
  const today = nowInfo().date;
  const st = itSettings();
  const pace = itPace();
  const out = {};
  const pending = IT_LESSONS.filter((l) => !itDone(l));
  let day, cap;
  if (!itAnyProgress() && today < st.start) { day = itNextStudyDay(st.start); cap = pace; }
  else if (itIsStudyDay(today) && itDoneOn(today) < pace) { day = today; cap = pace - itDoneOn(today); }
  else { day = itNextStudyDay(addDays(today, 1)); cap = pace; }
  for (const l of pending) {
    if (cap <= 0) { day = itNextStudyDay(addDays(day, 1)); cap = pace; }
    out[l.n] = day;
    cap--;
  }
  return out;
}

function itWhen(d) {
  const t = nowInfo().date;
  if (d === t) return 'Hoy';
  if (d === addDays(t, 1)) return 'Mañana';
  return `${DAY_SHORT[weekdayOf(d)]} ${Number(d.slice(8))}`;
}

/* ---------- Repetición espaciada (tarjetas) ---------- */

function itLessonVocab(l) {
  const out = [];
  for (const b of l.blocks) if (b[0] === 'v') for (const v of b[1]) if (v[1] && !/^[A-Z]$/.test(v[1])) out.push({ it: v[0], es: v[1], note: v[2] || '' });
  return out;
}

function itCardsOf(l) { const r = itRec('C:' + l.id); return (r && r.c) || {}; }

function itDueCards(today) {
  const out = [];
  for (const l of IT_LESSONS) {
    const c = itCardsOf(l);
    for (const v of itLessonVocab(l)) { const s = c[v.it]; if (s && s[0] <= today) out.push({ lid: l.id, n: l.n, it: v.it, es: v.es, note: v.note }); }
  }
  return out;
}

function itCardStats() {
  let total = 0, known = 0;
  for (const l of IT_LESSONS) { const c = itCardsOf(l); for (const k in c) { total++; if (c[k][1] >= 7) known++; } }
  return { total, known };
}

/* SM-2 (el algoritmo clásico de Anki). Estado: [vence, intervalo, facilidad, repasos, olvidos] */
function itSm2(s, g, today) {
  let [, ivl, ease, reps, lapses] = s;
  if (g === 0) { lapses++; ease = Math.max(1.3, ease - 0.2); reps = 0; ivl = 0; }
  else if (g === 1) { ivl = reps === 0 ? 1 : Math.max(ivl + 1, Math.round(ivl * 1.2)); ease = Math.max(1.3, ease - 0.15); reps++; }
  else if (g === 2) { ivl = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(ivl + 1, Math.round(ivl * ease)); reps++; }
  else { ivl = reps === 0 ? 3 : Math.max(ivl + 1, Math.round(ivl * ease * 1.3)); ease += 0.15; reps++; }
  ivl = Math.min(ivl, 180);
  return [addDays(today, ivl), ivl, Math.round(ease * 100) / 100, reps, lapses];
}

function itIvlLabel(ivl) { return ivl === 0 ? 'otra vez hoy' : ivl === 1 ? '1 día' : ivl < 30 ? ivl + ' días' : Math.round(ivl / 30) + ' mes' + (Math.round(ivl / 30) > 1 ? 'es' : ''); }

/* ---------- Agenda del día ---------- */

function itToday() {
  const today = nowInfo().date;
  const tasks = [];
  const due = itDueCards(today);
  if (due.length) tasks.push({ kind: 'cards', count: due.length, title: `Repasar ${due.length} tarjeta${due.length === 1 ? '' : 's'}` });
  for (const l of IT_LESSONS) { const r = itL(l); if (r.done && r.rev && r.rev.due <= today) tasks.push({ kind: 'rev', l, title: `Repaso de la lección ${l.n}: ${l.title}` }); }
  for (const w of IT_WEEKS) if (!itBlockDone(w.n) && itBlockLessons(w.n).every(itDone)) tasks.push({ kind: 'block', n: w.n, title: `Examen integral del bloque ${w.n}` });
  const next = IT_LESSONS.find((l) => !itDone(l));
  const proj = itProjection();
  if (next && proj[next.n] === today) tasks.push({ kind: 'lesson', l: next, title: `Lección ${next.n}: ${next.title}` });
  return { tasks, next, nextDate: next ? proj[next.n] : null, due };
}

function itTodayCount() {
  if (!DB || !DB.italian) return 0;
  const st = itSettings();
  if (!itAnyProgress() && nowInfo().date < st.start) return 0;
  return itToday().tasks.length;
}

function itStreak() {
  const r = itRec('log');
  const days = (r && r.d) || {};
  let d = nowInfo().date, n = 0;
  if (!days[d]) d = addDays(d, -1);
  while (days[d]) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------- Audio ---------- */

function itLoadVoice() {
  if (!('speechSynthesis' in window)) return;
  const v = speechSynthesis.getVoices();
  IT.voice = v.find((x) => x.lang === 'it-IT' && /google|alice|federica|luca|elsa/i.test(x.name)) || v.find((x) => x.lang === 'it-IT') || v.find((x) => x.lang && x.lang.toLowerCase().startsWith('it')) || null;
}

function itSpeakable(t) {
  return String(t).replace(/\([^)]*\)/g, '').replace(/(\w)\/[ae]i?\b/g, '$1').replace(/\s*(→|\/|·)\s*/g, ', ').replace(/\.\.\./g, '').replace(/[«»]/g, '').trim();
}

function itUtter(text, rate) {
  const u = new SpeechSynthesisUtterance(itSpeakable(text));
  u.lang = 'it-IT';
  if (IT.voice) u.voice = IT.voice;
  u.rate = rate;
  return u;
}

function itSay(text, slow) {
  if (!('speechSynthesis' in window)) { toast('Este navegador no tiene voz. Probá con Chrome o Safari.', { kind: 'error' }); return; }
  try { speechSynthesis.cancel(); speechSynthesis.speak(itUtter(text, slow ? 0.55 : itSettings().rate)); } catch (e) { /* sin voz */ }
}

function itSayAll(list) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  for (const t of list) speechSynthesis.speak(itUtter(t, itSettings().rate));
}

const ItRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

function itNormalize(s) { return String(s).toLowerCase().replace(/[’`]/g, '\'').replace(/[.,;:!?¡¿«»"()]/g, ' ').replace(/\s+/g, ' ').trim(); }
function itStripAccents(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }

function itLev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function itSimilarity(a, b) {
  a = itStripAccents(itNormalize(a)).replace(/'/g, ' ');
  b = itStripAccents(itNormalize(b)).replace(/'/g, ' ');
  return 1 - itLev(a, b) / (Math.max(a.length, b.length) || 1);
}

function itListen(target, onDone) {
  if (!ItRecognition) { toast('Este navegador no permite reconocer voz. Usá Chrome (compu o Android) o Safari en el iPhone.', { kind: 'error', duration: 7000 }); return; }
  const rec = new ItRecognition();
  rec.lang = 'it-IT';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  let got = false;
  rec.onresult = (e) => {
    got = true;
    let best = { heard: '', score: 0 };
    for (const a of Array.from(e.results[0])) { const sc = itSimilarity(a.transcript, itSpeakable(target)); if (sc >= best.score) best = { heard: a.transcript, score: sc }; }
    onDone({ heard: best.heard, score: best.score, ok: best.score >= 0.8 });
  };
  rec.onerror = (e) => { got = true; onDone({ error: e.error === 'not-allowed' ? 'Permití el micrófono para esta página.' : e.error === 'no-speech' ? 'No te escuché. Tocá 🎤 y hablá enseguida.' : 'No se pudo usar el micrófono.' }); };
  rec.onend = () => { if (!got) onDone({ error: 'No te escuché. Tocá 🎤 y hablá enseguida.' }); };
  try { rec.start(); } catch (e) { onDone({ error: 'No se pudo usar el micrófono.' }); }
}

/* ---------- Piezas de interfaz ---------- */

function itAudioBtns(text, withMic = true) {
  const t = esc(text);
  const r = IT.speech[text];
  const res = r ? `<span class="it-sr ${r.error ? 'is-err' : r.ok ? 'is-ok' : r.score >= 0.6 ? 'is-mid' : 'is-bad'}">${r.error ? esc(r.error) : (r.ok ? '¡Bien! ' : r.score >= 0.6 ? 'Casi. ' : 'Otra vez. ') + 'Escuché: «' + esc(r.heard) + '»'}</span>` : '';
  return `<span class="it-audio"><button class="it-ab" data-it="say" data-t="${t}" title="Escuchar" aria-label="Escuchar">🔊</button><button class="it-ab" data-it="slow" data-t="${t}" title="Lento" aria-label="Escuchar lento">🐢</button>${withMic ? `<button class="it-ab" data-it="mic" data-t="${t}" title="Pronunciá y te corrijo" aria-label="Probar pronunciación">🎤</button>` : ''}</span>${res}`;
}

function itBlock(b) {
  switch (b[0]) {
    case 'p': return `<p class="it-p">${b[1]}</p>`;
    case 'h': return `<h3 class="it-h">${esc(b[1])}</h3>`;
    case 't': return `<div class="it-tip">${icon('info')}<div>${b[1]}</div></div>`;
    case 'v': return `<div class="it-vocab">${b[1].map((v) => `<div class="it-vrow"><div class="it-vtxt"><b lang="it">${esc(v[0])}</b><span>${esc(v[1])}</span>${v[2] ? `<small>${esc(v[2])}</small>` : ''}</div><div class="it-vbtn">${itAudioBtns(v[0])}</div></div>`).join('')}</div>`;
    case 'c': {
      const pr = ['io', 'tu', 'lui / lei', 'noi', 'voi', 'loro'];
      const all = b[2].map((f, i) => (/^(mi|ti|si|ci|vi) /.test(f) ? '' : pr[i].split(' ')[0] + ' ') + f);
      return `<div class="it-conj"><div class="it-conj-head"><b>${esc(b[1])}</b><button class="btn btn-sm" data-it="sayall" data-list="${esc(JSON.stringify(all))}">🔊 Escuchar todo</button></div>
        <table class="tbl"><tbody>${b[2].map((f, i) => `<tr><td class="muted">${pr[i]}</td><td><b lang="it">${esc(f)}</b></td><td class="muted">${esc((b[3] || [])[i] || '')}</td><td class="it-right">${itAudioBtns(all[i])}</td></tr>`).join('')}</tbody></table></div>`;
    }
    case 'd': return `<div class="it-dialog"><div class="it-conj-head"><b>Diálogo</b><button class="btn btn-sm" data-it="sayall" data-list="${esc(JSON.stringify(b[1].map((x) => x[1])))}">🔊 Escuchar el diálogo</button></div>${b[1].map((x) => `<div class="it-line"><span class="it-who">${esc(x[0])}</span><div><b lang="it">${esc(x[1])}</b><span class="muted">${esc(x[2])}</span></div>${itAudioBtns(x[1])}</div>`).join('')}</div>`;
    case 'tb': return `<div class="tbl-wrap it-tb"><table class="tbl"><thead><tr>${b[1].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b[2].map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    default: return '';
  }
}

function itGo(view, extra = {}) {
  Object.assign(IT, { view }, extra);
  if (!['lesson', 'block'].includes(view)) IT.exam = null;
  renderItalian();
  const m = document.getElementById('main');
  if (m) m.scrollTop = 0;
}

function itNav(active) {
  return `<div class="seg" role="group" aria-label="Italiano">
    ${[['home', 'Hoy'], ['plan', 'Plan'], ['topics', 'Temario'], ['config', 'Ajustes']].map(([v, l]) => `<button data-it="go" data-view="${v}" aria-pressed="${active === v}">${l}</button>`).join('')}
  </div>`;
}

/* ---------- Vistas ---------- */

function renderItalian() {
  const el = document.getElementById('sec-italian');
  if (!el) return;
  if (!IT.bound) itBind(el);
  if (!IT.voice) itLoadVoice();
  const v = IT.view;
  el.innerHTML = v === 'lesson' ? itLessonView() : v === 'block' ? itBlockView() : v === 'review' ? itReviewView()
    : v === 'plan' ? itPlanView() : v === 'topics' ? itTopicsView() : v === 'config' ? itConfigView() : itHomeView();
}

function itTaskBtn(t) {
  if (t.kind === 'cards') return `<button class="btn btn-primary" data-it="review">${icon('play')} Repasar</button>`;
  if (t.kind === 'rev') return `<button class="btn btn-primary" data-it="lrev" data-id="${esc(t.l.id)}">${icon('play')} Repasar</button>`;
  if (t.kind === 'block') return `<button class="btn btn-primary" data-it="block" data-n="${t.n}">${icon('play')} Rendir</button>`;
  return `<button class="btn btn-primary" data-it="open" data-n="${t.l.n}">${icon('play')} Empezar</button>`;
}

function itHomeView() {
  const today = nowInfo().date;
  const st = itSettings();
  const lv = itLevel();
  const T = itToday();
  const proj = itProjection();
  const done = IT_LESSONS.filter(itDone).length;
  const cs = itCardStats();
  const scores = IT_LESSONS.map((l) => itL(l).best).filter((x) => x != null);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const last = IT_LESSONS[IT_LESSONS.length - 1];
  const finish = proj[last.n];
  const icons = { cards: 'copy', rev: 'repeat', block: 'target', lesson: 'book' };
  const sub = { cards: 'Lo que tu memoria está por olvidar. Primero esto, siempre.', rev: 'Te costó o pasó tiempo: un mini examen de 5 preguntas.', block: 'Junta todo el bloque. Aprobás con ' + st.pass + '%.', lesson: 'Lección nueva.' };

  let todayHtml;
  if (T.tasks.length) {
    todayHtml = `<div class="it-today">${T.tasks.map((t, i) => `<div class="it-task-row ${i === 0 ? 'is-first' : ''}"><span class="it-task-ic">${icon(icons[t.kind])}</span><div><b>${esc(t.title)}</b><small>${esc(t.kind === 'lesson' ? t.l.goal : sub[t.kind])}</small></div>${itTaskBtn(t)}</div>`).join('')}</div>`;
  } else {
    const n = T.next;
    const before = !itAnyProgress() && today < st.start;
    todayHtml = `<div class="it-hero ${n ? '' : 'is-ok'}"><div><span class="it-when">${before ? 'El plan arranca el ' + esc(fmtDateLong(st.start)) : 'Hoy ya cumpliste'}</span>
      <h2>${n ? (before ? 'Lección 1: ' + esc(n.title) : '¡Listo por hoy! ' + icon('check')) : '¡Terminaste el Módulo 1! ' + icon('check')}</h2>
      <p class="muted">${n ? `Próxima: lección ${n.n}, ${esc(itWhen(T.nextDate).toLowerCase())}. ${before ? 'Si querés arrancar antes, dale: el plan se corre solo.' : 'Si tenés ganas, podés adelantarla.'}` : 'Seguí con las tarjetas todos los días para no olvidar.'}</p></div>
      ${n ? `<div class="it-hero-actions"><button class="btn ${before ? 'btn-primary' : ''}" data-it="open" data-n="${n.n}">${before ? icon('play') + ' Empezar ya' : 'Adelantar la lección ' + n.n}</button></div>` : ''}</div>`;
  }

  return sectionHead('Italiano', itNav('home'), 'Módulo 1 · de cero a A2 · sin fechas fijas: el plan se acomoda a lo que hacés') + todayHtml + `
    <div class="kpis it-kpis">
      <div class="kpi"><span>Lecciones</span><b>${done} <small>/ ${IT_LESSONS.length}</small></b><small>${finish ? 'terminás aprox. el ' + esc(fmtDateShort(finish)) : 'módulo completo'}</small></div>
      <div class="kpi"><span>Racha</span><b>${itStreak()} <small>${itStreak() === 1 ? 'día' : 'días'}</small></b><small>días seguidos con italiano</small></div>
      <div class="kpi"><span>Palabras firmes</span><b>${cs.known} <small>/ ${cs.total}</small></b><small>tarjetas con repaso a 7 días o más</small></div>
      <div class="kpi"><span>Promedio de exámenes</span><b>${avg != null ? avg + '%' : '—'}</b><small>aprobás con ${st.pass}%</small></div>
    </div>
    <div class="block it-level"><h2>${icon('target')} Ritmo: ${IT_LEVELS[lv].name}${st.pace !== 'auto' ? ' · fijado en ' + st.pace + ' por día' : ''}</h2>
      <p>${esc(IT_LEVELS[lv].desc)}</p>
      <div class="it-meter">${[1, 2, 3].map((x) => `<span class="${x <= lv ? 'on' : ''}">${IT_LEVELS[x].name}</span>`).join('')}</div>
      <p class="muted small">Se ajusta solo con lo que respondés al terminar cada lección (difícil, bien o fácil) y con tus notas. Si te resulta fácil, el curso acelera y los exámenes pasan a ser escritos. Si te cuesta, baja el ritmo y suma repasos.</p></div>
    <div class="block it-method"><h2>${icon('help')} Cómo usar esto todos los días</h2>
      <ol><li><b>Primero, las tarjetas</b> (5 a 10 min). Decí la respuesta en voz alta antes de darla vuelta y calificate con honestidad: <i>Otra vez, Difícil, Bien o Fácil</i>. Lo fácil vuelve en semanas; lo difícil, mañana.</li>
      <li><b>Después, la lección</b>: Aprender (🔊 + 🎤), Practicar (cuaderno, pronunciación y tarjetas) y el examen del día. Al aprobarlo, la lección entra a tu mazo de repaso.</li>
      <li><b>Input</b> (10 min, en el colectivo o entrenando): un episodio de <i>Podcast Italiano</i> o <i>Italiano Automatico</i> para principiantes. Entender aunque sea la mitad ya suma.</li></ol>
      <p class="muted small">Por qué en este orden: recordar algo (examen, tarjetas) fija mucho más que releerlo, y repasar justo antes de olvidarlo es lo que hace que no se borre.</p></div>`;
}

function itChip(l, proj) {
  const r = itL(l);
  if (r.done) return `<span class="it-chip is-done">${r.rating != null ? IT_RATINGS[r.rating][0] : 'Hecha'} · ${r.best}%</span>`;
  const d = proj[l.n];
  return `<span class="it-chip ${d === nowInfo().date ? 'is-today' : ''}">${esc(itWhen(d))}</span>`;
}

function itPlanView() {
  const proj = itProjection();
  const blocks = IT_WEEKS.map((w) => {
    const ls = itBlockLessons(w.n);
    const r = itRec('W:' + w.n);
    const ready = ls.every(itDone);
    return `<div class="block it-week">
      <h2><span class="it-wn">Bloque ${w.n}</span> ${esc(w.title)}</h2>
      <p class="muted small">${esc(w.goal)}</p>
      <div class="it-list">${ls.map((l) => `<button class="it-li" data-it="open" data-n="${l.n}"><span class="it-num ${itDone(l) ? 'is-done' : ''}">${l.n}</span><span class="it-lt">${esc(l.title)}</span>${itChip(l, proj)}</button>`).join('')}
      <button class="it-li it-li-exam" data-it="block" data-n="${w.n}"><span class="it-num">★</span><span class="it-lt">Examen integral${r && r.best != null ? `<small>Mejor nota: ${r.best}%</small>` : ''}</span><span class="it-chip ${r && r.done ? 'is-done' : ready ? 'is-today' : ''}">${r && r.done ? 'Aprobado' : ready ? 'Listo para rendir' : 'Al terminar el bloque'}</span></button></div>
    </div>`;
  }).join('');
  return sectionHead('Italiano', itNav('plan'), 'Las fechas son una sugerencia y se recalculan solas: si adelantás, se adelantan; si un día no podés, se corren.') + `<div class="it-weeks">${blocks}</div>`;
}

function itLessonView() {
  const l = itLesson(IT.lesson) || IT_LESSONS[0];
  const proj = itProjection();
  const rec = itL(l);
  const prev = itLesson(l.n - 1), next = itLesson(l.n + 1);
  const steps = [['learn', '1 · Aprender'], ['practice', '2 · Practicar'], ['exam', '3 · Examen del día']];
  let body;
  if (IT.step === 'learn') {
    body = l.blocks.map(itBlock).join('') + `<div class="btn-row"><button class="btn btn-primary" data-it="step" data-step="practice">Ir a practicar ${icon('chevron-right')}</button></div>`;
  } else if (IT.step === 'practice') {
    const tasks = rec.tasks || [];
    body = `<div class="block"><h2>${icon('edit')} En el cuaderno</h2>
        <div class="it-tasks">${l.tasks.map((t, i) => `<label class="it-task"><input type="checkbox" data-it-task="${i}" ${tasks.includes(i) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div></div>
      <div class="block"><h2>${icon('volume')} Pronunciación</h2>
        <p class="muted small">Escuchá con 🔊, tocá 🎤 y decilo. Si sale «¡Bien!», lo pronunciaste claro.</p>
        <div class="it-vocab">${l.speak.map((s) => `<div class="it-vrow"><div class="it-vtxt"><b lang="it">${esc(s)}</b></div><div class="it-vbtn">${itAudioBtns(s)}</div></div>`).join('')}</div>
        ${ItRecognition ? '' : '<p class="it-warn">Este navegador no reconoce voz. Grabate con el celu y compará con el 🔊.</p>'}</div>
      <div class="block"><h2>${icon('copy')} Tarjetas de práctica</h2><p class="muted small">Práctica libre. Cuando apruebes el examen, estas palabras entran a tu repaso diario con intervalos.</p>${itFlashHtml('L:' + l.id, itLessonVocab(l))}</div>
      <div class="btn-row"><button class="btn btn-primary" data-it="step" data-step="exam">Ir al examen del día ${icon('chevron-right')}</button></div>`;
  } else {
    body = itExamHtml({ key: 'L:' + l.id, kind: 'lesson', lessonId: l.id, build: () => l.quiz.map((q) => q.slice()) });
  }
  return `<div class="it-crumbs"><button class="btn btn-ghost btn-sm" data-it="go" data-view="plan">${icon('chevron-left')} Plan</button>
      <span class="spacer"></span>
      ${prev ? `<button class="btn btn-ghost btn-sm" data-it="open" data-n="${prev.n}">${icon('chevron-left')} ${prev.n}</button>` : ''}
      ${next ? `<button class="btn btn-ghost btn-sm" data-it="open" data-n="${next.n}">${next.n} ${icon('chevron-right')}</button>` : ''}</div>
    <header class="it-lhead"><span class="it-when">Lección ${l.n} · Bloque ${l.w} · ${esc(IT_CAT[l.cat])}${rec.done ? '' : ' · sugerida: ' + esc(itWhen(proj[l.n]).toLowerCase())}</span>
      <h1>${esc(l.title)}</h1><p>${esc(l.goal)}</p>
      ${rec.done ? `<span class="it-chip is-done">Completada · ${rec.best}%${rec.rating != null ? ' · ' + IT_RATINGS[rec.rating][0].toLowerCase() : ''}</span>` : ''}</header>
    <div class="seg it-steps" role="group">${steps.map(([k, t]) => `<button data-it="step" data-step="${k}" aria-pressed="${IT.step === k}">${t}</button>`).join('')}</div>
    <div class="it-body">${body}</div>`;
}

function itFlashHtml(key, list) {
  if (!list.length) return '<p class="muted">No hay tarjetas en esta lección.</p>';
  if (!IT.cards || IT.cards.key !== key) IT.cards = { key, list: itShuffle(list), i: 0, flipped: false };
  const c = IT.cards, card = c.list[c.i];
  return `<div class="it-card"><span class="muted small">${c.i + 1} / ${c.list.length} · decilo en voz alta antes de dar vuelta</span>
    <div class="it-card-q">${esc(card.es)}</div>
    <div class="it-card-a" lang="it">${c.flipped ? esc(card.it) : ''}</div>
    <div class="btn-row it-center">${c.flipped ? itAudioBtns(card.it) : '<button class="btn btn-primary" data-it="flip">Dar vuelta</button>'}<button class="btn" data-it="nextcard">Siguiente</button></div></div>`;
}

/* ---------- Sesión de tarjetas (SRS) ---------- */

function itStartReview() {
  const due = itShuffle(itDueCards(nowInfo().date)).slice(0, 80);
  IT.rev = { queue: due, i: 0, shown: false, done: 0, total: due.length };
  itGo('review');
}

function itReviewView() {
  const R = IT.rev;
  const head = `<div class="it-crumbs"><button class="btn btn-ghost btn-sm" data-it="go" data-view="home">${icon('chevron-left')} Hoy</button></div>`;
  if (!R || R.i >= R.queue.length) {
    const more = itDueCards(nowInfo().date).length;
    return head + `<div class="it-hero is-ok"><div><span class="it-when">Repaso</span><h2>¡Tarjetas al día! ${icon('check')}</h2><p class="muted">${R ? `Repasaste ${R.done} tarjeta${R.done === 1 ? '' : 's'}. ` : ''}${more ? `Quedan ${more} para hoy.` : 'Mañana te espera lo que toque según cómo respondiste.'}</p></div>
      <div class="it-hero-actions">${more ? '<button class="btn" data-it="review">Seguir</button>' : ''}<button class="btn btn-primary" data-it="go" data-view="home">Volver a Hoy</button></div></div>`;
  }
  const card = R.queue[R.i];
  const l = itLessonById(card.lid);
  const s = itCardsOf(l)[card.it] || [nowInfo().date, 0, 2.5, 0, 0];
  const today = nowInfo().date;
  const btns = [['Otra vez', 'is-again'], ['Difícil', 'is-hard'], ['Bien', 'is-good'], ['Fácil', 'is-easy']]
    .map(([t, cls], g) => `<button class="it-grade ${cls}" data-it="grade-card" data-g="${g}"><b>${t}</b><small>${itIvlLabel(itSm2(s, g, today)[1])}</small></button>`).join('');
  return head + `<div class="block it-review">
    <div class="it-rev-top"><span class="muted small">Tarjeta ${R.i + 1} de ${R.queue.length} · lección ${card.n}</span><div class="it-prog"><i style="width:${Math.round((R.i / R.queue.length) * 100)}%"></i></div></div>
    <div class="it-card-q">${esc(card.es)}</div>
    <p class="muted small it-center-t">¿Cómo se dice en italiano? Decilo en voz alta.</p>
    ${R.shown ? `<div class="it-card-a" lang="it">${esc(card.it)}</div>${card.note ? `<p class="muted small it-center-t">${esc(card.note)}</p>` : ''}<div class="btn-row it-center">${itAudioBtns(card.it)}</div>
      <div class="it-grades">${btns}</div>` : '<div class="btn-row it-center"><button class="btn btn-primary" data-it="show-card">Mostrar respuesta</button></div>'}
  </div>
  <p class="muted small">Calificate con honestidad: <b>Otra vez</b> = no te salió · <b>Difícil</b> = salió con mucho esfuerzo · <b>Bien</b> = salió · <b>Fácil</b> = salió al instante. Debajo de cada botón ves cuándo vuelve la tarjeta.</p>`;
}

function itGradeCard(g) {
  const R = IT.rev;
  const card = R.queue[R.i];
  const today = nowInfo().date;
  commit((d) => {
    const r = itGet(d, 'C:' + card.lid, 'cards');
    r.c = r.c || {};
    r.c[card.it] = itSm2(r.c[card.it] || [today, 0, 2.5, 0, 0], g, today);
    itLog(d, 'r');
  });
  R.done++;
  if (g === 0) R.queue.push(card);
  R.i++;
  R.shown = false;
  renderItalian();
}

/* ---------- Exámenes ---------- */

function itShuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/* Adapta una pregunta al nivel: en Normal la mitad de las de traducción pasan a escritas; en Intenso, todas, y la escucha pasa a dictado */
function itAdapt(q, lv, i) {
  const toIt = q[0] === 'mc' && /^"/.test(q[1]);
  if (toIt && (lv === 3 || (lv === 2 && i % 2 === 0))) return ['wr', q[1].replace(/\s*(=|en italiano:)\s*$/, '') + ' → escribilo en italiano', [q[2]]];
  if (q[0] === 'ls' && lv === 3) return ['dt', q[1]];
  return q;
}

function itExamHtml(spec) {
  const st = itSettings();
  const lv = itLevel();
  if (!IT.exam || IT.exam.key !== spec.key) {
    const items = spec.build().map((q, i) => itAdapt(q, lv, i)).map((q) => {
      if (q[0] === 'mc' || q[0] === 'ls') return { type: q[0], q: q[1], a: q[2], opts: itShuffle([q[2], ...q[3]]) };
      if (q[0] === 'sp') return { type: 'sp', q: q[1] };
      if (q[0] === 'dt') return { type: 'dt', q: q[1] };
      return { type: 'wr', q: q[1], a: q[2] };
    });
    IT.exam = { key: spec.key, kind: spec.kind, lessonId: spec.lessonId || null, items, answers: {}, result: null, rated: false, lv };
  }
  const ex = IT.exam, res = ex.result;
  const qs = ex.items.map((it, i) => {
    const r = res && res.detail[i];
    let input;
    if (it.type === 'mc' || it.type === 'ls') {
      input = `<div class="it-opts">${it.opts.map((o) => `<label class="it-opt ${r && o === it.a ? 'is-right' : r && o === ex.answers[i] ? 'is-wrong' : ''}"><input type="radio" name="q${i}" value="${esc(o)}" ${ex.answers[i] === o ? 'checked' : ''} ${res ? 'disabled' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    } else if (it.type === 'wr' || it.type === 'dt') {
      input = `<input type="text" class="it-wr" data-q="${i}" value="${esc(ex.answers[i] || '')}" ${res ? 'disabled' : ''} autocomplete="off" autocapitalize="off" spellcheck="false" lang="it" placeholder="${it.type === 'dt' ? 'Escribí lo que escuchás' : 'Escribí en italiano'}">`;
    } else {
      const sr = ex.answers[i];
      input = `<div class="it-sp">${itAudioBtns(it.q, false)}<button class="btn btn-sm" data-it="exmic" data-q="${i}" ${res ? 'disabled' : ''}>🎤 Decilo</button>${sr ? `<span class="it-sr ${sr.ok ? 'is-ok' : 'is-bad'}">${sr.error ? esc(sr.error) : 'Escuché: «' + esc(sr.heard) + '»'}</span>` : ''}</div>`;
    }
    const prompt = it.type === 'ls' ? `${itAudioBtns(it.q, false)} <span class="muted">Escuchá y elegí qué significa.</span>`
      : it.type === 'dt' ? `${itAudioBtns(it.q, false)} <span class="muted">Dictado: escribí en italiano lo que escuchás.</span>`
      : it.type === 'sp' ? `Pronunciá: <b lang="it">${esc(it.q)}</b>` : esc(it.q);
    const right = it.type === 'wr' ? it.a[0] : it.type === 'sp' || it.type === 'dt' ? it.q : it.a;
    const fb = r ? `<div class="it-fb">${r.ok ? '✓ Bien' + (r.note ? ' · ' + esc(r.note) : '') : '✗ Respuesta correcta: <b>' + esc(right) + '</b>'}</div>` : '';
    return `<div class="it-q ${r ? (r.ok ? 'is-ok' : 'is-bad') : ''}"><div class="it-qn">${i + 1}</div><div class="it-qb"><div class="it-qp">${prompt}</div>${input}${fb}</div></div>`;
  }).join('');
  let head;
  if (res) {
    const pass = res.pct >= st.pass;
    const sugg = res.pct >= 90 ? 2 : res.pct >= 75 ? 1 : 0;
    const rateBox = pass && (ex.kind === 'lesson' || ex.kind === 'rev') ? (ex.rated
      ? `<div class="it-rated">${icon('check')} ${esc(ex.rated)}</div>`
      : `<div class="it-rate"><b>¿Cómo te resultó?</b><span class="muted small">Con esto se decide cuándo lo repasás y el ritmo de lo que sigue.</span>
          <div class="it-rate-btns">${IT_RATINGS.map(([t, s], v) => `<button class="btn ${v === sugg ? 'btn-primary' : ''}" data-it="rate" data-v="${v}"><b>${t}</b><small>${s}</small></button>`).join('')}</div></div>`) : '';
    head = `<div class="it-result ${pass ? 'is-ok' : 'is-bad'}"><b>${res.pct}%</b><span>${res.ok} de ${res.total} bien · ${pass ? (ex.kind === 'block' ? '¡Bloque aprobado!' : '¡Aprobado!') : 'Te faltó un poco. Mirá las correcciones y volvé a intentarlo.'}</span><button class="btn" data-it="retry">Rendir de nuevo</button></div>${rateBox}`;
  } else {
    const rec = ex.kind === 'block' ? itRec(ex.key) : ex.lessonId ? itRec('L:' + ex.lessonId) : null;
    head = `<p class="muted">Modo <b>${IT_LEVELS[ex.lv].name}</b> (${IT_LEVELS[ex.lv].exam}). Aprobás con ${st.pass}%.${rec && rec.attempts && ex.kind !== 'rev' ? ` Intentos: ${rec.attempts} · mejor nota: ${rec.best}%.` : ''}</p>`;
  }
  return `<div class="block it-exam">${head}${qs}${res ? '' : '<div class="btn-row"><button class="btn btn-primary" data-it="grade">Corregir</button></div>'}</div>`;
}

function itCheckWritten(given, accepted) {
  const g = itNormalize(given || '');
  if (!g) return { ok: false };
  const list = [];
  for (const a of accepted) { const n = itNormalize(a); list.push(n); const m = n.match(/^(io|tu|lui|lei|noi|voi|loro) (.+)$/); if (m) list.push(m[2]); }
  if (list.includes(g)) return { ok: true };
  if (list.map(itStripAccents).includes(itStripAccents(g))) return { ok: true, note: 'ojo con las tildes' };
  return { ok: false };
}

function itGrade() {
  const ex = IT.exam;
  if (!ex) return;
  itKeepAnswers();
  const detail = ex.items.map((it, i) => {
    const a = ex.answers[i];
    if (it.type === 'mc' || it.type === 'ls') return { ok: a === it.a };
    if (it.type === 'sp') return { ok: !!(a && a.ok) };
    if (it.type === 'dt') { const sc = a ? itSimilarity(a, it.q) : 0; return { ok: sc >= 0.85, note: sc < 1 && sc >= 0.85 ? 'casi exacto' : '' }; }
    return itCheckWritten(a, it.a);
  });
  const ok = detail.filter((d) => d.ok).length;
  const pct = Math.round((ok / detail.length) * 100);
  ex.result = { ok, total: detail.length, pct, detail };
  const pass = pct >= itSettings().pass;
  const today = nowInfo().date;
  let toastMsg = '';
  commit((d) => {
    if (ex.kind === 'rev') { itLog(d, 'x'); return; }
    const r = itGet(d, ex.key, ex.kind);
    const first = pass && !r.done;
    r.attempts = (r.attempts || 0) + 1;
    r.last = pct;
    r.best = Math.max(r.best || 0, pct);
    itLog(d, 'x');
    if (first) {
      r.done = true;
      r.doneAt = today;
      if (ex.kind === 'lesson') {
        itLog(d, 'l');
        const l = itLessonById(ex.lessonId);
        const c = itGet(d, 'C:' + l.id, 'cards');
        c.c = c.c || {};
        for (const v of itLessonVocab(l)) if (!c.c[v.it]) c.c[v.it] = [addDays(today, 1), 0, 2.5, 0, 0];
        r.rev = { due: addDays(today, 3), ivl: 3 };
        toastMsg = '¡Lección completada! Sus palabras entraron al repaso.';
      } else toastMsg = '¡Examen integral aprobado!';
    }
  }, toastMsg ? { toast: toastMsg } : {});
  requestAnimationFrame(() => { const el = document.querySelector('#sec-italian .it-result'); if (el) el.scrollIntoView({ block: 'start' }); });
}

/* Lo que respondés al final (difícil / bien / fácil) define el próximo repaso y el ritmo */
function itRate(v) {
  const ex = IT.exam;
  if (!ex || !ex.lessonId) return;
  const today = nowInfo().date;
  const l = itLessonById(ex.lessonId);
  const pass = ex.result.pct >= itSettings().pass;
  let msg;
  commit((d) => {
    const r = itGet(d, 'L:' + l.id, 'lesson');
    if (ex.kind === 'lesson') {
      r.rating = v;
      const ivl = [1, 3, 7][v];
      r.rev = { due: addDays(today, ivl), ivl };
      const c = itGet(d, 'C:' + l.id, 'cards');
      for (const k in (c.c || {})) {
        const s = c.c[k];
        if (s[3] === 0) { s[2] = [2.3, 2.5, 2.7][v]; s[0] = addDays(today, v === 2 ? 2 : 1); }
      }
      msg = `Repaso de esta lección: ${itIvlLabel(ivl) === '1 día' ? 'mañana' : 'en ' + itIvlLabel(ivl)}.`;
    } else {
      const g = pass ? v : 0;
      const prev = (r.rev && r.rev.ivl) || 1;
      const ivl = Math.min(120, g === 0 ? 1 : g === 1 ? Math.max(prev + 1, Math.round(prev * 2.2)) : Math.max(prev + 2, Math.round(prev * 3)));
      r.rev = { due: addDays(today, ivl), ivl };
      r.revCount = (r.revCount || 0) + 1;
      msg = `Próximo repaso de esta lección: ${ivl === 1 ? 'mañana' : 'en ' + itIvlLabel(ivl)}.`;
    }
  });
  const lv = itLevel();
  const next = IT_LESSONS.find((x) => !itDone(x));
  if (ex.kind === 'lesson' && next) {
    msg += lv === 3 ? ` Vas rápido: el ritmo pasa a Intenso. Si tenés energía, hacé la lección ${next.n} ahora.`
      : lv === 1 ? ` El ritmo baja a Suave: mañana arrancás con el repaso y después la lección ${next.n}.`
      : ` Próxima: lección ${next.n}, ${itWhen(itProjection()[next.n]).toLowerCase()}.`;
  }
  ex.rated = msg;
  renderItalian();
}

function itKeepAnswers() {
  const ex = IT.exam;
  if (!ex || ex.result) return;
  const el = document.getElementById('sec-italian');
  ex.items.forEach((it, i) => {
    if (it.type === 'mc' || it.type === 'ls') { const c = el.querySelector(`input[name=q${i}]:checked`); if (c) ex.answers[i] = c.value; }
    else if (it.type === 'wr' || it.type === 'dt') { const t = el.querySelector(`.it-wr[data-q="${i}"]`); if (t) ex.answers[i] = t.value; }
  });
}

function itLessonReview(id) {
  const l = itLessonById(id);
  IT.exam = null;
  IT.view = 'block';
  IT.block = null;
  IT.revLesson = l.id;
  renderItalian();
  document.getElementById('main').scrollTop = 0;
}

function itBlockView() {
  const head = `<div class="it-crumbs"><button class="btn btn-ghost btn-sm" data-it="go" data-view="home">${icon('chevron-left')} Hoy</button></div>`;
  if (IT.block == null && IT.revLesson) {
    const l = itLessonById(IT.revLesson);
    return head + `<header class="it-lhead"><span class="it-when">Repaso espaciado · lección ${l.n}</span><h1>${esc(l.title)}</h1>
      <p>5 preguntas al azar. Si te sale bien, el próximo repaso se aleja; si te cuesta, vuelve pronto. <button class="btn btn-ghost btn-sm" data-it="open" data-n="${l.n}">Ver la lección</button></p></header>
      ${itExamHtml({ key: 'R:' + l.id, kind: 'rev', lessonId: l.id, build: () => itShuffle(l.quiz).slice(0, 5) })}`;
  }
  const w = IT_WEEKS.find((x) => x.n === IT.block) || IT_WEEKS[0];
  const ls = itBlockLessons(w.n);
  const missing = ls.filter((l) => !itDone(l));
  const build = () => {
    const pool = itShuffle(ls.flatMap((l) => l.quiz)).slice(0, 20);
    const sp = ItRecognition ? itShuffle(ls.flatMap((l) => l.speak)).slice(0, 3).map((s) => ['sp', s]) : [];
    return [...pool, ...sp];
  };
  return head + `<header class="it-lhead"><span class="it-when">Examen integral</span><h1>Bloque ${w.n}: ${esc(w.title)}</h1>
      <p>20 preguntas al azar de las lecciones ${ls[0].n} a ${ls[ls.length - 1].n}${ItRecognition ? ' y 3 frases para pronunciar' : ''}. Cada intento sale distinto.</p></header>
    ${missing.length ? `<div class="it-late">${icon('alert')} <span>Te faltan las lecciones ${missing.map((l) => l.n).join(', ')}. Podés rendir igual, pero conviene terminarlas antes.</span></div>` : ''}
    ${itExamHtml({ key: 'W:' + w.n, kind: 'block', build })}`;
}

function itTopicsView() {
  return sectionHead('Italiano', itNav('topics'), 'Todos los temas del curso, ordenados como en Italiano Sencillo. Tocá uno para ir a su lección.') + `
    <div class="it-topics">${IT_TOPICS.map((c) => `<div class="it-tcol"><div class="it-thead"><span class="it-ticon">${icon(c.icon)}</span><h2>${esc(c.title)}</h2></div>
      <ul>${c.items.map(([t, n]) => n ? `<li><button class="it-tlink" data-it="open" data-n="${n}">${esc(t)}</button>${itDone(itLesson(n)) ? ' <span class="it-ok">✓</span>' : ''}</li>` : `<li class="it-tsoon">${esc(t)} <small>Módulo 2</small></li>`).join('')}</ul></div>`).join('')}</div>`;
}

function itConfigView() {
  const st = itSettings();
  const days = [1, 2, 3, 4, 5, 6, 0];
  return sectionHead('Italiano', itNav('config'), 'Cambiar esto no borra tu progreso: el plan se recalcula.') + `
    <div class="block it-config">
      <label class="field"><span>Arranque sugerido <small>(podés empezar antes cuando quieras)</small></span><input type="date" data-it-set="italianStart" value="${esc(st.start)}"></label>
      <div class="field"><span>Días de estudio</span><div class="it-days">${days.map((d) => `<label class="it-day"><input type="checkbox" data-it-day="${d}" ${st.days.includes(d) ? 'checked' : ''}><span>${DAY_SHORT[d]}</span></label>`).join('')}</div></div>
      <label class="field"><span>Lecciones por día</span><select data-it-set="italianPace">${[['auto', 'Automático según cómo te va'], [1, '1 por día'], [2, '2 por día'], [3, '3 por día']].map(([v, l]) => `<option value="${v}" ${String(st.pace) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Nota para aprobar</span><select data-it-set="italianPass">${[60, 70, 80, 90].map((v) => `<option value="${v}" ${st.pass === v ? 'selected' : ''}>${v}%</option>`).join('')}</select></label>
      <label class="field"><span>Velocidad de la voz</span><select data-it-set="italianRate">${[[0.75, 'Lenta'], [0.9, 'Normal'], [1, 'Rápida']].map(([v, l]) => `<option value="${v}" ${st.rate === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="muted small">Voz italiana: ${IT.voice ? esc(IT.voice.name) : 'no encontré una en este dispositivo. En Android: Ajustes → Texto a voz → instalá italiano. En iPhone: Ajustes → Accesibilidad → Contenido leído → Voces → Italiano.'} · Micrófono: ${ItRecognition ? 'disponible' : 'no disponible en este navegador'}.</p>
      <div class="btn-row"><button class="btn" data-it="testvoice">🔊 Probar la voz</button><button class="btn btn-danger-text" data-it="reset">Borrar mi progreso de italiano</button></div>
    </div>`;
}

/* ---------- Eventos ---------- */

function itBind(el) {
  IT.bound = true;
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', itLoadVoice);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-it]');
    if (!b) return;
    const a = b.dataset.it;
    if (a === 'say') itSay(b.dataset.t);
    else if (a === 'slow') itSay(b.dataset.t, true);
    else if (a === 'sayall') { try { itSayAll(JSON.parse(b.dataset.list)); } catch (err) { /* nada */ } }
    else if (a === 'mic') { const t = b.dataset.t; b.classList.add('is-rec'); b.textContent = '●'; itListen(t, (r) => { IT.speech[t] = r; itKeepAnswers(); renderItalian(); }); }
    else if (a === 'exmic') { const i = Number(b.dataset.q); b.textContent = '● Escuchando…'; itListen(IT.exam.items[i].q, (r) => { itKeepAnswers(); IT.exam.answers[i] = r; renderItalian(); }); }
    else if (a === 'go') itGo(b.dataset.view);
    else if (a === 'open') itGo('lesson', { lesson: Number(b.dataset.n), step: 'learn', cards: null });
    else if (a === 'block') itGo('block', { block: Number(b.dataset.n), revLesson: null });
    else if (a === 'lrev') itLessonReview(b.dataset.id);
    else if (a === 'review') itStartReview();
    else if (a === 'show-card') { IT.rev.shown = true; renderItalian(); itSay(IT.rev.queue[IT.rev.i].it); }
    else if (a === 'grade-card') itGradeCard(Number(b.dataset.g));
    else if (a === 'step') { itKeepAnswers(); IT.step = b.dataset.step; renderItalian(); document.getElementById('main').scrollTop = 0; }
    else if (a === 'flip') { IT.cards.flipped = true; renderItalian(); }
    else if (a === 'nextcard') { IT.cards.i = (IT.cards.i + 1) % IT.cards.list.length; IT.cards.flipped = false; renderItalian(); }
    else if (a === 'grade') itGrade();
    else if (a === 'rate') itRate(Number(b.dataset.v));
    else if (a === 'retry') { IT.exam = null; renderItalian(); document.getElementById('main').scrollTop = 0; }
    else if (a === 'testvoice') itSay('Ciao Danilo! Benvenuto al corso di italiano.');
    else if (a === 'reset') {
      if (await confirmDialog({ title: 'Borrar progreso de italiano', message: 'Se borran las lecciones completadas, las notas, las tarjetas y los repasos. El contenido del curso queda.', confirmText: 'Borrar', danger: true })) {
        commit((d) => { d.italian = []; }, { undo: 'Progreso de italiano borrado' });
      }
    }
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.itTask != null) {
      const l = itLesson(IT.lesson);
      const tasks = new Set(itL(l).tasks || []);
      if (t.checked) tasks.add(Number(t.dataset.itTask)); else tasks.delete(Number(t.dataset.itTask));
      commit((d) => { itGet(d, 'L:' + l.id, 'lesson').tasks = [...tasks].sort(); });
    } else if (t.dataset.itSet) {
      const k = t.dataset.itSet;
      let v = t.value;
      if (k === 'italianStart' && !isYmd(v)) return;
      if (k === 'italianPace') v = v === 'auto' ? 'auto' : Number(v);
      else if (k !== 'italianStart') v = Number(v);
      commit((d) => { d.settings[k] = v; }, { toast: 'Plan actualizado' });
    } else if (t.dataset.itDay != null) {
      const days = [...document.querySelectorAll('#sec-italian [data-it-day]')].filter((x) => x.checked).map((x) => Number(x.dataset.itDay));
      if (!days.length) { toast('Elegí al menos un día.', { kind: 'error' }); t.checked = true; return; }
      commit((d) => { d.settings.italianDays = days; }, { toast: 'Plan actualizado' });
    }
  });
  el.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList.contains('it-wr') && IT.exam) IT.exam.answers[Number(t.dataset.q)] = t.value;
  });
}

/* ---------- Aviso diario al abrir la agenda ---------- */

function itDailyCheck() {
  const today = nowInfo().date;
  const st = itSettings();
  if (!itAnyProgress() && today < st.start) return;
  try { if (localStorage.getItem(IT_DAY_KEY) === today) return; localStorage.setItem(IT_DAY_KEY, today); } catch (e) { /* sin almacenamiento */ }
  const T = itToday();
  if (!T.tasks.length) return;
  const log = (itRec('log') || {}).d || {};
  const y = addDays(today, -1);
  const lines = [];
  if (itAnyProgress() && itIsStudyDay(y) && !log[y]) lines.push('<p>Ayer no hubo italiano. Sin drama: el plan se corrió un día.</p>');
  lines.push(`<p>Para hoy:</p><ul class="it-modal-list">${T.tasks.map((t) => `<li>${esc(t.title)}</li>`).join('')}</ul>`);
  lines.push('<p class="muted small">Empezá por las tarjetas: son las palabras que estás por olvidar.</p>');
  const first = T.tasks[0];
  const m = openModal({
    title: '🇮🇹 Italiano', size: 'sm', body: lines.join(''),
    footer: `<button class="btn" data-later>Más tarde</button><button class="btn btn-primary" data-start>${icon('play')} Empezar</button>`,
  });
  m.el.querySelector('[data-later]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-start]').addEventListener('click', () => {
    m.close();
    showSection('italian');
    if (first.kind === 'cards') itStartReview();
    else if (first.kind === 'rev') itLessonReview(first.l.id);
    else if (first.kind === 'block') itGo('block', { block: first.n, revLesson: null });
    else itGo('lesson', { lesson: first.l.n, step: 'learn', cards: null });
  });
}
