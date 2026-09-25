'use strict';
/* Calendario: vistas Semana / Día / Hoy (agenda), línea de hora actual, filtros, arrastrar y estirar eventos. */

let calScrollEl = null;
let calInnerEl = null;
let dragState = null;
let lastNowDate = null;
let popoverJustClosed = false;
let lastTap = { key: null, t: 0 };
let didInitialScroll = false;

const mqMobile = window.matchMedia('(max-width: 760px)');
function isMobile() { return mqMobile.matches; }

function currentView() { return isMobile() ? UI.viewMobile : UI.viewDesktop; }

function setView(v) {
  if (isMobile()) UI.viewMobile = v; else UI.viewDesktop = v;
  saveUI();
  if (UI.section !== 'calendar') showSection('calendar');
  renderCalendar();
  if (v !== 'agenda') scrollToFocus(false);
}

function visibleDays() {
  const s = DB.settings;
  if (currentView() === 'day') return [UI.date];
  const start = startOfWeek(UI.date, s.weekStart);
  let days = dateRange(start, addDays(start, 6));
  if (!s.showWeekend) days = days.filter((d) => { const w = weekdayOf(d); return w >= 1 && w <= 5; });
  return days;
}

/* ---------- Filtros y búsqueda ---------- */

function activeFilterCount() {
  const f = UI.filters;
  return f.clientIds.length + f.subjectIds.length + f.weekdays.length + f.types.length + (f.device !== 'all' ? 1 : 0);
}

function occPassesFilters(o) {
  if (UI.calFilter !== 'both' && o.calendar !== UI.calFilter) return false;
  const f = UI.filters;
  const hasC = f.clientIds.length, hasS = f.subjectIds.length;
  if (hasC || hasS) {
    const okC = hasC && o.calendar === 'work' && f.clientIds.includes(o.clientId || '');
    const okS = hasS && o.calendar === 'faculty' && f.subjectIds.includes(o.subjectId || '');
    if (!okC && !okS) return false;
  }
  if (f.weekdays.length && !f.weekdays.includes(weekdayOf(o.date))) return false;
  if (f.types.length && !f.types.includes(occTypeKey(o))) return false;
  if (f.device !== 'all') {
    if (o.calendar !== 'work') return false;
    if (f.device === 'phone' ? !o.phone : o.phone) return false;
  }
  return true;
}

function occSearchText(o) {
  const s = getSubject(o.subjectId);
  return norm([
    o.title, clientName(o.clientId), o.project, o.taskType, s && s.name, o.commission, o.professor,
    FACULTY_TYPES[o.facultyType], o.room, o.location, o.notes,
    o.calendar === 'work' ? 'trabajo' : 'facultad',
    o.calendar === 'work' ? (o.phone ? 'telefono celular' : 'computadora') : '',
    o.confirmation === 'pending' ? 'pendiente confirmar' : '',
    o.demo ? 'demo ejemplo' : '',
  ].filter(Boolean).join(' '));
}

function occMatchesSearch(o, q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const text = occSearchText(o);
  return terms.every((t) => text.includes(t));
}

/* ---------- Estilo visual de un evento ---------- */

function isDarkTheme() { return document.documentElement.dataset.themeResolved === 'dark'; }

function eventVisual(o) {
  const base = occColor(o);
  const dark = isDarkTheme();
  if (o.calendar === 'work') {
    if (o.phone) {
      // Se puede hacer desde el teléfono: versión crema / pastel, texto oscuro
      const cream = dark ? '#d9cfb6' : '#f6eedb';
      return { cls: 'ev-work ev-phone', bg: mixHex(base, cream, dark ? 0.2 : 0.16), fg: '#2a241b', accent: base, ink: '0,0,0' };
    }
    // Computadora: color sólido e intenso
    const bg = dark ? mixHex(base, '#000000', 0.86) : base;
    const fg = readableOn(bg);
    return { cls: 'ev-work ev-solid', bg, fg, accent: fg === '#ffffff' ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.35)', ink: fg === '#ffffff' ? '255,255,255' : '0,0,0' };
  }
  const surface = dark ? '#1c1c1e' : '#ffffff';
  return { cls: 'ev-fac', bg: mixHex(base, surface, dark ? 0.24 : 0.11), fg: dark ? '#ecebe7' : '#22201d', accent: base, ink: dark ? '255,255,255' : '0,0,0' };
}

function eventStyleVars(o) {
  const v = eventVisual(o);
  return { v, style: `--ev-bg:${v.bg};--ev-fg:${v.fg};--ev-accent:${v.accent};--hatch-ink:${v.ink}` };
}

/* ---------- Distribución de eventos solapados ---------- */

