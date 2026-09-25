'use strict';
/* Eventos recurrentes: expansión en ocurrencias, excepciones y edición por alcance
   (solo esta / esta y las siguientes / toda la serie). */

const REC_LABELS = {
  none: 'No se repite',
  daily: 'Todos los días',
  weekdays: 'Lunes a viernes',
  days: 'Días seleccionados',
  weekly: 'Semanal',
  nweeks: 'Cada X semanas',
  custom: 'Personalizado',
};

const DAY_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];

const occCache = new Map();
const lastDateCache = new Map();

function invalidateCaches() { occCache.clear(); lastDateCache.clear(); }

function weekIndex(startDate, date) { return Math.floor(diffDays(startOfWeek(startDate, 1), date) / 7); }

/* ¿El patrón de repetición cae en esta fecha? (sin mirar excepciones ni fin de serie) */
function patternMatches(ev, date) {
  const r = ev.recurrence;
  const d = diffDays(ev.date, date);
  if (d < 0) return false;
  if (!r) return d === 0;
  const wd = weekdayOf(date);
  const n = Math.max(1, Number(r.interval) || 1);
  switch (r.type) {
    case 'daily': return true;
    case 'weekdays': return wd >= 1 && wd <= 5;
    case 'days': return (r.days || []).includes(wd);
    case 'weekly': return d % 7 === 0;
    case 'nweeks': return d % (7 * n) === 0;
    case 'custom':
      if (r.unit === 'day') return d % n === 0;
      return ((r.days && r.days.length) ? r.days.includes(wd) : wd === weekdayOf(ev.date)) && weekIndex(ev.date, date) % n === 0;
    default: return d === 0;
  }
}

/* Última fecha de la serie (null = sin fin) */
function seriesLastDate(ev) {
  const r = ev.recurrence;
  if (!r) return ev.date;
  if (r.end === 'until' && isYmd(r.until)) return r.until;
  if (r.end === 'count' && r.count > 0) {
    const key = ev.id + '|' + ev.date + '|' + JSON.stringify(r);
    if (lastDateCache.has(key)) return lastDateCache.get(key);
    let c = 0, d = ev.date, last = ev.date;
    for (let i = 0; i < 3700 && c < r.count; i++, d = addDays(d, 1)) {
      if (patternMatches(ev, d)) { c++; last = d; }
    }
    lastDateCache.set(key, last);
    return last;
  }
  return null;
}

function isValidOccurrence(ev, date) {
  if (!patternMatches(ev, date)) return false;
  const last = seriesLastDate(ev);
  return !last || date <= last;
}

function countOccurrences(ev, from, to) {
  let c = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isValidOccurrence(ev, d)) c++;
  return c;
}

function hasOccurrenceBefore(ev, date) {
  for (let d = ev.date; d < date; d = addDays(d, 1)) if (isValidOccurrence(ev, d)) return true;
  return false;
}

function makeOcc(ev, origDate, ov) {
  const o = Object.assign({}, ev, ov || {});
  o.key = ev.id + '@' + origDate;
  o.eventId = ev.id;
  o.origDate = origDate;
  o.date = (ov && ov.date) || origDate;
  o.isRecurring = !!ev.recurrence;
  o.isException = !!ov;
  o.exceptions = undefined;
  o.base = ev;
  return o;
}

function expandEvent(ev, from, to) {
  const out = [];
  if (!ev.recurrence) {
    if (ev.date >= from && ev.date <= to) out.push(makeOcc(ev, ev.date, null));
    return out;
  }
  const exc = ev.exceptions || {};
  const last = seriesLastDate(ev);
  const d0 = from > ev.date ? from : ev.date;
  const d1 = last && last < to ? last : to;
  for (let d = d0; d <= d1; d = addDays(d, 1)) {
    if (exc[d]) continue;
    if (patternMatches(ev, d)) out.push(makeOcc(ev, d, null));
  }
  for (const orig of Object.keys(exc)) {
    const ov = exc[orig];
    if (!ov || ov.deleted || !isValidOccurrence(ev, orig)) continue;
    const date = ov.date || orig;
    if (date >= from && date <= to) out.push(makeOcc(ev, orig, ov));
  }
  return out;
}

