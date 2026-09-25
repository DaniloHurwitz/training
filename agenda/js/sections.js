'use strict';
/* Secciones: panel lateral del calendario, Resumen, Clientes/Materias, Cobros, Ingresos, Tipo de cambio y Configuración. */

let summaryState = { anchor: null, from: null, to: null };

/* ---------- Piezas compartidas ---------- */

function sectionHead(title, actions = '', sub = '') {
  return `<header class="sec-head"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="sec-actions">${actions}</div></header>`;
}

function meterHtml(label, value, goal, valueText, goalText, note) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const over = goal > 0 && value > goal;
  return `<div class="meter${over ? ' is-over' : ''}">
    <div class="meter-top"><span>${label}</span><b>${valueText} <span class="muted">/ ${goalText}</span></b></div>
    <div class="meter-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}"><i style="width:${pct}%"></i></div>
    ${note ? `<small class="muted">${note}</small>` : ''}
  </div>`;
}

function goalNote(valueMin, goalMin) {
  const d = valueMin - goalMin;
  if (Math.abs(d) < 1) return 'Justo en el objetivo.';
  return d > 0 ? `${fmtDur(d)} por encima del objetivo.` : `Faltan ${fmtDur(-d)}.`;
}

function legendHtml(items) {
  return `<div class="legend">${items.map(([cls, color, label]) => `<span><i class="lg ${cls}" style="background:${color}"></i>${label}</span>`).join('')}</div>`;
}

function loadBarsHtml(sum) {
  const s = DB.settings;
  const days = sum.days;
  const max = Math.max(4 * 60, ...days.map((d) => sum.byDay[d].workMin + sum.byDay[d].facultyMin));
  const today = nowInfo().date;
  return `<ul class="loadbars">${days.map((d) => {
    const b = sum.byDay[d];
    const tot = b.workMin + b.facultyMin;
    const tip = `${capitalize(fmtDateLong(d))}\nTrabajo: ${fmtDur(b.workMin)}\nFacultad: ${fmtDur(b.facultyMin)}${b.travelMin ? `\nTraslados: ${fmtDur(b.travelMin)}` : ''}\nIngreso: ${fmtMoney(b.incomeMain, mainCur())}`;
    return `<li class="${d === today ? 'is-today' : ''}" data-tip="${esc(tip)}">
      <button class="lb-day link" data-action="select-day-week" data-date="${d}">${DAY_SHORT[weekdayOf(d)]} ${Number(d.slice(8))}</button>
      <span class="lb-bar">${b.workMin ? `<i style="width:${(b.workMin / max) * 100}%;background:${s.workColor}"></i>` : ''}${b.facultyMin ? `<i style="width:${(b.facultyMin / max) * 100}%;background:${s.facultyColor}"></i>` : ''}</span>
      <span class="lb-val">${tot ? fmtDurShort(tot) : '—'}</span>
    </li>`;
  }).join('')}</ul>`;
}

function timeSplitHtml(sum) {
  const s = DB.settings;
  const total = sum.rangeMin || 1;
  const free = sum.freeMin;
  const other = Math.max(0, sum.occupiedMin - sum.workMin - sum.facultyMin - sum.travelMin);
  const seg = (min, color, label) => (min > 0 ? `<i style="flex:${min};background:${color}" data-tip="${esc(label + ': ' + fmtDur(min))}"></i>` : '');
  return `<div class="split">
    <div class="split-bar">${seg(Math.min(sum.workMin, sum.occupiedMin), s.workColor, 'Trabajo')}${seg(sum.facultyMin, s.facultyColor, 'Facultad')}${seg(sum.travelMin, rgba(s.facultyColor, 0.35), 'Traslados')}${seg(other, 'var(--text-3)', 'Otros')}${seg(free, 'var(--track)', 'Libre')}</div>
    ${legendHtml([['', s.workColor, 'Trabajo'], ['', s.facultyColor, 'Facultad'], ['', rgba(s.facultyColor, 0.35), 'Traslados'], ['', 'var(--track)', 'Libre']])}
    <dl class="kv">
      <div><dt>Trabajo</dt><dd>${fmtDur(sum.workMin)}</dd></div>
      <div><dt>Facultad</dt><dd>${fmtDur(sum.facultyMin)}</dd></div>
      ${sum.travelMin ? `<div><dt>Traslados</dt><dd>${fmtDur(sum.travelMin)}</dd></div>` : ''}
      <div><dt>Total ocupado</dt><dd>${fmtDur(sum.occupiedMin)}</dd></div>
      <div><dt>Tiempo libre</dt><dd>${fmtDur(free)}</dd></div>
    </dl>
    <p class="muted small">Horas libres dentro de ${esc(segmentsLabel())} (${Math.round((free / total) * 100)}% del período). Las superposiciones no se cuentan dos veces.</p>
  </div>`;
}

function clientRowsData(sum) {
  return [...sum.byClient.values()].sort((a, b) => b.incomeMain - a.incomeMain || b.minutes - a.minutes);
}

