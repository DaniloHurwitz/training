'use strict';
/* Italiano: curso diario con plan por fechas, lecciones con audio y micrófono, examen del día,
   examen integral semanal, temario y aviso diario al abrir la agenda.
   Contenido en italiano-data-1.js e italiano-data-2.js. El progreso vive en DB.italian (se sincroniza). */

const IT = {
  view: 'home',      // home | lesson | week | topics | config
  lesson: 1,
  step: 'learn',     // learn | practice | exam
  week: 1,
  exam: null,        // { key, items, answers, result }
  speech: {},        // resultados del micrófono en esta sesión: {texto: {ok, heard, score}}
  cards: null,       // { key, list, i, flipped }
  voice: null,
  bound: false,
};

const IT_DAY_KEY = 'agendaSemanal:itCheck';
const IT_CAT = { pasos: 'Primeros pasos', verbo: 'El verbo', practico: 'Italiano práctico', gramatica: 'Gramática', glosarios: 'Glosarios' };

/* ---------- Progreso ---------- */

function itRec(id) { return (DB.italian || []).find((r) => r.id === id) || null; }
function itLessonDone(n) { const r = itRec('L' + n); return !!(r && r.done); }
function itWeekDone(w) { const r = itRec('W' + w); return !!(r && r.done); }
function itLesson(n) { return IT_LESSONS.find((l) => l.n === n); }
function itWeekLessons(w) { return IT_LESSONS.filter((l) => l.w === w); }

function itSave(id, patch, opts) {
  commit((d) => {
    d.italian = d.italian || [];
    let r = d.italian.find((x) => x.id === id);
    if (!r) { r = { id }; d.italian.push(r); }
    Object.assign(r, patch);
  }, opts || {});
}

/* ---------- Plan por fechas ---------- */

function itSettings() {
  const s = DB.settings;
  return {
    start: isYmd(s.italianStart) ? s.italianStart : '2026-11-20',
    days: Array.isArray(s.italianDays) && s.italianDays.length ? s.italianDays : [1, 2, 3, 4, 5],
    examDay: Number.isInteger(s.italianExamDay) ? s.italianExamDay : 0,
    pass: Number(s.italianPass) || 70,
    rate: Number(s.italianRate) || 0.9,
  };
}

let itPlanCache = null, itPlanKey = '';
function itPlan() {
  const st = itSettings();
  const key = JSON.stringify(st);
  if (itPlanCache && itPlanKey === key) return itPlanCache;
  const lessons = {}, weeks = {};
  let d = st.start, i = 0, guard = 0;
  while (i < IT_LESSONS.length && guard++ < 1000) {
    if (st.days.includes(weekdayOf(d))) { lessons[IT_LESSONS[i].n] = d; i++; }
    d = addDays(d, 1);
  }
  for (const w of IT_WEEKS) {
    const ls = itWeekLessons(w.n);
    if (!ls.length) continue;
    const last = lessons[ls[ls.length - 1].n];
    let e = addDays(last, 1);
    while (weekdayOf(e) !== st.examDay) e = addDays(e, 1);
    weeks[w.n] = e;
  }
  itPlanCache = { lessons, weeks };
  itPlanKey = key;
  return itPlanCache;
}

/* Todo lo que ya tendría que estar hecho y no está, más lo de hoy */
function itAgenda(today) {
  const p = itPlan();
  const items = [];
  for (const l of IT_LESSONS) items.push({ kind: 'lesson', n: l.n, date: p.lessons[l.n], done: itLessonDone(l.n), title: `Lección ${l.n}: ${l.title}` });
  for (const w of IT_WEEKS) if (p.weeks[w.n]) items.push({ kind: 'week', n: w.n, date: p.weeks[w.n], done: itWeekDone(w.n), title: `Examen integral de la semana ${w.n}` });
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === 'lesson' ? -1 : 1));
  return {
    all: items,
    today: items.filter((x) => x.date === today),
    overdue: items.filter((x) => x.date < today && !x.done),
    next: items.find((x) => !x.done && x.date > today) || null,
  };
}

function itOverdueCount() {
  if (!DB || !DB.italian) return 0;
  return itAgenda(nowInfo().date).overdue.length;
}

function itStreak(today) {
  // Días programados consecutivos (hacia atrás desde hoy o ayer) con su tarea cumplida
  const ag = itAgenda(today).all.filter((x) => x.date <= today);
  const byDate = {};
  for (const x of ag) (byDate[x.date] = byDate[x.date] || []).push(x);
  const dates = Object.keys(byDate).sort().reverse();
  let n = 0;
  for (const d of dates) {
    const ok = byDate[d].every((x) => x.done);
    if (!ok) { if (d === today) continue; break; }
    n++;
  }
  return n;
}

