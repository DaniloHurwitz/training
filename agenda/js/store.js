'use strict';
/* Estado de la app, persistencia en localStorage, datos de ejemplo, deshacer
   y registro de cambios para sincronizar entre dispositivos. */

const STORAGE_KEY = 'agendaSemanal:data:v1';
const UI_KEY = 'agendaSemanal:ui:v1';
const DATA_VERSION = 1;

const FACULTY_TYPES = { clase: 'Clase', practico: 'Práctico', parcial: 'Parcial', final: 'Final', estudio: 'Estudio', otro: 'Otro' };
const CLIENT_STATUS = { active: 'Activo', paused: 'Pausado', finished: 'Finalizado' };
const TASK_TYPES = ['Check', 'Traducción', 'Revisión', 'Edición', 'Reunión', 'Sesión', 'Entrega', 'Administrativo'];
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948', '#0e7c86', '#8a5a2b'];
const SYNC_COLLECTIONS = ['clients', 'subjects', 'events', 'receivables', 'payments'];
/* Preferencias propias de cada dispositivo: no se sincronizan */
const LOCAL_SETTINGS = ['hourHeight', 'lastBackupAt', 'theme', 'notifyEnabled'];

function defaultSettings() {
  return {
    userName: '',
    mainCurrency: 'USD',
    dayStart: 8,
    dayEnd: 26,            // 26 = 02:00 del día siguiente
    slotMinutes: 15,
    weekStart: 1,          // 1 = lunes, 0 = domingo
    showWeekend: true,
    hourHeight: 52,        // px por hora (zoom vertical)
    theme: 'system',
    weeklyGoalHours: 19,
    weeklyIncomeGoal: 342,
    incomeGoalCurrency: 'USD',
    monthlyGoalHours: null,
    monthlyIncomeGoal: null,
    maxConsecutiveHours: 4,
    minGapMinutes: 10,
    workColor: '#44546a',
    facultyColor: '#b5552b',
    showIncomeInEvents: true,
    showTravel: true,
    lastBackupAt: null,
    notifyEnabled: false,      // avisos en este dispositivo
    notifyMinutes: 15,         // aviso antes de cada evento
    notifyExtraMinutes: 30,    // aviso extra, más temprano, para tareas con compu o complejas
    notifyDaily: true,         // resumen del día
    notifyDailyTime: '08:00',
    pushTopic: '',             // canal de ntfy para avisos en el teléfono ('' = desactivado)
  };
}

function defaultRates() {
  return { USD_ARS: 1500, EUR_ARS: 1750, EUR_USD: 1.1667, updatedAt: new Date().toISOString() };
}

function emptyData() {
  return {
    version: DATA_VERSION,
    settings: defaultSettings(),
    rates: defaultRates(),
    clients: [],
    subjects: [],
    events: [],
    receivables: [],
    payments: [],
    deleted: {},                       // {colección: {id: fecha de borrado}}
    stamps: { settings: 0, rates: 0 }, // fecha del último cambio de configuración y tipo de cambio
    pushLog: {},                       // avisos ya programados en ntfy: {id: {at, h, t, topic, del}}
    meta: { createdAt: new Date().toISOString() },
  };
}

let DB = null;
let UI = null;
let storageOk = true;

function uiDefaults() {
  return {
    section: 'calendar',
    viewDesktop: 'week',
    viewMobile: 'agenda',
    calFilter: 'both',
    filters: { clientIds: [], subjectIds: [], weekdays: [], types: [], device: 'all' },
    panelOpen: true,
    summaryPeriod: 'week',
    demoBannerHidden: false,
    clientTab: 'clients',
    clientStatus: 'all',
    receivableFilter: 'open',
    incomeFilters: { clientId: '', month: '', currency: '', project: '' },
  };
}

/* Normaliza datos cargados o importados (completa campos faltantes) */
function normalizeData(raw) {
  const d = emptyData();
  if (!raw || typeof raw !== 'object') return d;
  d.settings = Object.assign(defaultSettings(), raw.settings || {});
  d.rates = Object.assign(defaultRates(), raw.rates || {});
  for (const k of ['clients', 'subjects', 'events', 'receivables', 'payments']) {
    d[k] = Array.isArray(raw[k]) ? raw[k].filter((x) => x && typeof x === 'object' && x.id) : [];
  }
  d.meta = Object.assign(d.meta, raw.meta || {});
  if (raw.deleted && typeof raw.deleted === 'object') {
    for (const k of SYNC_COLLECTIONS) if (raw.deleted[k] && typeof raw.deleted[k] === 'object') d.deleted[k] = Object.assign({}, raw.deleted[k]);
  }
  d.stamps = Object.assign(d.stamps, raw.stamps || {});
  if (raw.pushLog && typeof raw.pushLog === 'object') d.pushLog = Object.assign({}, raw.pushLog);
  for (const ev of d.events) normalizeEvent(ev);
  return d;
}