function layoutDay(list, withTravel) {
  // Un evento muy corto se dibuja con alto mínimo: se usa ese alto para no taparse con el siguiente
  const minMin = (17 / DB.settings.hourHeight) * 60;
  const items = list.map((o) => {
    const [s, e] = withTravel ? occBusyRange(o) : [o.start, o.end];
    return { o, s, e: Math.max(e, o.start + minMin) };
  }).sort((a, b) => a.s - b.s || b.e - a.e);
  const res = new Map();
  let cluster = [], clusterEnd = -Infinity;
  const place = () => {
    if (!cluster.length) return;
    const colsEnd = [];
    for (const it of cluster) {
      let c = colsEnd.findIndex((end) => end <= it.s);
      if (c === -1) { c = colsEnd.length; colsEnd.push(it.e); } else colsEnd[c] = it.e;
      it.col = c;
    }
    const n = colsEnd.length;
    for (const it of cluster) {
      let span = 1;
      for (let k = it.col + 1; k < n; k++) {
        if (cluster.some((x) => x.col === k && x.s < it.e && it.s < x.e)) break;
        span++;
      }
      res.set(it.o.key, { col: it.col, span, n });
    }
  };
  for (const it of items) {
    if (it.s >= clusterEnd) { place(); cluster = []; clusterEnd = it.e; } else clusterEnd = Math.max(clusterEnd, it.e);
    cluster.push(it);
  }
  place();
  return res;
}

/* ---------- Render principal del calendario ---------- */

function renderCalendar() {
  if (!calInnerEl) return;
  updateCalToolbar();
  const view = currentView();
  document.body.dataset.view = view;
  document.getElementById('calGridWrap').hidden = view === 'agenda';
  document.getElementById('agendaView').hidden = view !== 'agenda';
  renderDayStrip();
  if (view === 'agenda') renderAgenda(); else renderGrid();
  renderCalPanel();
}