/* ---------- Audio: voz y micrófono ---------- */

function itLoadVoice() {
  if (!('speechSynthesis' in window)) return;
  const v = speechSynthesis.getVoices();
  IT.voice = v.find((x) => x.lang === 'it-IT' && /google|alice|federica|luca|elsa/i.test(x.name)) || v.find((x) => x.lang === 'it-IT') || v.find((x) => x.lang && x.lang.toLowerCase().startsWith('it')) || null;
}

function itSpeakable(t) {
  return String(t)
    .replace(/\([^)]*\)/g, '')
    .replace(/(\w)\/[ae]i?\b/g, '$1')
    .replace(/\s*(→|\/|·)\s*/g, ', ')
    .replace(/\.\.\./g, '')
    .replace(/[«»]/g, '')
    .trim();
}

function itSay(text, slow) {
  if (!('speechSynthesis' in window)) { toast('Este navegador no tiene voz. Probá con Chrome o Safari.', { kind: 'error' }); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(itSpeakable(text));
    u.lang = 'it-IT';
    if (IT.voice) u.voice = IT.voice;
    u.rate = slow ? 0.55 : itSettings().rate;
    speechSynthesis.speak(u);
  } catch (e) { /* sin voz */ }
}

function itSayAll(list) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  for (const t of list) {
    const u = new SpeechSynthesisUtterance(itSpeakable(t));
    u.lang = 'it-IT';
    if (IT.voice) u.voice = IT.voice;
    u.rate = itSettings().rate;
    speechSynthesis.speak(u);
  }
}

const ItRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