/* Cada evento va en su fecha real: 01:00 del viernes es la madrugada del viernes.
   (La versión anterior guardaba la madrugada como horas 24+ del día previo: se pasa a la misma fecha.) */
function normalizeEvent(ev) {
  ev.calendar = ev.calendar === 'faculty' ? 'faculty' : 'work';
  ev.start = Number(ev.start) || 0;
  ev.end = Number(ev.end) || ev.start + 60;
  if (ev.end <= ev.start) ev.end = ev.start + 15;
  if (!isYmd(ev.date)) ev.date = todayYmd();
  if (!ev.exceptions || typeof ev.exceptions !== 'object') ev.exceptions = {};
  const baseStart = ev.start;
  if (ev.start >= MIN_PER_DAY) { ev.start -= MIN_PER_DAY; ev.end -= MIN_PER_DAY; }
  for (const ov of Object.values(ev.exceptions)) {
    if (!ov || typeof ov !== 'object') continue;
    if ((ov.start != null ? ov.start : baseStart) >= MIN_PER_DAY) {
      if (ov.start != null) ov.start -= MIN_PER_DAY;
      if (ov.end != null) ov.end -= MIN_PER_DAY;
    }
  }
  return ev;
}

function loadDB() {
  let raw = null;
  try {
    const txt = localStorage.getItem(STORAGE_KEY);
    raw = txt ? JSON.parse(txt) : null;
  } catch (e) {
    storageOk = false;
  }
  if (raw) {
    DB = normalizeData(raw);
  } else {
    DB = emptyData();
    Object.assign(DB, buildDemoData());
    DB.meta.demoLoaded = true;
    saveDB();
  }
  noteStamps(DB);
  try {
    UI = Object.assign(uiDefaults(), JSON.parse(localStorage.getItem(UI_KEY) || '{}'));
    UI.filters = Object.assign(uiDefaults().filters, UI.filters || {});
    UI.incomeFilters = Object.assign(uiDefaults().incomeFilters, UI.incomeFilters || {});
  } catch (e) {
    UI = uiDefaults();
  }
}

function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    storageOk = true;
  } catch (e) {
    storageOk = false;
    if (typeof toast === 'function') toast('No se pudo guardar en este navegador (almacenamiento lleno o bloqueado). Exportá un backup.', { kind: 'error', duration: 8000 });
  }
}

const UI_PERSIST = ['section', 'viewDesktop', 'viewMobile', 'calFilter', 'filters', 'panelOpen', 'summaryPeriod', 'demoBannerHidden', 'clientTab', 'clientStatus', 'receivableFilter', 'incomeFilters'];

function saveUI() {
  try {
    const o = {};
    for (const k of UI_PERSIST) o[k] = UI[k];
    localStorage.setItem(UI_KEY, JSON.stringify(o));
  } catch (e) { /* no crítico */ }
}

/* ---------- Registro de cambios (para sincronizar y deshacer) ---------- */

let lastStamp = 0;

function noteStamps(d) {
  for (const k of SYNC_COLLECTIONS) for (const x of d[k]) lastStamp = Math.max(lastStamp, x._u || 0);
  lastStamp = Math.max(lastStamp, d.stamps.settings || 0, d.stamps.rates || 0);
}

