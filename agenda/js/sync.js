'use strict';
/* Sincronización entre dispositivos, sin cuentas:
   los dispositivos se vinculan una vez con un código QR y se pasan los datos por una conexión directa
   y cifrada (WebRTC, con PeerJS). El servidor público de PeerJS solo los ayuda a encontrarse;
   los datos no quedan guardados en ningún servidor. */

const SYNC_KEY = 'agendaSemanal:sync:v1';
const PUBLIC_URL = 'https://danilohurwitz.github.io/training/agenda/';
const SYNC_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

let SYNC = null;              // { secret, slot, name, peers: { [slot]: { name, lastSeen, lastSync } } }
let syncPeer = null;
let syncIds = null;           // { base } derivado del código secreto
let syncState = 'off';        // off | connecting | online | offline | busy | unsupported
const syncConns = new Map();  // slot -> conexión verificada
const syncDialing = new Map(); // slot -> { conn, at }
let syncSendTimer = null;
let syncRetryTimer = null;
let syncRestartTimer = null;
let syncLastToast = 0;
let syncAttempts = 0;          // reintentos seguidos sin conectar (espera creciente)
let pairingModal = null;

/* ---------- Estado local de la vinculación ---------- */

function loadSyncState() {
  try { SYNC = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch (e) { SYNC = null; }
  if (SYNC && !SYNC.peers) SYNC.peers = {};
}

function saveSyncState() {
  try {
    if (SYNC) localStorage.setItem(SYNC_KEY, JSON.stringify(SYNC)); else localStorage.removeItem(SYNC_KEY);
  } catch (e) { /* sin almacenamiento */ }
}

function isPaired() { return !!(SYNC && SYNC.secret); }

function deviceName() { return isMobile() ? 'Teléfono' : 'Computadora'; }

function randomCode(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => SYNC_ALPHABET[b % 32]).join('');
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });
}

function pairingLink() {
  const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : PUBLIC_URL;
  return `${base}#vincular=${SYNC.secret}`;
}

function peerIdFor(slot) { return `${syncIds.base}-${slot}`; }

/* ---------- Conexión ---------- */

async function startSync() {
  if (!isPaired() || syncPeer) return;
  if (!window.RTCPeerConnection || !(window.crypto && crypto.subtle)) { setSyncState('unsupported'); return; }
  setSyncState('connecting');
  try {
    if (typeof Peer === 'undefined') await loadScript('js/vendor/peerjs.min.js');
    if (!syncIds) syncIds = { base: 'agenda-' + (await sha256hex('id:' + SYNC.secret)).slice(0, 24) };
  } catch (e) {
    setSyncState('offline');
    scheduleSyncRestart();
    return;
  }
  if (!isPaired() || syncPeer) return;
  const peer = syncPeer = new Peer(peerIdFor(SYNC.slot), Object.assign({ debug: 0 }, window.AGENDA_PEER_OPTIONS || {}));
  peer.on('open', () => { if (peer === syncPeer) { syncAttempts = 0; setSyncState('online'); dialPeers(); } });
  peer.on('connection', (c) => { if (peer === syncPeer) setupConn(c, null); });
  peer.on('disconnected', () => {
    if (peer !== syncPeer || peer.destroyed) return;
    setSyncState('offline');
    setTimeout(() => { if (peer === syncPeer && peer.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch (e) { /* reintenta el temporizador */ } } }, 3000);
  });
  peer.on('error', (err) => onPeerError(peer, err));
  clearInterval(syncRetryTimer);
  syncRetryTimer = setInterval(dialPeers, 15000);
}

function onPeerError(peer, err) {
  if (peer !== syncPeer) return;
  const type = err && err.type;
  if (type === 'peer-unavailable') return; // el otro dispositivo no tiene la agenda abierta ahora
  stopPeer();
  if (type === 'browser-incompatible') { setSyncState('unsupported'); return; }
  // unavailable-id: otra pestaña ya sincroniza, o el servidor todavía no liberó la conexión anterior
  setSyncState(type === 'unavailable-id' ? 'busy' : 'offline');
  scheduleSyncRestart();
}

function scheduleSyncRestart() {
  clearTimeout(syncRestartTimer);
  const ms = Math.min(30000, 2000 * 2 ** syncAttempts++);
  syncRestartTimer = setTimeout(() => { if (isPaired() && !syncPeer) startSync(); }, ms);
}

