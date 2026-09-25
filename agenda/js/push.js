'use strict';
/* Avisos en el teléfono aunque la agenda esté cerrada, con la app gratuita ntfy (sin cuenta).
   Cada vez que la agenda está abierta en algún dispositivo, deja programados en ntfy.sh los avisos de los
   próximos días. ntfy los entrega a la hora justa aunque todo esté cerrado. Si un evento cambia o se borra,
   el aviso programado se reemplaza o se cancela (cada aviso tiene un identificador fijo). */

const NTFY_URL = (window.AGENDA_NTFY_URL || 'https://ntfy.sh').replace(/\/$/, '');
const PUSH_HORIZON = 70 * 3600000;   // ntfy.sh acepta hasta 3 días de anticipación
const PUSH_MIN_DELAY = 15000;        // ntfy exige al menos 10 s de demora para programar
const PUSH_BATCH = 40;               // pedidos por tanda (ntfy.sh permite ráfagas de 60)
const PUSH_DAILY_BUDGET = 200;       // ntfy.sh admite 250 mensajes por día desde cada conexión
const PUSH_SENT_KEY = 'agendaSemanal:pushSent:v1';

let pushTimer = null;
let pushRunning = false;
let pushAgain = false;
let pushStatus = { ok: null, text: '', at: 0 };

function pushActive() { return !!DB.settings.pushTopic; }

function pushSeq(prefix, parts) { return (prefix + '-' + parts.join('-')).replace(/[^-_A-Za-z0-9]/g, '').slice(0, 64); }

/* Envíos de las últimas 24 h desde este dispositivo (el límite de ntfy.sh es por conexión) */
function loadSent(now) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(PUSH_SENT_KEY) || '[]'); } catch (e) { list = []; }
  return Array.isArray(list) ? list.filter((t) => t > now - 864e5) : [];
}

function saveSent(list) {
  try { localStorage.setItem(PUSH_SENT_KEY, JSON.stringify(list)); } catch (e) { /* sin almacenamiento */ }
}

function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* Momento (ms) de una hora 'HH:MM' en una fecha, más unos minutos */
function timeOn(date, hhmm, plus = 0) {
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, 0, (parseTime(hhmm) ?? 0) + plus).getTime();
}

/* Lo que debería estar programado en ntfy ahora mismo */
function desiredPushes(now) {
  const s = DB.settings;
  const out = new Map();
  // long: resumen extenso (se lee entero al tocarlo en ntfy)
  const add = (seq, at, t, tags, priority, long) => {
    if (t && at > now && at <= now + PUSH_HORIZON) out.set(seq, { seq, at, title: t.title, message: t.body, tags, priority, long: !!long });
  };
  const base = Number(s.notifyMinutes) || 15;
  for (const r of upcomingReminders(now - LATE_TOLERANCE, now + PUSH_HORIZON)) {
    if (r.startMs <= now || r.at < now - LATE_TOLERANCE) continue;
    const t = reminderText(r, Math.max(r.at, now));
    const o = r.o;
    const tags = o.calendar === 'faculty' ? ['mortar_board'] : [o.phone ? 'iphone' : 'computer'];
    const seq = pushSeq('r', [o.eventId, o.origDate.replace(/-/g, ''), r.lead]);
    out.set(seq, { seq, at: r.at, title: t.title, message: t.body, tags, priority: (needsExtraReminder(o) || o.start < 6 * 60) && r.lead === base ? 4 : 3 });
  }
  const today = todayYmd();
  const morning = s.notifyDailyTime || '08:00';
  for (let i = 0; i <= 3; i++) {
    const date = addDays(today, i);
    const ds = date.replace(/-/g, '');
    if (s.notifyDaily) add(pushSeq('dia', [ds]), timeOn(date, morning), morningDigest(date, parseTime(morning) ?? 0), ['sunny'], 3, true);
    if (s.notifyClasses) add(pushSeq('clases', [ds]), timeOn(date, morning, 1), classesDigest(date), ['mortar_board'], 3);
    if (s.notifyWeekly && weekdayOf(date) === s.weekStart) add(pushSeq('semana', [ds]), timeOn(date, morning, 2), weeklyDigest(date), ['calendar'], 3, true);
    if (s.notifyEvening) add(pushSeq('manana', [ds]), timeOn(date, s.notifyEveningTime || '21:00'), eveningDigest(date), ['crescent_moon'], 3, true);
    if (s.notifyMoney) {
      for (const r of DB.receivables) {
        if (r.dueDate === date && receivableStatus(r) !== 'paid') add(pushSeq('cobro', [r.id, ds]), timeOn(date, morning, 1), paymentDue(r), ['moneybag'], 3);
      }
    }
  }
  if (s.notifyExams) {
    for (const o of upcomingExams(today, EXAM_DAYS[0] + 3)) {
      for (const n of EXAM_DAYS) {
        const at = timeOn(addDays(o.date, -n), morning, 1);
        if (at < occStartMs(o)) add(pushSeq('examen', [o.eventId, o.origDate.replace(/-/g, ''), n]), at, examCountdown(o, n), ['memo'], n <= 1 ? 4 : 3, true);
      }
    }
  }
  if (s.notifyNight) {
    // Lo que cae de madrugada: aviso la noche anterior (o esa misma madrugada, si la hora elegida es después de las 00)
    const nightMin = parseTime(s.notifyNightTime || '22:30') ?? 0;
    for (const o of getOccurrences(today, addDays(today, 3))) {
      if (o.start >= 6 * 60) continue;
      const at = timeOn(nightMin < 12 * 60 ? o.date : addDays(o.date, -1), s.notifyNightTime || '22:30');
      if (at < occStartMs(o)) add(pushSeq('noche', [o.eventId, o.origDate.replace(/-/g, '')]), at, nightWarning(o), ['crescent_moon'], 4);
    }
  }
  return out;
}

