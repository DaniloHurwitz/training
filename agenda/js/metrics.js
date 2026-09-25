'use strict';
/* Cálculos: monedas, ingresos, resúmenes por período, carga diaria, conflictos e información automática. */

/* ---------- Monedas ---------- */

function convert(amount, from, to) {
  if (amount == null || isNaN(amount)) return 0;
  if (!from || !to || from === to) return amount;
  const r = DB.rates;
  const pair = {
    USD_ARS: () => amount * r.USD_ARS,
    ARS_USD: () => amount / r.USD_ARS,
    EUR_ARS: () => amount * r.EUR_ARS,
    ARS_EUR: () => amount / r.EUR_ARS,
    EUR_USD: () => amount * r.EUR_USD,
    USD_EUR: () => amount / r.EUR_USD,
  }[from + '_' + to];
  const v = pair ? pair() : amount;
  return isFinite(v) ? v : 0;
}

function mainCur() { return DB.settings.mainCurrency || 'USD'; }

/* Suma de un mapa {moneda: monto} convertida a una moneda */
function sumConverted(byCur, to) {
  let t = 0;
  for (const [cur, amt] of Object.entries(byCur)) t += convert(amt, cur, to);
  return t;
}

function fmtByCurrency(byCur) {
  const parts = CURRENCIES.filter((c) => byCur[c]).map((c) => fmtMoney(byCur[c], c));
  return parts.length ? parts.join(' + ') : fmtMoney(0, mainCur());
}

/* ---------- Eventos ---------- */

function occDuration(o) { return Math.max(0, o.end - o.start); }

/* Tarifa efectiva y moneda de un evento de trabajo */
function occRateInfo(o) {
  const c = getClient(o.clientId);
  const billing = o.billing || (c && c.billing) || 'hourly';
  let rate = o.rate;
  if (rate == null || rate === '') rate = c ? (billing === 'task' ? c.taskRate : c.hourlyRate) : null;
  const currency = o.currency || (c && c.currency) || mainCur();
  return { billing, rate: rate == null ? null : Number(rate), currency };
}

/* Ingreso estimado de una ocurrencia: duración × tarifa por hora (o monto fijo por tarea) */
function occIncome(o) {
  if (o.calendar !== 'work') return null;
  const { billing, rate, currency } = occRateInfo(o);
  if (rate == null || isNaN(rate)) return null;
  const amount = billing === 'task' ? rate : rate * occDuration(o) / 60;
  return { amount, currency };
}

function occColor(o) {
  if (o.calendar === 'work') {
    const c = getClient(o.clientId);
    return (c && c.color) || DB.settings.workColor;
  }
  const s = getSubject(o.subjectId);
  return (s && s.color) || DB.settings.facultyColor;
}

function occSubtitle(o) {
  if (o.calendar === 'work') return [clientName(o.clientId), o.project].filter(Boolean).join(' · ');
  const s = getSubject(o.subjectId);
  return [s && s.name, FACULTY_TYPES[o.facultyType], o.room].filter(Boolean).join(' · ');
}

function occTypeKey(o) { return o.calendar === 'work' ? 'w:' + (o.taskType || '') : 'f:' + (o.facultyType || ''); }

function occTypeLabel(o) { return o.calendar === 'work' ? (o.taskType || 'Tarea') : (FACULTY_TYPES[o.facultyType] || 'Facultad'); }

/* Intervalo ocupado incluyendo traslados */
function occBusyRange(o) {
  const tb = o.calendar === 'faculty' ? Number(o.travelBefore) || 0 : 0;
  const ta = o.calendar === 'faculty' ? Number(o.travelAfter) || 0 : 0;
  return [o.start - tb, o.end + ta];
}