function clientTableHtml(sum, compact) {
  const rows = clientRowsData(sum);
  const main = mainCur();
  if (!rows.length) return '<p class="muted small">Sin trabajo programado en este período.</p>';
  const name = (r) => { const c = getClient(r.clientId); return c ? `<i class="dot" style="background:${esc(c.color)}"></i>${esc(c.name)}` : '<i class="dot"></i><span class="muted">Sin cliente</span>'; };
  if (compact) {
    return `<table class="tbl tbl-compact"><tbody>${rows.map((r) => `<tr${r.clientId ? ` data-action="open-client" data-id="${r.clientId}"` : ''}>
      <td class="t-name">${name(r)}</td><td class="num">${fmtDurShort(r.minutes)}</td><td class="num">${esc(fmtMoney(r.incomeMain, main))}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Total</td><td class="num">${fmtDurShort(sum.workMin)}</td><td class="num">${esc(fmtMoney(sum.incomeMain, main))}</td></tr></tfoot></table>`;
  }
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th class="num">Horas</th><th class="num">Tareas</th><th class="num">Ingreso</th><th class="num">En ${main}</th><th class="num">% horas</th></tr></thead>
    <tbody>${rows.map((r) => `<tr${r.clientId ? ` data-action="open-client" data-id="${r.clientId}"` : ''}>
      <td class="t-name">${name(r)}</td><td class="num">${fmtDur(r.minutes)}</td><td class="num">${r.count}</td>
      <td class="num">${esc(fmtByCurrency(r.incomeByCur))}</td><td class="num">${esc(fmtMoney(r.incomeMain, main))}</td>
      <td class="num">${sum.workMin ? Math.round((r.minutes / sum.workMin) * 100) : 0}%</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Total</td><td class="num">${fmtDur(sum.workMin)}</td><td class="num">${sum.workCount}</td><td class="num">${esc(fmtByCurrency(sum.incomeByCur))}</td><td class="num">${esc(fmtMoney(sum.incomeMain, main))}</td><td class="num">100%</td></tr></tfoot></table></div>`;
}

function alertsHtml(alerts, limit) {
  if (!alerts.length) return `<p class="muted small">${icon('check')} Sin alertas de horario.</p>`;
  const list = limit ? alerts.slice(0, limit) : alerts;
  const ic = { overlap: 'alert', long: 'clock', midnight: 'moon', close: 'arrows', travel: 'walk' };
  return `<ul class="alerts">${list.map((a) => `<li class="al al-${a.type}"><button class="link" data-action="focus-occ" data-date="${a.date}" data-key="${esc(a.keys[0])}">${icon(ic[a.type] || 'alert')}<span>${esc(a.text)}</span></button></li>`).join('')}</ul>
    ${limit && alerts.length > limit ? `<p class="muted small">y ${alerts.length - limit} más en Resumen.</p>` : ''}`;
}

function insightsHtml(items) {
  return `<ul class="insights">${items.map((i) => `<li>${icon(i.icon)}<span>${i.text}</span></li>`).join('')}</ul>`;
}

/* ---------- Panel lateral del calendario ---------- */

function renderCalPanel() {
  const el = document.getElementById('calPanel');
  if (!el || !UI.panelOpen || isMobile()) { if (el) el.innerHTML = ''; return; }
  const s = DB.settings;
  const [from, to] = weekRange(UI.date);
  const sum = summarize(from, to);
  const alerts = detectAlerts(from, to);
  const main = mainCur();
  const goalCur = s.incomeGoalCurrency || main;
  const incGoal = Number(s.weeklyIncomeGoal) || 0;
  const incNow = convert(sum.incomeMain, main, goalCur);
  const incPast = convert(sum.incomePastMain, main, goalCur);
  el.innerHTML = `
    <section class="panel-sec">
      <h3>Semana del ${fmtDateShort(from)} al ${fmtDateShort(to)}</h3>
      ${insightsHtml(buildInsights(sum, alerts))}
    </section>
    <section class="panel-sec">
      <h3>Objetivos</h3>
      ${Number(s.weeklyGoalHours) > 0 ? meterHtml('Horas de trabajo', sum.workMin, s.weeklyGoalHours * 60, fmtDur(sum.workMin), `${fmtNum(s.weeklyGoalHours)} h`, goalNote(sum.workMin, s.weeklyGoalHours * 60)) : ''}
      ${incGoal > 0 ? meterHtml('Ingreso semanal', incNow, incGoal, esc(fmtMoney(incNow, goalCur)), esc(fmtMoney(incGoal, goalCur)), `Acumulado (ya realizado): <b>${esc(fmtMoney(incPast, goalCur))}</b>`) : ''}
      ${!(Number(s.weeklyGoalHours) > 0) && !(incGoal > 0) ? '<p class="muted small">Definí objetivos en Configuración.</p>' : ''}
    </section>
    <section class="panel-sec">
      <h3>Carga por día</h3>
      ${loadBarsHtml(sum)}
      ${legendHtml([['', s.workColor, 'Trabajo'], ['', s.facultyColor, 'Facultad']])}
    </section>
    <section class="panel-sec">
      <h3>Tiempo</h3>
      ${timeSplitHtml(sum)}
    </section>
    <section class="panel-sec">
      <h3>Por cliente <span class="muted">· ${sum.checks} ${sum.checks === 1 ? 'check' : 'checks'}</span></h3>
      ${clientTableHtml(sum, true)}
      ${sum.noRateCount ? `<p class="muted small">${sum.noRateCount} ${sum.noRateCount === 1 ? 'evento sin tarifa' : 'eventos sin tarifa'} (no suman ingreso).</p>` : ''}
    </section>
    <section class="panel-sec">
      <h3>Alertas</h3>
      ${alertsHtml(alerts, 6)}
    </section>`;
}

/* ---------- Resumen ---------- */

function summaryRange() {
  const p = UI.summaryPeriod;
  const anchor = summaryState.anchor || nowInfo().date;
  if (p === 'month') return [startOfMonth(anchor), endOfMonth(anchor)];
  if (p === 'custom') {
    const f = summaryState.from || startOfWeek(anchor, DB.settings.weekStart);
    const t = summaryState.to || addDays(f, 13);
    return f <= t ? [f, t] : [t, f];
  }
  return weekRange(anchor);
}

function renderSummary() {
  const el = document.getElementById('sec-summary');
  const s = DB.settings;
  const p = UI.summaryPeriod;
  const [from, to] = summaryRange();
  const sum = summarize(from, to);
  const days = sum.days.length;
  const alerts = days <= 62 ? detectAlerts(from, to) : [];
  const main = mainCur();
  let label;
  if (p === 'month') label = capitalize(fmtMonth(monthKey(from)));
  else label = `${fmtDateShort(from)} – ${fmtDateShort(to)} ${to.slice(0, 4)}`;
  const periodWord = p === 'week' ? 'Esta semana' : p === 'month' ? 'Este mes' : 'En este período';
  let goalHours = null, goalIncome = 0;
  if (p === 'week') { goalHours = Number(s.weeklyGoalHours) || 0; goalIncome = Number(s.weeklyIncomeGoal) || 0; }
  else if (p === 'month') { goalHours = Number(s.monthlyGoalHours) || 0; goalIncome = Number(s.monthlyIncomeGoal) || 0; }
  const goalCur = s.incomeGoalCurrency || main;
  const incGoalCur = convert(sum.incomeMain, main, goalCur);

  el.innerHTML = sectionHead('Resumen', `
      <div class="seg" role="group" aria-label="Período">
        ${[['week', 'Esta semana'], ['month', 'Este mes'], ['custom', 'Personalizado']].map(([v, l]) => `<button data-action="summary-period" data-v="${v}" aria-pressed="${p === v}">${l}</button>`).join('')}
      </div>`) + `
    <div class="period-bar">
      ${p !== 'custom' ? `<button class="btn-icon" data-action="summary-prev" aria-label="Anterior">${icon('chevron-left')}</button>
      <b class="period-label">${esc(label)}</b>
      <button class="btn-icon" data-action="summary-next" aria-label="Siguiente">${icon('chevron-right')}</button>
      <button class="btn btn-ghost btn-sm" data-action="summary-today">Actual</button>` : `
      <label class="field inline-field"><span>Desde</span><input type="date" data-summary="from" value="${from}"></label>
      <label class="field inline-field"><span>Hasta</span><input type="date" data-summary="to" value="${to}"></label>
      <span class="muted small">${days} días</span>`}
    </div>

    <div class="kpis">
      <div class="kpi"><span>Horas de trabajo</span><b>${fmtDur(sum.workMin)}</b><small>${sum.workCount} tareas${sum.pendingConfirmMin ? ` · ${fmtDur(sum.pendingConfirmMin)} por confirmar` : ''}</small></div>
      <div class="kpi"><span>Ingreso estimado</span><b>${esc(fmtMoney(sum.incomeMain, main))}</b><small>${Object.keys(sum.incomeByCur).some((c) => c !== main) ? esc(fmtByCurrency(sum.incomeByCur)) : 'duración × tarifa'}</small></div>
      <div class="kpi"><span>Checks</span><b>${sum.checks}</b><small>chequeos programados</small></div>
      <div class="kpi"><span>Facultad</span><b>${fmtDur(sum.facultyMin)}</b><small>${sum.facultyCount} actividades</small></div>
      <div class="kpi"><span>Tiempo libre</span><b>${fmtDur(sum.freeMin)}</b><small>de ${fmtDur(sum.rangeMin)} disponibles</small></div>
    </div>

    <div class="sum-grid">
      <section class="block">
        <h2>Lo más importante</h2>
        ${insightsHtml(buildInsights(sum, alerts, { periodWord, goalHours: goalHours || 0 }))}
      </section>
      <section class="block">
        <h2>Objetivos</h2>
        ${goalHours ? meterHtml('Horas de trabajo', sum.workMin, goalHours * 60, fmtDur(sum.workMin), `${fmtNum(goalHours)} h`, goalNote(sum.workMin, goalHours * 60)) : ''}
        ${goalIncome ? meterHtml('Ingreso', incGoalCur, goalIncome, esc(fmtMoney(incGoalCur, goalCur)), esc(fmtMoney(goalIncome, goalCur)), `Acumulado (eventos ya realizados): <b>${esc(fmtMoney(convert(sum.incomePastMain, main, goalCur), goalCur))}</b>`) : ''}
        ${!goalHours && !goalIncome ? `<p class="muted small">${p === 'custom' ? 'Los objetivos se muestran por semana o por mes.' : `Sin objetivos ${p === 'month' ? 'mensuales' : 'semanales'}.`} <button class="link" data-action="goto" data-section="settings">Configurar</button></p>` : ''}
        <h3 class="mt">Equivalencias del ingreso estimado</h3>
        <div class="eq-row">${CURRENCIES.map((c) => `<div><span>${c}</span><b>${esc(fmtMoney(sumConverted(sum.incomeByCur, c), c))}</b></div>`).join('')}</div>
        <p class="muted small">Con el tipo de cambio del ${fmtDateTime(DB.rates.updatedAt)}. <button class="link" data-action="goto" data-section="rates">Editar</button></p>
      </section>
      <section class="block block-wide">
        <h2>Ingreso y horas por cliente</h2>
        ${clientTableHtml(sum, false)}
      </section>
      <section class="block">
        <h2>Trabajo, facultad y tiempo libre</h2>
        ${timeSplitHtml(sum)}
      </section>
      <section class="block">
        <h2>Carga por día</h2>
        ${days <= 14 ? loadBarsHtml(sum) : columnsByDayHtml(sum)}
        ${legendHtml([['', s.workColor, 'Trabajo'], ['', s.facultyColor, 'Facultad']])}
      </section>
      <section class="block block-wide">
        <h2>Alertas${alerts.length ? ` <span class="muted">(${alerts.length})</span>` : ''}</h2>
        ${days <= 62 ? alertsHtml(alerts) : '<p class="muted small">Elegí un período más corto para ver alertas.</p>'}
      </section>
    </div>`;
}

function columnsByDayHtml(sum) {
  const s = DB.settings;
  const max = Math.max(4 * 60, ...sum.days.map((d) => sum.byDay[d].workMin + sum.byDay[d].facultyMin));
  const h = 120;
  return `<div class="cols" style="--cols-h:${h}px">${sum.days.map((d) => {
    const b = sum.byDay[d];
    const wh = (b.workMin / max) * h, fh = (b.facultyMin / max) * h;
    const tip = `${capitalize(fmtDateLong(d))}\nTrabajo: ${fmtDur(b.workMin)}\nFacultad: ${fmtDur(b.facultyMin)}`;
    return `<div class="col" data-tip="${esc(tip)}"><div class="col-stack">${fh ? `<i style="height:${fh}px;background:${s.facultyColor}"></i>` : ''}${wh ? `<i style="height:${wh}px;background:${s.workColor}"></i>` : ''}</div><span>${Number(d.slice(8))}</span></div>`;
  }).join('')}</div>`;
}

/* ---------- Clientes y materias ---------- */

function renderClients() {
  const el = document.getElementById('sec-clients');
  const tab = UI.clientTab;
  const actions = tab === 'clients'
    ? `<button class="btn btn-primary" data-action="new-client">${icon('plus')} Nuevo cliente</button>`
    : `<button class="btn btn-primary" data-action="new-subject">${icon('plus')} Nueva materia</button>`;
  let html = sectionHead('Clientes', actions) + `
    <div class="tabs" role="tablist">
      <button role="tab" data-action="client-tab" data-v="clients" aria-selected="${tab === 'clients'}">Clientes <span class="muted">${DB.clients.length}</span></button>
      <button role="tab" data-action="client-tab" data-v="subjects" aria-selected="${tab === 'subjects'}">Materias <span class="muted">${DB.subjects.length}</span></button>
    </div>`;
  if (tab === 'subjects') {
    html += DB.subjects.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Materia</th><th>Comisión</th><th>Profesor</th><th class="num">Horas esta semana</th></tr></thead><tbody>
      ${DB.subjects.slice().sort((a, b) => a.name.localeCompare(b.name, 'es')).map((sj) => {
        const [f, t] = weekRange(nowInfo().date);
        const min = getOccurrences(f, t).filter((o) => o.subjectId === sj.id).reduce((a, o) => a + occDuration(o), 0);
        return `<tr data-action="edit-subject" data-id="${sj.id}"><td class="t-name"><i class="dot" style="background:${esc(sj.color)}"></i>${esc(sj.name)}${sj.demo ? ' <span class="tag tag-demo">demo</span>' : ''}</td><td>${esc(sj.commission)}</td><td>${esc(sj.professor)}</td><td class="num">${min ? fmtDur(min) : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<div class="empty"><p>Todavía no hay materias. También se crean solas al escribir una materia nueva en un evento de Facultad.</p></div>`;
    el.innerHTML = html;
    return;
  }
  const st = UI.clientStatus;
  html += `<div class="chips filter-chips">${[['all', 'Todos'], ['active', 'Activos'], ['paused', 'Pausados'], ['finished', 'Finalizados']].map(([v, l]) => `<button class="chip" data-action="client-status" data-v="${v}" aria-pressed="${st === v}">${l}</button>`).join('')}</div>`;
  const list = sortedClients(true).filter((c) => st === 'all' || c.status === st);
  if (!list.length) {
    el.innerHTML = html + `<div class="empty"><p>${DB.clients.length ? 'No hay clientes con ese estado.' : 'Todavía no cargaste clientes.'}</p><button class="btn btn-primary" data-action="new-client">${icon('plus')} Nuevo cliente</button></div>`;
    return;
  }
  const [wf, wt] = weekRange(nowInfo().date);
  const wsum = summarize(wf, wt);
  const main = mainCur();
  html += `<div class="tbl-wrap"><table class="tbl tbl-clients"><thead><tr><th>Cliente</th><th>Estado</th><th class="num">Tarifa</th><th class="num">Horas semana</th><th class="num">Ingreso semana</th><th class="num">Pendiente de cobro</th></tr></thead><tbody>
    ${list.map((c) => {
      const w = wsum.byClient.get(c.id);
      const pend = pendingReceivables(c.id);
      const pendMain = sumConverted(pend, main);
      const rate = [c.hourlyRate != null ? `${fmtMoney(c.hourlyRate, c.currency)}/h` : '', c.taskRate != null ? `${fmtMoney(c.taskRate, c.currency)}/tarea` : ''].filter(Boolean).join(' · ') || '—';
      return `<tr data-action="open-client" data-id="${c.id}">
        <td class="t-name"><i class="dot" style="background:${esc(c.color)}"></i>${esc(c.name)}${c.demo ? ' <span class="tag tag-demo">demo</span>' : ''}</td>
        <td><span class="status st-${c.status}">${CLIENT_STATUS[c.status] || c.status}</span></td>
        <td class="num">${esc(rate)}</td>
        <td class="num">${w ? fmtDur(w.minutes) : '—'}</td>
        <td class="num">${w ? esc(fmtByCurrency(w.incomeByCur)) : '—'}</td>
        <td class="num">${pendMain ? esc(fmtByCurrency(pend)) : '—'}</td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  el.innerHTML = html;
}

/* Panel de información del cliente */
function openClientDrawer(id) {
  const c = getClient(id);
  if (!c) return;
  const st = clientStats(id);
  const dr = document.getElementById('drawer');
  const upcoming = [];
  const nowI = nowInfo();
  for (const ev of DB.events.filter((e) => e.clientId === id)) {
    for (const o of expandEvent(ev, nowI.date, addDays(nowI.date, 30))) if (!(o.date === nowI.date && o.end <= nowI.min)) upcoming.push(o);
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const recs = DB.receivables.filter((r) => r.clientId === id && receivableStatus(r) !== 'paid');
  const next = st.next;
  dr.innerHTML = `<div class="drawer-inner" role="dialog" aria-label="${esc(c.name)}">
    <header class="drawer-head">
      <div><h2><i class="dot dot-lg" style="background:${esc(c.color)}"></i>${esc(c.name)}</h2>
      <p><span class="status st-${c.status}">${CLIENT_STATUS[c.status]}</span> · ${c.hourlyRate != null ? esc(fmtMoney(c.hourlyRate, c.currency)) + '/h' : 'sin tarifa por hora'}${c.taskRate != null ? ' · ' + esc(fmtMoney(c.taskRate, c.currency)) + '/tarea' : ''}</p></div>
      <button class="btn-icon" data-action="close-drawer" aria-label="Cerrar">${icon('x')}</button>
    </header>
    <div class="drawer-actions">
      <button class="btn btn-sm" data-action="edit-client" data-id="${id}">${icon('edit')} Editar</button>
      <button class="btn btn-sm" data-action="new-event-client" data-id="${id}">${icon('plus')} Evento</button>
      <button class="btn btn-sm" data-action="new-receivable-client" data-id="${id}">${icon('inbox')} Cobro pendiente</button>
    </div>
    <dl class="stat-grid">
      <div><dt>Horas esta semana</dt><dd>${fmtDur(st.week.minutes)}</dd></div>
      <div><dt>Horas este mes</dt><dd>${fmtDur(st.month.minutes)}</dd></div>
      <div><dt>Ingreso esta semana</dt><dd>${esc(fmtByCurrency(st.week.incomeByCur))}</dd></div>
      <div><dt>Ingreso este mes</dt><dd>${esc(fmtByCurrency(st.month.incomeByCur))}</dd></div>
      <div><dt>Tareas este mes</dt><dd>${st.month.count}</dd></div>
      <div><dt>Dinero pendiente</dt><dd>${Object.keys(st.pending).length ? esc(fmtByCurrency(st.pending)) : '—'}</dd></div>
      <div><dt>Checks este mes</dt><dd>${st.month.checks}</dd></div>
      <div><dt>Cobrado este mes</dt><dd>${Object.keys(st.paidByCur).length ? esc(fmtByCurrency(st.paidByCur)) : '—'}</dd></div>
      <div class="span-2"><dt>Próximo evento</dt><dd>${next ? `<button class="link" data-action="focus-occ" data-date="${next.date}" data-key="${esc(next.key)}">${esc(next.title)} · ${esc(capitalize(fmtDateLong(next.date)))} ${fmtTime(next.start)}</button>` : '<span class="muted">Sin eventos programados</span>'}</dd></div>
    </dl>
    ${c.notes ? `<h3>Notas</h3><p class="pre">${esc(c.notes)}</p>` : ''}
    <h3>Próximos 30 días <span class="muted">(${upcoming.length})</span></h3>
    ${upcoming.length ? `<ul class="mini-list">${upcoming.slice(0, 8).map((o) => { const inc = occIncome(o); return `<li><button class="link" data-action="focus-occ" data-date="${o.date}" data-key="${esc(o.key)}"><span>${DAY_SHORT[weekdayOf(o.date)]} ${fmtDateShort(o.date)} · ${fmtTime(o.start)}–${fmtTime(o.end)}</span><b>${esc(o.title)}</b>${inc ? `<em>${esc(fmtMoney(inc.amount, inc.currency))}</em>` : ''}</button></li>`; }).join('')}</ul>` : '<p class="muted small">Nada programado.</p>'}
    <h3>Cobros pendientes</h3>
    ${recs.length ? `<ul class="mini-list">${recs.map((r) => `<li><span>${esc(r.concept)} · vence ${fmtDateNum(r.dueDate) || '—'}</span><b>${esc(fmtMoney(r.amount, r.currency))}</b>${receivableStatus(r) === 'overdue' ? '<span class="status st-overdue">Vencido</span>' : ''}</li>`).join('')}</ul>` : '<p class="muted small">No hay cobros pendientes.</p>'}
  </div>`;
  dr.hidden = false;
  dr.dataset.id = id;
  document.body.classList.add('drawer-open');
}

function closeDrawer() {
  const dr = document.getElementById('drawer');
  if (!dr || dr.hidden) return false;
  dr.hidden = true;
  dr.innerHTML = '';
  delete dr.dataset.id;
  document.body.classList.remove('drawer-open');
  return true;
}

function refreshDrawer() {
  const dr = document.getElementById('drawer');
  if (dr && !dr.hidden && dr.dataset.id) {
    if (getClient(dr.dataset.id)) openClientDrawer(dr.dataset.id); else closeDrawer();
  }
}

/* ---------- Cuentas por cobrar ---------- */

function renderReceivables() {
  const el = document.getElementById('sec-receivables');
  const main = mainCur();
  const today = todayYmd();
  const all = DB.receivables.map((r) => Object.assign({}, r, { st: receivableStatus(r) }));
  const open = all.filter((r) => r.st !== 'paid');
  const overdue = all.filter((r) => r.st === 'overdue').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const upcoming = all.filter((r) => r.st === 'pending').sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const paidMonth = all.filter((r) => r.st === 'paid' && r.paidAt && monthKey(r.paidAt) === monthKey(today));
  const pend = pendingReceivables();
  const byCur = (list) => { const o = {}; for (const r of list) o[r.currency] = (o[r.currency] || 0) + Number(r.amount || 0); return o; };
  const overdueByCur = byCur(overdue);
  const paidByCur = byCur(paidMonth);
  const f = UI.receivableFilter;
  const filtered = all.filter((r) => f === 'all' || (f === 'open' ? r.st !== 'paid' : r.st === f))
    .sort((a, b) => (a.st === 'paid') - (b.st === 'paid') || (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const stLabel = { pending: 'Pendiente', paid: 'Pagado', overdue: 'Vencido' };
  const miniList = (list, empty, dateKey) => list.length ? `<ul class="mini-list">${list.slice(0, 5).map((r) => `<li><span>${esc(clientName(r.clientId) || 'Sin cliente')} · ${esc(r.concept)}</span><b>${esc(fmtMoney(r.amount, r.currency))}</b><em>${fmtDateNum(r[dateKey]) || '—'}</em></li>`).join('')}</ul>` : `<p class="muted small">${empty}</p>`;

  el.innerHTML = sectionHead('Cuentas por cobrar', `<button class="btn btn-primary" data-action="new-receivable">${icon('plus')} Nuevo cobro</button>`) + `
    <div class="kpis">
      <div class="kpi kpi-hero"><span>Total pendiente</span><b>${esc(fmtMoney(sumConverted(pend, main), main))}</b><small>${esc(fmtByCurrency(pend))}</small></div>
      <div class="kpi"><span>Equivalencias</span><div class="eq-inline">${CURRENCIES.map((c) => `<span>${esc(fmtMoney(sumConverted(pend, c), c))}</span>`).join('')}</div></div>
      <div class="kpi"><span>Vencidos</span><b>${overdue.length}</b><small>${overdue.length ? esc(fmtByCurrency(overdueByCur)) : 'Nada vencido'}</small></div>
      <div class="kpi"><span>Recibidos este mes</span><b>${esc(fmtMoney(sumConverted(paidByCur, main), main))}</b><small>${paidMonth.length} ${paidMonth.length === 1 ? 'pago' : 'pagos'}</small></div>
    </div>
    <div class="sum-grid three">
      <section class="block"><h2>${icon('alert')} Pagos vencidos</h2>${miniList(overdue, 'No hay pagos vencidos.', 'dueDate')}</section>
      <section class="block"><h2>${icon('calendar')} Próximos pagos</h2>${miniList(upcoming, 'No hay pagos pendientes.', 'dueDate')}</section>
      <section class="block"><h2>${icon('check')} Recibidos este mes</h2>${miniList(paidMonth, 'Todavía no se registraron cobros este mes.', 'paidAt')}</section>
    </div>
    <div class="chips filter-chips">${[['open', `Abiertos (${open.length})`], ['overdue', `Vencidos (${overdue.length})`], ['paid', 'Pagados'], ['all', 'Todos']].map(([v, l]) => `<button class="chip" data-action="rec-filter" data-v="${v}" aria-pressed="${f === v}">${l}</button>`).join('')}</div>
    ${filtered.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Concepto</th><th class="num">Monto</th><th class="num">En ${main}</th><th>Fecha</th><th>Pago esperado</th><th>Estado</th><th></th></tr></thead><tbody>
      ${filtered.map((r) => `<tr>
        <td class="t-name">${r.clientId && getClient(r.clientId) ? `<i class="dot" style="background:${esc(getClient(r.clientId).color)}"></i>${esc(clientName(r.clientId))}` : '<span class="muted">Sin cliente</span>'}${r.demo ? ' <span class="tag tag-demo">demo</span>' : ''}</td>
        <td>${esc(r.concept)}${r.notes ? `<br><small class="muted">${esc(r.notes)}</small>` : ''}</td>
        <td class="num"><b>${esc(fmtMoney(r.amount, r.currency))}</b></td>
        <td class="num muted">${r.currency === main ? '' : esc(fmtMoney(convert(r.amount, r.currency, main), main))}</td>
        <td>${fmtDateNum(r.date)}</td>
        <td>${fmtDateNum(r.dueDate) || '—'}${r.st === 'paid' && r.paidAt ? `<br><small class="muted">pagado ${fmtDateNum(r.paidAt)}</small>` : ''}</td>
        <td><span class="status st-${r.st}">${stLabel[r.st]}</span></td>
        <td class="t-actions">
          ${r.st !== 'paid' ? `<button class="btn btn-sm" data-action="rec-paid" data-id="${r.id}" title="Marcar como pagado">${icon('check')}<span class="hide-sm"> Pagado</span></button>` : ''}
          <button class="btn-icon" data-action="rec-edit" data-id="${r.id}" aria-label="Editar">${icon('edit')}</button>
          <button class="btn-icon" data-action="rec-delete" data-id="${r.id}" aria-label="Eliminar">${icon('trash')}</button>
        </td>
      </tr>`).join('')}</tbody></table></div>` : `<div class="empty"><p>No hay cobros en esta lista.</p></div>`}`;
}

/* ---------- Ingresos ---------- */

function renderIncome() {
  const el = document.getElementById('sec-income');
  const main = mainCur();
  const f = UI.incomeFilters;
  const base = DB.payments.filter((p) => (!f.clientId || (f.clientId === '_none' ? !p.clientId : p.clientId === f.clientId)) && (!f.currency || p.currency === f.currency) && (!f.project || p.project === f.project));
  const list = base.filter((p) => !f.month || monthKey(p.date) === f.month).sort((a, b) => b.date.localeCompare(a.date));
  const months = [...new Set(DB.payments.map((p) => monthKey(p.date)).concat([monthKey(todayYmd())]))].sort().reverse();
  const projects = [...new Set(DB.payments.map((p) => p.project).filter(Boolean))].sort();
  const totalByCur = {};
  for (const p of list) totalByCur[p.currency] = (totalByCur[p.currency] || 0) + Number(p.amount || 0);
  const total = sumConverted(totalByCur, main);
  // Serie mensual (últimos 12 meses)
  const curMonth = monthKey(todayYmd());
  const series = [];
  for (let i = 11; i >= 0; i--) {
    const k = monthKey(addMonths(curMonth + '-01', -i));
    const v = base.filter((p) => monthKey(p.date) === k).reduce((a, p) => a + convert(Number(p.amount || 0), p.currency, main), 0);
    series.push({ k, v, n: base.filter((p) => monthKey(p.date) === k).length });
  }
  const thisM = series[series.length - 1].v, prevM = series[series.length - 2].v;
  const last6 = series.slice(-6);
  const avg6 = last6.reduce((a, x) => a + x.v, 0) / 6;
  const maxV = Math.max(1, ...series.map((x) => x.v));
  const niceMax = niceCeil(maxV);
  const h = 150;
  const byClient = new Map();
  for (const p of list) {
    const k = p.clientId || '_none';
    const e = byClient.get(k) || { clientId: p.clientId, byCur: {}, main: 0, n: 0 };
    e.byCur[p.currency] = (e.byCur[p.currency] || 0) + Number(p.amount || 0);
    e.main += convert(Number(p.amount || 0), p.currency, main);
    e.n++;
    byClient.set(k, e);
  }
  const diff = thisM - prevM;

  el.innerHTML = sectionHead('Ingresos', `<button class="btn btn-primary" data-action="new-payment">${icon('plus')} Registrar pago</button>`, 'Pagos recibidos. Los montos se convierten con tu tipo de cambio manual.') + `
    <div class="filters-row">
      <label class="field inline-field"><span>Cliente</span><select data-income-filter="clientId"><option value="">Todos</option>${sortedClients(true).map((c) => `<option value="${c.id}" ${f.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="_none" ${f.clientId === '_none' ? 'selected' : ''}>Sin cliente</option></select></label>
      <label class="field inline-field"><span>Mes</span><select data-income-filter="month"><option value="">Todos</option>${months.map((m) => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${esc(capitalize(fmtMonth(m)))}</option>`).join('')}</select></label>
      <label class="field inline-field"><span>Moneda</span><select data-income-filter="currency"><option value="">Todas</option>${CURRENCIES.map((c) => `<option ${f.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="field inline-field"><span>Proyecto</span><select data-income-filter="project"><option value="">Todos</option>${projects.map((p) => `<option ${f.project === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      ${f.clientId || f.month || f.currency || f.project ? `<button class="link" data-action="clear-income-filters">Limpiar</button>` : ''}
    </div>
    <div class="kpis">
      <div class="kpi kpi-hero"><span>Total ${f.month ? 'de ' + esc(fmtMonth(f.month)) : 'filtrado'}</span><b>${esc(fmtMoney(total, main))}</b><small>${list.length} ${list.length === 1 ? 'pago' : 'pagos'} · ${esc(fmtByCurrency(totalByCur))}</small></div>
      <div class="kpi"><span>Este mes</span><b>${esc(fmtMoney(thisM, main))}</b><small>${prevM || thisM ? `${diff >= 0 ? '+' : '−'}${esc(fmtMoney(Math.abs(diff), main))} vs. mes anterior` : 'Sin pagos'}</small></div>
      <div class="kpi"><span>Promedio mensual</span><b>${esc(fmtMoney(avg6, main))}</b><small>últimos 6 meses</small></div>
    </div>
    <section class="block">
      <h2>Por mes <span class="muted">(en ${main})</span></h2>
      <div class="vchart" style="--h:${h}px">
        <div class="vchart-grid">${[1, 0.5, 0].map((t) => `<div style="bottom:${t * h}px"><span>${esc(fmtNum(niceMax * t, 0))}</span></div>`).join('')}</div>
        <div class="vchart-bars">${series.map((x) => `<button class="vbar${f.month === x.k ? ' is-sel' : ''}" data-action="income-month" data-v="${x.k}" data-tip="${esc(capitalize(fmtMonth(x.k)) + '\n' + fmtMoney(x.v, main) + ' · ' + x.n + (x.n === 1 ? ' pago' : ' pagos'))}"><i style="height:${(x.v / niceMax) * h}px"></i><span>${MONTHS_SHORT[Number(x.k.slice(5)) - 1]}</span></button>`).join('')}</div>
      </div>
      <details class="data-table"><summary>Ver datos</summary><table class="tbl tbl-compact"><tbody>${series.slice().reverse().map((x) => `<tr><td>${esc(capitalize(fmtMonth(x.k)))}</td><td class="num">${x.n}</td><td class="num">${esc(fmtMoney(x.v, main))}</td></tr>`).join('')}</tbody></table></details>
    </section>
    ${byClient.size ? `<section class="block"><h2>Por cliente</h2><div class="tbl-wrap"><table class="tbl tbl-compact"><thead><tr><th>Cliente</th><th class="num">Pagos</th><th class="num">Monto</th><th class="num">En ${main}</th></tr></thead><tbody>
      ${[...byClient.values()].sort((a, b) => b.main - a.main).map((e) => `<tr><td class="t-name">${e.clientId && getClient(e.clientId) ? `<i class="dot" style="background:${esc(getClient(e.clientId).color)}"></i>${esc(clientName(e.clientId))}` : '<span class="muted">Sin cliente</span>'}</td><td class="num">${e.n}</td><td class="num">${esc(fmtByCurrency(e.byCur))}</td><td class="num">${esc(fmtMoney(e.main, main))}</td></tr>`).join('')}
    </tbody></table></div></section>` : ''}
    <section class="block">
      <h2>Pagos</h2>
      ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Fecha</th><th>Cliente</th><th>Concepto</th><th>Proyecto</th><th class="num">Monto</th><th class="num">Equivalencia</th><th>Mes</th><th></th></tr></thead><tbody>
        ${list.map((p) => `<tr>
          <td>${fmtDateNum(p.date)}</td>
          <td class="t-name">${p.clientId && getClient(p.clientId) ? `<i class="dot" style="background:${esc(getClient(p.clientId).color)}"></i>${esc(clientName(p.clientId))}` : '<span class="muted">Sin cliente</span>'}${p.demo ? ' <span class="tag tag-demo">demo</span>' : ''}</td>
          <td>${esc(p.concept)}</td><td>${esc(p.project || '')}</td>
          <td class="num"><b>${esc(fmtMoney(p.amount, p.currency))}</b></td>
          <td class="num muted small">${CURRENCIES.filter((c) => c !== p.currency).map((c) => esc(fmtMoney(convert(p.amount, p.currency, c), c))).join('<br>')}</td>
          <td>${esc(capitalize(fmtMonth(monthKey(p.date))))}</td>
          <td class="t-actions"><button class="btn-icon" data-action="pay-edit" data-id="${p.id}" aria-label="Editar">${icon('edit')}</button><button class="btn-icon" data-action="pay-delete" data-id="${p.id}" aria-label="Eliminar">${icon('trash')}</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>No hay pagos con estos filtros.</p></div>'}
    </section>`;
}

function niceCeil(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

/* ---------- Tipo de cambio ---------- */

function renderRates() {
  const el = document.getElementById('sec-rates');
  const r = DB.rates;
  const implied = r.EUR_ARS / r.USD_ARS;
  const ageDays = (Date.now() - new Date(r.updatedAt).getTime()) / 864e5;
  el.innerHTML = sectionHead('Tipo de cambio', '', 'Valores manuales. La app no consulta cotizaciones en internet.') + `
    <section class="block rates-block">
      <form class="rates" data-form="rates" novalidate>
        <label class="rate-row"><span>1 USD =</span><input type="number" name="USD_ARS" min="0" step="any" value="${r.USD_ARS}" inputmode="decimal"><span>ARS</span></label>
        <label class="rate-row"><span>1 EUR =</span><input type="number" name="EUR_ARS" min="0" step="any" value="${r.EUR_ARS}" inputmode="decimal"><span>ARS</span></label>
        <label class="rate-row"><span>1 EUR =</span><input type="number" name="EUR_USD" min="0" step="any" value="${r.EUR_USD}" inputmode="decimal"><span>USD</span></label>
        <p class="muted small">Según tus valores en ARS, 1 EUR equivale a ${fmtNum(implied, 4)} USD. <button type="button" class="link" data-action="use-implied">Usar este valor</button></p>
        <div class="rates-foot">
          <p class="${ageDays > 7 ? 'warn-text' : 'muted'} small">${ageDays > 7 ? icon('alert') + ' ' : ''}Actualizado el <b>${fmtDateTime(r.updatedAt)}</b> (${fmtRelative(r.updatedAt)})</p>
          <button type="submit" class="btn btn-primary">Guardar tipo de cambio</button>
        </div>
      </form>
    </section>
    <section class="block">
      <h2>Conversor</h2>
      <div class="converter">
        <input type="number" data-conv="amount" value="100" min="0" step="any" inputmode="decimal" aria-label="Monto">
        <select data-conv="from" aria-label="Moneda">${currencyOptions('USD')}</select>
        <div class="conv-out" data-conv-out></div>
      </div>
    </section>`;
  updateConverter();
}

function updateConverter() {
  const a = toNumber(document.querySelector('[data-conv=amount]')?.value) || 0;
  const from = document.querySelector('[data-conv=from]')?.value || 'USD';
  const out = document.querySelector('[data-conv-out]');
  if (out) out.innerHTML = CURRENCIES.map((c) => `<div><span>${c}</span><b>${esc(fmtMoney(convert(a, from, c), c))}</b></div>`).join('');
}

/* ---------- Configuración ---------- */

function renderSettings() {
  const el = document.getElementById('sec-settings');
  const s = DB.settings;
  const hourOpts = (from, to, sel) => {
    const o = [];
    for (let h = from; h <= to; h++) o.push([h, h === 24 ? '24:00' : fmtTime(h * 60) + (h > 24 ? ' · madrugada arriba' : '')]);
    return opts(o, sel);
  };
  const backupAge = s.lastBackupAt ? (Date.now() - new Date(s.lastBackupAt).getTime()) / 864e5 : Infinity;
  el.innerHTML = sectionHead('Configuración', '', 'Los cambios se guardan automáticamente en este navegador.') + `
    <div class="settings">
      <section class="block block-wide sync-block" id="syncBlock">${syncBlockHtml()}</section>
      <section class="block block-wide" id="notifyBlock">${notifyBlockHtml()}</section>
      <section class="block block-wide" id="pushBlock">${pushBlockHtml()}</section>
      <section class="block">
        <h2>General</h2>
        <div class="grid-2">
          <label class="field"><span>Tu nombre</span><input data-set="userName" value="${esc(s.userName)}" placeholder="Opcional"></label>
          <label class="field"><span>Moneda principal</span><select data-set="mainCurrency">${currencyOptions(s.mainCurrency)}</select></label>
        </div>
        <div class="field"><span>Tema</span>${segHtml('theme', [['light', `${icon('sun')} Claro`], ['dark', `${icon('moon')} Oscuro`], ['system', 'Sistema']], s.theme)}</div>
      </section>

      <section class="block">
        <h2>Calendario</h2>
        <div class="grid-3">
          <label class="field"><span>Hora inicial</span><select data-set="dayStart" data-type="int">${hourOpts(0, 12, s.dayStart)}</select></label>
          <label class="field"><span>Hora final</span><select data-set="dayEnd" data-type="int">${hourOpts(16, 30, s.dayEnd)}</select></label>
          <label class="field"><span>División</span><select data-set="slotMinutes" data-type="int">${opts([[15, '15 minutos'], [30, '30 minutos'], [60, '1 hora']], s.slotMinutes)}</select></label>
        </div>
        <div class="grid-3">
          <label class="field"><span>Primer día de la semana</span><select data-set="weekStart" data-type="int">${opts([[1, 'Lunes'], [0, 'Domingo']], s.weekStart)}</select></label>
          <label class="field"><span>Días visibles</span><select data-set="showWeekend" data-type="bool">${opts([['true', 'Lunes a domingo'], ['false', 'Lunes a viernes']], String(s.showWeekend))}</select></label>
          <label class="field"><span>Densidad (alto de cada hora)</span><div class="inline"><input type="range" min="28" max="120" step="4" data-set="hourHeight" data-type="int" value="${s.hourHeight}"><output>${s.hourHeight}px</output></div></label>
        </div>
        <label class="check"><input type="checkbox" data-set="showIncomeInEvents" data-type="check" ${s.showIncomeInEvents ? 'checked' : ''}> Mostrar el ingreso dentro de los eventos</label>
        <label class="check"><input type="checkbox" data-set="showTravel" data-type="check" ${s.showTravel ? 'checked' : ''}> Mostrar tiempos de traslado de Facultad</label>
      </section>

      <section class="block">
        <h2>Objetivos</h2>
        <div class="grid-3">
          <label class="field"><span>Horas de trabajo por semana</span><input type="number" min="0" step="0.25" data-set="weeklyGoalHours" data-type="num" value="${s.weeklyGoalHours ?? ''}"></label>
          <label class="field"><span>Ingreso semanal esperado</span><input type="number" min="0" step="any" data-set="weeklyIncomeGoal" data-type="num" value="${s.weeklyIncomeGoal ?? ''}"></label>
          <label class="field"><span>Moneda de los objetivos</span><select data-set="incomeGoalCurrency">${currencyOptions(s.incomeGoalCurrency)}</select></label>
        </div>
        <div class="grid-3">
          <label class="field"><span>Horas por mes <small>(opcional)</small></span><input type="number" min="0" step="0.5" data-set="monthlyGoalHours" data-type="num" value="${s.monthlyGoalHours ?? ''}"></label>
          <label class="field"><span>Ingreso mensual <small>(opcional)</small></span><input type="number" min="0" step="any" data-set="monthlyIncomeGoal" data-type="num" value="${s.monthlyIncomeGoal ?? ''}"></label>
        </div>
      </section>

      <section class="block">
        <h2>Alertas</h2>
        <div class="grid-2">
          <label class="field"><span>Avisar después de estas horas seguidas</span><input type="number" min="0" max="16" step="0.5" data-set="maxConsecutiveHours" data-type="num" value="${s.maxConsecutiveHours ?? ''}"></label>
          <label class="field"><span>Margen mínimo entre eventos (min)</span><input type="number" min="0" max="60" step="5" data-set="minGapMinutes" data-type="num" value="${s.minGapMinutes ?? ''}"></label>
        </div>
        <p class="muted small">Solo son indicadores visuales: nunca se cambian tus horarios.</p>
      </section>

      <section class="block">
        <h2>Colores</h2>
        <div class="grid-2">
          <label class="field"><span>Calendario Trabajo <small>(eventos sin cliente)</small></span><input type="color" data-set="workColor" value="${esc(s.workColor)}"></label>
          <label class="field"><span>Calendario Facultad <small>(eventos sin materia)</small></span><input type="color" data-set="facultyColor" value="${esc(s.facultyColor)}"></label>
        </div>
        <h3 class="mt">Clientes</h3>
        <div class="color-list">${sortedClients(true).map((c) => `<label><input type="color" data-color-client="${c.id}" value="${esc(c.color)}"><span>${esc(c.name)}</span></label>`).join('') || '<p class="muted small">Sin clientes.</p>'}</div>
        <h3 class="mt">Materias</h3>
        <div class="color-list">${DB.subjects.map((x) => `<label><input type="color" data-color-subject="${x.id}" value="${esc(x.color)}"><span>${esc(x.name)}</span></label>`).join('') || '<p class="muted small">Sin materias.</p>'}</div>
        <p class="muted small">Tareas desde el teléfono = versión clara/pastel del color. Con computadora = color sólido.</p>
      </section>

      <section class="block" id="backup">
        <h2>Copia de seguridad y datos</h2>
        <p class="${backupAge > 7 ? 'warn-text' : ''}">${backupAge > 7 ? icon('alert') + ' ' : ''}Última copia de seguridad: <b>${s.lastBackupAt ? fmtDateTime(s.lastBackupAt) + ' (' + fmtRelative(s.lastBackupAt) + ')' : 'nunca'}</b></p>
        <p class="muted small">Tus datos viven solo en este navegador (localStorage). Si borrás los datos del navegador se pierden: exportá un backup cada tanto.</p>
        <div class="btn-row">
          <button class="btn btn-primary" data-action="export-json">${icon('download')} Exportar backup completo</button>
          <button class="btn" data-action="import-json">${icon('upload')} Importar datos</button>
        </div>
        <div class="btn-row">
          <select id="csvRange" aria-label="Rango del CSV">${opts([['week', 'Semana visible'], ['month', 'Mes actual'], ['next3', 'Próximos 3 meses'], ['year', 'Últimos 12 meses y próximos 12']], 'week')}</select>
          <button class="btn" data-action="export-csv">${icon('table')} Exportar calendario (CSV)</button>
          <button class="btn" data-action="print">${icon('printer')} Imprimir semana</button>
        </div>
        <div class="btn-row danger-zone">
          ${hasDemoData() ? `<button class="btn" data-action="remove-demo">Eliminar datos de ejemplo</button>` : '<span class="muted small">No hay datos de ejemplo cargados.</span>'}
          <button class="btn" data-action="load-demo">Cargar datos de ejemplo</button>
          <button class="btn btn-danger-text btn-ghost" data-action="reset-all">Borrar todos los datos</button>
        </div>
      </section>

      <section class="block">
        <h2>Privacidad</h2>
        <p class="muted small">No hay cuentas, analytics ni servidores que guarden tus datos. Si no vinculás dispositivos, nada sale de este navegador. Si los vinculás, los datos viajan cifrados directamente entre tus dispositivos (WebRTC); el servidor público de PeerJS solo los ayuda a encontrarse y, si la conexión directa no es posible (por ejemplo con datos móviles), un servidor de retransmisión de PeerJS pasa los datos cifrados sin poder leerlos.</p>
        <h3 class="mt">Atajos de teclado</h3>
        ${shortcutsHtml()}
      </section>
    </div>`;
  bindSeg(el, 'theme', (v) => { commit((d) => { d.settings.theme = v; }); applyTheme(); });
}

function notifyBlockHtml() {
  const s = DB.settings;
  const st = notifyStatusText();
  return `<h2>${icon('clock')} Avisos</h2>
    <p class="sync-line"><i class="sync-dot is-${st.cls}"></i><b>${esc(st.text)}</b></p>
    <label class="check"><input type="checkbox" data-notify-toggle ${s.notifyEnabled && notifyPermission() === 'granted' ? 'checked' : ''} ${notifySupported() ? '' : 'disabled'}> Mostrar avisos en este dispositivo mientras la agenda está abierta</label>
    <div class="grid-3 notify-grid">
      <label class="field"><span>Aviso (minutos antes)</span><input type="number" min="1" max="240" step="1" data-set="notifyMinutes" data-type="num" value="${s.notifyMinutes ?? 15}"></label>
      <label class="field"><span>Segundo aviso para tareas con compu o complejas</span><input type="number" min="0" max="480" step="5" data-set="notifyExtraMinutes" data-type="num" value="${s.notifyExtraMinutes ?? 30}"></label>
      <label class="field"><span>Resumen del día a las</span><input type="time" data-set="notifyDailyTime" value="${esc(s.notifyDailyTime || '08:00')}"></label>
    </div>
    <label class="check"><input type="checkbox" data-set="notifyDaily" data-type="check" ${s.notifyDaily ? 'checked' : ''}> Mandarme un resumen de lo que hay cada día</label>
    <div class="btn-row"><button class="btn" data-action="notify-test">${icon('clock')} Probar aviso</button></div>
    <p class="muted small">Ejemplo: «En 15 min: BMS Spanish check». Las tareas que necesitan la compu (o marcadas como complejas) avisan dos veces: a los ${s.notifyExtraMinutes ?? 30} y a los ${s.notifyMinutes ?? 15} min. Para la facultad, el aviso cuenta el tiempo de traslado.</p>
    <p class="muted small">Estos avisos del navegador llegan mientras la agenda está abierta en este dispositivo (en la computadora alcanza con dejar la pestaña abierta, aunque esté minimizada). Para recibirlos en el teléfono con todo cerrado, activá ntfy abajo.</p>`;
}

function shortcutsHtml() {
  const rows = [['N', 'Nuevo evento'], ['T', 'Ir a hoy / ahora'], ['W', 'Vista semanal'], ['D', 'Vista diaria'], ['A', 'Vista Hoy (agenda)'], ['← →', 'Semana/día anterior o siguiente'], ['/', 'Buscar'], ['+ −', 'Zoom vertical'], ['Esc', 'Cerrar ventana'], ['Ctrl+Enter', 'Guardar evento'], ['?', 'Ver atajos']];
  return `<dl class="shortcuts">${rows.map(([k, v]) => `<div><dt>${k.split(' ').map((x) => `<kbd>${x}</kbd>`).join(' ')}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}