function itNormalize(s) {
  return String(s).toLowerCase().replace(/[’`]/g, '\'').replace(/[.,;:!?¡¿«»"()]/g, ' ').replace(/\s+/g, ' ').trim();
}
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
  const L = Math.max(a.length, b.length) || 1;
  return 1 - itLev(a, b) / L;
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
    const alts = Array.from(e.results[0]).map((a) => a.transcript);
    let best = { heard: alts[0] || '', score: 0 };
    for (const h of alts) { const sc = itSimilarity(h, itSpeakable(target)); if (sc > best.score) best = { heard: h, score: sc }; }
    onDone({ heard: best.heard, score: best.score, ok: best.score >= 0.8 });
  };
  rec.onerror = (e) => {
    got = true;
    const msg = e.error === 'not-allowed' ? 'Permití el micrófono para esta página.' : e.error === 'no-speech' ? 'No te escuché. Tocá 🎤 y hablá enseguida.' : 'No se pudo usar el micrófono.';
    onDone({ error: msg });
  };
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
      const all = b[2].map((f, i) => (f.startsWith('mi ') || f.startsWith('ti ') || f.startsWith('si ') || f.startsWith('ci ') || f.startsWith('vi ') ? '' : pr[i].split(' ')[0] + ' ') + f);
      return `<div class="it-conj"><div class="it-conj-head"><b>${esc(b[1])}</b><button class="btn btn-sm" data-it="sayall" data-list="${esc(JSON.stringify(all))}">🔊 Escuchar todo</button></div>
        <table class="tbl"><tbody>${b[2].map((f, i) => `<tr><td class="muted">${pr[i]}</td><td><b lang="it">${esc(f)}</b></td><td class="muted">${esc((b[3] || [])[i] || '')}</td><td class="it-right">${itAudioBtns(all[i])}</td></tr>`).join('')}</tbody></table></div>`;
    }
    case 'd': return `<div class="it-dialog"><div class="it-conj-head"><b>Diálogo</b><button class="btn btn-sm" data-it="sayall" data-list="${esc(JSON.stringify(b[1].map((x) => x[1])))}">🔊 Escuchar el diálogo</button></div>${b[1].map((x) => `<div class="it-line"><span class="it-who">${esc(x[0])}</span><div><b lang="it">${esc(x[1])}</b><span class="muted">${esc(x[2])}</span></div>${itAudioBtns(x[1])}</div>`).join('')}</div>`;
    case 'tb': return `<div class="tbl-wrap it-tb"><table class="tbl"><thead><tr>${b[1].map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b[2].map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    default: return '';
  }
}

function itStatusChip(item, today) {
  if (item.done) return '<span class="it-chip is-done">Hecho</span>';
  if (item.date < today) return '<span class="it-chip is-late">Pendiente</span>';
  if (item.date === today) return '<span class="it-chip is-today">Hoy</span>';
  return `<span class="it-chip">${esc(fmtDateShort(item.date))}</span>`;
}

function itGo(view, extra = {}) {
  Object.assign(IT, { view }, extra);
  if (view !== 'lesson' && view !== 'week') IT.exam = null;
  renderItalian();
  const m = document.getElementById('main');
  if (m) m.scrollTop = 0;
}

/* ---------- Vistas ---------- */

function renderItalian() {
  const el = document.getElementById('sec-italian');
  if (!el) return;
  if (!IT.bound) itBind(el);
  if (!IT.voice) itLoadVoice();
  if (IT.view === 'lesson') el.innerHTML = itLessonView();
  else if (IT.view === 'week') el.innerHTML = itWeekView();
  else if (IT.view === 'topics') el.innerHTML = itTopicsView();
  else if (IT.view === 'config') el.innerHTML = itConfigView();
  else el.innerHTML = itHomeView();
}

function itNav(active) {
  return `<div class="seg" role="group" aria-label="Italiano">
    ${[['home', 'Hoy y plan'], ['topics', 'Temario'], ['config', 'Ajustes']].map(([v, l]) => `<button data-it="go" data-view="${v}" aria-pressed="${active === v}">${l}</button>`).join('')}
  </div>`;
}

function itHomeView() {
  const today = nowInfo().date;
  const st = itSettings();
  const ag = itAgenda(today);
  const p = itPlan();
  const done = IT_LESSONS.filter((l) => itLessonDone(l.n)).length;
  const scores = (DB.italian || []).filter((r) => r.best != null).map((r) => r.best);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const streak = itStreak(today);

  let hero;
  const pendingToday = ag.today.filter((x) => !x.done);
  const first = ag.overdue[0] || pendingToday[0];
  if (today < st.start) {
    hero = `<div class="it-hero"><div><span class="it-when">Arrancás el ${esc(fmtDateLong(st.start))}</span><h2>Lección 1: ${esc(IT_LESSONS[0].title)}</h2><p class="muted">Podés adelantarla cuando quieras. El plan se ajusta en Ajustes.</p></div>
      <div class="it-hero-actions"><button class="btn btn-primary" data-it="open" data-n="1">${icon('play')} Ver la lección 1</button></div></div>`;
  } else if (first) {
    const isWeek = first.kind === 'week';
    const late = first.date < today;
    hero = `<div class="it-hero ${late ? 'is-late' : ''}"><div><span class="it-when">${late ? `Pendiente desde el ${esc(fmtDateLong(first.date))}` : 'Hoy te toca'}</span><h2>${esc(first.title)}</h2>
      <p class="muted">${isWeek ? 'Junta todo lo de la semana. Aprobás con ' + st.pass + '%.' : esc(itLesson(first.n).goal)}</p></div>
      <div class="it-hero-actions"><button class="btn btn-primary" data-it="${isWeek ? 'week' : 'open'}" data-n="${first.n}">${icon('play')} Empezar</button></div></div>`;
  } else if (ag.today.length) {
    hero = `<div class="it-hero is-ok"><div><span class="it-when">Hoy</span><h2>¡Listo por hoy! ${icon('check')}</h2><p class="muted">${ag.next ? 'Lo próximo: ' + esc(ag.next.title) + ', el ' + esc(fmtDateLong(ag.next.date)) + '.' : 'Terminaste el Módulo 1.'}</p></div>
      ${ag.next && ag.next.kind === 'lesson' ? `<div class="it-hero-actions"><button class="btn" data-it="open" data-n="${ag.next.n}">Adelantar la próxima</button></div>` : ''}</div>`;
  } else {
    hero = `<div class="it-hero"><div><span class="it-when">Hoy no hay lección</span><h2>${weekdayOf(today) === 6 ? 'Día de repaso' : 'Día libre'}</h2><p class="muted">Repasá las tarjetas de la semana o escuchá un diálogo.${ag.next ? ' Lo próximo: ' + esc(ag.next.title) + ', el ' + esc(fmtDateLong(ag.next.date)) + '.' : ''}</p></div>
      ${ag.next && ag.next.kind === 'lesson' ? `<div class="it-hero-actions"><button class="btn" data-it="open" data-n="${ag.next.n}">Adelantar la próxima</button></div>` : ''}</div>`;
  }

  const overdueList = ag.overdue.length > 1 ? `<div class="it-late">${icon('alert')} <span>Tenés <b>${ag.overdue.length}</b> pendientes: ${ag.overdue.slice(0, 4).map((x) => esc(x.kind === 'week' ? 'examen semana ' + x.n : 'lección ' + x.n)).join(', ')}${ag.overdue.length > 4 ? '…' : ''}. Hacelos en orden.</span></div>` : '';

  const weeks = IT_WEEKS.map((w) => {
    const ls = itWeekLessons(w.n);
    const wItem = { done: itWeekDone(w.n), date: p.weeks[w.n] };
    const r = itRec('W' + w.n);
    return `<div class="block it-week">
      <h2><span class="it-wn">Semana ${w.n}</span> ${esc(w.title)}</h2>
      <p class="muted small">${esc(w.goal)}</p>
      <div class="it-list">${ls.map((l) => {
        const rec = itRec('L' + l.n);
        return `<button class="it-li" data-it="open" data-n="${l.n}"><span class="it-num">${l.n}</span><span class="it-lt">${esc(l.title)}${rec && rec.best != null ? `<small>Examen: ${rec.best}%</small>` : ''}</span>${itStatusChip({ done: itLessonDone(l.n), date: p.lessons[l.n] }, today)}</button>`;
      }).join('')}
      <button class="it-li it-li-exam" data-it="week" data-n="${w.n}"><span class="it-num">★</span><span class="it-lt">Examen integral${r && r.best != null ? `<small>Mejor nota: ${r.best}%</small>` : ''}</span>${itStatusChip(wItem, today)}</button></div>
    </div>`;
  }).join('');

  return sectionHead('Italiano', itNav('home'), 'Módulo 1 · de cero a A2 · lecciones de lunes a viernes y examen integral el domingo') + hero + overdueList + `
    <div class="kpis it-kpis">
      <div class="kpi"><span>Lecciones</span><b>${done} <small>/ ${IT_LESSONS.length}</small></b><small>${Math.round((done / IT_LESSONS.length) * 100)}% del módulo</small></div>
      <div class="kpi"><span>Racha</span><b>${streak} <small>${streak === 1 ? 'día' : 'días'}</small></b><small>días de plan cumplidos seguidos</small></div>
      <div class="kpi"><span>Promedio de exámenes</span><b>${avg != null ? avg + '%' : '—'}</b><small>aprobás con ${st.pass}%</small></div>
      <div class="kpi"><span>Próximo examen integral</span><b>${(() => { const w = IT_WEEKS.find((x) => !itWeekDone(x.n)); return w ? 'Sem. ' + w.n : '—'; })()}</b><small>${(() => { const w = IT_WEEKS.find((x) => !itWeekDone(x.n)); return w ? esc(fmtDateLong(p.weeks[w.n])) : 'todos aprobados'; })()}</small></div>
    </div>
    <div class="it-weeks">${weeks}</div>
    <div class="block it-method"><h2>${icon('help')} Cómo usar cada lección</h2>
      <ol><li><b>Aprender (15 min):</b> leé la explicación y tocá 🔊 en cada palabra. Repetila en voz alta 3 veces y probá con 🎤.</li>
      <li><b>Practicar (10 min):</b> hacé las tareas en el cuaderno, la práctica de pronunciación y las tarjetas.</li>
      <li><b>Examen del día (5 min):</b> la lección queda completa cuando lo aprobás. Si no llegás, repasá y volvé a rendirlo.</li>
      <li><b>Domingo:</b> examen integral de la semana. El sábado, repaso libre de tarjetas.</li></ol>
      <p class="muted small">El 🎤 funciona en Chrome (compu y Android) y en Safari (iPhone). La primera vez te pide permiso para usar el micrófono.</p></div>`;
}

function itLessonView() {
  const l = itLesson(IT.lesson) || IT_LESSONS[0];
  const today = nowInfo().date;
  const p = itPlan();
  const rec = itRec('L' + l.n) || {};
  const prev = itLesson(l.n - 1), next = itLesson(l.n + 1);
  const steps = [['learn', '1 · Aprender'], ['practice', '2 · Practicar'], ['exam', '3 · Examen del día']];
  let body = '';
  if (IT.step === 'learn') {
    body = l.blocks.map(itBlock).join('') + `<div class="btn-row"><button class="btn btn-primary" data-it="step" data-step="practice">Ir a practicar ${icon('chevron-right')}</button></div>`;
  } else if (IT.step === 'practice') {
    const tasks = rec.tasks || [];
    body = `<div class="block"><h2>${icon('edit')} En el cuaderno</h2>
        <div class="it-tasks">${l.tasks.map((t, i) => `<label class="it-task"><input type="checkbox" data-it-task="${i}" ${tasks.includes(i) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div></div>
      <div class="block"><h2>${icon('volume')} Pronunciación</h2>
        <p class="muted small">Escuchá con 🔊, después tocá 🎤 y decilo. Te digo qué entendí. Si sale «¡Bien!», lo pronunciaste claro.</p>
        <div class="it-vocab">${l.speak.map((s) => `<div class="it-vrow"><div class="it-vtxt"><b lang="it">${esc(s)}</b></div><div class="it-vbtn">${itAudioBtns(s)}</div></div>`).join('')}</div>
        ${ItRecognition ? '' : '<p class="it-warn">Este navegador no reconoce voz. Grabate con el celu y compará con el 🔊.</p>'}</div>
      <div class="block"><h2>${icon('copy')} Tarjetas</h2>${itCardsHtml('L' + l.n, itLessonVocab(l))}</div>
      <div class="btn-row"><button class="btn btn-primary" data-it="step" data-step="exam">Ir al examen del día ${icon('chevron-right')}</button></div>`;
  } else {
    body = itExamHtml('L' + l.n, () => l.quiz.map((q) => q.slice()));
  }
  return `<div class="it-crumbs"><button class="btn btn-ghost btn-sm" data-it="go" data-view="home">${icon('chevron-left')} Plan</button>
      <span class="spacer"></span>
      ${prev ? `<button class="btn btn-ghost btn-sm" data-it="open" data-n="${prev.n}">${icon('chevron-left')} Lección ${prev.n}</button>` : ''}
      ${next ? `<button class="btn btn-ghost btn-sm" data-it="open" data-n="${next.n}">Lección ${next.n} ${icon('chevron-right')}</button>` : ''}</div>
    <header class="it-lhead"><span class="it-when">Lección ${l.n} · Semana ${l.w} · ${esc(IT_CAT[l.cat])} · ${esc(fmtDateLong(p.lessons[l.n]))}</span>
      <h1>${esc(l.title)}</h1><p>${esc(l.goal)}</p>
      ${rec.done ? `<span class="it-chip is-done">Completada · ${rec.best}%</span>` : p.lessons[l.n] < today ? '<span class="it-chip is-late">Pendiente</span>' : ''}</header>
    <div class="seg it-steps" role="group">${steps.map(([k, t]) => `<button data-it="step" data-step="${k}" aria-pressed="${IT.step === k}">${t}</button>`).join('')}</div>
    <div class="it-body">${body}</div>`;
}

function itLessonVocab(l) {
  const out = [];
  for (const b of l.blocks) if (b[0] === 'v') for (const v of b[1]) if (v[1] && !/^[A-Z]$/.test(v[1])) out.push([v[1], v[0]]);
  return out;
}

function itCardsHtml(key, list) {
  if (!list.length) return '<p class="muted">No hay tarjetas en esta lección.</p>';
  if (!IT.cards || IT.cards.key !== key) IT.cards = { key, list: list.slice().sort(() => Math.random() - 0.5), i: 0, flipped: false };
  const c = IT.cards;
  const card = c.list[c.i];
  return `<div class="it-card"><span class="muted small">${c.i + 1} / ${c.list.length} · decilo en voz alta antes de dar vuelta</span>
    <div class="it-card-q">${esc(card[0])}</div>
    <div class="it-card-a" lang="it">${c.flipped ? esc(card[1]) : ''}</div>
    <div class="btn-row it-center">${c.flipped ? itAudioBtns(card[1]) : '<button class="btn btn-primary" data-it="flip">Dar vuelta</button>'}<button class="btn" data-it="nextcard">Siguiente</button></div></div>`;
}

/* ---------- Exámenes ---------- */

function itShuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

function itExamHtml(key, build) {
  const st = itSettings();
  if (!IT.exam || IT.exam.key !== key) {
    const items = build().map((q) => {
      if (q[0] === 'mc' || q[0] === 'ls') return { type: q[0], q: q[1], a: q[2], opts: itShuffle([q[2], ...q[3]]) };
      if (q[0] === 'sp') return { type: 'sp', q: q[1] };
      return { type: 'wr', q: q[1], a: q[2] };
    });
    IT.exam = { key, items, answers: {}, result: null };
  }
  const ex = IT.exam;
  const res = ex.result;
  const rec = itRec(key);
  const qs = ex.items.map((it, i) => {
    const r = res && res.detail[i];
    const cls = r ? (r.ok ? 'is-ok' : 'is-bad') : '';
    let input;
    if (it.type === 'mc' || it.type === 'ls') {
      input = `<div class="it-opts">${it.opts.map((o) => `<label class="it-opt ${r && o === it.a ? 'is-right' : r && o === ex.answers[i] ? 'is-wrong' : ''}"><input type="radio" name="q${i}" value="${esc(o)}" ${ex.answers[i] === o ? 'checked' : ''} ${res ? 'disabled' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`;
    } else if (it.type === 'wr') {
      input = `<input type="text" class="it-wr" data-q="${i}" value="${esc(ex.answers[i] || '')}" ${res ? 'disabled' : ''} autocomplete="off" autocapitalize="off" spellcheck="false" lang="it" placeholder="Escribí en italiano">`;
    } else {
      const sr = ex.answers[i];
      input = `<div class="it-sp">${itAudioBtns(it.q, false)}<button class="btn btn-sm" data-it="exmic" data-q="${i}" ${res ? 'disabled' : ''}>🎤 Decilo</button>${sr ? `<span class="it-sr ${sr.ok ? 'is-ok' : 'is-bad'}">${sr.error ? esc(sr.error) : 'Escuché: «' + esc(sr.heard) + '»'}</span>` : ''}</div>`;
    }
    const prompt = it.type === 'ls' ? `${itAudioBtns(it.q, false)} <span class="muted">Escuchá y elegí qué significa.</span>` : it.type === 'sp' ? `Pronunciá: <b lang="it">${esc(it.q)}</b>` : esc(it.q);
    const fb = r ? `<div class="it-fb">${r.ok ? '✓ Bien' + (r.note ? ' · ' + esc(r.note) : '') : '✗ Respuesta correcta: <b>' + esc(it.type === 'wr' ? it.a[0] : it.type === 'sp' ? it.q : it.a) + '</b>'}</div>` : '';
    return `<div class="it-q ${cls}"><div class="it-qn">${i + 1}</div><div class="it-qb"><div class="it-qp">${prompt}</div>${input}${fb}</div></div>`;
  }).join('');
  const head = res
    ? `<div class="it-result ${res.pct >= st.pass ? 'is-ok' : 'is-bad'}"><b>${res.pct}%</b><span>${res.ok} de ${res.total} bien · ${res.pct >= st.pass ? '¡Aprobado! Quedó registrado.' : 'Te faltó poco. Repasá lo que marqué y volvé a intentarlo.'}</span>
       <button class="btn" data-it="retry">Rendir de nuevo</button></div>`
    : `<p class="muted">Aprobás con ${st.pass}%. ${rec && rec.attempts ? `Intentos: ${rec.attempts} · mejor nota: ${rec.best}%.` : ''}</p>`;
  return `<div class="block it-exam">${head}${qs}${res ? '' : '<div class="btn-row"><button class="btn btn-primary" data-it="grade">Corregir</button></div>'}</div>`;
}

function itGrade() {
  const ex = IT.exam;
  if (!ex) return;
  const el = document.getElementById('sec-italian');
  ex.items.forEach((it, i) => {
    if (it.type === 'mc' || it.type === 'ls') { const c = el.querySelector(`input[name=q${i}]:checked`); ex.answers[i] = c ? c.value : ''; }
    else if (it.type === 'wr') { const t = el.querySelector(`.it-wr[data-q="${i}"]`); ex.answers[i] = t ? t.value : ''; }
  });
  const detail = ex.items.map((it, i) => {
    const a = ex.answers[i];
    if (it.type === 'mc' || it.type === 'ls') return { ok: a === it.a };
    if (it.type === 'sp') return { ok: !!(a && a.ok) };
    const given = itNormalize(a || '');
    const good = it.a.map(itNormalize);
    if (good.includes(given)) return { ok: true };
    if (given && good.map(itStripAccents).includes(itStripAccents(given))) return { ok: true, note: 'ojo con las tildes' };
    return { ok: false };
  });
  const ok = detail.filter((d) => d.ok).length;
  const total = detail.length;
  const pct = Math.round((ok / total) * 100);
  ex.result = { ok, total, pct, detail };
  const rec = itRec(ex.key) || {};
  const pass = pct >= itSettings().pass;
  const patch = { kind: ex.key[0] === 'W' ? 'week' : 'lesson', attempts: (rec.attempts || 0) + 1, last: pct, best: Math.max(rec.best || 0, pct) };
  if (pass && !rec.done) { patch.done = true; patch.doneAt = nowInfo().date; }
  itSave(ex.key, patch, pass && !rec.done ? { toast: ex.key[0] === 'W' ? '¡Examen integral aprobado!' : '¡Lección completada!' } : {});
  requestAnimationFrame(() => { const r = document.querySelector('#sec-italian .it-result'); if (r) r.scrollIntoView({ block: 'start' }); });
}

function itWeekView() {
  const w = IT_WEEKS.find((x) => x.n === IT.week) || IT_WEEKS[0];
  const ls = itWeekLessons(w.n);
  const missing = ls.filter((l) => !itLessonDone(l.n));
  const build = () => {
    const pool = itShuffle(ls.flatMap((l) => l.quiz)).slice(0, 20);
    const sp = ItRecognition ? itShuffle(ls.flatMap((l) => l.speak)).slice(0, 3).map((s) => ['sp', s]) : [];
    return [...pool, ...sp];
  };
  return `<div class="it-crumbs"><button class="btn btn-ghost btn-sm" data-it="go" data-view="home">${icon('chevron-left')} Plan</button></div>
    <header class="it-lhead"><span class="it-when">Examen integral · ${esc(fmtDateLong(itPlan().weeks[w.n]))}</span><h1>Semana ${w.n}: ${esc(w.title)}</h1>
      <p>20 preguntas al azar de las lecciones ${ls[0].n} a ${ls[ls.length - 1].n}${ItRecognition ? ' y 3 frases para pronunciar' : ''}. Cada intento sale distinto.</p></header>
    ${missing.length ? `<div class="it-late">${icon('alert')} <span>Te faltan las lecciones ${missing.map((l) => l.n).join(', ')}. Podés rendir igual, pero conviene terminarlas antes.</span></div>` : ''}
    ${itExamHtml('W' + w.n, build)}`;
}

function itTopicsView() {
  const today = nowInfo().date;
  const p = itPlan();
  return sectionHead('Italiano', itNav('topics'), 'Todos los temas del curso, ordenados como en Italiano Sencillo. Tocá uno para ir a su lección.') + `
    <div class="it-topics">${IT_TOPICS.map((c) => `<div class="it-tcol"><div class="it-thead"><span class="it-ticon">${icon(c.icon)}</span><h2>${esc(c.title)}</h2></div>
      <ul>${c.items.map(([t, n]) => n ? `<li><button class="it-tlink" data-it="open" data-n="${n}">${esc(t)}</button>${itLessonDone(n) ? ' <span class="it-ok">✓</span>' : p.lessons[n] < today ? ' <span class="it-dot-late" title="Pendiente"></span>' : ''}</li>` : `<li class="it-tsoon">${esc(t)} <small>Módulo 2</small></li>`).join('')}</ul></div>`).join('')}</div>`;
}

function itConfigView() {
  const st = itSettings();
  const days = [1, 2, 3, 4, 5, 6, 0];
  return sectionHead('Italiano', itNav('config'), 'El plan se recalcula solo: cambiar la fecha o los días no borra tu progreso.') + `
    <div class="block it-config">
      <label class="field"><span>Fecha de inicio</span><input type="date" data-it-set="italianStart" value="${esc(st.start)}"></label>
      <div class="field"><span>Días de lección</span><div class="it-days">${days.map((d) => `<label class="it-day"><input type="checkbox" data-it-day="${d}" ${st.days.includes(d) ? 'checked' : ''}><span>${DAY_SHORT[d]}</span></label>`).join('')}</div></div>
      <label class="field"><span>Día del examen integral</span><select data-it-set="italianExamDay">${days.map((d) => `<option value="${d}" ${st.examDay === d ? 'selected' : ''}>${DAY_NAMES[d]}</option>`).join('')}</select></label>
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
    else if (a === 'mic') {
      const t = b.dataset.t;
      b.classList.add('is-rec');
      b.textContent = '●';
      itListen(t, (r) => { IT.speech[t] = r; renderItalian(); });
    } else if (a === 'exmic') {
      const i = Number(b.dataset.q);
      b.textContent = '● Escuchando…';
      itListen(IT.exam.items[i].q, (r) => { IT.exam.answers[i] = r; itKeepAnswers(); renderItalian(); });
    } else if (a === 'go') itGo(b.dataset.view);
    else if (a === 'open') itGo('lesson', { lesson: Number(b.dataset.n), step: 'learn', cards: null });
    else if (a === 'week') itGo('week', { week: Number(b.dataset.n) });
    else if (a === 'step') { if (IT.step === 'exam' || b.dataset.step === 'exam') itKeepAnswers(); IT.step = b.dataset.step; renderItalian(); document.getElementById('main').scrollTop = 0; }
    else if (a === 'flip') { IT.cards.flipped = true; renderItalian(); }
    else if (a === 'nextcard') { IT.cards.i = (IT.cards.i + 1) % IT.cards.list.length; IT.cards.flipped = false; renderItalian(); }
    else if (a === 'grade') itGrade();
    else if (a === 'retry') { IT.exam = null; renderItalian(); document.getElementById('main').scrollTop = 0; }
    else if (a === 'testvoice') itSay('Ciao Danilo! Benvenuto al corso di italiano.');
    else if (a === 'reset') {
      if (await confirmDialog({ title: 'Borrar progreso de italiano', message: 'Se borran las lecciones completadas, las notas y las tareas tildadas. El contenido del curso queda.', confirmText: 'Borrar', danger: true })) {
        commit((d) => { d.italian = []; }, { undo: 'Progreso de italiano borrado' });
      }
    }
  });
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.itTask != null) {
      const i = Number(t.dataset.itTask);
      const rec = itRec('L' + IT.lesson) || {};
      const tasks = new Set(rec.tasks || []);
      if (t.checked) tasks.add(i); else tasks.delete(i);
      itSave('L' + IT.lesson, { kind: 'lesson', tasks: [...tasks].sort() });
    } else if (t.dataset.itSet) {
      const k = t.dataset.itSet;
      let v = t.value;
      if (k === 'italianStart' && !isYmd(v)) return;
      if (k !== 'italianStart') v = Number(v);
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

/* Guarda lo marcado en el examen antes de volver a dibujar */
function itKeepAnswers() {
  const ex = IT.exam;
  if (!ex || ex.result) return;
  const el = document.getElementById('sec-italian');
  ex.items.forEach((it, i) => {
    if (it.type === 'mc' || it.type === 'ls') { const c = el.querySelector(`input[name=q${i}]:checked`); if (c) ex.answers[i] = c.value; }
    else if (it.type === 'wr') { const t = el.querySelector(`.it-wr[data-q="${i}"]`); if (t) ex.answers[i] = t.value; }
  });
}

/* ---------- Aviso diario al abrir la agenda ---------- */

function itDailyCheck() {
  const today = nowInfo().date;
  const st = itSettings();
  if (today < st.start) return;
  try { if (localStorage.getItem(IT_DAY_KEY) === today) return; localStorage.setItem(IT_DAY_KEY, today); } catch (e) { /* sin almacenamiento */ }
  const ag = itAgenda(today);
  const pendingToday = ag.today.filter((x) => !x.done);
  if (!ag.overdue.length && !pendingToday.length) return;
  const first = ag.overdue[0] || pendingToday[0];
  const lines = [];
  if (ag.overdue.length) lines.push(`<p>Te ${ag.overdue.length === 1 ? 'quedó pendiente' : 'quedaron pendientes'}: <b>${ag.overdue.map((x) => esc(x.kind === 'week' ? 'el examen integral de la semana ' + x.n : 'la lección ' + x.n)).join(', ')}</b>.</p>`);
  if (pendingToday.length) lines.push(`<p>Hoy te toca: <b>${pendingToday.map((x) => esc(x.title)).join(' y ')}</b>.</p>`);
  if (ag.overdue.length) lines.push('<p class="muted small">Arrancá por la más vieja: cada lección se apoya en la anterior.</p>');
  const m = openModal({
    title: '🇮🇹 Italiano', size: 'sm',
    body: lines.join(''),
    footer: `<button class="btn" data-later>Más tarde</button><button class="btn btn-primary" data-start>${icon('play')} Empezar ${first.kind === 'week' ? 'el examen' : 'la lección ' + first.n}</button>`,
  });
  m.el.querySelector('[data-later]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-start]').addEventListener('click', () => {
    m.close();
    if (first.kind === 'week') { IT.view = 'week'; IT.week = first.n; } else { IT.view = 'lesson'; IT.lesson = first.n; IT.step = 'learn'; }
    showSection('italian');
  });
}