async function ntfyPublish(p, now) {
  const body = { topic: DB.settings.pushTopic, sequence_id: p.seq, title: p.title, message: p.message, tags: p.tags, priority: p.priority };
  // Los resúmenes largos se abren en ntfy para leerlos enteros; el botón lleva a la agenda
  if (p.long) body.actions = [{ action: 'view', label: 'Abrir agenda', url: PUBLIC_URL }];
  else body.click = PUBLIC_URL;
  if (p.at - now >= PUSH_MIN_DELAY) body.delay = String(Math.floor(p.at / 1000));
  // Cuerpo como texto plano: pedido "simple", sin verificación previa de CORS
  const res = await fetch(NTFY_URL + '/', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw Object.assign(new Error('ntfy ' + res.status), { status: res.status });
}

async function ntfyCancel(seq) {
  const res = await fetch(`${NTFY_URL}/${encodeURIComponent(DB.settings.pushTopic)}/${encodeURIComponent(seq)}/delete`);
  if (!res.ok && res.status !== 404) throw Object.assign(new Error('ntfy ' + res.status), { status: res.status });
}

/* Compara lo que debería estar programado con lo ya enviado (registro compartido entre dispositivos) */
async function pushSchedule() {
  if (!pushActive()) return;
  if (pushRunning) { pushAgain = true; return; }
  pushRunning = true;
  const now = Date.now();
  const log = DB.pushLog;
  const want = desiredPushes(now);
  const jobs = [];
  for (const p of want.values()) {
    const h = hashText([p.at, p.title, p.message, p.priority, DB.settings.pushTopic].join('|'));
    const prev = log[p.seq];
    // Ya enviado y sin cambios, o ya demasiado cerca para reprogramarlo
    if (prev && !prev.del && (prev.h === h || p.at <= now + PUSH_MIN_DELAY)) continue;
    jobs.push({ kind: 'pub', p, h, update: !!(prev && !prev.del) });
  }
  for (const [seq, e] of Object.entries(log)) {
    if (e.del || want.has(seq) || e.at <= now + 5000 || e.topic !== DB.settings.pushTopic) continue;
    jobs.push({ kind: 'del', seq, e });
  }
  jobs.sort((a, b) => (a.kind === 'del' ? a.e.at : a.p.at) - (b.kind === 'del' ? b.e.at : b.p.at));
  // Tope diario: primero lo más próximo; con poco margen, los cambios de avisos lejanos esperan a estar más cerca
  const sent = loadSent(now);
  const run = [];
  let deferred = 0;
  for (const j of jobs) {
    if (run.length >= PUSH_BATCH) break;
    const used = sent.length + run.length;
    if (used >= PUSH_DAILY_BUDGET || (j.update && used >= PUSH_DAILY_BUDGET * 0.6 && j.p.at - now > 12 * 3600000)) { deferred++; continue; }
    run.push(j);
  }
  let done = 0, failed = null;
  for (const j of run) {
    try {
      if (j.kind === 'pub') {
        await ntfyPublish(j.p, Date.now());
        log[j.p.seq] = { at: j.p.at, h: j.h, t: Date.now(), topic: DB.settings.pushTopic };
      } else {
        await ntfyCancel(j.seq);
        log[j.seq] = Object.assign({}, j.e, { del: true, t: Date.now() });
      }
      sent.push(Date.now());
      done++;
    } catch (e) {
      failed = e;
      break; // sin conexión o límite de ntfy: se reintenta en la próxima vuelta
    }
  }
  saveSent(sent);
  // Limpieza de avisos viejos
  for (const [seq, e] of Object.entries(log)) if (e.at < now - 864e5) delete log[seq];
  if (done || failed) {
    saveDB();
    if (done && typeof syncLocalChange === 'function') syncLocalChange();
  }
  const pending = Object.values(log).filter((e) => !e.del && e.at > Date.now()).length;
  const text = `${pending} ${pending === 1 ? 'aviso programado' : 'avisos programados'} para los próximos días`;
  pushStatus = failed
    ? { ok: false, text: failed.status === 429 ? 'ntfy pidió esperar un poco; se reintenta solo' : 'No se pudo conectar con ntfy; se reintenta solo', at: Date.now() }
    : deferred && sent.length >= PUSH_DAILY_BUDGET
      ? { ok: false, text: `${text}. Por hoy se llegó al límite de ntfy: el resto se programa más tarde`, at: Date.now() }
      : { ok: true, text, at: Date.now() };
  pushRunning = false;
  renderPushStatus();
  if (pushAgain || (!failed && jobs.length - deferred > run.length)) { pushAgain = false; setTimeout(pushSchedule, failed ? 60000 : 6000); }
  else if (failed) setTimeout(pushSchedule, 60000);
}

/* Llamado después de cada cambio: se agrupan los cambios seguidos */
let pushDebounce = null;
function pushLocalChange() {
  if (!pushActive()) return;
  clearTimeout(pushDebounce);
  pushDebounce = setTimeout(pushSchedule, 4000);
}

/* ---------- Activar / desactivar ---------- */

async function enablePush() {
  const topic = 'agenda-' + randomCode(22);
  commit((d) => { d.settings.pushTopic = topic; });
  renderSettings();
  await pushTest(true);
  pushSchedule();
}

async function disablePush() {
  const ok = await confirmDialog({
    title: 'Desactivar avisos en el teléfono',
    message: 'Se cancelan los avisos ya programados y la agenda deja de mandar avisos a ntfy. Después podés borrar la suscripción en la app ntfy.',
    confirmText: 'Desactivar', danger: true,
  });
  if (!ok) return;
  const topic = DB.settings.pushTopic;
  const now = Date.now();
  for (const [seq, e] of Object.entries(DB.pushLog)) {
    if (e.del || e.at <= now || e.topic !== topic) continue;
    try { await ntfyCancel(seq); } catch (err) { break; }
    DB.pushLog[seq] = Object.assign({}, e, { del: true, t: Date.now() });
  }
  commit((d) => { d.settings.pushTopic = ''; });
  toast('Avisos en el teléfono desactivados');
}

function pushErrorText(e) {
  return e.status === 429 ? 'ntfy pidió esperar un poco. Probá de nuevo en un minuto.' : 'No se pudo conectar con ntfy. Revisá la conexión e intentá de nuevo.';
}

async function pushTest(first) {
  try {
    await ntfyPublish({
      seq: 'prueba-' + Date.now().toString(36), at: Date.now(), tags: ['wave'], priority: 3,
      title: first ? 'Avisos de la agenda activados' : 'Aviso de prueba de la agenda',
      message: 'Así te van a llegar los avisos: «En 15 min: BMS Spanish check».',
    }, Date.now());
    if (!first) toast('Aviso de prueba enviado. Si tenés ntfy suscripto, ya te llegó.');
  } catch (e) {
    toast(pushErrorText(e), { kind: 'error' });
  }
}

/* Mandar ya un resumen, para leerlo en el teléfono */
async function pushNow(kind) {
  const today = todayYmd();
  const d = new Date();
  const t = kind === 'semana' ? weeklyDigest(startOfWeek(today, DB.settings.weekStart))
    : kind === 'manana' ? eveningDigest(today)
      : morningDigest(today, d.getHours() * 60 + d.getMinutes());
  try {
    await ntfyPublish({ seq: 'ya-' + Date.now().toString(36), at: Date.now(), title: t.title, message: t.body, tags: ['memo'], priority: 3, long: true }, Date.now());
    toast('Enviado. Tocalo en el teléfono para leerlo entero.');
  } catch (e) {
    toast(pushErrorText(e), { kind: 'error' });
  }
}

/* ---------- Interfaz ---------- */

function pushUpcomingHtml() {
  const list = [...desiredPushes(Date.now()).values()].sort((a, b) => a.at - b.at);
  if (!list.length) return '<p class="muted small">No hay avisos para los próximos 3 días.</p>';
  const when = (ms) => {
    const d = new Date(ms);
    const date = ymd(d);
    return `${date === todayYmd() ? 'hoy' : dayShort(date)} ${fmtTime(d.getHours() * 60 + d.getMinutes())}`;
  };
  return `<details class="push-next"><summary>Ver los próximos avisos (${list.length})</summary>
    <ul>${list.map((p) => `<li><span>${esc(when(p.at))}</span>${esc(p.title)}</li>`).join('')}</ul></details>`;
}

function renderPushStatus() {
  const el = document.getElementById('pushStatusLine');
  if (el) el.innerHTML = pushStatusHtml();
}

function pushStatusHtml() {
  if (!pushActive()) return '';
  const cls = pushStatus.ok === false ? 'warn' : pushStatus.ok ? 'ok' : 'wait';
  return `<i class="sync-dot is-${cls}"></i><b>${esc(pushStatus.text || 'Programando avisos…')}</b>`;
}

function pushBlockHtml() {
  const topic = DB.settings.pushTopic;
  const android = `ntfy://ntfy.sh/${topic}?display=Agenda`;
  if (!topic) {
    return `<h2>${icon('phone')} Avisos en el teléfono, aunque la agenda esté cerrada</h2>
      <p>Te llegan como cualquier notificación del teléfono, con todo cerrado. Usa la app gratuita <b>ntfy</b> (sin cuenta).</p>
      <div class="btn-row"><button class="btn btn-primary" data-action="push-enable">${icon('phone')} Activar avisos en el teléfono</button></div>
      <p class="muted small">La agenda deja programados los avisos de los próximos 3 días cada vez que la abrís en cualquier dispositivo. El título y la hora de cada aviso pasan por el servicio público ntfy.sh, en un canal con nombre secreto.</p>`;
  }
  return `<h2>${icon('phone')} Avisos en el teléfono, aunque la agenda esté cerrada</h2>
    <p class="sync-line" id="pushStatusLine">${pushStatusHtml()}</p>
    <ol class="push-steps">
      <li>Instalá la app gratuita <b>ntfy</b>:
        <a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" rel="noopener">Android</a> ·
        <a href="https://apps.apple.com/us/app/ntfy/id1625396347" target="_blank" rel="noopener">iPhone</a></li>
      <li>Suscribite a tu canal de avisos:
        <div class="push-sub">
          <a class="btn btn-sm" href="${esc(android)}">${icon('phone')} Android: abrir en ntfy</a>
          <span class="muted small">iPhone: en ntfy tocá <b>+</b> y pegá el nombre del canal:</span>
          <span class="pair-link push-topic"><input readonly value="${esc(topic)}" aria-label="Nombre del canal"><button type="button" class="btn btn-sm" data-action="push-copy">${icon('copy')} Copiar</button></span>
        </div>
      </li>
      <li>Probá que llegue: <button class="btn btn-sm" data-action="push-test">Enviar aviso de prueba</button></li>
    </ol>
    <p class="muted small">Estos pasos se hacen una sola vez, desde el teléfono. Los avisos siguen la configuración de arriba. La agenda los deja programados para los próximos 3 días: si pasan más de 3 días sin abrirla en ningún dispositivo, dejan de llegar hasta que la abras.</p>
    <p class="muted small">Los resúmenes largos se leen enteros tocándolos en ntfy. Mandarme ahora:</p>
    <div class="btn-row">
      <button class="btn btn-sm" data-action="push-now" data-kind="hoy">Resumen de hoy</button>
      <button class="btn btn-sm" data-action="push-now" data-kind="manana">Resumen de mañana</button>
      <button class="btn btn-sm" data-action="push-now" data-kind="semana">Resumen de la semana</button>
    </div>
    ${pushUpcomingHtml()}
    <div class="btn-row"><button class="btn btn-ghost btn-danger-text" data-action="push-disable">Desactivar avisos en el teléfono</button></div>`;
}

function initPush() {
  clearInterval(pushTimer);
  pushTimer = setInterval(pushSchedule, 120000);
  // Primera vuelta con unos segundos de margen, para que se sincronice antes con los otros dispositivos
  setTimeout(pushSchedule, isPaired() ? 8000 : 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pushLocalChange(); });
}
