'use strict';
/* Avisos: recordatorio antes de cada evento (dos para tareas con compu o complejas) y resumen del día.
   Usan las notificaciones del navegador: llegan mientras la agenda esté abierta en ese dispositivo. */

const NOTIFIED_KEY = 'agendaSemanal:notified:v1';
const LATE_TOLERANCE = 10 * 60000;      // un aviso atrasado (pestaña dormida) se muestra hasta 10 min tarde
const DAILY_WINDOW = 4 * 3600000;       // el resumen del día se muestra si se abre la agenda hasta 4 h después

let notified = {};
let swRegistration = null;
let notifyTimer = null;

function notifySupported() { return 'Notification' in window; }

function notifyPermission() { return notifySupported() ? Notification.permission : 'unsupported'; }

function loadNotified() {
  try { notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}'); } catch (e) { notified = {}; }
}

function saveNotified() {
  const limit = Date.now() - 2 * 864e5;
  for (const [k, t] of Object.entries(notified)) if (t < limit) delete notified[k];
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified)); } catch (e) { /* sin almacenamiento */ }
}

function occStartMs(o) {
  const [y, m, d] = o.date.split('-').map(Number);
  return new Date(y, m - 1, d, 0, o.start).getTime();
}

/* ¿Hace falta la compu o es una tarea compleja? → aviso extra más temprano */
function needsExtraReminder(o) {
  return o.calendar === 'work' && (!o.phone || o.complexity === 'complex');
}

/* Avisos de eventos entre dos momentos (ms) */
function upcomingReminders(fromMs, toMs) {
  const s = DB.settings;
  const base = Math.max(1, Number(s.notifyMinutes) || 15);
  const extra = Number(s.notifyExtraMinutes) || 0;
  const out = [];
  for (const o of getOccurrences(ymd(new Date(fromMs - 864e5)), ymd(new Date(toMs + 864e5)))) {
    const startMs = occStartMs(o);
    if (startMs < fromMs) continue;
    const travel = o.calendar === 'faculty' ? Number(o.travelBefore) || 0 : 0;
    const leads = [base];
    if (needsExtraReminder(o) && extra > base) leads.push(extra);
    for (const lead of leads) {
      const at = startMs - (lead + travel) * 60000;
      if (at > toMs) continue;
      out.push({ id: `${o.key}|${o.start}|${lead}`, at, startMs, lead, travel, o });
    }
  }
  return out;
}

function reminderText(r, nowMs) {
  const o = r.o;
  const mins = Math.max(1, Math.round((r.startMs - r.travel * 60000 - nowMs) / 60000));
  const when = mins >= 60 ? `En ${fmtDur(mins)}` : `En ${mins} min`;
  const time = `${fmtTime(o.start)}–${fmtTime(o.end)}`;
  if (o.calendar === 'faculty') {
    const sj = getSubject(o.subjectId);
    return {
      title: r.travel ? `${when} salís para ${o.title}` : `${when}: ${o.title}`,
      body: [`${FACULTY_TYPES[o.facultyType] || 'Facultad'} ${time}`, o.room, sj && sj.name !== o.title ? sj.name : '', r.travel ? `traslado ${r.travel} min` : ''].filter(Boolean).join(' · '),
    };
  }
  const where = o.phone ? 'desde el teléfono' : 'necesitás la compu';
  return {
    title: `${when}: ${o.title}${needsExtraReminder(o) && !o.phone ? ' (compu)' : ''}`,
    body: [time, clientName(o.clientId), where, o.complexity === 'complex' ? 'compleja' : ''].filter(Boolean).join(' · '),
  };
}

function dailySummaryText(date) {
  const list = getOccurrences(date, date).sort((a, b) => a.start - b.start);
  const sum = summarize(date, date);
  const main = mainCur();
  if (!list.length) return { title: 'Hoy no tenés nada programado', body: 'Día libre en la agenda.' };
  const head = [`${list.length} ${list.length === 1 ? 'evento' : 'eventos'}`,
    sum.workMin ? `${fmtDur(sum.workMin)} de trabajo` : '',
    sum.facultyMin ? `${fmtDur(sum.facultyMin)} de facultad` : '',
    sum.incomeMain ? fmtMoney(sum.incomeMain, main) : ''].filter(Boolean).join(' · ');
  const items = list.slice(0, 5).map((o) => `${fmtTime(o.start)} ${o.title}`);
  if (list.length > 5) items.push(`y ${list.length - 5} más`);
  return { title: `Hoy: ${head}`, body: items.join('\n') };
}