function updateCalToolbar() {
  const view = currentView();
  const title = document.getElementById('calTitle');
  const today = nowInfo().date;
  if (view === 'week') {
    const days = visibleDays();
    const a = days[0], b = days[days.length - 1];
    const [ya, ma, da] = a.split('-').map(Number);
    const [yb, mb, db] = b.split('-').map(Number);
    let txt;
    if (ya !== yb) txt = `${da} ${MONTHS_SHORT[ma - 1]} ${ya} – ${db} ${MONTHS_SHORT[mb - 1]} ${yb}`;
    else if (ma !== mb) txt = `${da} ${MONTHS_SHORT[ma - 1]} – ${db} ${MONTHS_SHORT[mb - 1]} ${yb}`;
    else txt = `${da} – ${db} ${MONTHS_SHORT[mb - 1]} ${yb}`;
    title.innerHTML = esc(txt) + (days.includes(today) ? ' <span class="pill pill-now">Esta semana</span>' : '');
  } else {
    title.innerHTML = esc(capitalize(fmtDateLong(UI.date))) + ` <span class="tb-year">${UI.date.slice(0, 4)}</span>` + (UI.date === today ? ' <span class="pill pill-now">Hoy</span>' : '');
  }
  document.querySelectorAll('#viewSeg [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  document.querySelectorAll('#calFilterSeg [data-cal]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cal === UI.calFilter)));
  const n = activeFilterCount();
  const fb = document.getElementById('filtersBtn');
  fb.classList.toggle('is-active', n > 0);
  fb.querySelector('.count').textContent = n ? String(n) : '';
  const chips = document.getElementById('activeFilters');
  chips.hidden = !(n > 0 || UI.search.trim());
  document.querySelector('.tb-sub').classList.toggle('has-filters', !chips.hidden);
  if (!chips.hidden) {
    const parts = [];
    if (UI.search.trim()) parts.push(`Búsqueda: «${esc(UI.search.trim())}»`);
    if (n) parts.push(`${n} ${n === 1 ? 'filtro activo' : 'filtros activos'}`);
    chips.innerHTML = `${icon('filter')} <span>${parts.join(' · ')}</span> <button class="link" data-action="clear-filters">Limpiar</button>`;
  }
  document.body.classList.toggle('panel-closed', !UI.panelOpen);
}

function gridMetrics() {
  const s = DB.settings;
  return { H: s.hourHeight, lo: s.dayStart * 60, hi: s.dayEnd * 60, snap: s.slotMinutes || 15 };
}

function renderGrid() {
  const s = DB.settings;
  const { H, lo, hi } = gridMetrics();
  const days = visibleDays();
  const totalH = ((hi - lo) / 60) * H;
  const from = days[0], to = days[days.length - 1];
  const all = getOccurrences(from, to);
  const visible = all.filter(occPassesFilters);
  const q = UI.search.trim();
  const nowI = nowInfo();
  const alerts = detectAlerts(from, to);
  const conflictKeys = new Set(alerts.filter((a) => a.type === 'overlap').flatMap((a) => a.keys));

  calInnerEl.style.setProperty('--cols', days.length);
  calInnerEl.style.setProperty('--hour-h', H + 'px');
  calInnerEl.style.setProperty('--slots', String(60 / (s.slotMinutes || 15)));
  calInnerEl.classList.toggle('is-single', days.length === 1);

  let head = `<div class="cal-corner"><span>${esc(UI.calFilter === 'work' ? 'Trabajo' : UI.calFilter === 'faculty' ? 'Facultad' : '')}</span></div>`;
  days.forEach((d, i) => {
    const wd = weekdayOf(d);
    const dayAll = all.filter((o) => o.date === d);
    const work = dayAll.filter((o) => o.calendar === 'work').reduce((t, o) => t + occDuration(o), 0);
    const fac = dayAll.filter((o) => o.calendar === 'faculty').reduce((t, o) => t + occDuration(o), 0);
    const nConf = alerts.filter((a) => a.type === 'overlap' && a.date === d).length;
    const outside = dayAll.filter((o) => occPassesFilters(o) && (o.end <= lo || o.start >= hi)).length;
    const loadTitle = `Trabajo ${fmtDur(work)} · Facultad ${fmtDur(fac)}`;
    head += `<div class="cal-dayhead${d === nowI.date ? ' is-today' : ''}${d < nowI.date ? ' is-past' : ''}" data-date="${d}" style="grid-column:${i + 2}">
      <button class="dh-btn" data-action="open-day" data-date="${d}" title="Ver ${esc(fmtDateLong(d))}">
        <span class="dh-name">${DAY_SHORT[wd]}</span><span class="dh-num">${Number(d.slice(8))}</span>
      </button>
      <div class="dh-meta" title="${esc(loadTitle)}">
        ${work ? `<span class="dh-load">${fmtDurShort(work)}</span>` : ''}
        ${fac ? `<span class="dh-load dh-fac">${fmtDurShort(fac)}</span>` : ''}
        ${nConf ? `<span class="dh-warn" title="${nConf} ${nConf === 1 ? 'conflicto' : 'conflictos'} de horario">${icon('alert')}${nConf}</span>` : ''}
        ${outside ? `<button class="dh-out" data-action="out-of-range" data-date="${d}" title="Eventos fuera del horario visible">+${outside}</button>` : ''}
      </div>
    </div>`;
  });

  let gutter = '<div class="cal-gutter">';
  for (let h = s.dayStart; h <= s.dayEnd; h++) {
    const top = ((h * 60 - lo) / 60) * H;
    const cls = h === s.dayStart ? ' is-first' : h === s.dayEnd ? ' is-last' : '';
    const night = h >= 24;
    gutter += `<div class="gl${cls}${night ? ' is-night' : ''}${h === 24 ? ' is-midnight' : ''}" style="top:${top}px"><span>${fmtTime(h * 60)}</span>${h === 24 ? '<em>+1</em>' : ''}</div>`;
  }
  gutter += '<div class="now-label" hidden></div></div>';

  let cols = '';
  days.forEach((d, i) => {
    const list = visible.filter((o) => o.date === d);
    const layout = layoutDay(list, s.showTravel);
    const ov = overlapSegments(list);
    let inner = '';
    if (hi > MIN_PER_DAY) {
      inner += `<div class="night-zone" style="top:${((MIN_PER_DAY - lo) / 60) * H}px;height:${((hi - MIN_PER_DAY) / 60) * H}px"></div>`;
    }
    for (const o of list) {
      const lay = layout.get(o.key) || { col: 0, span: 1, n: 1 };
      inner += eventBlockHtml(o, lay, ov.get(o.key), {
        dim: q && !occMatchesSearch(o, q),
        match: q && occMatchesSearch(o, q),
        past: o.date < nowI.date || (o.date === nowI.date && o.end <= nowI.min),
        conflict: conflictKeys.has(o.key),
      });
    }
    cols += `<div class="cal-col${d === nowI.date ? ' is-today' : ''}${weekdayOf(d) === 0 || weekdayOf(d) === 6 ? ' is-weekend' : ''}" data-date="${d}" style="grid-column:${i + 2};height:${totalH}px">${inner}</div>`;
  });

  const overlay = `<div class="cal-now" hidden><div class="now-all"></div><div class="now-today"><i></i></div></div>`;
  calInnerEl.innerHTML = head + gutter + cols + `<div class="cal-overlay" style="height:${totalH}px">${overlay}</div>`;
  lastNowDate = nowI.date;
  renderNowLine();
  if (!didInitialScroll) { didInitialScroll = true; requestAnimationFrame(() => scrollToFocus(false)); }
}

function eventBlockHtml(o, lay, ov, ctx) {
  const s = DB.settings;
  const { H, lo, hi } = gridMetrics();
  const vs = Math.max(o.start, lo), ve = Math.min(o.end, hi);
  if (ve <= vs) return '';
  const top = ((vs - lo) / 60) * H;
  const height = Math.max(((ve - vs) / 60) * H, 16);
  const left = (lay.col / lay.n) * 100, width = (lay.span / lay.n) * 100;
  const pos = `top:${top}px;height:${height - 1}px;left:calc(${left}% + 1px);width:calc(${width}% - 3px)`;
  const { v, style } = eventStyleVars(o);
  const size = height < 27 ? 'xs' : height < 46 ? 'sm' : height < 74 ? 'md' : 'lg';
  const inc = occIncome(o);
  const showInc = s.showIncomeInEvents && inc;
  const time = `${fmtTime(o.start)}–${fmtTime(o.end)}`;
  const kind = o.calendar === 'work' ? icon(o.phone ? 'phone' : 'laptop', 'ev-kind') : icon('cap', 'ev-kind');
  const tags = [
    o.isRecurring ? icon('repeat', 'ev-rep') : '',
    o.demo ? '<span class="ev-demo">demo</span>' : '',
  ].join('');
  const cls = [
    'ev', v.cls, 'sz-' + size,
    o.confirmation === 'pending' && o.calendar === 'work' ? 'is-pending' : '',
    ctx.past ? 'is-past' : '', ctx.dim ? 'is-dim' : '', ctx.match ? 'is-match' : '',
    ov ? 'is-overlap' : '', o.start < lo ? 'clip-top' : '', o.end > hi ? 'clip-bot' : '',
  ].filter(Boolean).join(' ');

  let hatch = '';
  if (ov) {
    for (const seg of ov.segs) {
      const a = Math.max(seg.start, vs), b = Math.min(seg.end, ve);
      if (b <= a) continue;
      hatch += `<div class="ev-hatch d${Math.min(seg.depth, 3)}" style="top:${((a - vs) / 60) * H}px;height:${((b - a) / 60) * H}px"></div>`;
    }
  }

  let travel = '';
  if (s.showTravel && o.calendar === 'faculty') {
    const tb = Number(o.travelBefore) || 0, ta = Number(o.travelAfter) || 0;
    const tz = (a, b, label) => {
      const za = Math.max(a, lo), zb = Math.min(b, hi);
      if (zb <= za) return '';
      const zh = ((zb - za) / 60) * H;
      return `<div class="ev-travel" style="top:${((za - lo) / 60) * H}px;height:${zh}px;left:calc(${left}% + 1px);width:calc(${width}% - 3px);--ev-accent:${v.accent};--tz-bg:${rgba(occColor(o), 0.09)}" title="${esc(label)}">${zh >= 15 ? `<span>${esc(label)}</span>` : ''}</div>`;
    };
    if (tb) travel += tz(o.start - tb, o.start, `Traslado ${tb} min`);
    if (ta) travel += tz(o.end, o.end + ta, `Traslado ${ta} min`);
  }

  const sub = occSubtitle(o);
  const overlapNames = ov ? ov.others.map((x) => x.title || 'Sin título').join(', ') : '';
  const tip = [
    o.title || 'Sin título', time + ` (${fmtDur(occDuration(o))})`, sub,
    inc ? `Ingreso estimado: ${fmtMoney(inc.amount, inc.currency)}` : '',
    ov ? `⚠ Solapamiento con: ${overlapNames}` : '',
  ].filter(Boolean).join('\n');

  let body;
  if (size === 'xs') {
    body = `<div class="ev-line"><span class="ev-title">${esc(o.title || 'Sin título')}</span><span class="ev-time">${fmtTime(o.start)}</span>${showInc && width > 30 ? `<span class="ev-inc">${esc(fmtMoney(inc.amount, inc.currency))}</span>` : ''}</div>`;
  } else {
    body = `<div class="ev-top"><span class="ev-title">${esc(o.title || 'Sin título')}</span>${kind}</div>
      <div class="ev-time">${time}${showInc ? ` · <span class="ev-inc">${esc(fmtMoney(inc.amount, inc.currency))}</span>` : ''}</div>
      ${size !== 'sm' && sub ? `<div class="ev-sub">${esc(sub)}</div>` : ''}
      ${size === 'lg' && o.confirmation === 'pending' && o.calendar === 'work' ? '<div class="ev-flag">Por confirmar</div>' : ''}
      ${tags ? `<div class="ev-tags">${tags}</div>` : ''}`;
  }

  return travel + `<div class="${cls}" style="${pos};${style}" data-key="${esc(o.key)}" tabindex="0" role="button" title="${esc(tip)}">
    ${hatch}
    ${ov ? `<span class="ev-ovl">${icon('alert')}<b>Solapamiento</b></span>` : ctx.conflict ? `<span class="ev-ovl" title="Se superpone con un evento oculto por los filtros">${icon('alert')}<b>Solapamiento</b></span>` : ''}
    <div class="ev-body">${body}</div>
    <div class="ev-rs ev-rs-top"></div><div class="ev-rs ev-rs-bot"></div>
  </div>`;
}

/* ---------- Línea de hora actual ---------- */

function renderNowLine() {
  if (!calInnerEl) return;
  const n = nowInfo();
  if (lastNowDate && n.date !== lastNowDate) { lastNowDate = n.date; renderAll(); return; }
  const line = calInnerEl.querySelector('.cal-now');
  const label = calInnerEl.querySelector('.now-label');
  if (!line || !label) { updateAgendaNow(); return; }
  const { H, lo, hi } = gridMetrics();
  const days = visibleDays();
  const idx = days.indexOf(n.date);
  if (idx === -1 || n.min < lo || n.min > hi) { line.hidden = true; label.hidden = true; return; }
  const top = ((n.min - lo) / 60) * H;
  line.hidden = false; label.hidden = false;
  line.style.top = top + 'px';
  label.style.top = top + 'px';
  label.textContent = fmtTime(n.min);
  const t = line.querySelector('.now-today');
  t.style.left = (idx / days.length) * 100 + '%';
  t.style.width = (1 / days.length) * 100 + '%';
}

function scrollToFocus(smooth) {
  if (currentView() === 'agenda') {
    const el = document.querySelector('#agendaView .ag-now, #agendaView .ag-item.is-now');
    if (el) el.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    return;
  }
  if (!calScrollEl) return;
  const { H, lo, hi } = gridMetrics();
  const n = nowInfo();
  const days = visibleDays();
  let target = 0;
  if (days.includes(n.date) && n.min >= lo && n.min <= hi) {
    target = ((n.min - lo) / 60) * H - calScrollEl.clientHeight * 0.3;
  } else {
    // Sin "ahora" visible: ir al primer evento de lo que se ve
    const occs = getOccurrences(days[0], days[days.length - 1]).filter(occPassesFilters);
    const first = occs.reduce((m, o) => Math.min(m, o.start), Infinity);
    if (isFinite(first) && first > lo) target = ((first - lo) / 60) * H - 40;
  }
  const col = calInnerEl.querySelector(`.cal-col[data-date="${n.date}"]`);
  const opts = { top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' };
  if (col && calScrollEl.scrollWidth > calScrollEl.clientWidth) {
    const gutterW = calInnerEl.querySelector('.cal-gutter').offsetWidth;
    opts.left = Math.max(0, col.offsetLeft - gutterW - 8);
  }
  calScrollEl.scrollTo(opts);
}

function goToNow() {
  UI.date = nowInfo().date;
  if (UI.section !== 'calendar') showSection('calendar');
  renderCalendar();
  requestAnimationFrame(() => scrollToFocus(true));
}

function shiftPeriod(dir) {
  const view = currentView();
  UI.date = addDays(UI.date, view === 'week' ? 7 * dir : dir);
  renderCalendar();
}

function zoom(dir) {
  const s = DB.settings;
  const steps = [28, 36, 44, 52, 64, 80, 100, 120];
  let i = steps.findIndex((x) => x >= s.hourHeight);
  if (i === -1) i = steps.length - 1;
  i = clamp(i + dir, 0, steps.length - 1);
  if (steps[i] === s.hourHeight) return;
  // mantener el centro visible
  const centerMin = calScrollEl ? ((calScrollEl.scrollTop + calScrollEl.clientHeight / 2) / s.hourHeight) * 60 : 0;
  s.hourHeight = steps[i];
  saveDB();
  renderCalendar();
  if (calScrollEl) calScrollEl.scrollTop = (centerMin / 60) * s.hourHeight - calScrollEl.clientHeight / 2;
}

/* Resalta un evento (desde búsqueda o alertas) */
function focusOccurrence(date, key) {
  UI.date = date;
  if (UI.section !== 'calendar') showSection('calendar');
  if (currentView() === 'agenda' && !isMobile()) setView('week'); else renderCalendar();
  requestAnimationFrame(() => {
    const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1600);
  });
}

/* ---------- Tira de días (día / agenda / celular) ---------- */

function renderDayStrip() {
  const strip = document.getElementById('dayStrip');
  const view = currentView();
  if (view === 'week') { strip.hidden = true; return; }
  strip.hidden = false;
  const s = DB.settings;
  const start = startOfWeek(UI.date, s.weekStart);
  let days = dateRange(start, addDays(start, 6));
  if (!s.showWeekend) days = days.filter((d) => { const w = weekdayOf(d); return w >= 1 && w <= 5; });
  const sum = summarize(start, addDays(start, 6));
  const max = Math.max(6 * 60, ...days.map((d) => sum.byDay[d].workMin + sum.byDay[d].facultyMin));
  const today = nowInfo().date;
  strip.innerHTML = `<button class="btn-icon ds-nav" data-action="prev-week" title="Semana anterior" aria-label="Semana anterior">${icon('chevron-left')}</button>
    <div class="ds-days">${days.map((d) => {
      const b = sum.byDay[d];
      const tot = b.workMin + b.facultyMin;
      return `<button class="ds-day${d === UI.date ? ' is-sel' : ''}${d === today ? ' is-today' : ''}" data-action="select-day" data-date="${d}" title="${esc(capitalize(fmtDateLong(d)))}: ${fmtDur(tot)} ocupado">
        <span class="ds-name">${DAY_SHORT[weekdayOf(d)]}</span><b>${Number(d.slice(8))}</b>
        <i class="ds-load"><i style="width:${Math.round((b.workMin / max) * 100)}%" class="w"></i><i style="width:${Math.round((b.facultyMin / max) * 100)}%" class="f"></i></i>
      </button>`;
    }).join('')}</div>
    <button class="btn-icon ds-nav" data-action="next-week" title="Semana siguiente" aria-label="Semana siguiente">${icon('chevron-right')}</button>`;
}

/* ---------- Vista "Hoy" (agenda vertical) ---------- */

function renderAgenda() {
  const el = document.getElementById('agendaView');
  const date = UI.date;
  const n = nowInfo();
  const isToday = date === n.date;
  const q = UI.search.trim();
  const list = getOccurrences(date, date).filter(occPassesFilters).filter((o) => !q || occMatchesSearch(o, q));
  const sum = summarize(date, date);
  const main = mainCur();
  const stats = [
    sum.workMin ? `${fmtDur(sum.workMin)} de trabajo` : '',
    sum.facultyMin ? `${fmtDur(sum.facultyMin)} de facultad` : '',
    sum.incomeMain ? fmtMoney(sum.incomeMain, main) : '',
    `${fmtDur(sum.freeMin)} libres`,
  ].filter(Boolean).join(' · ');

  const rel = { 0: 'Hoy', 1: 'Mañana', '-1': 'Ayer' }[diffDays(n.date, date)];
  let html = `<div class="ag-head">
    <div><h2>${rel ? rel + ' · ' : ''}${esc(capitalize(fmtDateLong(date)))}</h2><p>${esc(stats)}</p></div>
    ${isToday ? '' : `<button class="btn btn-ghost btn-sm" data-action="now">${icon('clock')} Ir a hoy</button>`}
  </div>`;

  if (!list.length) {
    html += `<div class="empty"><p>No hay nada programado${q ? ' que coincida con la búsqueda' : ''}.</p>
      <button class="btn btn-primary" data-action="new-event-date" data-date="${date}">${icon('plus')} Nuevo evento</button></div>`;
    el.innerHTML = html;
    return;
  }

  html += '<ol class="ag-list">';
  let nowPlaced = !isToday;
  let prevEnd = null;
  const nowRow = () => `<li class="ag-now" data-now><span class="ag-now-time">${fmtTime(n.min)}</span><span class="ag-now-line"></span><span class="ag-now-label">Ahora</span></li>`;
  for (const o of list) {
    const busy = occBusyRange(o);
    if (prevEnd != null && busy[0] - prevEnd >= 15) {
      html += `<li class="ag-gap"><span>${fmtTime(prevEnd)}</span><em>Libre ${fmtDur(busy[0] - prevEnd)}</em></li>`;
    }
    if (!nowPlaced && n.min < busy[0]) { html += nowRow(); nowPlaced = true; }
    if (DB.settings.showTravel && o.calendar === 'faculty' && +o.travelBefore) {
      html += `<li class="ag-travel"><span>${fmtTime(o.start - o.travelBefore)}</span><em>${icon('walk')} Traslado ${o.travelBefore} min</em></li>`;
    }
    if (!nowPlaced && n.min < o.start) { html += nowRow(); nowPlaced = true; }
    const inc = occIncome(o);
    const { v, style } = eventStyleVars(o);
    const running = isToday && o.start <= n.min && o.end > n.min;
    const past = isToday ? o.end <= n.min : date < n.date;
    if (running) nowPlaced = true;
    const meta = [
      fmtDur(occDuration(o)),
      occSubtitle(o),
      inc ? fmtMoney(inc.amount, inc.currency) : '',
    ].filter(Boolean).map(esc).join(' · ');
    const extra = [o.location, o.notes].filter(Boolean).join(' · ');
    html += `<li><button class="ag-item ${v.cls}${running ? ' is-now' : ''}${past ? ' is-past' : ''}" data-key="${esc(o.key)}" style="${style}">
      <span class="ag-time"><b>${fmtTime(o.start)}</b><span>${fmtTime(o.end)}</span></span>
      <span class="ag-swatch"></span>
      <span class="ag-body">
        <span class="ag-title">${esc(o.title || 'Sin título')}
          ${o.calendar === 'work' ? `<span class="tag">${icon(o.phone ? 'phone' : 'laptop')}${o.phone ? 'Teléfono' : 'Compu'}</span>` : `<span class="tag">${icon('cap')}Facultad</span>`}
          ${o.confirmation === 'pending' && o.calendar === 'work' ? '<span class="tag tag-warn">Por confirmar</span>' : ''}
          ${o.demo ? '<span class="tag tag-demo">demo</span>' : ''}
        </span>
        <span class="ag-meta">${meta}</span>
        ${extra ? `<span class="ag-extra">${esc(extra)}</span>` : ''}
        ${running ? `<span class="ag-running">En curso · faltan ${fmtDur(o.end - n.min)}</span>` : ''}
      </span>
    </button></li>`;
    if (DB.settings.showTravel && o.calendar === 'faculty' && +o.travelAfter) {
      html += `<li class="ag-travel"><span>${fmtTime(o.end)}</span><em>${icon('walk')} Traslado ${o.travelAfter} min</em></li>`;
    }
    prevEnd = prevEnd == null ? busy[1] : Math.max(prevEnd, busy[1]);
  }
  if (!nowPlaced) html += nowRow();
  html += '</ol>';
  el.innerHTML = html;
}

function updateAgendaNow() {
  if (currentView() !== 'agenda' || UI.section !== 'calendar') return;
  const row = document.querySelector('#agendaView .ag-now-time');
  if (row) row.textContent = fmtTime(nowInfo().min);
}

/* ---------- Arrastrar, estirar y crear con el mouse / dedo ---------- */

function colAtX(x) {
  const cols = [...calInnerEl.querySelectorAll('.cal-col')];
  let best = null, bestD = Infinity;
  for (const el of cols) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x < r.right) return el;
    const dd = Math.min(Math.abs(x - r.left), Math.abs(x - r.right));
    if (dd < bestD) { bestD = dd; best = el; }
  }
  return best;
}