function stopPeer() {
  clearInterval(syncRetryTimer);
  for (const c of syncConns.values()) { try { c.close(); } catch (e) { /* ya cerrada */ } }
  syncConns.clear();
  syncDialing.clear();
  if (syncPeer) {
    const p = syncPeer;
    syncPeer = null;
    try { p.destroy(); } catch (e) { /* ya cerrado */ }
  }
}

function knownSlots() {
  return [...new Set([0, ...Object.keys(SYNC.peers).map(Number)])].filter((s) => s !== SYNC.slot);
}

/* Cada dispositivo llama a los de número menor, así no se duplican las conexiones */
function dialPeers() {
  const peer = syncPeer;
  if (!peer || peer.destroyed) return;
  if (peer.disconnected) { try { peer.reconnect(); } catch (e) { /* reintenta luego */ } return; }
  if (!peer.open) return;
  for (const slot of knownSlots()) {
    if (slot >= SYNC.slot || syncConns.has(slot)) continue;
    const d = syncDialing.get(slot);
    if (d && Date.now() - d.at < 12000) continue;
    if (d) { try { d.conn.close(); } catch (e) { /* intento viejo */ } }
    setupConn(peer.connect(peerIdFor(slot), { reliable: true }), slot);
  }
}

/* Cada lado prueba que conoce el código secreto respondiendo al desafío del otro */
function proofFor(nonce, slot) { return sha256hex(`proof:${SYNC.secret}:${nonce}:${slot}`); }

function setupConn(c, dialSlot) {
  const nonce = randomCode(16);
  let remote = null;
  let verified = false;
  let early = null; // estado recibido antes de terminar la verificación
  if (dialSlot != null) syncDialing.set(dialSlot, { conn: c, at: Date.now() });
  const drop = () => {
    if (dialSlot != null && syncDialing.get(dialSlot) && syncDialing.get(dialSlot).conn === c) syncDialing.delete(dialSlot);
    if (verified && syncConns.get(remote.slot) === c) { syncConns.delete(remote.slot); renderSyncStatus(); }
  };
  c.on('open', () => {
    // Solo se anuncian dispositivos vistos en los últimos 60 días
    const recent = Object.entries(SYNC.peers).filter(([, p]) => p.lastSeen && Date.now() - p.lastSeen < 60 * 864e5).map(([k]) => Number(k));
    c.send({ t: 'hello', v: 1, nonce, slot: SYNC.slot, name: SYNC.name, slots: [SYNC.slot, ...recent] });
  });
  c.on('data', async (msg) => {
    if (!msg || typeof msg !== 'object' || !isPaired()) return;
    if (msg.t === 'hello' && !remote) {
      if (typeof msg.slot !== 'number' || msg.slot === SYNC.slot || typeof msg.nonce !== 'string') { c.close(); return; }
      remote = { slot: msg.slot, name: String(msg.name || 'Dispositivo').slice(0, 40), slots: Array.isArray(msg.slots) ? msg.slots : [] };
      c.send({ t: 'proof', proof: await proofFor(msg.nonce, SYNC.slot) });
      return;
    }
    if (msg.t === 'proof' && remote && !verified) {
      if (msg.proof !== await proofFor(nonce, remote.slot)) { c.close(); return; }
      verified = true;
      onVerified(c, remote);
      if (early) receiveJSON(c, remote.slot, early);
      early = null;
      return;
    }
    if (msg.t === 'bye' && verified) {
      // El otro dispositivo se desvinculó
      delete SYNC.peers[remote.slot];
      saveSyncState();
      c.close();
      renderSyncStatus();
      return;
    }
    if (msg.t === 'state' && typeof msg.json === 'string') {
      if (verified) receiveJSON(c, remote.slot, msg.json); else early = msg.json;
    }
  });
  c.on('close', drop);
  c.on('error', drop);
}

function onVerified(c, remote) {
  syncDialing.delete(remote.slot);
  const old = syncConns.get(remote.slot);
  if (old && old !== c) { try { old.close(); } catch (e) { /* reemplazada */ } }
  syncConns.set(remote.slot, c);
  const isNew = !SYNC.peers[remote.slot] || !SYNC.peers[remote.slot].lastSeen;
  SYNC.peers[remote.slot] = Object.assign(SYNC.peers[remote.slot] || {}, { name: remote.name, lastSeen: Date.now() });
  for (const s of remote.slots) {
    if (typeof s === 'number' && s !== SYNC.slot && !SYNC.peers[s]) SYNC.peers[s] = { name: 'Dispositivo', lastSeen: 0 };
  }
  saveSyncState();
  sendState(c, true);
  renderSyncStatus();
  if (isNew && pairingModal) pairingModal.done(remote.name);
}