/* Marca de tiempo creciente: nunca repite ni retrocede en este dispositivo */
function nextStamp() {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function entityJSON(o) {
  const c = Object.assign({}, o);
  delete c._u;
  return JSON.stringify(c);
}

function sharedSettings(settings) {
  const c = Object.assign({}, settings);
  for (const k of LOCAL_SETTINGS) delete c[k];
  return c;
}

function indexData(d) {
  const idx = { settings: JSON.stringify(sharedSettings(d.settings)), rates: JSON.stringify(d.rates) };
  for (const k of SYNC_COLLECTIONS) idx[k] = new Map(d[k].map((x) => [x.id, entityJSON(x)]));
  return idx;
}

/* Pone fecha a lo que cambió y deja constancia de lo borrado.
   Devuelve el cambio inverso (para "Deshacer") o null si no cambió nada compartido. */
function stampChanges(prev, d) {
  const now = nextStamp();
  const inv = { items: {}, settings: null, rates: null };
  let changed = false;
  d.deleted = d.deleted || {};
  d.stamps = d.stamps || { settings: 0, rates: 0 };
  for (const k of SYNC_COLLECTIONS) {
    const seen = new Set();
    const tomb = d.deleted[k] = d.deleted[k] || {};
    for (const x of d[k]) {
      seen.add(x.id);
      const before = prev[k].get(x.id);
      if (before === entityJSON(x)) continue;
      x._u = now;
      delete tomb[x.id];
      (inv.items[k] = inv.items[k] || {})[x.id] = before === undefined ? null : before;
      changed = true;
    }
    for (const [id, before] of prev[k]) {
      if (seen.has(id)) continue;
      tomb[id] = now;
      (inv.items[k] = inv.items[k] || {})[id] = before;
      changed = true;
    }
  }
  if (JSON.stringify(sharedSettings(d.settings)) !== prev.settings) { d.stamps.settings = now; inv.settings = prev.settings; changed = true; }
  if (JSON.stringify(d.rates) !== prev.rates) { d.stamps.rates = now; inv.rates = prev.rates; changed = true; }
  return changed ? inv : null;
}

function undoChange(inv) {
  commit((d) => {
    for (const [k, items] of Object.entries(inv.items)) {
      for (const [id, before] of Object.entries(items)) {
        const i = d[k].findIndex((x) => x.id === id);
        if (before == null) { if (i >= 0) d[k].splice(i, 1); continue; }
        const obj = JSON.parse(before);
        if (i >= 0) d[k][i] = obj; else d[k].push(obj);
      }
    }
    if (inv.settings) Object.assign(d.settings, JSON.parse(inv.settings));
    if (inv.rates) d.rates = JSON.parse(inv.rates);
  }, { toast: 'Cambio deshecho' });
}

/* Aplica un cambio, guarda y vuelve a dibujar. opts.undo: texto del aviso con "Deshacer". */
function commit(mutator, opts = {}) {
  const prev = indexData(DB);
  mutator(DB);
  const inv = stampChanges(prev, DB);
  invalidateCaches();
  saveDB();
  renderAll();
  if (inv && typeof syncLocalChange === 'function') syncLocalChange();
  if (inv && typeof pushLocalChange === 'function') pushLocalChange();
  if (opts.undo && inv) {
    // Solo el último "Deshacer" es válido
    document.querySelectorAll('#toasts .toast.has-undo').forEach((t) => t.remove());
    toast(opts.undo, { undo: true, action: 'Deshacer', onAction: () => undoChange(inv) });
  } else if (opts.toast || opts.undo) {
    toast(opts.toast || opts.undo);
  }
}

/* ---------- Combinar datos de otro dispositivo ---------- */

function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

/* Lo que se comparte con los otros dispositivos */
function syncPayload(d) {
  const p = { v: DATA_VERSION, settings: sharedSettings(d.settings), rates: d.rates, stamps: d.stamps, deleted: d.deleted, pushLog: d.pushLog };
  for (const k of SYNC_COLLECTIONS) p[k] = d[k];
  return p;
}

function payloadDigest(p) {
  const c = Object.assign({}, p);
  for (const k of SYNC_COLLECTIONS) c[k] = (p[k] || []).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  return canonical(c);
}

/* Gana la versión con el cambio más reciente; empate: criterio fijo para que todos los dispositivos elijan lo mismo */
function newerOf(a, b) {
  const ua = a._u || 0, ub = b._u || 0;
  if (ua !== ub) return ua > ub ? a : b;
  return canonical(a) >= canonical(b) ? a : b;
}

/* Combina los datos recibidos dentro de `d`. Devuelve true si cambió algo. */
function mergeRemote(d, r) {
  if (!r || typeof r !== 'object') return false;
  let changed = false;
  d.deleted = d.deleted || {};
  d.stamps = d.stamps || { settings: 0, rates: 0 };
  for (const k of SYNC_COLLECTIONS) {
    const theirs = Array.isArray(r[k]) ? r[k].filter((x) => x && typeof x === 'object' && x.id) : [];
    if (k === 'events') theirs.forEach(normalizeEvent);
    const tomb = Object.assign({}, d.deleted[k] || {});
    for (const [id, ts] of Object.entries((r.deleted && r.deleted[k]) || {})) if (!(tomb[id] >= ts)) tomb[id] = ts;
    const mine = new Map(d[k].map((x) => [x.id, x]));
    const other = new Map(theirs.map((x) => [x.id, x]));
    const out = [];
    for (const id of new Set([...mine.keys(), ...other.keys()])) {
      const a = mine.get(id), b = other.get(id);
      let pick = !a ? b : !b ? a : newerOf(a, b);
      if (tomb[id] != null && tomb[id] >= (pick._u || 0)) pick = null;
      if (pick) out.push(pick);
      if (!!a !== !!pick || (a && pick && a !== pick && canonical(a) !== canonical(pick))) changed = true;
    }
    d[k] = out;
    d.deleted[k] = tomb;
    for (const x of out) lastStamp = Math.max(lastStamp, x._u || 0);
  }
  const rs = (r.stamps && r.stamps.settings) || 0, ls = d.stamps.settings || 0;
  if (r.settings && (rs > ls || (rs === ls && canonical(sharedSettings(r.settings)) > canonical(sharedSettings(d.settings))))) {
    const next = Object.assign(defaultSettings(), sharedSettings(r.settings));
    for (const k of LOCAL_SETTINGS) next[k] = d.settings[k];
    if (canonical(next) !== canonical(d.settings)) changed = true;
    d.settings = next;
    d.stamps.settings = rs;
  }
  const rr = (r.stamps && r.stamps.rates) || 0, lr = d.stamps.rates || 0;
  if (r.rates && (rr > lr || (rr === lr && canonical(r.rates) > canonical(d.rates)))) {
    const next = Object.assign(defaultRates(), r.rates);
    if (canonical(next) !== canonical(d.rates)) changed = true;
    d.rates = next;
    d.stamps.rates = rr;
  }
  lastStamp = Math.max(lastStamp, rs, rr);
  // Registro de avisos programados: gana la entrada más reciente (no cuenta como cambio visible)
  d.pushLog = d.pushLog || {};
  for (const [seq, e] of Object.entries((r.pushLog && typeof r.pushLog === 'object') ? r.pushLog : {})) {
    if (e && typeof e === 'object' && (!d.pushLog[seq] || (e.t || 0) > (d.pushLog[seq].t || 0))) d.pushLog[seq] = e;
  }
  return changed;
}

/* ---------- Acceso ---------- */

function getClient(id) { return id ? DB.clients.find((c) => c.id === id) || null : null; }
function getSubject(id) { return id ? DB.subjects.find((s) => s.id === id) || null : null; }
function getEvent(id) { return DB.events.find((e) => e.id === id) || null; }

function clientName(id) { const c = getClient(id); return c ? c.name : ''; }

function sortedClients(includeFinished = true) {
  const order = { active: 0, paused: 1, finished: 2 };
  return DB.clients
    .filter((c) => includeFinished || c.status !== 'finished')
    .slice()
    .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.name.localeCompare(b.name, 'es'));
}