function minutesAtY(colEl, y) {
  const { H, lo } = gridMetrics();
  return lo + ((y - colEl.getBoundingClientRect().top) / H) * 60;
}

function onGridPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const colEl = e.target.closest('.cal-col');
  if (!colEl) return;
  const evEl = e.target.closest('.ev');
  const occ = evEl ? findOccurrence(evEl.dataset.key) : null;
  const type = !evEl ? 'create' : e.target.closest('.ev-rs-top') ? 'resize-top' : e.target.closest('.ev-rs-bot') ? 'resize-bot' : 'move';
  const m = minutesAtY(colEl, e.clientY);
  dragState = {
    pointerId: e.pointerId, type, touch: e.pointerType !== 'mouse',
    x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastY: e.clientY,
    active: false, occ, el: evEl, colEl, date: colEl.dataset.date, anchorMin: m,
    suppressCreate: popoverJustClosed,
  };
  popoverJustClosed = false;
  if (occ) {
    dragState.grab = m - occ.start;
    dragState.ns = occ.start; dragState.ne = occ.end; dragState.nd = occ.date;
  }
  if (dragState.touch && occ) {
    dragState.timer = setTimeout(() => { if (dragState && !dragState.active) activateDrag(); }, 420);
  }
  if (!dragState.touch && evEl) e.preventDefault();
}

