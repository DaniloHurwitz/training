'use strict';
/* Avisos en el teléfono aunque la agenda esté cerrada, con la app gratuita ntfy (sin cuenta).
   Cada vez que la agenda está abierta en algún dispositivo, deja programados en ntfy.sh los avisos de los
   próximos días. ntfy los entrega a la hora justa aunque todo esté cerrado. Si un evento cambia o se borra,
   el aviso programado se reemplaza o se cancela (cada aviso tiene un identificador fijo). */

const NTFY_URL = (window.AGENDA_NTFY_URL || 'https://ntfy.sh').replace(/\/$/, '');
const PUSH_HORIZON = 70 * 3600000;   // ntfy.sh acepta hasta 3 días de anticipación
const PUSH_MIN_DELAY = 15000;        // ntfy exige al menos 10 s de demora para programar
const PUSH_BATCH = 40;               // pedidos por tanda (ntfy.sh permite ráfagas de 60)

let pushTimer = null;
let pushRunning = false;
let pushAgain = false;
let pushStatus = { ok: null, text: '', at: 0 };

function pushActive() { return !!DB.settings.pushTopic; }

function pushSeq(prefix, parts) { return (prefix + '-' + parts.join('-')).replace(/[^-_A-Za-z0-9]/g, '').slice(0, 64); }

function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/* Lo que debería estar programado en ntfy ahora mismo */
function desiredPushes(now) {
  const s = DB.settings;
  const out = new Map();
  for (const r of upcomingReminders(now - LATE_TOLERANCE, now + PUSH_HORIZON)) {
    if (r.startMs <= now || r.at < now - LATE_TOLERANCE) continue;
    const t = reminderText(r, Math.max(r.at, now));
    const o = r.o;
    const tags = o.calendar === 'faculty' ? ['mortar_board'] : [o.phone ? 'iphone' : 'computer'];
    const seq = pushSeq('r', [o.eventId, o.origDate.replace(/-/g, ''), r.lead]);
    out.set(seq, { seq, at: r.at, title: t.title, message: t.body, tags, priority: needsExtraReminder(o) && r.lead === (Number(s.notifyMinutes) || 15) ? 4 : 3 });
  }
  if (s.notifyDaily) {
    const [hh, mm] = String(s.notifyDailyTime || '08:00').split(':').map(Number);
    for (let i = 0; i <= 3; i++) {
      const date = addDays(todayYmd(), i);
      const [y, mo, d] = date.split('-').map(Number);
      const at = new Date(y, mo - 1, d, hh || 0, mm || 0).getTime();
      if (at <= now || at > now + PUSH_HORIZON) continue;
      const t = dailySummaryText(date);
      const seq = pushSeq('dia', [date.replace(/-/g, '')]);
      out.set(seq, { seq, at, title: t.title, message: t.body, tags: ['spiral_calendar'], priority: 3 });
    }
  }
  return out;
}

async function ntfyPublish(p, now) {
  const body = { topic: DB.settings.pushTopic, sequence_id: p.seq, title: p.title, message: p.message, tags: p.tags, priority: p.priority, click: PUBLIC_URL };
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
    jobs.push({ kind: 'pub', p, h });
  }
  for (const [seq, e] of Object.entries(log)) {
    if (e.del || want.has(seq) || e.at <= now + 5000 || e.topic !== DB.settings.pushTopic) continue;
    jobs.push({ kind: 'del', seq, e });
  }
  jobs.sort((a, b) => (a.kind === 'del' ? a.e.at : a.p.at) - (b.kind === 'del' ? b.e.at : b.p.at));
  let done = 0, failed = null;
  for (const j of jobs.slice(0, PUSH_BATCH)) {
    try {
      if (j.kind === 'pub') {
        await ntfyPublish(j.p, Date.now());
        log[j.p.seq] = { at: j.p.at, h: j.h, t: Date.now(), topic: DB.settings.pushTopic };
      } else {
        await ntfyCancel(j.seq);
        log[j.seq] = Object.assign({}, j.e, { del: true, t: Date.now() });
      }
      done++;
    } catch (e) {
      failed = e;
      break; // sin conexión o límite de ntfy: se reintenta en la próxima vuelta
    }
  }
  // Limpieza de avisos viejos
  for (const [seq, e] of Object.entries(log)) if (e.at < now - 864e5) delete log[seq];
  if (done || failed) {
    saveDB();
    if (done && typeof syncLocalChange === 'function') syncLocalChange();
  }
  const pending = Object.values(log).filter((e) => !e.del && e.at > Date.now()).length;
  pushStatus = failed
    ? { ok: false, text: failed.status === 429 ? 'ntfy pidió esperar un poco; se reintenta solo' : 'No se pudo conectar con ntfy; se reintenta solo', at: Date.now() }
    : { ok: true, text: `${pending} ${pending === 1 ? 'aviso programado' : 'avisos programados'} para los próximos días`, at: Date.now() };
  pushRunning = false;
  renderPushStatus();
  if (pushAgain || (!failed && jobs.length > PUSH_BATCH)) { pushAgain = false; setTimeout(pushSchedule, failed ? 60000 : 6000); }
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

async function pushTest(first) {
  try {
    await ntfyPublish({
      seq: 'prueba-' + Date.now().toString(36), at: Date.now(), tags: ['wave'], priority: 3,
      title: first ? 'Avisos de la agenda activados' : 'Aviso de prueba de la agenda',
      message: 'Así te van a llegar los avisos: «En 15 min: BMS Spanish check».',
    }, Date.now());
    if (!first) toast('Aviso de prueba enviado. Si tenés ntfy suscripto, ya te llegó.');
  } catch (e) {
    toast('No se pudo conectar con ntfy. Revisá la conexión e intentá de nuevo.', { kind: 'error' });
  }
}

/* ---------- Interfaz ---------- */

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
    <p class="muted small">Estos pasos se hacen una sola vez, desde el teléfono. Los avisos siguen la configuración de arriba (minutos antes, doble aviso para tareas con compu, resumen del día). La agenda los deja programados para los próximos 3 días: si pasan más de 3 días sin abrirla en ningún dispositivo, dejan de llegar hasta que la abras.</p>
    <div class="btn-row"><button class="btn btn-ghost btn-danger-text" data-action="push-disable">Desactivar avisos en el teléfono</button></div>`;
}

function initPush() {
  clearInterval(pushTimer);
  pushTimer = setInterval(pushSchedule, 120000);
  // Primera vuelta con unos segundos de margen, para que se sincronice antes con los otros dispositivos
  setTimeout(pushSchedule, isPaired() ? 8000 : 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pushLocalChange(); });
}