function nextPaletteColor(list) {
  const used = new Set(list.map((x) => (x.color || '').toLowerCase()));
  return PALETTE.find((c) => !used.has(c)) || PALETTE[list.length % PALETTE.length];
}

function hasDemoData() {
  return ['clients', 'subjects', 'events', 'receivables', 'payments'].some((k) => DB[k].some((x) => x.demo));
}

/* Borra los datos de ejemplo. Los clientes/materias de ejemplo que ya usás en datos propios se conservan. */
function removeDemoData(d) {
  const keepClients = new Set();
  const keepSubjects = new Set();
  for (const e of d.events) if (!e.demo) { if (e.clientId) keepClients.add(e.clientId); if (e.subjectId) keepSubjects.add(e.subjectId); }
  for (const r of d.receivables) if (!r.demo && r.clientId) keepClients.add(r.clientId);
  for (const p of d.payments) if (!p.demo && p.clientId) keepClients.add(p.clientId);
  d.events = d.events.filter((e) => !e.demo);
  d.receivables = d.receivables.filter((r) => !r.demo);
  d.payments = d.payments.filter((p) => !p.demo);
  d.clients = d.clients.filter((c) => !c.demo || keepClients.has(c.id));
  d.clients.forEach((c) => { c.demo = false; });
  d.subjects = d.subjects.filter((s) => !s.demo || keepSubjects.has(s.id));
  d.subjects.forEach((s) => { s.demo = false; });
}

/* ---------- Datos de ejemplo (todos marcados demo: true) ---------- */