function activateDrag() {
  const ds = dragState;
  if (!ds || (ds.type === 'create' && ds.touch)) return;
  ds.active = true;
  document.body.classList.add('is-dragging', 'drag-' + ds.type);
  if (ds.el) ds.el.classList.add('is-drag-src');
  if (ds.touch && navigator.vibrate) navigator.vibrate(12);
  ds.ghost = document.createElement('div');
  ds.ghost.className = 'ev-ghost' + (ds.type === 'create' ? ' is-create' : '');
  if (ds.occ) ds.ghost.setAttribute('style', eventStyleVars(ds.occ).style);
  closePopover();
  updateDrag();
  autoScrollLoop();
}

function updateDrag() {
  const ds = dragState;
  if (!ds || !ds.active) return;
  const { H, lo, hi, snap } = gridMetrics();
  const col = ds.type === 'move' ? colAtX(ds.lastX) : ds.colEl;
  if (!col) return;
  const m = minutesAtY(col, ds.lastY);
  const r = (x) => Math.round(x / snap) * snap;
  let ns, ne;
  if (ds.type === 'move') {
    const dur = ds.occ.end - ds.occ.start;
    ns = clamp(r(m - ds.grab), lo, Math.max(lo, hi - dur));
    ne = ns + dur;
    ds.nd = col.dataset.date;
  } else if (ds.type === 'resize-top') {
    ne = ds.occ.end;
    ns = clamp(r(m), Math.min(lo, ds.occ.start), ne - snap);
  } else if (ds.type === 'resize-bot') {
    ns = ds.occ.start;
    ne = clamp(r(m), ns + snap, Math.max(hi, ds.occ.end));
  } else {
    const a = Math.floor(ds.anchorMin / snap) * snap;
    const b = r(m);
    ns = clamp(Math.min(a, b), lo, hi - snap);
    ne = clamp(Math.max(a + snap, b), ns + snap, hi);
    ds.nd = ds.date;
  }
  ds.ns = ns; ds.ne = ne;
  if (ds.ghost.parentNode !== col) col.appendChild(ds.ghost);
  const top = ((Math.max(ns, lo) - lo) / 60) * H;
  const h = ((Math.min(ne, hi) - Math.max(ns, lo)) / 60) * H;
  ds.ghost.style.top = top + 'px';
  ds.ghost.style.height = Math.max(h, 14) + 'px';
  const title = ds.occ ? esc(ds.occ.title || 'Sin título') : 'Nuevo evento';
  ds.ghost.innerHTML = `<b>${title}</b><span>${fmtTime(ns)}–${fmtTime(ne)} · ${fmtDur(ne - ns)}</span>${ds.type === 'move' && ds.nd !== ds.occ.date ? `<span>${DAY_SHORT[weekdayOf(ds.nd)]} ${Number(ds.nd.slice(8))}</span>` : ''}`;
}

