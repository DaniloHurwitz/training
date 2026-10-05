'use strict';
/* Entrenamiento: rutinas, registro de series, modo entrenamiento con descanso, semana y progreso.
   Las rutinas por defecto salen de FitHome (Pull, Push, Piernas, Upper) más un Full body para arrancar. */

const DEFAULT_ROUTINES = [
  { id: 'rt-full', name: 'Full body', focus: 'Cuerpo completo · para arrancar', color: '#2f8f62', exercises: [
    { id: 'ex-full-1', name: 'Flexiones', sets: 3, reps: '8-12', rest: 60,
      guide: 'Manos a la altura de los hombros, cuerpo recto como tabla. Bajá el pecho hasta casi tocar el piso y subí. Si no llegás a 8, apoyá las manos en la mesa o en la cama.' },
    { id: 'ex-full-2', name: 'Remo invertido (bajo la mesa)', sets: 3, reps: '8-12', rest: 60,
      guide: 'Acostate debajo de una mesa firme, agarrá el borde y mantené el cuerpo recto. Tirá del pecho hacia la mesa y bajá con control. Es el que más hace crecer espalda y brazos.' },
    { id: 'ex-full-3', name: 'Sentadillas', sets: 3, reps: '15-20', rest: 60,
      guide: 'Pies al ancho de los hombros. Bajá como si te sentaras en una silla, pecho arriba y rodillas en línea con los pies. Subí empujando con los talones.' },
    { id: 'ex-full-4', name: 'Fondos en silla', sets: 3, reps: '8-12', rest: 60,
      guide: 'Sentate al borde de la silla con las manos al lado de la cadera. Deslizá el cuerpo hacia adelante y bajá doblando los codos hacia atrás, no hacia los costados. Subí con fuerza de tríceps.' },
    { id: 'ex-full-5', name: 'Curl con mochila', sets: 3, reps: '10-15', rest: 60,
      guide: 'Llená una mochila con libros. De pie, codos pegados al cuerpo, llevá la mochila hacia los hombros y bajá despacio.' },
    { id: 'ex-full-6', name: 'Plancha', sets: 3, reps: '30 seg', rest: 45,
      guide: 'Apoyado en los antebrazos, cuerpo recto de la cabeza a los talones. Apretá abdomen y glúteos. No dejes caer la cadera.' },
  ] },
  { id: 'rt-pull', name: 'Pull', focus: 'Espalda + bíceps + core', color: '#2a78d6', exercises: [
    { id: 'ex-fh-1', name: 'Remo invertido (bajo mesa o entre sillas)', sets: 4, reps: '10-15', rest: 90,
      guide: 'Ponete bajo una mesa o entre dos sillas. Agarrá el borde y mantené el cuerpo recto. Tirá del pecho hacia arriba manteniendo el core activado. Bajá con control.' },
    { id: 'ex-fh-2', name: 'Superman hold o Y raises', sets: 3, reps: '12-15', rest: 60,
      guide: 'Acostate boca abajo. Levantá brazos y piernas del piso formando una Y. Mantené tensión en la espalda baja. Si podés, usá una mochila en la nuca para más resistencia.' },
    { id: 'ex-fh-3', name: 'Curl bíceps con mochila', sets: 4, reps: '12-15', rest: 60,
      guide: 'Llená una mochila con libros o botellas de agua. De pie, con la mochila en las manos, flexioná los codos llevando la mochila hacia los hombros. Mantené los codos pegados al cuerpo. Bajá con control.' },
    { id: 'ex-fh-4', name: 'Curl isométrico con toalla', sets: 3, reps: '20-30 seg', rest: 60,
      guide: 'Poné un pie sobre una toalla. Con las manos, tirá de la toalla hacia arriba mientras el pie empuja hacia abajo. Mantené la tensión máxima en los bíceps durante todo el tiempo.' },
    { id: 'ex-fh-5', name: 'Plancha', sets: 3, reps: '45-60 seg', rest: 60,
      guide: 'Posición de tabla sobre los antebrazos. Cuerpo completamente recto de cabeza a talones. Apretá el core, glúteos y piernas. No dejes caer la cadera.' },
  ] },
  { id: 'rt-push', name: 'Push', focus: 'Pecho + tríceps + hombros', color: '#e34948', exercises: [
    { id: 'ex-fh-6', name: 'Flexiones normales', sets: 4, reps: '10-15', rest: 90,
      guide: 'Manos a la altura de los hombros. Cuerpo recto como tabla. Bajá el pecho hasta casi tocar el piso. Mantené los codos a 45 grados. Subí con explosividad.' },
    { id: 'ex-fh-7', name: 'Flexiones inclinadas (manos en silla)', sets: 3, reps: '12', rest: 60,
      guide: 'Poné las manos sobre el asiento de una silla, pies en el piso. Bajá el pecho hacia la silla. Esto enfatiza el pecho superior. Mantené el core apretado.' },
    { id: 'ex-fh-8', name: 'Fondos en silla (tríceps)', sets: 4, reps: '8-12', rest: 90,
      guide: 'Sentate al borde de la silla. Manos al lado de las caderas. Deslizá el cuerpo hacia adelante y bajá flexionando los codos hacia atrás. Los codos deben ir hacia atrás, no a los lados. Subí con fuerza de tríceps.' },
    { id: 'ex-fh-9', name: 'Pike push-ups (hombros)', sets: 4, reps: '8-12', rest: 90,
      guide: 'Posición de V invertida. Manos y pies en el piso, cadera arriba. Bajá la cabeza hacia el piso flexionando los codos. Subí. Esto trabaja hombros de forma vertical.' },
    { id: 'ex-fh-10', name: 'Extensión tríceps overhead', sets: 3, reps: '12-15', rest: 60,
      guide: 'De pie o sentado. Mochila con peso sobre la cabeza, agarrada con ambas manos. Bajá la mochila detrás de la cabeza flexionando solo los codos. Mantené los codos pegados a la cabeza. Subí extendiendo los brazos.' },
  ] },
  { id: 'rt-legs', name: 'Piernas + core', focus: 'Piernas y abdomen', color: '#eda100', exercises: [
    { id: 'ex-fh-11', name: 'Sentadillas con pausa', sets: 4, reps: '12-15', rest: 120,
      guide: 'Pies al ancho de hombros. Bajá como si te sentaras en una silla. Mantené 2 segundos abajo. El pecho arriba, rodillas alineadas con los pies. Subí empujando con los talones.' },
    { id: 'ex-fh-12', name: 'Sentadilla búlgara (pie trasero en silla)', sets: 3, reps: '10-12', rest: 90,
      guide: 'Poné un pie sobre una silla detrás tuyo. El otro pie adelante. Bajá flexionando la rodilla delantera hasta casi tocar el piso con la trasera. Mantené el torso vertical. Subí con fuerza de la pierna delantera.' },
    { id: 'ex-fh-13', name: 'Zancadas', sets: 3, reps: '10 por pierna', rest: 90,
      guide: 'Da un paso largo hacia adelante. Bajá la rodilla trasera hacia el piso. La rodilla delantera no debe pasar la punta del pie. Subí y repetí con la otra pierna.' },
    { id: 'ex-fh-14', name: 'Puente glúteo una pierna', sets: 3, reps: '12-15 por lado', rest: 60,
      guide: 'Acostado boca arriba, rodillas flexionadas. Levantá una pierna extendida. Empujá con el talón de la pierna en el piso para elevar la cadera. Apretá el glúteo arriba. Bajá con control.' },
    { id: 'ex-fh-15', name: 'Gemelos', sets: 4, reps: '15-20', rest: 60,
      guide: 'De pie, subí sobre las puntas de los pies lo más alto posible. Mantené arriba 1 segundo. Bajá con control. Para más dificultad, hacelo en un escalón o con mochila.' },
    { id: 'ex-fh-16', name: 'Elevaciones de piernas', sets: 3, reps: '12-15', rest: 60,
      guide: 'Acostado boca arriba, manos bajo los glúteos. Piernas extendidas. Levantá las piernas hasta 90 grados. Bajá con control sin tocar el piso. Mantené la zona lumbar pegada al piso.' },
    { id: 'ex-fh-17', name: 'Plancha RKC (máxima tensión)', sets: 3, reps: '40-60 seg', rest: 60,
      guide: 'Plancha normal pero con tensión corporal total. Apretá glúteos, cuádriceps, core y dorsales. Empujá los codos hacia los pies (sin moverlos). Máxima activación.' },
  ] },
  { id: 'rt-upper', name: 'Upper + brazos', focus: 'Torso + brazos + core', color: '#4a3aa7', exercises: [
    { id: 'ex-fh-18', name: 'Flexiones diamante o cerradas', sets: 4, reps: '10-12', rest: 90,
      guide: 'Manos muy juntas formando un diamante con los dedos índice y pulgar. Bajá manteniendo los codos pegados al cuerpo. Esto trabaja tríceps y pecho interno intensamente.' },
    { id: 'ex-fh-19', name: 'Fondos en silla', sets: 3, reps: '10-12', rest: 90,
      guide: 'Igual que en el día push. Manos en el borde de la silla, codos hacia atrás. Bajá y subí con control. Enfoque en tríceps.' },
    { id: 'ex-fh-20', name: 'Curl bíceps mochila', sets: 4, reps: '12-15', rest: 60,
      guide: 'Con mochila cargada. Brazos extendidos. Flexioná llevando la mochila hacia los hombros. Control total en subida y bajada. Apretá el bíceps arriba.' },
    { id: 'ex-fh-21', name: 'Pike push-ups', sets: 3, reps: '10', rest: 90,
      guide: 'Posición de V invertida. Bajá la cabeza hacia el piso con control. Trabaja hombros. Mantené las piernas lo más rectas posible.' },
    { id: 'ex-fh-22', name: 'Bicycle crunches', sets: 4, reps: '15 por lado', rest: 60,
      guide: 'Acostado boca arriba, manos en la nuca. Llevá el codo derecho a la rodilla izquierda mientras extendés la pierna derecha. Alterná en movimiento de bicicleta. Controlá el movimiento.' },
    { id: 'ex-fh-23', name: 'Plancha lateral', sets: 3, reps: '30-45 seg por lado', rest: 60,
      guide: 'De lado, apoyado en un antebrazo. Cuerpo completamente recto. Apretá el oblicuo del lado de apoyo. Mantené la cadera alta. No dejes caer el cuerpo.' },
    { id: 'ex-fh-24', name: 'Vacuum abdominal', sets: 4, reps: '10 seg', rest: 45,
      guide: 'De pie o boca abajo. Expulsá todo el aire. Meté el abdomen hacia dentro todo lo posible, como si quisieras tocar la columna. Mantené 10 segundos. Respirá y repetí.' },
  ] },
];
const TRAIN_DRAFT_KEY = 'agendaSemanal:trainDraft:v1';

