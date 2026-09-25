'use strict';
/* Arranque, navegación, acciones, atajos, búsqueda, filtros, tema, exportar/importar e impresión. */

const SECTIONS = ['calendar', 'summary', 'clients', 'receivables', 'income', 'rates', 'settings'];

/* ---------- Render general ---------- */

function renderAll() {
  renderNav();
  renderDemoBanner();
  switch (UI.section) {
    case 'calendar': renderCalendar(); break;
    case 'summary': renderSummary(); break;
    case 'clients': renderClients(); break;
    case 'receivables': renderReceivables(); break;
    case 'income': renderIncome(); break;
    case 'rates': renderRates(); break;
    case 'settings': renderSettings(); break;
  }
  refreshDrawer();
  if (document.activeElement === document.getElementById('searchInput')) renderSearchResults();
}

function showSection(name) {
  if (!SECTIONS.includes(name)) name = 'calendar';
  UI.section = name;
  saveUI();
  closePopover();
  for (const s of SECTIONS) document.getElementById('sec-' + s).hidden = s !== name;
  document.body.dataset.section = name;
  renderAll();
  document.getElementById('main').scrollTop = 0;
  if (name === 'calendar' && currentView() !== 'agenda') requestAnimationFrame(() => scrollToFocus(false));
}

function renderNav() {
  const overdue = DB.receivables.filter((r) => receivableStatus(r) === 'overdue').length;
  document.querySelectorAll('[data-section]').forEach((b) => {
    if (b.closest('.nav, .tabbar')) b.setAttribute('aria-current', String(b.dataset.section === UI.section));
  });
  document.querySelectorAll('[data-badge=receivables]').forEach((b) => { b.textContent = overdue ? String(overdue) : ''; b.hidden = !overdue; });
  const more = document.querySelector('.tabbar [data-action=more]');
  if (more) more.setAttribute('aria-current', String(['income', 'rates', 'settings'].includes(UI.section)));
  const s = DB.settings;
  document.documentElement.style.setProperty('--work-c', s.workColor);
  document.documentElement.style.setProperty('--fac-c', s.facultyColor);
  document.getElementById('brandName').textContent = s.userName ? `de ${s.userName}` : '';
  const bk = document.getElementById('backupStatus');
  const age = s.lastBackupAt ? (Date.now() - new Date(s.lastBackupAt).getTime()) / 864e5 : Infinity;
  bk.innerHTML = `${icon(age > 7 ? 'alert' : 'shield')}<span>Backup: ${s.lastBackupAt ? fmtRelative(s.lastBackupAt) : 'nunca'}</span>`;
  bk.classList.toggle('is-warn', age > 7);
  if (!storageOk) bk.innerHTML = `${icon('alert')}<span>No se puede guardar</span>`;
}

function renderDemoBanner() {
  const b = document.getElementById('demoBanner');
  const show = hasDemoData() && !UI.demoBannerHidden;
  b.hidden = !show;
  if (show) {
    b.innerHTML = `<span>${icon('info')} Estás viendo <b>datos de ejemplo</b> (marcados «demo»). Disney y ResMed están cargados sin horarios porque no están confirmados.</span>
      <span class="demo-actions"><button class="btn btn-sm" data-action="remove-demo">Eliminar datos de ejemplo</button><button class="btn btn-sm btn-ghost" data-action="hide-demo-banner">Ocultar</button></span>`;
  }
}

/* ---------- Tema ---------- */

const mqDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const t = DB.settings.theme || 'system';
  const resolved = t === 'system' ? (mqDark.matches ? 'dark' : 'light') : t;
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.themeResolved = resolved;
  document.querySelector('meta[name=theme-color]').setAttribute('content', resolved === 'dark' ? '#161617' : '#f6f5f2');
  const tb = document.getElementById('themeToggle');
  if (tb) { tb.innerHTML = icon(resolved === 'dark' ? 'sun' : 'moon'); tb.title = resolved === 'dark' ? 'Modo claro' : 'Modo oscuro'; }
}

/* ---------- Búsqueda ---------- */

let searchTimer = null;