function autoScrollLoop() {
  const ds = dragState;
  if (!ds || !ds.active || !calScrollEl) return;
  const r = calScrollEl.getBoundingClientRect();
  const edge = 40;
  let dy = 0, dx = 0;
  if (ds.lastY < r.top + edge + 50) dy = -Math.ceil((r.top + edge + 50 - ds.lastY) / 6);
  else if (ds.lastY > r.bottom - edge) dy = Math.ceil((ds.lastY - (r.bottom - edge)) / 6);
  if (ds.type === 'move') {
    if (ds.lastX < r.left + 70) dx = -8; else if (ds.lastX > r.right - edge) dx = 8;
  }
  if (dy || dx) {
    calScrollEl.scrollTop += dy;
    if (calScrollEl.scrollWidth > calScrollEl.clientWidth) calScrollEl.scrollLeft += dx;
    updateDrag();
  }
  ds.raf = requestAnimationFrame(autoScrollLoop);
}

function onPointerMove(e) {
  const ds = dragState;
  if (!ds || e.pointerId !== ds.pointerId) return;
  ds.lastX = e.clientX; ds.lastY = e.clientY;
  const dist = Math.hypot(e.clientX - ds.x0, e.clientY - ds.y0);
  if (!ds.active) {
    if (ds.touch) {
      if (dist > 10) { clearTimeout(ds.timer); dragState = null; }
      return;
    }
    if (dist < 5) return;
    activateDrag();
    return;
  }
  updateDrag();
}