/* Carga las rutinas iniciales una sola vez por dispositivo. Los ids son fijos para que
   dos dispositivos sincronizados no las dupliquen. Devuelve true si cambió algo. */
function seedDefaultRoutines(d) {
  if (d.meta.routinesSeeded) return false;
  d.meta.routinesSeeded = true;
  if (!d.routines.length) d.routines = deepClone(DEFAULT_ROUTINES).map((r, i) => Object.assign(r, { order: i }));
  return true;
}

/* ---------- Acceso y cálculos ---------- */

function getRoutine(id) { return id ? DB.routines.find((r) => r.id === id) || null : null; }

function sortedRoutines() {
  return DB.routines.slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name, 'es'));
}

function routineOptions(sel) {
  const list = sortedRoutines().map((r) => [r.id, r.name]);
  if (sel && !getRoutine(sel)) list.unshift([sel, 'Rutina eliminada']);
  return `<option value="">— Elegí una rutina —</option>` + opts(list, sel);
}

/* "10-12" → 10 repeticiones; "30 seg" → 30 segundos */
function parseTarget(reps) {
  const str = String(reps || '');
  const m = str.match(/\d+/);
  return { low: m ? Number(m[0]) : null, unit: /seg|s\b/i.test(str) ? 'seg' : 'reps' };
}

function routineMinutes(rt, light) {
  let sec = 0;
  for (const ex of rt.exercises) {
    const n = light ? 1 : Math.max(1, Number(ex.sets) || 1);
    const t = parseTarget(ex.reps);
    const work = t.unit === 'seg' && t.low ? t.low : 40;
    sec += n * work + n * (Number(ex.rest) || 60);
  }
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

function routineSummary(rt) {
  const n = rt.exercises.length;
  return `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'} · unos ${routineMinutes(rt)} min`;
}

function workoutsSorted() {
  return DB.workouts.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.finishedAt || '').localeCompare(String(a.finishedAt || '')));
}