/* Todas las ocurrencias entre dos fechas (inclusive), ordenadas */
function getOccurrences(from, to) {
  const key = from + '|' + to;
  if (occCache.has(key)) return occCache.get(key);
  const out = [];
  for (const ev of DB.events) for (const o of expandEvent(ev, from, to)) out.push(o);
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.start - b.start || b.end - a.end);
  if (occCache.size > 80) occCache.clear();
  occCache.set(key, out);
  return out;
}

function findOccurrence(key) {
  const [id, orig] = key.split('@');
  const ev = getEvent(id);
  if (!ev) return null;
  const ov = ev.exceptions && ev.exceptions[orig];
  if (ov && ov.deleted) return null;
  return makeOcc(ev, orig, ov || null);
}

/* Próxima ocurrencia a partir de una fecha (o la última pasada si no hay futuras) */
function nextOccurrenceOf(ev, fromDate) {
  const future = expandEvent(ev, fromDate, addDays(fromDate, 400)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  if (future.length) return future[0];
  const past = expandEvent(ev, addDays(fromDate, -400), addDays(fromDate, -1)).sort((a, b) => b.date.localeCompare(a.date));
  return past[0] || null;
}

/* ---------- Edición ---------- */

const OVERRIDE_SKIP = ['id', 'recurrence', 'exceptions', 'createdAt', 'demo', 'updatedAt'];

function setOverride(ev, orig, changes) {
  ev.exceptions = ev.exceptions || {};
  const ov = Object.assign({}, ev.exceptions[orig] || {});
  delete ov.deleted;
  for (const [k, v] of Object.entries(changes)) {
    if (OVERRIDE_SKIP.includes(k)) continue;
    if (k === 'date') { if (v === orig) delete ov.date; else ov.date = v; continue; }
    if (sameValue(v, ev[k])) delete ov[k]; else ov[k] = v;
  }
  if (Object.keys(ov).length) ev.exceptions[orig] = ov; else delete ev.exceptions[orig];
}

function shiftWeekdays(days, delta) {
  return days.map((w) => (((w + delta) % 7) + 7) % 7).sort((a, b) => a - b);
}

/* Aplica cambios a toda la serie `ev`, partiendo de la ocurrencia `occ` (para mover días) */
function applySeriesChange(ev, occ, changes) {
  const c = Object.assign({}, changes);
  const recChanged = 'recurrence' in c && !sameValue(c.recurrence, ev.recurrence);
  let delta = 0;
  if ('date' in c) {
    delta = diffDays(occ.date, c.date);
    delete c.date;
  }
  if (delta) {
    ev.date = addDays(ev.date, delta);
    if (ev.recurrence && !recChanged) {
      if (ev.recurrence.days && ev.recurrence.days.length) ev.recurrence.days = shiftWeekdays(ev.recurrence.days, delta);
      if (ev.recurrence.end === 'until' && isYmd(ev.recurrence.until)) ev.recurrence.until = addDays(ev.recurrence.until, delta);
    }
    if (ev.exceptions) {
      const moved = {};
      for (const [k, v] of Object.entries(ev.exceptions)) {
        const nv = Object.assign({}, v);
        if (nv.date) nv.date = addDays(nv.date, delta);
        moved[addDays(k, delta)] = nv;
      }
      ev.exceptions = moved;
    }
  }
  if (!recChanged) delete c.recurrence;
  for (const k of OVERRIDE_SKIP) if (k !== 'recurrence') delete c[k];
  Object.assign(ev, c);
  if (!ev.recurrence) {
    // La serie pasó a ser un evento único: queda en la fecha elegida
    if ('date' in changes) ev.date = changes.date;
    ev.exceptions = {};
    return;
  }
  // La ocurrencia editada queda exactamente como se pidió (sin excepciones redundantes)
  setOverride(ev, addDays(occ.origDate, delta), changes);
  if (ev.exceptions) {
    for (const k of Object.keys(ev.exceptions)) if (!isValidOccurrence(ev, k)) delete ev.exceptions[k];
  }
}

function applyOccurrenceEdit(d, occ, changes, scope) {
  const ev = d.events.find((e) => e.id === occ.eventId);
  if (!ev) return;
  ev.updatedAt = new Date().toISOString();
  ev.demo = false;
  if (!ev.recurrence) {
    Object.assign(ev, changes);
    return;
  }
  if (scope === 'one') {
    setOverride(ev, occ.origDate, changes);
    return;
  }
  if (scope === 'following' && hasOccurrenceBefore(ev, occ.origDate)) {
    const nev = deepClone(Object.assign({}, ev));
    nev.id = uid();
    nev.createdAt = ev.updatedAt;
    const oldExc = {}, newExc = {};
    for (const [k, v] of Object.entries(ev.exceptions || {})) (k < occ.origDate ? oldExc : newExc)[k] = v;
    ev.exceptions = oldExc;
    nev.exceptions = newExc;
    if (ev.recurrence.end === 'count') {
      const before = countOccurrences(ev, ev.date, addDays(occ.origDate, -1));
      nev.recurrence.count = Math.max(1, (ev.recurrence.count || 1) - before);
    }
    ev.recurrence = Object.assign({}, ev.recurrence, { end: 'until', until: addDays(occ.origDate, -1), count: null });
    nev.date = occ.origDate;
    d.events.push(nev);
    invalidateCaches();
    applySeriesChange(nev, occ, changes);
    return;
  }
  applySeriesChange(ev, occ, changes);
}

function deleteOccurrence(d, occ, scope) {
  const ev = d.events.find((e) => e.id === occ.eventId);
  if (!ev) return;
  if (!ev.recurrence || scope === 'all' || (scope === 'following' && !hasOccurrenceBefore(ev, occ.origDate))) {
    d.events = d.events.filter((e) => e !== ev);
    return;
  }
  if (scope === 'one') {
    ev.exceptions = ev.exceptions || {};
    ev.exceptions[occ.origDate] = { deleted: true };
    return;
  }
  ev.recurrence = Object.assign({}, ev.recurrence, { end: 'until', until: addDays(occ.origDate, -1), count: null });
  for (const k of Object.keys(ev.exceptions || {})) if (k >= occ.origDate) delete ev.exceptions[k];
}

/* ---------- Texto ---------- */

function describeRecurrence(r, date) {
  if (!r) return 'No se repite';
  const n = Math.max(1, Number(r.interval) || 1);
  const dayList = (days) => (days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((w) => DAY_SHORT[w].toLowerCase()).join(', ');
  let s;
  switch (r.type) {
    case 'daily': s = 'Todos los días'; break;
    case 'weekdays': s = 'De lunes a viernes'; break;
    case 'days': s = 'Cada semana: ' + (dayList(r.days) || '—'); break;
    case 'weekly': s = 'Todos los ' + DAY_PLURAL[weekdayOf(date)]; break;
    case 'nweeks': s = `Cada ${n} semanas, los ${DAY_PLURAL[weekdayOf(date)]}`; break;
    case 'custom':
      s = r.unit === 'day'
        ? (n === 1 ? 'Todos los días' : `Cada ${n} días`)
        : `Cada ${n === 1 ? 'semana' : n + ' semanas'}: ${dayList(r.days && r.days.length ? r.days : [weekdayOf(date)])}`;
      break;
    default: s = 'Se repite';
  }
  if (r.end === 'until' && r.until) s += ` · hasta el ${fmtDateNum(r.until)}`;
  if (r.end === 'count' && r.count) s += ` · ${r.count} veces`;
  return s;
}