function endDrag() {
  const ds = dragState;
  if (!ds) return;
  cancelAnimationFrame(ds.raf);
  clearTimeout(ds.timer);
  document.body.classList.remove('is-dragging', 'drag-move', 'drag-create', 'drag-resize-top', 'drag-resize-bot');
  if (ds.el) ds.el.classList.remove('is-drag-src');
  dragState = null;
  return ds;
}

function onPointerUp(e) {
  const ds = dragState;
  if (!ds || e.pointerId !== ds.pointerId) return;
  const dist = Math.hypot(e.clientX - ds.x0, e.clientY - ds.y0);
  if (!ds.active) {
    endDrag();
    if (dist > 10) return;
    if (ds.occ) {
      const t = e.timeStamp;
      if (lastTap.key === ds.occ.key && t - lastTap.t < 350 && !ds.touch) { closePopover(); openEventForm({ occ: ds.occ }); lastTap = { key: null, t: 0 }; return; }
      lastTap = { key: ds.occ.key, t };
      openEventPopover(ds.occ, ds.el);
    } else if (!ds.suppressCreate) {
      const { snap } = gridMetrics();
      const start = Math.floor(ds.anchorMin / snap) * snap;
      openEventForm({ date: ds.date, start, end: start + 60 });
    }
    return;
  }
  endDrag();
  const ghost = ds.ghost;
  if (ds.type === 'create') {
    ghost.remove();
    openEventForm({ date: ds.nd, start: ds.ns, end: ds.ne });
    return;
  }
  const o = ds.occ;
  if (ds.ns === o.start && ds.ne === o.end && ds.nd === o.date) { ghost.remove(); return; }
  applyDragChange(o, { date: ds.nd, start: ds.ns, end: ds.ne }).finally(() => ghost.remove());
}