function buildDemoData() {
  const now = new Date().toISOString();
  const M = startOfWeek(todayYmd(), 1);          // lunes de esta semana
  const S = addDays(M, -21);                      // las series empiezan 3 semanas antes
  const onWd = (wd) => addDays(S, (wd - 1 + 7) % 7);  // primer día con ese día de semana (S es lunes)
  const demoNote = 'Tarifa de ejemplo: editala en Clientes.';

  const mk = (id, name, color, extra) => Object.assign({
    id, name, color, currency: 'USD', hourlyRate: 18, taskRate: null, billing: 'hourly',
    notes: demoNote, status: 'active', demo: true, createdAt: now,
  }, extra || {});

  const clients = [
    mk('demo-bmss', 'BMS Spanish', '#4a3aa7'),
    mk('demo-bmsh', 'BMS Hebrew', '#e87ba4'),
    mk('demo-ihg', 'IHG', '#eb6834'),
    mk('demo-chev', 'Chevron', '#e34948'),
    mk('demo-med', 'Medical Colombia', '#eda100'),
    mk('demo-disney', 'Disney', '#2a78d6', { notes: 'Horarios sin confirmar: agregá los eventos cuando estén definidos. Tarifa de ejemplo.' }),
    mk('demo-resmed', 'ResMed', '#008300', { notes: 'Horarios sin confirmar: agregá los eventos cuando estén definidos. Tarifa de ejemplo.' }),
  ];

  const subjects = [
    { id: 'demo-anat', name: 'Anatomía', color: '#b5552b', commission: 'B', professor: 'Prof. ejemplo', notes: '', demo: true },
    { id: 'demo-fisio', name: 'Fisiología', color: '#0e7c86', commission: '2', professor: '', notes: '', demo: true },
    { id: 'demo-ingles', name: 'Inglés técnico', color: '#8a5a2b', commission: 'Virtual', professor: '', notes: '', demo: true },
  ];

  const T = (h, m = 0) => h * 60 + m;
  const base = { notes: '', location: '', link: '', exceptions: {}, demo: true, createdAt: now, updatedAt: now };
  const work = (o) => Object.assign({
    calendar: 'work', project: '', taskType: 'Check', billing: 'hourly', rate: 18, currency: 'USD',
    isCheck: false, phone: false, complexity: 'simple', confirmation: 'confirmed', recurrence: null,
  }, base, o);
  const fac = (o) => Object.assign({
    calendar: 'faculty', commission: '', professor: '', facultyType: 'clase', room: '',
    travelBefore: 0, travelAfter: 0, recurrence: null,
  }, base, o);
  const rec = (type, extra) => Object.assign({ type, interval: 1, days: [], end: 'never', until: '', count: null, unit: 'week' }, extra || {});

  const events = [
    work({ id: 'demo-e1', title: 'BMS Spanish · check', clientId: 'demo-bmss', project: 'Spanish QA', date: S, start: T(9), end: T(9, 30),
      isCheck: true, phone: true, recurrence: rec('days', { days: [1, 3, 5] }) }),
    work({ id: 'demo-e2', title: 'BMS Hebrew · check', clientId: 'demo-bmsh', project: 'Hebrew QA', date: onWd(2), start: T(8, 30), end: T(9),
      isCheck: true, phone: true, recurrence: rec('days', { days: [2, 4] }) }),
    work({ id: 'demo-e3', title: 'IHG · traducción', clientId: 'demo-ihg', project: 'Web', taskType: 'Traducción', date: S, start: T(14), end: T(16, 30),
      complexity: 'complex', recurrence: rec('days', { days: [1, 3] }) }),
    work({ id: 'demo-e4', title: 'Chevron · revisión', clientId: 'demo-chev', taskType: 'Revisión', date: onWd(2), start: T(19), end: T(21),
      complexity: 'complex', recurrence: rec('weekly') }),
    work({ id: 'demo-e5', title: 'Chevron · entrega', clientId: 'demo-chev', taskType: 'Entrega', date: addDays(M, 4), start: T(23), end: T(24, 45),
      complexity: 'complex', confirmation: 'pending', notes: 'Ejemplo de trabajo que termina después de medianoche.' }),
    work({ id: 'demo-e6', title: 'Medical Colombia · sesión', clientId: 'demo-med', taskType: 'Sesión', date: onWd(4), start: T(15), end: T(17),
      complexity: 'complex', recurrence: rec('weekly') }),
    work({ id: 'demo-e7', title: 'Medical Colombia · check', clientId: 'demo-med', date: onWd(6), start: T(11), end: T(11, 30),
      isCheck: true, phone: true, recurrence: rec('weekly') }),
    work({ id: 'demo-e8', title: 'Medical Colombia · check extra', clientId: 'demo-med', date: addDays(M, 2), start: T(15), end: T(15, 30),
      isCheck: true, phone: true, notes: 'Ejemplo de solapamiento.' }),
    work({ id: 'demo-e9', title: 'BMS Spanish · revisión', clientId: 'demo-bmss', taskType: 'Revisión', date: addDays(M, 2), start: T(15, 15), end: T(16),
      notes: 'Ejemplo de solapamiento triple.' }),
    fac({ id: 'demo-f1', title: 'Anatomía · clase', subjectId: 'demo-anat', commission: 'B', professor: 'Prof. ejemplo', room: 'Aula 3',
      date: S, start: T(10), end: T(12), travelBefore: 30, travelAfter: 30, location: 'Facultad (ejemplo)', recurrence: rec('days', { days: [1, 4] }) }),
    fac({ id: 'demo-f2', title: 'Fisiología · práctico', subjectId: 'demo-fisio', facultyType: 'practico', commission: '2', room: 'Lab 2',
      date: onWd(2), start: T(16), end: T(18), travelBefore: 30, travelAfter: 30, recurrence: rec('weekly') }),
    fac({ id: 'demo-f3', title: 'Estudio · Fisiología', subjectId: 'demo-fisio', facultyType: 'estudio',
      date: onWd(0), start: T(17), end: T(19), recurrence: rec('weekly') }),
    fac({ id: 'demo-f4', title: 'Parcial · Anatomía', subjectId: 'demo-anat', facultyType: 'parcial', room: 'Aula magna',
      date: addDays(M, 9), start: T(18), end: T(20), travelBefore: 45, travelAfter: 30 }),
    fac({ id: 'demo-f5', title: 'Inglés técnico · clase virtual', subjectId: 'demo-ingles', commission: 'Virtual',
      date: onWd(3), start: T(18, 30), end: T(20), link: 'https://example.com', recurrence: rec('weekly') }),
  ];

  const today = todayYmd();
  const receivables = [
    { id: 'demo-r1', clientId: 'demo-ihg', concept: 'Traducciones (ejemplo)', amount: 230, currency: 'USD', date: addDays(today, -12), dueDate: addDays(today, 10), status: 'pending', notes: '', demo: true },
    { id: 'demo-r2', clientId: 'demo-chev', concept: 'Revisiones (ejemplo)', amount: 120, currency: 'EUR', date: addDays(today, -40), dueDate: addDays(today, -5), status: 'pending', notes: '', demo: true },
    { id: 'demo-r3', clientId: 'demo-bmsh', concept: 'Checks (ejemplo)', amount: 150000, currency: 'ARS', date: addDays(today, -8), dueDate: addDays(today, 20), status: 'pending', notes: '', demo: true },
    { id: 'demo-r4', clientId: 'demo-bmss', concept: 'Checks (ejemplo)', amount: 90, currency: 'USD', date: addDays(today, -30), dueDate: addDays(today, -3), status: 'paid', paidAt: addDays(today, -1), notes: '', demo: true },
  ];

  const payments = [];
  const monthStart = startOfMonth(today);
  const pay = (monthsAgo, day, clientId, concept, amount, currency, project) => {
    const d = addDays(addMonths(monthStart, -monthsAgo), day - 1);
    if (d > today) return;
    payments.push({ id: 'demo-p' + payments.length, date: d, clientId, concept, amount, currency, project: project || '', notes: '', demo: true });
  };
  for (let m = 5; m >= 0; m--) {
    pay(m, 5, 'demo-bmss', 'Checks (ejemplo)', 90 + (m % 3) * 18, 'USD', 'Spanish QA');
    pay(m, 8, 'demo-ihg', 'Traducciones (ejemplo)', 180 + (m % 2) * 45, 'USD', 'Web');
    if (m % 2 === 0) pay(m, 15, 'demo-chev', 'Revisiones (ejemplo)', 110, 'EUR');
    if (m % 3 === 1) pay(m, 20, 'demo-bmsh', 'Checks (ejemplo)', 120000, 'ARS', 'Hebrew QA');
  }
  payments.push({ id: 'demo-pr4', date: addDays(today, -1), clientId: 'demo-bmss', concept: 'Checks (ejemplo)', amount: 90, currency: 'USD', project: 'Spanish QA', notes: '', receivableId: 'demo-r4', demo: true });

  return { clients, subjects, events, receivables, payments };
}