function workoutSets(w) { return (w.entries || []).reduce((t, e) => t + e.sets.length, 0); }

function occEnded(o) {
  const n = nowInfo();
  return o.date < n.date || (o.date === n.date && o.end <= n.min);
}

/* Registro que corresponde a un entrenamiento agendado: el vinculado, o uno suelto del mismo día */
function workoutForOcc(o) {
  return DB.workouts.find((w) => w.occKey === o.key)
    || DB.workouts.find((w) => !w.occKey && w.date === o.date)
    || null;
}

/* 'done' = registrado · 'missed' = ya pasó sin registro · '' = pendiente */
function trainingOccState(o) {
  if (o.calendar !== 'training') return '';
  if (workoutForOcc(o)) return 'done';
  return occEnded(o) ? 'missed' : '';
}

function trainingOccs(from, to) {
  return getOccurrences(from, to).filter((o) => o.calendar === 'training').sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

/* Al empezar sin elegir un evento: se vincula al entrenamiento de hoy que siga pendiente */
function findLinkableOcc(routineId) {
  const today = nowInfo().date;
  const list = trainingOccs(today, today).filter((o) => !workoutForOcc(o));
  return list.find((o) => o.routineId === routineId) || list[0] || null;
}

function workoutsBetween(from, to) { return DB.workouts.filter((w) => w.date >= from && w.date <= to); }

function trainingGoal() { return Math.max(0, Number(DB.settings.weeklyTrainingGoal) || 0); }

/* Semanas seguidas cumpliendo el objetivo (la actual cuenta solo si ya se cumplió) */
function trainingStreak() {
  const goal = trainingGoal();
  if (!goal || !DB.workouts.length) return 0;
  const first = DB.workouts.reduce((a, w) => (w.date < a ? w.date : a), DB.workouts[0].date);
  let [from, to] = weekRange(nowInfo().date);
  let streak = workoutsBetween(from, to).length >= goal ? 1 : 0;
  for (let i = 0; i < 104; i++) {
    from = addDays(from, -7); to = addDays(to, -7);
    if (to < first) break;
    if (workoutsBetween(from, to).length >= goal) streak++; else break;
  }
  return streak;
}

/* Entrenamientos agendados que ya pasaron sin registrar, contando desde el más reciente */
function missedRun() {
  const today = nowInfo().date;
  const past = trainingOccs(addDays(today, -42), today).filter(occEnded).reverse();
  let run = 0;
  for (const o of past) { if (workoutForOcc(o)) break; run++; }
  return { run, last: past[0] || null };
}

function nextPlanned() {
  const today = nowInfo().date;
  return trainingOccs(today, addDays(today, 21)).find((o) => !occEnded(o) && !workoutForOcc(o)) || null;
}

function trainingMeterHtml(from, to) {
  const goal = trainingGoal();
  if (!goal) return '';
  const done = workoutsBetween(from, to).length;
  const planned = trainingOccs(from, to).length;
  const note = planned ? `${planned} ${planned === 1 ? 'agendado' : 'agendados'} en la semana.` : 'Sin entrenamientos agendados esta semana.';
  return meterHtml('Entrenamientos', done, goal, String(done), String(goal), note);
}

function relDay(date) {
  const d = diffDays(date, nowInfo().date);
  if (d === 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 0) return d === -1 ? 'mañana' : `el ${DAY_NAMES[weekdayOf(date)].toLowerCase()}`;
  return `hace ${d} días`;
}

function whenLabel(o) {
  const d = diffDays(nowInfo().date, o.date);
  const day = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : capitalize(fmtDateLong(o.date));
  return `${day} · ${fmtTime(o.start)}`;
}

/* Últimas series registradas de un ejercicio (sin contar la sesión en curso) */
function lastSetsFor(exerciseId, name) {
  for (const w of workoutsSorted()) {
    const e = (w.entries || []).find((x) => (exerciseId && x.exerciseId === exerciseId) || norm(x.name) === norm(name));
    if (e && e.sets.length) return { sets: e.sets, date: w.date };
  }
  return null;
}

/* ---------- Sección ---------- */

function renderTraining() {
  const el = document.getElementById('sec-training');
  const s = DB.settings;
  const today = nowInfo().date;
  const [wf, wt] = weekRange(today);
  const goal = trainingGoal();
  const weekDone = workoutsBetween(wf, wt).length;
  const all = workoutsSorted();
  const lastW = all[0] || null;
  const next = nextPlanned();
  const miss = missedRun();
  const draft = loadDraft();
  const routines = sortedRoutines();

  const actions = `<button class="btn" data-action="routine-new">${icon('plus')} Nueva rutina</button>
    <button class="btn" data-action="train-schedule">${icon('calendar')} Agendar entrenamiento</button>`;

  // Sesión sin terminar
  const draftHtml = draft ? `<div class="tr-draft">
      <span>${icon('dumbbell')} Tenés <b>${esc(draft.routineName)}</b> sin terminar: ${draft.entries.reduce((t, e) => t + e.done.length, 0)} series hechas.</span>
      <span class="spacer"></span>
      <button class="btn btn-sm btn-primary" data-action="train-resume">Continuar</button>
      <button class="btn btn-sm btn-ghost" data-action="train-discard">Descartar</button>
    </div>` : '';

  // Lo que toca
  let hero;
  const nextRt = next && getRoutine(next.routineId);
  if (next && nextRt) {
    hero = `<div class="tr-hero-main">
        <span class="tr-when">${esc(whenLabel(next))}</span>
        <h2 style="--rt-c:${esc(nextRt.color || s.trainingColor)}"><i class="rt-dot"></i>${esc(nextRt.name)}</h2>
        <p class="muted">${esc([nextRt.focus, routineSummary(nextRt)].filter(Boolean).join(' · '))}</p>
      </div>
      <div class="tr-hero-actions">
        <button class="btn btn-primary" data-action="train-start" data-routine="${esc(nextRt.id)}" data-key="${esc(next.key)}">${icon('play')} Empezar</button>
        <button class="btn" data-action="train-start" data-routine="${esc(nextRt.id)}" data-key="${esc(next.key)}" data-light="1">Versión corta · ${routineMinutes(nextRt, true)} min</button>
      </div>`;
  } else {
    hero = `<div class="tr-hero-main">
        <span class="tr-when">Sin entrenamientos agendados</span>
        <h2>Elegí tus días</h2>
        <p class="muted">Agendalos en el calendario y elegí qué rutina toca cada día. La agenda te avisa y lleva la cuenta.</p>
      </div>
      <div class="tr-hero-actions"><button class="btn btn-primary" data-action="train-schedule">${icon('calendar')} Agendar entrenamiento</button></div>`;
  }

  // Regla: nunca dos seguidos
  let rule = '';
  if (miss.run >= 2) {
    const shortRt = (next && nextRt) || routines[0];
    rule = `<p class="tr-rule is-bad">${icon('alert')}<span><b>${miss.run} entrenamientos seguidos sin registrar.</b> Hoy hacé aunque sea la versión corta: una serie de cada ejercicio.</span>
      ${shortRt ? `<button class="btn btn-sm" data-action="train-start" data-routine="${esc(shortRt.id)}" data-light="1">Versión corta ahora</button>` : ''}</p>`;
  } else if (miss.run === 1) {
    rule = `<p class="tr-rule is-warn">${icon('alert')}<span>No registraste el del ${esc(DAY_NAMES[weekdayOf(miss.last.date)].toLowerCase())}. Faltar uno no es problema: <b>el próximo no lo saltees.</b></span></p>`;
  } else if (miss.last) {
    rule = `<p class="tr-rule is-ok">${icon('check')}<span>Hiciste el último que tenías agendado. Regla: nunca dos seguidos.</span></p>`;
  }

  // Semana día por día
  const days = dateRange(wf, wt);
  const weekHtml = `<ol class="tr-week">${days.map((d) => {
    const ws = DB.workouts.filter((w) => w.date === d);
    const planned = trainingOccs(d, d);
    let st = 'rest', label = '';
    if (ws.length) { st = 'done'; label = ws[0].routineName || 'Entrenamiento'; }
    else if (planned.length) {
      const o = planned[0];
      st = trainingOccState(o) === 'missed' ? 'missed' : 'planned';
      label = (getRoutine(o.routineId) || {}).name || o.title;
    }
    const tip = `${capitalize(fmtDateLong(d))}\n${{ done: 'Hecho', missed: 'No registrado', planned: 'Agendado', rest: 'Descanso' }[st]}${label ? ': ' + label : ''}`;
    return `<li class="tr-day is-${st}${d === today ? ' is-today' : ''}" data-tip="${esc(tip)}">
      <button class="link" data-action="select-day-week" data-date="${d}">
        <span class="tr-dn">${DAY_SHORT[weekdayOf(d)]} ${Number(d.slice(8))}</span>
        <span class="tr-mark">${st === 'done' ? icon('check') : st === 'missed' ? icon('x') : ''}</span>
        <span class="tr-lbl">${esc(label || '')}</span>
      </button></li>`;
  }).join('')}</ol>`;

  const kpis = `<div class="kpis">
    <div class="kpi"><span>Esta semana</span><b>${weekDone}${goal ? ` <small class="muted">/ ${goal}</small>` : ''}</b><small>${goal ? (weekDone >= goal ? 'Objetivo cumplido' : `Faltan ${goal - weekDone}`) : 'Sin objetivo semanal'}</small></div>
    <div class="kpi"><span>Racha</span><b>${trainingStreak()} sem.</b><small>semanas seguidas cumpliendo</small></div>
    <div class="kpi"><span>Último entrenamiento</span><b>${lastW ? esc(capitalize(relDay(lastW.date))) : '—'}</b><small>${lastW ? esc(lastW.routineName || '') : 'Todavía no registraste ninguno'}</small></div>
    <div class="kpi"><span>Total</span><b>${DB.workouts.length}</b><small>${DB.workouts.length === 1 ? 'sesión registrada' : 'sesiones registradas'}</small></div>
  </div>`;

  const routinesHtml = routines.length ? `<ul class="rt-list">${routines.map((r) => {
    const lw = all.find((w) => w.routineId === r.id);
    return `<li class="rt-row" style="--rt-c:${esc(r.color || s.trainingColor)}">
      <i class="rt-dot"></i>
      <div class="rt-main"><b>${esc(r.name)}</b>
        <small>${esc([r.focus, routineSummary(r)].filter(Boolean).join(' · '))}</small>
        <small class="muted">${lw ? `Última vez ${esc(relDay(lw.date))}` : 'Todavía sin registros'}</small></div>
      <div class="rt-actions">
        <button class="btn btn-sm btn-primary" data-action="train-start" data-routine="${esc(r.id)}">${icon('play')} Empezar</button>
        <button class="btn btn-sm" data-action="train-schedule" data-routine="${esc(r.id)}">Agendar</button>
        <button class="btn-icon" data-action="routine-edit" data-id="${esc(r.id)}" title="Editar rutina" aria-label="Editar ${esc(r.name)}">${icon('edit')}</button>
      </div></li>`;
  }).join('')}</ul>` : `<div class="empty"><p>No tenés rutinas.</p><button class="btn btn-primary" data-action="routine-new">${icon('plus')} Crear una rutina</button></div>`;

  const histHtml = all.length ? `<ul class="mini-list tr-hist">${all.slice(0, 12).map((w) => `<li><button class="link" data-action="workout-open" data-id="${esc(w.id)}">
      <b>${esc(capitalize(fmtDateLong(w.date)).replace(/ de \w+$/, ''))}</b>
      <span>${esc(w.routineName || 'Entrenamiento')}${w.light ? ' <span class="tag">Corta</span>' : ''}${w.quick ? ' <span class="tag">Sin detalle</span>' : ''}</span>
      <em>${w.quick ? 'marcado como hecho' : `${workoutSets(w)} series${w.durationMin ? ` · ${w.durationMin} min` : ''}`}</em>
    </button></li>`).join('')}</ul>${all.length > 12 ? `<p class="muted small">y ${all.length - 12} más.</p>` : ''}`
    : '<p class="muted small">Cuando termines un entrenamiento aparece acá, con las repeticiones de cada serie.</p>';

  el.innerHTML = sectionHead('Entrenamiento', actions, 'Rutinas, registro de series y tu semana.') + draftHtml + `
    <section class="block tr-hero">${hero}</section>
    ${rule}
    <section class="block tr-week-block">
      <h2>Semana del ${fmtDateShort(wf)} al ${fmtDateShort(wt)}</h2>
      ${weekHtml}
    </section>
    ${kpis}
    <div class="sum-grid">
      <section class="block block-wide"><h2>Rutinas</h2>${routinesHtml}</section>
      <section class="block"><h2>Historial</h2>${histHtml}</section>
      <section class="block"><h2>Progreso</h2>${progressHtml(all)}</section>
    </div>
    <p class="muted small">Objetivo semanal y color en <button class="link" data-action="goto" data-section="settings">Configuración</button>.</p>`;
}

/* Comparación de la última sesión de cada ejercicio con la anterior */
function progressHtml(all) {
  const map = new Map();
  for (const w of all) {
    for (const e of w.entries || []) {
      if (!e.sets.length) continue;
      const k = e.exerciseId || norm(e.name);
      if (!map.has(k)) map.set(k, { name: e.name, unit: e.unit || parseTarget(e.target).unit, runs: [] });
      const it = map.get(k);
      if (it.runs.length < 2) it.runs.push(e.sets);
    }
  }
  const rows = [...map.values()].slice(0, 10);
  if (!rows.length) return '<p class="muted small">Con dos sesiones del mismo ejercicio vas a ver acá si sumaste repeticiones.</p>';
  const tot = (a) => a.reduce((t, v) => t + (Number(v) || 0), 0);
  return `<div class="tbl-wrap"><table class="tbl tbl-compact"><thead><tr><th>Ejercicio</th><th>Última</th><th class="num">Cambio</th></tr></thead><tbody>${rows.map((r) => {
    const [a, b] = r.runs;
    const diff = b ? tot(a) - tot(b) : null;
    const unit = r.unit === 'seg' ? ' s' : '';
    return `<tr><td>${esc(r.name)}</td><td class="t-sets">${a.join(' · ')}${unit}</td>
      <td class="num">${diff == null ? '<span class="muted">—</span>' : diff > 0 ? `<span class="up">+${diff}${unit}</span>` : diff < 0 ? `<span class="down">${diff}${unit}</span>` : '<span class="muted">igual</span>'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

/* ---------- Editor de rutinas ---------- */

function openRoutineEditor(id) {
  const orig = getRoutine(id);
  const editing = !!orig;
  const r = editing ? deepClone(orig) : { id: uid(), name: '', focus: '', color: nextPaletteColor(DB.routines.length ? DB.routines : [{ color: '#2f8f62' }]), exercises: [], order: DB.routines.length };
  if (!r.exercises.length) r.exercises.push({ id: uid(), name: '', sets: 3, reps: '10-12', rest: 60, guide: '' });

  const exRow = (ex, i) => `<li class="rtf-ex" data-i="${i}">
      <div class="rtf-ex-head">
        <span class="rtf-num">${i + 1}</span>
        <input name="ex-name" value="${esc(ex.name)}" placeholder="Nombre del ejercicio" maxlength="80" aria-label="Nombre del ejercicio ${i + 1}">
        <span class="rtf-tools">
          <button type="button" class="btn-icon" data-ex="up" title="Subir" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up')}</button>
          <button type="button" class="btn-icon" data-ex="down" title="Bajar" aria-label="Bajar" ${i === r.exercises.length - 1 ? 'disabled' : ''}>${icon('arrow-down')}</button>
          <button type="button" class="btn-icon btn-danger-text" data-ex="del" title="Quitar" aria-label="Quitar ejercicio">${icon('trash')}</button>
        </span>
      </div>
      <div class="grid-3">
        <label class="field"><span>Series</span><input name="ex-sets" type="number" min="1" max="10" inputmode="numeric" value="${Number(ex.sets) || 3}"></label>
        <label class="field"><span>Repeticiones o tiempo</span><input name="ex-reps" value="${esc(ex.reps)}" placeholder="10-12 o 30 seg"></label>
        <label class="field"><span>Descanso (seg)</span><input name="ex-rest" type="number" min="0" max="600" step="5" inputmode="numeric" value="${Number(ex.rest) || 0}"></label>
      </div>
      <label class="field"><span>Cómo hacerlo <small>(opcional)</small></span><textarea name="ex-guide" rows="2">${esc(ex.guide)}</textarea></label>
    </li>`;

  const body = `<form class="rtf" novalidate autocomplete="off">
      <div class="rtf-top">
        <label class="field"><span>Nombre</span><input name="name" value="${esc(r.name)}" placeholder="Ej.: Full body" maxlength="60" autofocus></label>
        <label class="field"><span>Enfoque <small>(opcional)</small></span><input name="focus" value="${esc(r.focus)}" placeholder="Ej.: Espalda + bíceps" maxlength="80"></label>
        <label class="field rtf-color"><span>Color</span><input name="color" type="color" value="${esc(r.color || DB.settings.trainingColor)}"></label>
      </div>
      <h3 class="rtf-h">Ejercicios <span class="muted small" data-est></span></h3>
      <ol class="rtf-list"></ol>
      <button type="button" class="btn btn-sm" data-ex="add">${icon('plus')} Agregar ejercicio</button>
    </form>`;
  const footer = `${editing ? `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash')} Eliminar rutina</button>` : ''}
    <span class="spacer"></span>
    <button type="button" class="btn" data-act="cancel">Cancelar</button>
    <button type="button" class="btn btn-primary" data-act="save">${editing ? 'Guardar rutina' : 'Crear rutina'}</button>`;
  const m = openModal({ title: editing ? 'Editar rutina' : 'Nueva rutina', body, footer, size: 'lg', dismissible: false, className: 'modal-routine' });
  const f = m.el.querySelector('form');
  const list = f.querySelector('.rtf-list');

  const read = () => {
    r.name = f.elements.name.value.trim();
    r.focus = f.elements.focus.value.trim();
    r.color = f.elements.color.value;
    list.querySelectorAll('.rtf-ex').forEach((li) => {
      const ex = r.exercises[Number(li.dataset.i)];
      const q = (n) => li.querySelector(`[name="${n}"]`);
      ex.name = q('ex-name').value.trim();
      ex.sets = clamp(parseInt(q('ex-sets').value, 10) || 1, 1, 10);
      ex.reps = q('ex-reps').value.trim();
      ex.rest = clamp(parseInt(q('ex-rest').value, 10) || 0, 0, 600);
      ex.guide = q('ex-guide').value.trim();
    });
  };
  const est = () => { read(); f.querySelector('[data-est]').textContent = r.exercises.some((x) => x.name) ? `· unos ${routineMinutes({ exercises: r.exercises.filter((x) => x.name) })} min` : ''; };
  const draw = () => { list.innerHTML = r.exercises.map(exRow).join(''); est(); };
  draw();

  f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ex]');
    if (!b) return;
    read();
    const a = b.dataset.ex;
    if (a === 'add') {
      r.exercises.push({ id: uid(), name: '', sets: 3, reps: '10-12', rest: 60, guide: '' });
      draw();
      const last = list.lastElementChild.querySelector('[name="ex-name"]');
      last.scrollIntoView({ block: 'center', behavior: 'smooth' });
      last.focus({ preventScroll: true });
      return;
    }
    const i = Number(b.closest('.rtf-ex').dataset.i);
    if (a === 'del') r.exercises.splice(i, 1);
    if (a === 'up' && i > 0) [r.exercises[i - 1], r.exercises[i]] = [r.exercises[i], r.exercises[i - 1]];
    if (a === 'down' && i < r.exercises.length - 1) [r.exercises[i + 1], r.exercises[i]] = [r.exercises[i], r.exercises[i + 1]];
    draw();
  });
  f.addEventListener('change', est);

  m.el.querySelector('[data-act=cancel]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-act=save]').addEventListener('click', () => {
    read();
    clearErrors(f);
    r.exercises = r.exercises.filter((x) => x.name);
    if (!r.name) { setFieldError(f, 'name', 'Poné un nombre'); f.elements.name.focus(); return; }
    if (!r.exercises.length) { r.exercises.push({ id: uid(), name: '', sets: 3, reps: '10-12', rest: 60, guide: '' }); draw(); toast('Agregá al menos un ejercicio con nombre.', { kind: 'error' }); return; }
    for (const x of r.exercises) if (!x.reps) x.reps = '10';
    m.close();
    commit((d) => {
      const i = d.routines.findIndex((x) => x.id === r.id);
      if (i >= 0) d.routines[i] = r; else d.routines.push(r);
    }, { undo: editing ? 'Rutina guardada' : 'Rutina creada' });
  });
  const del = m.el.querySelector('[data-act=delete]');
  if (del) del.addEventListener('click', async () => {
    const uses = DB.events.filter((e) => e.calendar === 'training' && e.routineId === r.id).length;
    const ok = await confirmDialog({
      title: 'Eliminar rutina',
      message: `¿Eliminar «${esc(orig.name)}»?${uses ? ` Tenés ${uses} ${uses === 1 ? 'evento agendado' : 'eventos agendados'} con esta rutina: quedan en el calendario sin rutina.` : ''} Los entrenamientos ya registrados se conservan.`,
      confirmText: 'Eliminar', danger: true,
    });
    if (!ok) return;
    m.close();
    commit((d) => { d.routines = d.routines.filter((x) => x.id !== r.id); }, { undo: 'Rutina eliminada' });
  });
}

/* ---------- Registro de un entrenamiento ---------- */

function openWorkoutDetail(id) {
  const w = DB.workouts.find((x) => x.id === id);
  if (!w) return;
  const rows = (w.entries || []).map((e) => {
    const unit = (e.unit || parseTarget(e.target).unit) === 'seg' ? ' s' : '';
    return `<tr><td>${esc(e.name)}</td><td class="t-sets">${e.sets.join(' · ')}${unit}</td><td class="num muted">${esc(e.target || '')}</td></tr>`;
  }).join('');
  const meta = [
    w.routineName,
    w.durationMin ? `${w.durationMin} min` : '',
    w.quick ? 'marcado como hecho, sin series' : `${workoutSets(w)} series`,
    w.light ? 'versión corta' : '',
  ].filter(Boolean).map(esc).join(' · ');
  const m = openModal({
    title: capitalize(fmtDateLong(w.date, true)), size: 'md',
    body: `<p class="muted">${meta}</p>
      ${rows ? `<div class="tbl-wrap"><table class="tbl tbl-compact"><thead><tr><th>Ejercicio</th><th>Series</th><th class="num">Objetivo</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}`,
    footer: `<button type="button" class="btn btn-ghost btn-danger-text" data-del>${icon('trash')} Eliminar registro</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-ok>Cerrar</button>`,
  });
  m.el.querySelector('[data-ok]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-del]').addEventListener('click', () => {
    m.close();
    commit((d) => { d.workouts = d.workouts.filter((x) => x.id !== id); }, { undo: 'Registro eliminado' });
  });
}

/* "Lo hice" sin detalle de series (por ejemplo, entrenaste afuera) */
function quickLogOcc(o) {
  const today = nowInfo().date;
  const rt = getRoutine(o.routineId);
  const w = {
    id: uid(), date: o.date <= today ? o.date : today, routineId: o.routineId || '', routineName: rt ? rt.name : o.title,
    occKey: o.key, light: false, quick: true, entries: [], durationMin: occDuration(o), finishedAt: new Date().toISOString(),
  };
  commit((d) => { d.workouts.push(w); }, { undo: 'Marcado como hecho' });
}

/* ---------- Modo entrenamiento ---------- */

let TR = null;          // sesión en curso
let trModal = null;
let trTimer = null;
let trWake = null;
let trAudio = null;

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(TRAIN_DRAFT_KEY) || 'null'); } catch (e) { return null; }
}