function sendState(c, force) {
  if (!c.open) return;
  const p = syncPayload(DB);
  const digest = payloadDigest(p);
  if (!force && c._sentDigest === digest) return;
  c._sentDigest = digest;
  c.send({ t: 'state', json: JSON.stringify(p) });
}

function receiveJSON(c, slot, json) {
  let data = null;
  try { data = JSON.parse(json); } catch (e) { return; }
  receiveState(c, slot, data);
}

function receiveState(c, slot, data) {
  if (typeof dragState !== 'undefined' && dragState && dragState.active) {
    setTimeout(() => receiveState(c, slot, data), 700);
    return;
  }
  const changed = mergeRemote(DB, data);
  if (changed) {
    invalidateCaches();
    saveDB();
    renderAll();
  }
  if (SYNC.peers[slot]) SYNC.peers[slot].lastSync = SYNC.peers[slot].lastSeen = Date.now();
  saveSyncState();
  // Si el otro no tiene todo lo que tenemos acá, se lo mandamos (una vez por versión)
  if (payloadDigest(syncPayload(DB)) !== payloadDigest(data)) sendState(c);
  renderSyncStatus();
  if (changed && Date.now() - syncLastToast > 15000) {
    syncLastToast = Date.now();
    toast(`Sincronizado con ${(SYNC.peers[slot] && SYNC.peers[slot].name) || 'otro dispositivo'}`);
  }
}

/* Se llama después de cada cambio guardado */
function syncLocalChange() {
  if (!syncConns.size) return;
  clearTimeout(syncSendTimer);
  syncSendTimer = setTimeout(() => { for (const c of syncConns.values()) sendState(c); }, 500);
}

/* ---------- Estado visible ---------- */

function setSyncState(s) {
  syncState = s;
  renderSyncStatus();
}

function syncSummary() {
  if (!isPaired()) return { cls: 'off', text: 'Sin vincular' };
  if (syncState === 'unsupported') return { cls: 'err', text: 'Este navegador no puede sincronizar' };
  if (syncState === 'busy') return { cls: 'wait', text: 'Reconectando…' };
  if (syncState === 'connecting') return { cls: 'wait', text: 'Conectando…' };
  if (syncState === 'offline') return { cls: 'warn', text: 'Sin conexión · reintentando' };
  const names = [...syncConns.keys()].map((s) => (SYNC.peers[s] && SYNC.peers[s].name) || 'Dispositivo');
  if (names.length) return { cls: 'ok', text: 'Conectado con ' + names.join(', ') };
  const last = Math.max(0, ...Object.values(SYNC.peers).map((p) => p.lastSync || 0));
  return { cls: 'idle', text: last ? `Vinculado · sincronizado ${fmtRelative(new Date(last).toISOString())}` : 'Vinculado · esperando al otro dispositivo' };
}

function renderSyncStatus() {
  const st = syncSummary();
  const side = document.getElementById('syncStatus');
  if (side) {
    side.innerHTML = `<i class="sync-dot is-${st.cls}"></i><span>${esc(isPaired() ? st.text : 'Vincular teléfono')}</span>`;
    side.title = st.text;
  }
  const block = document.getElementById('syncBlock');
  if (block) block.innerHTML = syncBlockHtml();
  if (pairingModal) pairingModal.refresh();
}