function renderSearchResults() {
  const box = document.getElementById('searchResults');
  const q = UI.search.trim();
  if (!q) { box.hidden = true; return; }
  const today = nowInfo().date;
  const res = [];
  for (const ev of DB.events) {
    const probe = makeOcc(ev, ev.date, null);
    let occ = null;
    if (occMatchesSearch(probe, q)) occ = nextOccurrenceOf(ev, today);
    else if (ev.exceptions) {
      // Alguna ocurrencia modificada puede coincidir
      for (const [orig, ov] of Object.entries(ev.exceptions)) {
        if (ov.deleted) continue;
        const o = makeOcc(ev, orig, ov);
        if (occMatchesSearch(o, q)) { occ = o; break; }
      }
    }
    if (occ) res.push(occ);
  }
  res.sort((a, b) => {
    const fa = a.date >= today, fb = b.date >= today;
    if (fa !== fb) return fa ? -1 : 1;
    return fa ? a.date.localeCompare(b.date) || a.start - b.start : b.date.localeCompare(a.date);
  });
  box.hidden = false;
  box.innerHTML = res.length
    ? `<p class="sr-count">${res.length} ${res.length === 1 ? 'resultado' : 'resultados'}</p><ul>${res.slice(0, 14).map((o) => {
      const { style } = eventStyleVars(o);
      return `<li><button data-action="focus-occ" data-date="${o.date}" data-key="${esc(o.key)}">
        <i class="sr-sw ev ${eventVisual(o).cls}" style="${style}"></i>
        <span class="sr-main"><b>${esc(o.title || 'Sin título')}</b><small>${esc(occSubtitle(o) || (o.calendar === 'work' ? 'Trabajo' : 'Facultad'))}</small></span>
        <span class="sr-when">${o.isRecurring ? icon('repeat') : ''}${DAY_SHORT[weekdayOf(o.date)]} ${fmtDateShort(o.date)}<small>${fmtTime(o.start)}</small></span>
      </button></li>`;
    }).join('')}</ul>`
    : '<p class="sr-empty">Sin resultados.</p>';
}

function hideSearchResults() { document.getElementById('searchResults').hidden = true; }

function setupSearch() {
  const input = document.getElementById('searchInput');
  input.value = UI.search || '';
  input.addEventListener('input', () => {
    UI.search = input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { renderSearchResults(); if (UI.section === 'calendar') renderCalendar(); }, 120);
  });
  input.addEventListener('focus', renderSearchResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = document.querySelector('#searchResults button[data-key]');
      if (first) first.click();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      input.value = ''; UI.search = '';
      hideSearchResults(); input.blur(); renderCalendar();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = document.querySelector('#searchResults button');
      if (first) first.focus();
    }
  });
  document.getElementById('searchResults').addEventListener('keydown', (e) => {
    const items = [...document.querySelectorAll('#searchResults button')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
  });
}

/* ---------- Filtros ---------- */

function openFilters() {
  const f = UI.filters;
  const typeSet = new Map();
  for (const ev of DB.events) {
    const k = occTypeKey(ev);
    if (!typeSet.has(k)) typeSet.set(k, (ev.calendar === 'work' ? 'Trabajo · ' : 'Facultad · ') + occTypeLabel(ev));
  }
  const chip = (group, v, label, on, dot) => `<button type="button" class="chip" data-fg="${group}" data-v="${esc(v)}" aria-pressed="${on}">${dot ? `<i class="dot" style="background:${esc(dot)}"></i>` : ''}${esc(label)}</button>`;
  const body = `<div class="filters">
    <p class="muted small">El selector Trabajo / Facultad / Ambos está en la barra superior. Estos filtros se suman a esa selección.</p>
    <h3>Clientes</h3><div class="chips">${sortedClients(true).map((c) => chip('clientIds', c.id, c.name, f.clientIds.includes(c.id), c.color)).join('')}${chip('clientIds', '', 'Sin cliente', f.clientIds.includes(''))}</div>
    <h3>Materias</h3><div class="chips">${DB.subjects.map((s) => chip('subjectIds', s.id, s.name, f.subjectIds.includes(s.id), s.color)).join('') || '<span class="muted small">Sin materias</span>'}</div>
    <h3>Días</h3><div class="chips">${[1, 2, 3, 4, 5, 6, 0].map((w) => chip('weekdays', w, DAY_NAMES[w], f.weekdays.includes(w))).join('')}</div>
    <h3>Tipo de evento</h3><div class="chips">${[...typeSet.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([k, l]) => chip('types', k, l, f.types.includes(k))).join('') || '<span class="muted small">Sin eventos</span>'}</div>
    <h3>Dispositivo</h3>${segHtml('device', [['all', 'Todos'], ['phone', `${icon('phone')} Teléfono`], ['computer', `${icon('laptop')} Computadora`]], f.device)}
  </div>`;
  const m = openModal({
    title: 'Filtros', size: 'md', body,
    footer: `<button type="button" class="btn btn-ghost" data-clear>Limpiar filtros</button><span class="spacer"></span><button type="button" class="btn btn-primary" data-done>Listo</button>`,
  });
  const apply = () => { saveUI(); renderCalendar(); };
  m.el.querySelector('.filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-fg]');
    if (!b) return;
    const g = b.dataset.fg;
    const v = g === 'weekdays' ? Number(b.dataset.v) : b.dataset.v;
    const arr = UI.filters[g];
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1); else arr.push(v);
    b.setAttribute('aria-pressed', String(i < 0));
    apply();
  });
  bindSeg(m.el, 'device', (v) => { UI.filters.device = v; apply(); });
  m.el.querySelector('[data-done]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-clear]').addEventListener('click', () => { clearFilters(); m.close(); });
}