function saveDraft() {
  try { if (TR) localStorage.setItem(TRAIN_DRAFT_KEY, JSON.stringify(TR)); else localStorage.removeItem(TRAIN_DRAFT_KEY); } catch (e) { /* no crítico */ }
}

async function startTraining(routineId, o = {}) {
  const rt = getRoutine(routineId);
  if (!rt) { toast('Esa rutina ya no existe.', { kind: 'error' }); return; }
  const draft = loadDraft();
  if (draft) {
    const ok = await confirmDialog({ title: 'Entrenamiento sin terminar', message: `Tenés <b>${esc(draft.routineName)}</b> sin terminar. ¿Lo descartás y empezás <b>${esc(rt.name)}</b>?`, confirmText: 'Descartar y empezar' });
    if (!ok) return;
  }
  const occKey = (o.occ && o.occ.key) || o.occKey || ((findLinkableOcc(routineId) || {}).key) || null;
  TR = {
    v: 1, routineId: rt.id, routineName: rt.name, color: rt.color || DB.settings.trainingColor, occKey, light: !!o.light,
    startedAt: new Date().toISOString(), idx: 0, phase: 'work', restEnd: null, after: null, value: null,
    entries: rt.exercises.map((ex) => ({ exerciseId: ex.id, name: ex.name, target: ex.reps, sets: Number(ex.sets) || 1, rest: Number(ex.rest) || 0, guide: ex.guide || '', done: [] })),
  };
  saveDraft();
  openTrainingModal();
}