function syncBlockHtml() {
  const st = syncSummary();
  if (!isPaired()) {
    return `<h2>${icon('phone')} Usar la agenda en el teléfono y la computadora</h2>
      <p>Vinculá tus dispositivos una sola vez con un código QR y vas a ver la misma agenda en los dos. Sin cuentas ni contraseñas.</p>
      <div class="btn-row"><button class="btn btn-primary" data-action="sync-pair">${icon('phone')} Vincular un teléfono</button></div>
      <details class="sync-join"><summary>¿Ya tenés un link o código de vinculación?</summary>
        <div class="inline"><input id="syncCode" placeholder="Pegá el link o el código" autocomplete="off"><button class="btn" data-action="sync-join">Vincular</button></div>
      </details>
      <p class="muted small">Los datos viajan cifrados directamente entre tus dispositivos y no quedan guardados en ningún servidor.</p>`;
  }
  const seenPeers = Object.entries(SYNC.peers).filter(([, p]) => p.lastSeen);
  const others = !seenPeers.length
    ? '<li><i class="sync-dot is-wait"></i><span class="muted">Esperando a que tu otro dispositivo abra la agenda…</span></li>'
    : seenPeers.map(([slot, p]) => {
    const on = syncConns.has(Number(slot));
    const seen = on ? 'conectado ahora' : p.lastSync ? `sincronizado ${fmtRelative(new Date(p.lastSync).toISOString())}` : 'todavía no se conectó';
    return `<li><i class="sync-dot is-${on ? 'ok' : 'idle'}"></i><span><b>${esc(p.name)}</b> <span class="muted">· ${seen}</span></span>
      <button class="link" data-action="sync-forget" data-slot="${esc(slot)}">Olvidar</button></li>`;
  }).join('');
  return `<h2>${icon('phone')} Sincronización</h2>
    <p class="sync-line"><i class="sync-dot is-${st.cls}"></i><b>${esc(st.text)}</b></p>
    <ul class="device-list">
      <li><i class="sync-dot is-ok"></i><span><b>Este dispositivo</b> <span class="muted">· ${esc(SYNC.name)}</span></span></li>
      ${others}
    </ul>
    <div class="btn-row">
      <button class="btn" data-action="sync-pair">${icon('plus')} Vincular otro dispositivo</button>
      <button class="btn" data-action="sync-now">${icon('repeat')} Sincronizar ahora</button>
      <button class="btn btn-ghost btn-danger-text" data-action="sync-unlink">Desvincular este dispositivo</button>
    </div>
    <p class="muted small">Los cambios pasan al instante cuando los dos dispositivos tienen la agenda abierta. Si uno está cerrado, se pasan la próxima vez que coincidan; nada se pierde porque cada dispositivo guarda su copia completa.</p>`;
}

/* ---------- Vincular ---------- */

async function beginPairing() {
  if (!isPaired()) {
    SYNC = { secret: randomCode(20), slot: 0, name: deviceName(), peers: {} };
    saveSyncState();
  }
  startSync();
  try {
    if (typeof qrcode === 'undefined') await loadScript('js/vendor/qrcode.js');
  } catch (e) {
    toast('No se pudo generar el código QR. Usá el link.', { kind: 'error' });
  }
  const link = pairingLink();
  let qrSvg = '';
  if (typeof qrcode !== 'undefined') {
    const qr = qrcode(0, 'M');
    qr.addData(link);
    qr.make();
    qrSvg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true, alt: 'Código QR para vincular el teléfono' });
  }
  const m = openModal({
    title: 'Vincular un teléfono', size: 'md', className: 'modal-pair',
    body: `<div class="pair">
      ${qrSvg ? `<div class="pair-qr">${qrSvg}</div>` : ''}
      <div class="pair-info">
        <ol class="pair-steps">
          <li>Abrí la <b>cámara</b> del teléfono y apuntá a este código.</li>
          <li>Tocá el link que aparece y confirmá <b>Vincular</b>.</li>
          <li>Listo: lo que cargues en uno aparece en el otro.</li>
        </ol>
        <p class="pair-status" data-pair-status></p>
      </div>
    </div>
    <p class="muted small">¿No podés escanear? Mandate este link (por ejemplo por WhatsApp) y abrilo en el teléfono:</p>
    <div class="pair-link"><input readonly value="${esc(link)}" aria-label="Link de vinculación"><button type="button" class="btn" data-copy>${icon('copy')} Copiar</button></div>
    <p class="muted small">No compartas este código con nadie: da acceso a tu agenda.</p>`,
    footer: '<span class="spacer"></span><button type="button" class="btn btn-primary" data-close-pair>Listo</button>',
    onClose: () => { pairingModal = null; },
  });
  let doneName = null;
  pairingModal = {
    refresh() {
      const el = m.el.querySelector('[data-pair-status]');
      if (!el) return;
      if (doneName) { el.className = 'pair-status is-ok'; el.innerHTML = `${icon('check')} <b>${esc(doneName)} vinculado.</b> Ya están sincronizados.`; return; }
      const st = syncSummary();
      el.className = 'pair-status';
      el.innerHTML = `<i class="sync-dot is-${st.cls === 'idle' || st.cls === 'ok' ? 'wait' : st.cls}"></i> ${st.cls === 'idle' || st.cls === 'ok' ? 'Esperando al teléfono…' : esc(st.text)}`;
    },
    done(name) { doneName = name; this.refresh(); },
  };
  pairingModal.refresh();
  m.el.querySelector('[data-close-pair]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-copy]').addEventListener('click', async () => {
    const input = m.el.querySelector('.pair-link input');
    try { await navigator.clipboard.writeText(link); } catch (e) { input.select(); document.execCommand('copy'); }
    toast('Link copiado');
  });
}