async function showNotice(title, body, tag, occ) {
  if (document.visibilityState === 'visible') toast(`${title} · ${body.split('\n')[0]}`, { duration: 9000 });
  if (notifyPermission() !== 'granted') return;
  // En el teléfono con ntfy activo, el aviso ya llega por ntfy: no se duplica
  if (isMobile() && typeof pushActive === 'function' && pushActive()) return;
  const data = { url: location.href.split('#')[0], date: occ ? occ.date : null, key: occ ? occ.key : null };
  const opts = { body, tag, data, renotify: true };
  try {
    if (swRegistration) { await swRegistration.showNotification(title, opts); return; }
    const n = new Notification(title, opts);
    n.onclick = () => { window.focus(); n.close(); if (occ) focusOccurrence(occ.date, occ.key); };
  } catch (e) { /* el sistema no permitió mostrarla */ }
}

/* Se revisa cada 20 s: así los avisos no dependen de temporizadores largos que el navegador puede pausar */
function notifyTick() {
  const s = DB.settings;
  if (!s.notifyEnabled) return;
  const now = Date.now();
  let changed = false;
  for (const r of upcomingReminders(now - LATE_TOLERANCE, now)) {
    if (notified[r.id] || r.startMs <= now) continue;
    notified[r.id] = now;
    changed = true;
    const t = reminderText(r, now);
    showNotice(t.title, t.body, r.id, r.o);
  }
  if (s.notifyDaily) {
    const today = todayYmd();
    const [hh, mm] = String(s.notifyDailyTime || '08:00').split(':').map(Number);
    const [y, mo, d] = today.split('-').map(Number);
    const at = new Date(y, mo - 1, d, hh || 0, mm || 0).getTime();
    const id = 'daily|' + today;
    if (!notified[id] && now >= at && now - at < DAILY_WINDOW) {
      notified[id] = now;
      changed = true;
      const t = dailySummaryText(today);
      showNotice(t.title, t.body, id, null);
    }
  }
  if (changed) saveNotified();
}

async function enableNotifications() {
  if (!notifySupported()) {
    toast('Este navegador no permite avisos. En iPhone: agregá la agenda a la pantalla de inicio y activalos desde ahí.', { kind: 'error', duration: 8000 });
    return false;
  }
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    toast('Los avisos están bloqueados para esta página. Permitilos desde el candado de la barra de direcciones.', { kind: 'error', duration: 8000 });
    return false;
  }
  // Los avisos de hoy que ya pasaron no se muestran de golpe al activar
  const now = Date.now();
  for (const r of upcomingReminders(now - LATE_TOLERANCE, now)) notified[r.id] = now;
  saveNotified();
  return true;
}

function testNotification() {
  const next = upcomingReminders(Date.now(), Date.now() + 7 * 864e5).sort((a, b) => a.at - b.at)[0];
  if (next) {
    const t = reminderText(next, next.startMs - next.lead * 60000 - next.travel * 60000);
    showNotice(t.title, t.body, 'test', next.o);
  } else {
    showNotice('Así se ven los avisos', 'En 15 min: tu próximo evento', 'test', null);
  }
  if (notifyPermission() !== 'granted') toast('Para ver el aviso del sistema, activá los avisos primero.');
}

function notifyStatusText() {
  const p = notifyPermission();
  if (p === 'unsupported') return { cls: 'err', text: 'Este navegador no permite avisos' };
  if (p === 'denied') return { cls: 'err', text: 'Bloqueados en el navegador' };
  if (!DB.settings.notifyEnabled) return { cls: 'off', text: 'Desactivados' };
  if (p !== 'granted') return { cls: 'warn', text: 'Falta dar permiso' };
  return { cls: 'ok', text: 'Activados en este dispositivo' };
}

function initNotify() {
  loadNotified();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then((reg) => { swRegistration = reg; }).catch(() => { /* sin service worker: se usa Notification */ });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'focus-occ' && e.data.key) focusOccurrence(e.data.date, e.data.key);
    });
  }
  clearInterval(notifyTimer);
  notifyTimer = setInterval(notifyTick, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) notifyTick(); });
  notifyTick();
}