function resumeTraining() {
  TR = loadDraft();
  if (!TR) { renderTraining(); return; }
  openTrainingModal();
}

async function discardTrainingDraft() {
  const d = loadDraft();
  if (d && !(await confirmDialog({ title: 'Descartar entrenamiento', message: `Se pierden las series de <b>${esc(d.routineName)}</b> que no guardaste.`, confirmText: 'Descartar', danger: true }))) return;
  TR = null;
  saveDraft();
  if (trModal) trModal.close();
  renderAll();
}

function plannedSets(e) { return TR.light ? 1 : e.sets; }
function entryDone(e) { return e.done.length >= plannedSets(e); }
function nextIndex(from) {
  const n = TR.entries.length;
  for (let k = 1; k <= n; k++) { const i = (from + k) % n; if (!entryDone(TR.entries[i])) return i; }
  return -1;
}

function defaultValue(e) {
  const i = e.done.length;
  const last = lastSetsFor(e.exerciseId, e.name);
  if (last && last.sets[i] != null) return Number(last.sets[i]);
  if (i > 0) return Number(e.done[i - 1]);
  return parseTarget(e.target).low ?? 10;
}

function openTrainingModal() {
  if (trModal) trModal.close();
  const footer = `<button type="button" class="btn btn-ghost btn-danger-text" data-t="discard">Descartar</button>
    <span class="spacer"></span>
    <button type="button" class="btn" data-t="skipex">Saltar ejercicio</button>
    <button type="button" class="btn btn-primary" data-t="finish">Terminar</button>`;
  trModal = openModal({
    title: TR.routineName, body: '<div class="trn"></div>', footer, size: 'md', dismissible: false, className: 'modal-train',
    onClose: () => { clearInterval(trTimer); trTimer = null; trModal = null; releaseWake(); if (UI.section === 'training') renderTraining(); },
  });
  trModal.el.style.setProperty('--rt-c', TR.color);
  trModal.el.addEventListener('click', onTrainClick);
  trModal.el.addEventListener('change', (e) => {
    if (e.target.dataset.t === 'light') { TR.light = e.target.checked; if (TR.phase === 'work' && entryDone(TR.entries[TR.idx])) advance(); else { saveDraft(); drawTrain(); } }
  });
  requestWake();
  trTimer = setInterval(tickRest, 250);
  drawTrain();
}