async function joinWithCode(text) {
  const s = String(text || '').trim();
  const m = s.match(/vincular=([a-z0-9]{12,40})/) || s.match(/^([a-z0-9]{12,40})$/);
  if (!m) { toast('Ese link o código no es válido.', { kind: 'error' }); return false; }
  const secret = m[1];
  if (isPaired() && SYNC.secret === secret) {
    toast('Este dispositivo ya está vinculado.');
    startSync();
    return true;
  }
  const ok = await confirmDialog({
    title: 'Vincular este dispositivo',
    message: `Este ${deviceName().toLowerCase()} va a mostrar la misma agenda que tu otro dispositivo.<br><br>Los datos de los dos se <b>combinan</b>: no se borra nada.${isPaired() ? '<br><br>Ya estaba vinculado con otra agenda: esa vinculación se reemplaza.' : ''}`,
    confirmText: 'Vincular',
  });
  if (!ok) return false;
  stopPeer();
  syncIds = null;
  SYNC = { secret, slot: 1 + Math.floor(Math.random() * 999998), name: deviceName(), peers: { 0: { name: 'Otro dispositivo', lastSeen: 0 } } };
  saveSyncState();
  startSync();
  renderAll();
  toast('Vinculado. Buscando tu otro dispositivo…');
  return true;
}

async function unlinkDevice() {
  const ok = await confirmDialog({
    title: 'Desvincular este dispositivo',
    message: 'Este dispositivo deja de sincronizarse. Tus datos se quedan acá y en los otros dispositivos.',
    confirmText: 'Desvincular', danger: true,
  });
  if (!ok) return;
  for (const c of syncConns.values()) { try { c.send({ t: 'bye' }); } catch (e) { /* ya cerrada */ } }
  if (syncConns.size) await new Promise((r) => setTimeout(r, 300));
  stopPeer();
  SYNC = null;
  syncIds = null;
  saveSyncState();
  setSyncState('off');
  renderAll();
}

function forgetDevice(slot) {
  if (!isPaired()) return;
  delete SYNC.peers[slot];
  const c = syncConns.get(Number(slot));
  if (c) { try { c.close(); } catch (e) { /* ya cerrada */ } }
  saveSyncState();
  renderSyncStatus();
}

function syncNow() {
  if (!isPaired()) return;
  if (!syncPeer) { startSync(); return; }
  dialPeers();
  for (const c of syncConns.values()) sendState(c, true);
  toast(syncConns.size ? 'Sincronizando…' : 'Buscando tus otros dispositivos. Tienen que tener la agenda abierta.');
}

/* Abre la agenda con #vincular=... (desde el QR) */
function checkPairingLink() {
  const m = location.hash.match(/vincular=([a-z0-9]{12,40})/);
  if (!m) return;
  history.replaceState(null, '', location.pathname + location.search);
  joinWithCode(m[1]);
}

function initSync() {
  loadSyncState();
  renderSyncStatus();
  if (isPaired()) startSync();
  const wake = () => {
    if (!isPaired() || document.hidden) return;
    syncAttempts = 0;
    if (!syncPeer) { clearTimeout(syncRestartTimer); startSync(); } else dialPeers();
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
  window.addEventListener('pagehide', (e) => { if (!e.persisted) stopPeer(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) wake(); });
  window.addEventListener('storage', (e) => {
    if (e.key !== SYNC_KEY) return;
    const was = SYNC && SYNC.secret;
    loadSyncState();
    if ((SYNC && SYNC.secret) !== was) { stopPeer(); syncIds = null; if (isPaired()) startSync(); else setSyncState('off'); }
    renderSyncStatus();
  });
  window.addEventListener('hashchange', checkPairingLink);
  checkPairingLink();
}