function unionMinutes(intervals, lo, hi) {
  const iv = intervals
    .map(([a, b]) => [Math.max(a, lo), Math.min(b, hi)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  let total = 0, cs = null, ce = null;
  for (const [a, b] of iv) {
    if (cs == null || a > ce) { if (cs != null) total += ce - cs; cs = a; ce = b; } else ce = Math.max(ce, b);
  }
  if (cs != null) total += ce - cs;
  return total;
}

/* ---------- Resumen de un período ---------- */

function summarize(from, to) {
  const s = DB.settings;
  const occs = getOccurrences(from, to);
  const main = mainCur();
  const days = dateRange(from, to);
  const lo = s.dayStart * 60, hi = s.dayEnd * 60;
  const nowI = nowInfo();
  const byDay = {};
  for (const d of days) byDay[d] = { workMin: 0, facultyMin: 0, travelMin: 0, busy: [], incomeMain: 0, count: 0 };
  const byClient = new Map();
  const res = {
    from, to, days, occs,
    workMin: 0, facultyMin: 0, travelMin: 0, occupiedMin: 0, rangeMin: days.length * (hi - lo), freeMin: 0,
    checks: 0, workCount: 0, facultyCount: 0, pendingConfirmMin: 0,
    incomeByCur: {}, incomeMain: 0, incomePastMain: 0, noRateCount: 0,
    byDay, byClient,
  };
  for (const o of occs) {
    const dur = occDuration(o);
    const day = byDay[o.date];
    if (!day) continue;
    day.count++;
    const [bs, be] = occBusyRange(o);
    day.busy.push([bs, be]);
    if (o.calendar === 'work') {
      res.workMin += dur; day.workMin += dur; res.workCount++;
      if (o.isCheck) res.checks++;
      if (o.confirmation === 'pending') res.pendingConfirmMin += dur;
      const inc = occIncome(o);
      const key = o.clientId || '_none';
      if (!byClient.has(key)) byClient.set(key, { clientId: o.clientId || null, minutes: 0, count: 0, checks: 0, incomeByCur: {}, incomeMain: 0 });
      const bc = byClient.get(key);
      bc.minutes += dur; bc.count++;
      if (o.isCheck) bc.checks++;
      if (inc) {
        res.incomeByCur[inc.currency] = (res.incomeByCur[inc.currency] || 0) + inc.amount;
        bc.incomeByCur[inc.currency] = (bc.incomeByCur[inc.currency] || 0) + inc.amount;
        const m = convert(inc.amount, inc.currency, main);
        res.incomeMain += m; bc.incomeMain += m; day.incomeMain += m;
        const ended = o.date < nowI.date || (o.date === nowI.date && o.end <= nowI.min);
        if (ended) res.incomePastMain += m;
      } else res.noRateCount++;
    } else {
      res.facultyMin += dur; day.facultyMin += dur; res.facultyCount++;
      day.travelMin += (be - o.end) + (o.start - bs);
      res.travelMin += (be - o.end) + (o.start - bs);
    }
  }
  for (const d of days) {
    const occ = unionMinutes(byDay[d].busy, lo, hi);
    byDay[d].occupiedMin = occ;
    res.occupiedMin += occ;
  }
  res.freeMin = Math.max(0, res.rangeMin - res.occupiedMin);
  return res;
}

function weekRange(date) {
  const from = startOfWeek(date, DB.settings.weekStart);
  return [from, addDays(from, 6)];
}

/* ---------- Estadísticas por cliente ---------- */

function receivableStatus(r) {
  if (r.status === 'paid') return 'paid';
  if (r.status === 'overdue') return 'overdue';
  if (r.dueDate && r.dueDate < todayYmd()) return 'overdue';
  return 'pending';
}

function pendingReceivables(clientId) {
  const byCur = {};
  for (const r of DB.receivables) {
    if (clientId && r.clientId !== clientId) continue;
    if (receivableStatus(r) === 'paid') continue;
    byCur[r.currency] = (byCur[r.currency] || 0) + (Number(r.amount) || 0);
  }
  return byCur;
}

function clientStats(clientId) {
  const today = nowInfo().date;
  const [wf, wt] = weekRange(today);
  const mf = startOfMonth(today), mt = endOfMonth(today);
  const empty = { minutes: 0, count: 0, checks: 0, incomeByCur: {}, incomeMain: 0 };
  const week = summarize(wf, wt).byClient.get(clientId) || empty;
  const month = summarize(mf, mt).byClient.get(clientId) || empty;
  let next = null;
  const nowI = nowInfo();
  for (const ev of DB.events) {
    if (ev.clientId !== clientId) continue;
    for (const o of expandEvent(ev, nowI.date, addDays(nowI.date, 120))) {
      if (o.date === nowI.date && o.end <= nowI.min) continue;
      if (!next || o.date < next.date || (o.date === next.date && o.start < next.start)) next = o;
    }
  }
  const paidMonth = DB.payments.filter((p) => p.clientId === clientId && monthKey(p.date) === monthKey(todayYmd()));
  const paidByCur = {};
  for (const p of paidMonth) paidByCur[p.currency] = (paidByCur[p.currency] || 0) + Number(p.amount || 0);
  return { week, month, pending: pendingReceivables(clientId), next, paidByCur };
}

/* ---------- Conflictos y alertas ---------- */

function overlapSegments(list) {
  // Para cada ocurrencia: tramos solapados con profundidad (cantidad de eventos simultáneos)
  const res = new Map();
  for (const a of list) {
    const pts = new Set([a.start, a.end]);
    const others = list.filter((b) => b !== a && b.start < a.end && a.start < b.end);
    if (!others.length) continue;
    for (const b of others) { pts.add(Math.max(a.start, b.start)); pts.add(Math.min(a.end, b.end)); }
    const sorted = [...pts].sort((x, y) => x - y);
    const segs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const s = sorted[i], e = sorted[i + 1];
      const depth = others.filter((b) => b.start < e && s < b.end).length;
      if (depth > 0) {
        const last = segs[segs.length - 1];
        if (last && last.end === s && last.depth === depth) last.end = e; else segs.push({ start: s, end: e, depth });
      }
    }
    res.set(a.key, { segs, others });
  }
  return res;
}

function detectAlerts(from, to) {
  const s = DB.settings;
  const occs = getOccurrences(from, to);
  const alerts = [];
  const byDay = {};
  for (const o of occs) (byDay[o.date] = byDay[o.date] || []).push(o);
  for (const date of Object.keys(byDay).sort()) {
    const list = byDay[date].slice().sort((a, b) => a.start - b.start);
    const dayName = DAY_NAMES[weekdayOf(date)].toLowerCase();
    const dayLabel = `el ${dayName} ${fmtDateShort(date)}`;

    // 1. Solapamientos (agrupados)
    let cluster = [], clusterEnd = -1;
    const flush = () => {
      if (cluster.length > 1) {
        let firstOverlap = Infinity;
        for (let i = 0; i < cluster.length; i++) for (let j = i + 1; j < cluster.length; j++) {
          const a = cluster[i], b = cluster[j];
          if (a.start < b.end && b.start < a.end) firstOverlap = Math.min(firstOverlap, Math.max(a.start, b.start));
        }
        alerts.push({ type: 'overlap', level: 'serious', date, start: firstOverlap, keys: cluster.map((o) => o.key),
          text: `${cluster.length} eventos se superponen ${dayLabel} a las ${fmtTime(firstOverlap)}.` });
      }
    };
    for (const o of list) {
      if (o.start < clusterEnd) { cluster.push(o); clusterEnd = Math.max(clusterEnd, o.end); } else { flush(); cluster = [o]; clusterEnd = o.end; }
    }
    flush();

    // 2. Demasiadas horas seguidas (pausas de 15 min o menos no cortan el bloque)
    const maxMin = (Number(s.maxConsecutiveHours) || 0) * 60;
    if (maxMin > 0) {
      let cs = null, ce = null, keys = [];
      const check = () => {
        if (cs != null && ce - cs > maxMin) {
          alerts.push({ type: 'long', level: 'warning', date, start: cs, keys: keys.slice(),
            text: `${fmtDur(ce - cs)} seguidas ${dayLabel} desde las ${fmtTime(cs)}, sin pausas de más de 15 min.` });
        }
      };
      for (const o of list) {
        if (cs == null || o.start > ce + 15) { check(); cs = o.start; ce = o.end; keys = [o.key]; } else { ce = Math.max(ce, o.end); keys.push(o.key); }
      }
      check();
    }

    // 3. Termina después de medianoche
    const late = list.filter((o) => o.end > MIN_PER_DAY);
    if (late.length) {
      const last = late.reduce((a, b) => (b.end > a.end ? b : a));
      alerts.push({ type: 'midnight', level: 'info', date, start: last.start, keys: [last.key],
        text: `${capitalize(dayLabel)} terminás a las ${fmtTime(last.end)} (${last.title || 'sin título'}).` });
    }

    // 4. Eventos muy cercanos entre sí
    const gapMin = Number(s.minGapMinutes) || 0;
    if (gapMin > 0) {
      for (let i = 0; i < list.length - 1; i++) {
        const a = list[i];
        const b = list.slice(i + 1).find((x) => x.start >= a.end);
        if (!b) continue;
        const gap = b.start - a.end;
        if (gap > 0 && gap < gapMin && !list.some((x) => x !== a && x !== b && x.start < b.start && x.end > a.end)) {
          alerts.push({ type: 'close', level: 'info', date, start: a.end, keys: [a.key, b.key],
            text: `Solo ${gap} min entre «${a.title}» y «${b.title}» ${dayLabel} (${fmtTime(a.end)}).` });
        }
      }
    }

    // 5. Trabajo durante un traslado a la facultad
    for (const f of list.filter((o) => o.calendar === 'faculty' && ((+o.travelBefore || 0) + (+o.travelAfter || 0)) > 0)) {
      const zones = [];
      if (+f.travelBefore) zones.push([f.start - f.travelBefore, f.start]);
      if (+f.travelAfter) zones.push([f.end, f.end + +f.travelAfter]);
      for (const w of list.filter((o) => o.calendar === 'work')) {
        if (zones.some(([zs, ze]) => w.start < ze && zs < w.end) && !(w.start < f.end && f.start < w.end)) {
          alerts.push({ type: 'travel', level: 'warning', date, start: w.start, keys: [w.key, f.key],
            text: `«${w.title}» cae en el traslado de «${f.title}» ${dayLabel}.` });
        }
      }
    }
  }
  const order = { overlap: 0, travel: 1, long: 2, close: 3, midnight: 4 };
  return alerts.sort((a, b) => (order[a.type] - order[b.type]) || a.date.localeCompare(b.date) || a.start - b.start);
}

/* ---------- Texto automático ---------- */

function buildInsights(sum, alerts, opts = {}) {
  const s = DB.settings;
  const main = mainCur();
  const out = [];
  const periodWord = opts.periodWord || 'Esta semana';
  out.push({ icon: 'briefcase', text: `${periodWord} tenés <b>${fmtDur(sum.workMin)}</b> de trabajo programado${sum.facultyMin ? ` y <b>${fmtDur(sum.facultyMin)}</b> de facultad` : ''}.` });
  const goal = opts.goalHours != null ? opts.goalHours : Number(s.weeklyGoalHours);
  if (goal > 0) {
    const diff = sum.workMin - goal * 60;
    let t = `Tu objetivo es ${fmtNum(goal)} h. `;
    if (Math.abs(diff) < 1) t += 'Estás justo en el objetivo.';
    else if (diff > 0) t += `Estás <b>${fmtDur(diff)}</b> por encima.`;
    else t += `Te faltan <b>${fmtDur(-diff)}</b>.`;
    out.push({ icon: 'target', text: t });
  }
  if (sum.days.length <= 7) {
    const busiest = sum.days.reduce((a, d) => (sum.byDay[d].workMin > (a ? sum.byDay[a].workMin : -1) ? d : a), null);
    if (busiest && sum.byDay[busiest].workMin > 0) {
      out.push({ icon: 'bars', text: `El ${DAY_NAMES[weekdayOf(busiest)].toLowerCase()} es tu día con más trabajo: <b>${fmtDur(sum.byDay[busiest].workMin)}</b>.` });
    }
  }
  const nOverlap = alerts.filter((a) => a.type === 'overlap').length;
  out.push({ icon: nOverlap ? 'alert' : 'check', text: nOverlap ? `Tenés <b>${nOverlap} ${nOverlap === 1 ? 'conflicto' : 'conflictos'}</b> de horario.` : 'Sin conflictos de horario.' });
  if (sum.workMin > 0 && sum.byClient.size > 0) {
    const top = [...sum.byClient.values()].sort((a, b) => b.minutes - a.minutes)[0];
    const pct = Math.round((top.minutes / sum.workMin) * 100);
    const name = top.clientId ? clientName(top.clientId) || 'Cliente eliminado' : 'Sin cliente';
    if (sum.byClient.size > 1) out.push({ icon: 'pie', text: `${esc(name)} representa el <b>${pct}%</b> de tus horas de trabajo.` });
  }
  if (sum.pendingConfirmMin > 0) out.push({ icon: 'help', text: `<b>${fmtDur(sum.pendingConfirmMin)}</b> están pendientes de confirmación.` });
  const pend = pendingReceivables();
  const pendMain = sumConverted(pend, main);
  if (pendMain > 0) out.push({ icon: 'inbox', text: `Tenés <b>${fmtMoney(pendMain, main)}</b> pendientes de cobro.` });
  return out;
}

/* ---------- Hora actual (día lógico: después de medianoche sigue siendo "hoy" hasta el fin del rango) ---------- */

function nowInfo() {
  const d = new Date();
  let min = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  let date = ymd(d);
  const cut = DB.settings.dayEnd * 60 - MIN_PER_DAY;
  if (cut > 0 && min < cut) { date = addDays(date, -1); min += MIN_PER_DAY; }
  return { date, min };
}