function onPointerCancel(e) {
  const ds = dragState;
  if (!ds || e.pointerId !== ds.pointerId) return;
  const d = endDrag();
  if (d && d.ghost) d.ghost.remove();
}

function cancelDrag() {
  const d = endDrag();
  if (d && d.ghost) d.ghost.remove();
}

async function applyDragChange(occ, changes) {
  let scope = 'all';
  if (occ.isRecurring) {
    scope = await askScope({ title: 'Mover un evento que se repite', verb: 'mover' });
    if (!scope) { renderCalendar(); return; }
  }
  const moved = changes.date !== occ.date;
  const resized = (changes.end - changes.start) !== (occ.end - occ.start);
  commit((d) => applyOccurrenceEdit(d, occ, changes, scope), {
    undo: `${resized && !moved ? 'Duración cambiada' : 'Evento movido'}: ${changes.date !== occ.date ? DAY_SHORT[weekdayOf(changes.date)] + ' ' : ''}${fmtTime(changes.start)}–${fmtTime(changes.end)}`,
  });
}

/* ---------- Gestos de swipe (día / agenda) ---------- */

function setupSwipe(el) {
  let sw = null;
  el.addEventListener('touchstart', (e) => {
    if (currentView() === 'week' || e.touches.length !== 1) { sw = null; return; }
    sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!sw || (dragState && dragState.active)) { sw = null; return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - sw.x, dy = t.clientY - sw.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - sw.t < 700) {
      UI.date = addDays(UI.date, dx < 0 ? 1 : -1);
      const target = currentView() === 'agenda' ? document.getElementById('agendaView') : calScrollEl;
      target.classList.remove('swipe-l', 'swipe-r');
      void target.offsetWidth;
      target.classList.add(dx < 0 ? 'swipe-l' : 'swipe-r');
      renderCalendar();
    }
    sw = null;
  }, { passive: true });
}

function initCalendar() {
  calScrollEl = document.getElementById('calScroll');
  calInnerEl = document.getElementById('calInner');
  calInnerEl.addEventListener('pointerdown', onGridPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('touchmove', (e) => { if (dragState && dragState.active) e.preventDefault(); }, { passive: false });
  calInnerEl.addEventListener('contextmenu', (e) => { if (dragState) e.preventDefault(); });
  calInnerEl.addEventListener('keydown', (e) => {
    const evEl = e.target.closest && e.target.closest('.ev');
    if (evEl && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      const occ = findOccurrence(evEl.dataset.key);
      if (occ) openEventPopover(occ, evEl);
    }
  });
  calScrollEl.addEventListener('scroll', () => { if (popoverAnchor && popoverAnchor.closest && popoverAnchor.closest('#calScroll')) closePopover(); }, { passive: true });
  setupSwipe(document.getElementById('calMain'));
  setInterval(renderNowLine, 20000);
  mqMobile.addEventListener('change', () => { renderAll(); });
}