function fmtClock(sec) { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${pad2(sec % 60)}`; }

function drawTrain() {
  if (!trModal || !TR) return;
  const box = trModal.el.querySelector('.trn');
  const n = TR.entries.length;
  const doneSets = TR.entries.reduce((t, e) => t + Math.min(e.done.length, plannedSets(e)), 0);
  const totalSets = TR.entries.reduce((t, e) => t + plannedSets(e), 0);
  const chips = TR.entries.map((e, i) => `<button type="button" class="trn-chip${i === TR.idx && TR.phase === 'work' ? ' is-cur' : ''}${entryDone(e) ? ' is-done' : ''}" data-t="jump" data-i="${i}">
      ${entryDone(e) ? icon('check') : ''}<span>${esc(e.name)}</span><small>${Math.min(e.done.length, plannedSets(e))}/${plannedSets(e)}</small></button>`).join('');
  let main;
  if (TR.phase === 'end') {
    const mins = Math.max(1, Math.round((Date.now() - new Date(TR.startedAt).getTime()) / 60000));
    main = `<div class="trn-card trn-end">
      <span class="trn-big-ic">${icon('check')}</span>
      <h3>Listo</h3>
      <p>${doneSets} series en ${mins} min.</p>
      <button type="button" class="btn btn-primary trn-cta" data-t="finish">Guardar entrenamiento</button>
    </div>`;
  } else if (TR.phase === 'rest') {
    const nx = TR.entries[TR.after];
    const nxText = nx ? `${nx.name} · serie ${Math.min(nx.done.length + 1, plannedSets(nx))} de ${plannedSets(nx)}` : '';
    main = `<div class="trn-card trn-rest">
      <p class="trn-label">Descanso</p>
      <div class="trn-clock" data-clock>${fmtClock((TR.restEnd - Date.now()) / 1000)}</div>
      <div class="trn-clock-ctl">
        <button type="button" class="btn" data-t="less">−10 s</button>
        <button type="button" class="btn" data-t="more">+10 s</button>
      </div>
      <button type="button" class="btn btn-primary trn-cta" data-t="skiprest">Seguir</button>
      ${nxText ? `<p class="muted small">Sigue: ${esc(nxText)}</p>` : ''}
    </div>`;
  } else {
    const e = TR.entries[TR.idx];
    const t = parseTarget(e.target);
    const planned = plannedSets(e);
    const setNo = Math.min(e.done.length + 1, planned);
    if (TR.value == null) TR.value = defaultValue(e);
    const last = lastSetsFor(e.exerciseId, e.name);
    main = `<div class="trn-card">
      <h3 class="trn-name">${esc(e.name)}</h3>
      <p class="trn-set">Serie <b>${setNo}</b> de ${planned}<span class="muted"> · objetivo ${esc(e.target)}</span></p>
      ${last ? `<p class="trn-last">La última vez (${esc(relDay(last.date))}): <b>${last.sets.join(' · ')}</b></p>` : '<p class="trn-last muted">Primera vez con este ejercicio.</p>'}
      ${e.done.length ? `<p class="trn-today">Hoy: <b>${e.done.join(' · ')}</b></p>` : ''}
      <div class="stepper" role="group" aria-label="${t.unit === 'seg' ? 'Segundos' : 'Repeticiones'} hechas">
        <button type="button" class="btn" data-t="dec" aria-label="Menos">−</button>
        <output>${TR.value}</output><span>${t.unit === 'seg' ? 'seg' : 'reps'}</span>
        <button type="button" class="btn" data-t="inc" aria-label="Más">+</button>
      </div>
      <button type="button" class="btn btn-primary trn-cta" data-t="set">${icon('check')} Serie hecha</button>
      ${e.guide ? `<details class="trn-guide"><summary>Cómo hacerlo</summary><p>${esc(e.guide)}</p>
        ${'speechSynthesis' in window ? `<button type="button" class="btn btn-sm btn-ghost" data-t="speak">${icon('volume')} Escuchar</button>` : ''}</details>` : ''}
    </div>`;
  }
  box.innerHTML = `<div class="trn-top">
      <div class="trn-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${totalSets}" aria-valuenow="${doneSets}"><i style="width:${totalSets ? (doneSets / totalSets) * 100 : 0}%"></i></div>
      <div class="trn-meta"><span>${doneSets} de ${totalSets} series · ${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}</span>
        <label class="trn-light"><input type="checkbox" data-t="light" ${TR.light ? 'checked' : ''}> Versión corta</label></div>
      <div class="trn-chips">${chips}</div>
    </div>${main}`;
  const cur = box.querySelector('.trn-chip.is-cur');
  if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function advance() {
  const nx = entryDone(TR.entries[TR.idx]) ? nextIndex(TR.idx) : TR.idx;
  TR.value = null;
  if (nx < 0) { TR.phase = 'end'; } else { TR.idx = nx; TR.phase = 'work'; }
  saveDraft();
  drawTrain();
}

function startRest(sec, after) {
  if (!sec) { TR.idx = after; TR.phase = 'work'; saveDraft(); drawTrain(); return; }
  TR.phase = 'rest';
  TR.after = after;
  TR.restEnd = Date.now() + sec * 1000;
  saveDraft();
  drawTrain();
}

function tickRest() {
  if (!TR || TR.phase !== 'rest' || !trModal) return;
  const left = (TR.restEnd - Date.now()) / 1000;
  const el = trModal.el.querySelector('[data-clock]');
  if (el) el.textContent = fmtClock(left);
  if (left <= 0) {
    restDone();
    TR.idx = TR.after; TR.phase = 'work'; TR.value = null;
    saveDraft();
    drawTrain();
  }
}

function restDone() {
  try { if (navigator.vibrate) navigator.vibrate([180, 80, 180]); } catch (e) { /* sin vibración */ }
  if (!DB.settings.trainingSound || !trAudio) return;
  try {
    const t0 = trAudio.currentTime;
    [0, 0.22].forEach((d) => {
      const o = trAudio.createOscillator(), g = trAudio.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.16);
      o.connect(g).connect(trAudio.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.18);
    });
  } catch (e) { /* sin sonido */ }
}

async function requestWake() {
  try { if ('wakeLock' in navigator) trWake = await navigator.wakeLock.request('screen'); } catch (e) { trWake = null; }
}
function releaseWake() { try { if (trWake) trWake.release(); } catch (e) { /* nada */ } trWake = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && trModal && !trWake) requestWake(); });

async function onTrainClick(e) {
  const b = e.target.closest('[data-t]');
  if (!b || !TR || b.dataset.t === 'light') return;
  const a = b.dataset.t;
  // El sonido solo se puede preparar después de un toque
  if (!trAudio && (window.AudioContext || window.webkitAudioContext)) { try { trAudio = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { trAudio = null; } }
  if (trAudio && trAudio.state === 'suspended') trAudio.resume();
  const e0 = TR.entries[TR.idx];
  const step = parseTarget(e0.target).unit === 'seg' ? 5 : 1;
  switch (a) {
    case 'inc': TR.value = (Number(TR.value) || 0) + step; break;
    case 'dec': TR.value = Math.max(0, (Number(TR.value) || 0) - step); break;
    case 'set': {
      e0.done.push(Number(TR.value) || 0);
      TR.value = null;
      const nx = entryDone(e0) ? nextIndex(TR.idx) : TR.idx;
      if (nx < 0) { TR.phase = 'end'; saveDraft(); drawTrain(); return; }
      startRest(e0.rest, nx);
      return;
    }
    case 'skiprest': TR.idx = TR.after; TR.phase = 'work'; TR.value = null; break;
    case 'less': TR.restEnd -= 10000; tickRest(); break;
    case 'more': TR.restEnd += 10000; break;
    case 'jump': TR.idx = Number(b.dataset.i); TR.phase = 'work'; TR.value = null; break;
    case 'skipex': {
      const nx = nextIndex(TR.idx);
      if (nx < 0 || nx === TR.idx) { toast('No quedan otros ejercicios pendientes.'); return; }
      TR.idx = nx; TR.phase = 'work'; TR.value = null;
      break;
    }
    case 'speak': {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(`${e0.name}. ${e0.guide}`);
        u.lang = 'es-AR';
        speechSynthesis.speak(u);
      } catch (err) { /* sin voz */ }
      return;
    }
    case 'discard': discardTrainingDraft(); return;
    case 'finish': finishTraining(); return;
    default: return;
  }
  saveDraft();
  drawTrain();
}

async function finishTraining() {
  const sets = TR.entries.reduce((t, e) => t + e.done.length, 0);
  if (!sets) { discardTrainingDraft(); return; }
  if (TR.phase !== 'end') {
    const left = TR.entries.reduce((t, e) => t + Math.max(0, plannedSets(e) - e.done.length), 0);
    const ok = await confirmDialog({ title: 'Terminar entrenamiento', message: `Te faltan ${left} ${left === 1 ? 'serie' : 'series'}. Se guarda lo que hiciste.`, confirmText: 'Guardar y terminar' });
    if (!ok) return;
  }
  const now = new Date();
  const w = {
    id: uid(), date: ymd(now), routineId: TR.routineId, routineName: TR.routineName, occKey: TR.occKey, light: TR.light,
    startedAt: TR.startedAt, finishedAt: now.toISOString(),
    durationMin: Math.max(1, Math.round((now.getTime() - new Date(TR.startedAt).getTime()) / 60000)),
    entries: TR.entries.filter((e) => e.done.length).map((e) => ({ exerciseId: e.exerciseId, name: e.name, target: e.target, unit: parseTarget(e.target).unit, sets: e.done.slice() })),
  };
  TR = null;
  saveDraft();
  if (trModal) trModal.close();
  commit((d) => { d.workouts.push(w); }, { undo: 'Entrenamiento guardado' });
}