function clearFilters() {
  UI.filters = uiDefaults().filters;
  UI.search = '';
  document.getElementById('searchInput').value = '';
  hideSearchResults();
  saveUI();
  renderCalendar();
}

/* ---------- Exportar / importar / imprimir ---------- */

function exportJSON() {
  const now = new Date().toISOString();
  DB.settings.lastBackupAt = now;
  const payload = { app: 'agenda-semanal', version: DATA_VERSION, exportedAt: now, data: DB };
  downloadFile(`agenda-backup-${todayYmd()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  saveDB();
  renderAll();
  toast('Backup exportado. Guardalo en un lugar seguro.');
}

function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    let raw;
    try {
      const obj = JSON.parse(String(reader.result));
      raw = obj && obj.data && typeof obj.data === 'object' ? obj.data : obj;
      if (!raw || typeof raw !== 'object' || !(Array.isArray(raw.events) || raw.settings)) throw new Error('formato');
    } catch (e) {
      toast('El archivo no es un backup válido de la agenda.', { kind: 'error', duration: 6000 });
      return;
    }
    const n = Array.isArray(raw.events) ? raw.events.length : 0;
    const nc = Array.isArray(raw.clients) ? raw.clients.length : 0;
    const ok = await confirmDialog({
      title: 'Importar datos',
      message: `El archivo tiene <b>${n}</b> eventos y <b>${nc}</b> clientes.<br>Esto <b>reemplaza</b> todos los datos actuales (${DB.events.length} eventos, ${DB.clients.length} clientes). Podés deshacerlo desde el aviso que aparece después.`,
      confirmText: 'Reemplazar mis datos',
      danger: true,
    });
    if (!ok) return;
    commit((d) => {
      const nd = normalizeData(raw);
      for (const k of Object.keys(d)) delete d[k];
      Object.assign(d, nd);
    }, { undo: 'Datos importados' });
    applyTheme();
  };
  reader.readAsText(file);
}

function csvRange(kind) {
  const today = nowInfo().date;
  if (kind === 'month') return [startOfMonth(today), endOfMonth(today)];
  if (kind === 'next3') return [today, addDays(addMonths(startOfMonth(today), 3), -1)];
  if (kind === 'year') return [addMonths(startOfMonth(today), -12), addDays(addMonths(startOfMonth(today), 13), -1)];
  return weekRange(UI.date);
}

function exportCSV(kind) {
  const [from, to] = csvRange(kind);
  const main = mainCur();
  const occs = getOccurrences(from, to);
  const head = ['Fecha', 'Día', 'Inicio', 'Fin', 'Duración (h)', 'Calendario', 'Título', 'Cliente', 'Proyecto', 'Materia', 'Tipo', 'Teléfono', 'Complejidad', 'Confirmación', 'Check', 'Cobro', 'Tarifa', 'Moneda', 'Ingreso estimado', `Ingreso en ${main}`, 'Ubicación', 'Aula', 'Comisión', 'Traslado antes (min)', 'Traslado después (min)', 'Link', 'Notas', 'Repetición', 'Demo'];
  const lines = [head.map(csvCell).join(',')];
  for (const o of occs) {
    const inc = occIncome(o);
    const ri = o.calendar === 'work' ? occRateInfo(o) : null;
    const sj = getSubject(o.subjectId);
    lines.push([
      o.date, DAY_NAMES[weekdayOf(o.date)], fmtTime(o.start) + (o.start >= MIN_PER_DAY ? ' (+1)' : ''), fmtTime(o.end) + (o.end > MIN_PER_DAY ? ' (+1)' : ''),
      (occDuration(o) / 60).toFixed(2), o.calendar === 'work' ? 'Trabajo' : 'Facultad', o.title, clientName(o.clientId), o.project || '', sj ? sj.name : '',
      occTypeLabel(o), o.calendar === 'work' ? (o.phone ? 'Sí' : 'No') : '', o.calendar === 'work' ? (o.complexity === 'complex' ? 'Compleja' : 'Simple') : '',
      o.calendar === 'work' ? (o.confirmation === 'pending' ? 'Pendiente' : 'Confirmado') : '', o.isCheck ? 'Sí' : '',
      ri ? (ri.billing === 'task' ? 'Por tarea' : 'Por hora') : '', ri && ri.rate != null ? ri.rate : '', ri ? ri.currency : '',
      inc ? inc.amount.toFixed(2) : '', inc ? convert(inc.amount, inc.currency, main).toFixed(2) : '',
      o.location || '', o.room || '', o.commission || '', o.travelBefore || '', o.travelAfter || '', o.link || '', o.notes || '',
      o.isRecurring ? describeRecurrence(o.base.recurrence, o.base.date) : '', o.demo ? 'Sí' : '',
    ].map(csvCell).join(','));
  }
  downloadFile(`agenda-${from}_a_${to}.csv`, '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast(`CSV exportado: ${occs.length} eventos.`);
}

let printPrev = null;

function printWeek() {
  showSection('calendar');
  if (!isMobile() && UI.viewDesktop !== 'week') { UI.viewDesktop = 'week'; saveUI(); renderCalendar(); }
  setTimeout(() => window.print(), 60);
}

function setupPrint() {
  window.addEventListener('beforeprint', () => {
    if (printPrev != null) return;
    const s = DB.settings;
    printPrev = s.hourHeight;
    document.documentElement.dataset.themeResolved = 'light';
    s.hourHeight = clamp(Math.floor(560 / (visibleMinutes(daySegments()) / 60)), 18, 48);
    const [from, to] = weekRange(UI.date);
    const cal = UI.calFilter === 'work' ? 'Trabajo' : UI.calFilter === 'faculty' ? 'Facultad' : 'Trabajo y Facultad';
    document.getElementById('printHead').textContent = `Agenda${s.userName ? ' de ' + s.userName : ''} · ${fmtDateShort(from)} – ${fmtDateShort(to)} ${to.slice(0, 4)} · ${cal}`;
    renderCalendar();
  });
  window.addEventListener('afterprint', () => {
    if (printPrev == null) return;
    DB.settings.hourHeight = printPrev;
    printPrev = null;
    applyTheme();
    renderCalendar();
  });
}

/* ---------- Diálogos varios ---------- */

function showOutOfRange(date) {
  const segs = daySegments();
  const list = getOccurrences(date, date).filter(occPassesFilters)
    .filter((o) => !piecesOf(o, date, segs).length && !(o.end > MIN_PER_DAY && piecesOf(o, addDays(date, 1), segs).length));
  const m = openModal({
    title: `Fuera del horario visible · ${capitalize(fmtDateLong(date))}`, size: 'sm',
    body: `<p class="muted small">Estos eventos quedan fuera de las horas visibles (${esc(segmentsLabel())}). Podés ampliar el horario en Configuración.</p>
      <ul class="mini-list">${list.map((o) => `<li><button class="link" data-k="${esc(o.key)}"><span>${fmtTime(o.start)}–${fmtTime(o.end)}</span><b>${esc(o.title)}</b></button></li>`).join('')}</ul>`,
  });
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    const occ = findOccurrence(b.dataset.k);
    m.close();
    if (occ) openEventForm({ occ });
  });
}

function showShortcuts() {
  openModal({ title: 'Atajos de teclado', size: 'sm', body: shortcutsHtml() + '<p class="muted small">Los atajos no funcionan mientras escribís en un campo.</p>' });
}

function openMoreMenu() {
  const items = [
    ['income', 'wallet', 'Ingresos'], ['rates', 'exchange', 'Tipo de cambio'], ['settings', 'settings', 'Configuración'],
  ];
  const st = syncSummary();
  const m = openModal({
    title: 'Más', size: 'sm', className: 'modal-more',
    body: `<nav class="more-list">
      <button data-go="sync">${icon('phone')}<span>Sincronizar dispositivos<small><i class="sync-dot is-${st.cls}"></i>${esc(st.text)}</small></span>${icon('chevron-right')}</button>
      ${items.map(([s, ic, l]) => `<button data-go="${s}">${icon(ic)}<span>${l}</span>${icon('chevron-right')}</button>`).join('')}
      <button data-go="export">${icon('download')}<span>Exportar backup completo</span></button></nav>`,
  });
  m.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (!b) return;
    m.close();
    if (b.dataset.go === 'export') exportJSON();
    else if (b.dataset.go === 'sync') handleAction('goto-sync', b);
    else showSection(b.dataset.go);
  });
}

/* ---------- Acciones (delegación de clicks) ---------- */

async function handleAction(a, el) {
  const id = el.dataset.id;
  switch (a) {
    case 'prev': shiftPeriod(-1); break;
    case 'next': shiftPeriod(1); break;
    case 'prev-week': UI.date = addDays(UI.date, -7); renderCalendar(); break;
    case 'next-week': UI.date = addDays(UI.date, 7); renderCalendar(); break;
    case 'now': goToNow(); break;
    case 'new-event': openEventForm(); break;
    case 'new-event-date': openEventForm({ date: el.dataset.date }); break;
    case 'filters': openFilters(); break;
    case 'toggle-search': {
      const open = document.body.classList.toggle('search-open');
      if (open) document.getElementById('searchInput').focus(); else hideSearchResults();
      break;
    }
    case 'clear-filters': clearFilters(); break;
    case 'zoom-in': zoom(1); break;
    case 'zoom-out': zoom(-1); break;
    case 'toggle-panel': UI.panelOpen = !UI.panelOpen; saveUI(); renderCalendar(); break;
    case 'open-day': UI.date = el.dataset.date; setView('day'); break;
    case 'select-day': UI.date = el.dataset.date; renderCalendar(); if (currentView() === 'day') scrollToFocus(false); break;
    case 'select-day-week': UI.date = el.dataset.date; showSection('calendar'); setView('day'); break;
    case 'out-of-range': showOutOfRange(el.dataset.date); break;
    case 'focus-occ': closeDrawer(); hideSearchResults(); focusOccurrence(el.dataset.date, el.dataset.key); break;
    case 'goto': showSection(el.dataset.section); break;
    case 'more': openMoreMenu(); break;
    case 'shortcuts': showShortcuts(); break;
    case 'theme-toggle': commit((d) => { d.settings.theme = document.documentElement.dataset.themeResolved === 'dark' ? 'light' : 'dark'; }); applyTheme(); renderAll(); break;
    case 'hide-demo-banner': UI.demoBannerHidden = true; saveUI(); renderDemoBanner(); break;
    case 'remove-demo':
      if (await confirmDialog({ title: 'Eliminar datos de ejemplo', message: 'Se borran los eventos, clientes, materias, cobros y pagos marcados «demo». Lo que creaste o editaste vos se conserva (también los clientes de ejemplo que ya usás).', confirmText: 'Eliminar ejemplos', danger: true })) {
        commit((d) => removeDemoData(d), { undo: 'Datos de ejemplo eliminados' });
      }
      break;
    case 'load-demo':
      commit((d) => {
        const demo = buildDemoData();
        for (const k of Object.keys(demo)) {
          const ids = new Set(d[k].map((x) => x.id));
          d[k].push(...demo[k].filter((x) => !ids.has(x.id)));
        }
      }, { undo: 'Datos de ejemplo cargados' });
      UI.demoBannerHidden = false; saveUI(); renderDemoBanner();
      break;
    case 'reset-all':
      if (await confirmDialog({ title: 'Borrar todos los datos', message: `Se borran <b>todos</b> los eventos, clientes, cobros, ingresos y la configuración de este navegador.${isPaired() ? ' También se borran en tus dispositivos vinculados.' : ''} Te recomendamos exportar un backup antes.`, confirmText: 'Borrar todo', danger: true })) {
        commit((d) => { const nd = emptyData(); for (const k of Object.keys(d)) delete d[k]; Object.assign(d, nd); }, { undo: 'Todos los datos fueron borrados' });
        applyTheme();
      }
      break;
    case 'goto-sync':
      showSection('settings');
      requestAnimationFrame(() => { const b = document.getElementById('syncBlock'); if (b) b.scrollIntoView({ block: 'start' }); });
      break;
    case 'notify-test': testNotification(); break;
    case 'sync-pair': beginPairing(); break;
    case 'sync-join': joinWithCode((document.getElementById('syncCode') || {}).value); break;
    case 'sync-now': syncNow(); break;
    case 'sync-unlink': unlinkDevice(); break;
    case 'sync-forget': forgetDevice(el.dataset.slot); break;
    case 'export-json': exportJSON(); break;
    case 'import-json': document.getElementById('importFile').click(); break;
    case 'export-csv': exportCSV(document.getElementById('csvRange').value); break;
    case 'print': printWeek(); break;
    // Resumen
    case 'summary-period': UI.summaryPeriod = el.dataset.v; saveUI(); renderSummary(); break;
    case 'summary-prev': case 'summary-next': {
      const dir = a === 'summary-next' ? 1 : -1;
      const anchor = summaryState.anchor || nowInfo().date;
      summaryState.anchor = UI.summaryPeriod === 'month' ? addMonths(startOfMonth(anchor), dir) : addDays(anchor, 7 * dir);
      renderSummary();
      break;
    }
    case 'summary-today': summaryState.anchor = null; renderSummary(); break;
    // Clientes y materias
    case 'new-client': openClientForm(null); break;
    case 'edit-client': openClientForm(getClient(id)); break;
    case 'open-client': openClientDrawer(id); break;
    case 'close-drawer': closeDrawer(); break;
    case 'client-tab': UI.clientTab = el.dataset.v; saveUI(); renderClients(); break;
    case 'client-status': UI.clientStatus = el.dataset.v; saveUI(); renderClients(); break;
    case 'new-subject': openSubjectForm(null); break;
    case 'edit-subject': openSubjectForm(getSubject(id)); break;
    case 'new-event-client': closeDrawer(); openEventForm({ calendar: 'work', clientId: id }); break;
    case 'new-receivable-client': openReceivableForm(null, { clientId: id }); break;
    // Cobros
    case 'new-receivable': openReceivableForm(null); break;
    case 'rec-filter': UI.receivableFilter = el.dataset.v; saveUI(); renderReceivables(); break;
    case 'rec-paid': openMarkPaid(DB.receivables.find((r) => r.id === id)); break;
    case 'rec-edit': openReceivableForm(DB.receivables.find((r) => r.id === id)); break;
    case 'rec-delete': {
      const r = DB.receivables.find((x) => x.id === id);
      if (r && await confirmDialog({ title: 'Eliminar cobro', message: `¿Eliminar «${esc(r.concept)}» (${esc(fmtMoney(r.amount, r.currency))})?`, confirmText: 'Eliminar', danger: true })) {
        commit((d) => { d.receivables = d.receivables.filter((x) => x.id !== id); }, { undo: 'Cobro eliminado' });
      }
      break;
    }
    // Ingresos
    case 'new-payment': openPaymentForm(null); break;
    case 'pay-edit': openPaymentForm(DB.payments.find((p) => p.id === id)); break;
    case 'pay-delete': {
      const p = DB.payments.find((x) => x.id === id);
      if (p && await confirmDialog({ title: 'Eliminar pago', message: `¿Eliminar el pago de ${esc(fmtMoney(p.amount, p.currency))} del ${fmtDateNum(p.date)}?`, confirmText: 'Eliminar', danger: true })) {
        commit((d) => { d.payments = d.payments.filter((x) => x.id !== id); }, { undo: 'Pago eliminado' });
      }
      break;
    }
    case 'income-month': UI.incomeFilters.month = UI.incomeFilters.month === el.dataset.v ? '' : el.dataset.v; saveUI(); renderIncome(); break;
    case 'clear-income-filters': UI.incomeFilters = uiDefaults().incomeFilters; saveUI(); renderIncome(); break;
    // Tipo de cambio
    case 'use-implied': {
      const r = DB.rates;
      const inp = document.querySelector('[data-form=rates] [name=EUR_USD]');
      if (inp) inp.value = (Math.round((r.EUR_ARS / r.USD_ARS) * 10000) / 10000).toString();
      break;
    }
    default: break;
  }
}

function setupEvents() {
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-section]');
    if (nav && nav.closest('.nav, .tabbar')) { e.preventDefault(); showSection(nav.dataset.section); return; }
    const vb = e.target.closest('#viewSeg [data-view]');
    if (vb) { setView(vb.dataset.view); return; }
    const cb = e.target.closest('#calFilterSeg [data-cal]');
    if (cb) { UI.calFilter = cb.dataset.cal; saveUI(); renderCalendar(); return; }
    const ag = e.target.closest('#agendaView .ag-item[data-key]');
    if (ag) { const occ = findOccurrence(ag.dataset.key); if (occ) openEventPopover(occ, isMobile() ? null : ag); return; }
    const act = e.target.closest('[data-action]');
    if (act && !act.closest('.modal')) { handleAction(act.dataset.action, act); }
  });

  // Cerrar popover / buscador / panel del cliente al tocar afuera
  document.addEventListener('pointerdown', (e) => {
    const p = document.getElementById('popover');
    if (!p.hidden && !p.contains(e.target) && !e.target.closest('.modal-wrap')) {
      closePopover();
      if (e.target.closest('.cal-col') && !e.target.closest('.ev')) popoverJustClosed = true;
    }
    if (!e.target.closest('.search')) hideSearchResults();
    const dr = document.getElementById('drawer');
    if (!dr.hidden && !dr.contains(e.target) && !e.target.closest('.modal-wrap, [data-action=open-client], #popover, .toast')) closeDrawer();
  }, true);

  // Configuración (autoguardado)
  const setEl = document.getElementById('sec-settings');
  setEl.addEventListener('input', (e) => {
    const t = e.target;
    if (t.type === 'range' && t.dataset.set) { const out = t.parentElement.querySelector('output'); if (out) out.textContent = t.value + 'px'; }
  });
  setEl.addEventListener('change', (e) => {
    const t = e.target;
    const s = DB.settings;
    if (t.dataset.notifyToggle != null) {
      if (!t.checked) { commit((d) => { d.settings.notifyEnabled = false; }); return; }
      t.checked = false;
      enableNotifications().then((ok) => { if (ok) commit((d) => { d.settings.notifyEnabled = true; }, { toast: 'Avisos activados en este dispositivo' }); else renderSettings(); });
      return;
    }
    if (t.dataset.set) {
      const key = t.dataset.set;
      let v = t.value;
      const type = t.dataset.type;
      if (type === 'int') v = parseInt(v, 10);
      else if (type === 'num') v = t.value === '' ? null : Math.max(0, Number(t.value));
      else if (type === 'bool') v = v === 'true';
      else if (type === 'check') v = t.checked;
      if (key === 'dayStart' || key === 'dayEnd') {
        const ds = key === 'dayStart' ? v : s.dayStart, de = key === 'dayEnd' ? v : s.dayEnd;
        if (de - ds < 6 || de - ds > 24) { toast('El rango visible tiene que tener entre 6 y 24 horas.', { kind: 'error' }); renderSettings(); return; }
      }
      commit((d) => { d.settings[key] = v; });
      if (key === 'theme') applyTheme();
      if (key === 'mainCurrency' || key === 'userName') renderNav();
    } else if (t.dataset.colorClient) {
      commit((d) => { const c = d.clients.find((x) => x.id === t.dataset.colorClient); if (c) { c.color = t.value; c.demo = false; } });
    } else if (t.dataset.colorSubject) {
      commit((d) => { const x = d.subjects.find((y) => y.id === t.dataset.colorSubject); if (x) { x.color = t.value; x.demo = false; } });
    }
  });

  // Tipo de cambio
  const ratesEl = document.getElementById('sec-rates');
  ratesEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const vals = {};
    for (const k of ['USD_ARS', 'EUR_ARS', 'EUR_USD']) {
      const v = toNumber(f.elements[k].value);
      if (v == null || v <= 0) { toast('Los tipos de cambio tienen que ser mayores a cero.', { kind: 'error' }); f.elements[k].focus(); return; }
      vals[k] = v;
    }
    commit((d) => { d.rates = Object.assign({}, vals, { updatedAt: new Date().toISOString() }); }, { toast: 'Tipo de cambio actualizado' });
  });
  ratesEl.addEventListener('input', (e) => { if (e.target.dataset.conv) updateConverter(); });
  ratesEl.addEventListener('change', (e) => { if (e.target.dataset.conv) updateConverter(); });

  // Resumen: período personalizado
  document.getElementById('sec-summary').addEventListener('change', (e) => {
    const k = e.target.dataset.summary;
    if (!k || !isYmd(e.target.value)) return;
    summaryState[k] = e.target.value;
    renderSummary();
  });

  // Ingresos: filtros
  document.getElementById('sec-income').addEventListener('change', (e) => {
    const k = e.target.dataset.incomeFilter;
    if (!k) return;
    UI.incomeFilters[k] = e.target.value;
    saveUI();
    renderIncome();
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importJSONFile(file);
    e.target.value = '';
  });

  // Atajos de teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (dragState && dragState.active) { cancelDrag(); renderCalendar(); return; }
      if (closeTopModal()) return;
      if (closePopover()) return;
      if (closeDrawer()) return;
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (modalStack.length) return;
    const k = e.key;
    const inCal = UI.section === 'calendar';
    let handled = true;
    if (k === 'n' || k === 'N') openEventForm();
    else if (k === 't' || k === 'T') goToNow();
    else if (k === 'w' || k === 'W') setView('week');
    else if (k === 'd' || k === 'D') setView('day');
    else if (k === 'a' || k === 'A') setView('agenda');
    else if (k === '/') { showSection('calendar'); document.getElementById('searchInput').focus(); }
    else if (k === '?') showShortcuts();
    else if (inCal && k === 'ArrowLeft') shiftPeriod(-1);
    else if (inCal && k === 'ArrowRight') shiftPeriod(1);
    else if (inCal && (k === '+' || k === '=')) zoom(1);
    else if (inCal && k === '-') zoom(-1);
    else handled = false;
    if (handled) { e.preventDefault(); closePopover(); }
  });

  // Tooltips de gráficos
  const tip = document.getElementById('tip');
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t || e.pointerType === 'touch') return;
    tip.innerHTML = esc(t.dataset.tip).replace(/\n/g, '<br>');
    tip.hidden = false;
    const r = t.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 6, window.innerWidth - tw - 6) + 'px';
    tip.style.top = (r.top - th - 8 < 6 ? r.bottom + 8 : r.top - th - 8) + 'px';
  });
  document.addEventListener('pointerout', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && !t.contains(e.relatedTarget)) tip.hidden = true;
  });

  // Sincronización entre pestañas
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try { DB = normalizeData(JSON.parse(e.newValue)); noteStamps(DB); invalidateCaches(); applyTheme(); renderAll(); syncLocalChange(); } catch (err) { /* ignorar */ }
  });

  mqDark.addEventListener('change', () => { if (DB.settings.theme === 'system') { applyTheme(); renderAll(); } });
}

/* ---------- Arranque ---------- */

function init() {
  loadDB();
  applyTheme();
  UI.date = nowInfo().date;
  UI.search = '';
  initCalendar();
  setupEvents();
  setupSearch();
  setupPrint();
  if (!storageOk) toast('Este navegador no permite guardar datos (modo privado o almacenamiento bloqueado). Exportá un backup antes de cerrar.', { kind: 'error', duration: 9000 });
  showSection(UI.section || 'calendar');
  initSync();
  initNotify();
}

document.addEventListener('DOMContentLoaded', init);
