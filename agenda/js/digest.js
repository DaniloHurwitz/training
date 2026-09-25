'use strict';
/* Textos de los avisos largos y anuncios: resumen del día, de mañana, semanal, clases de hoy,
   cuenta regresiva de parciales/finales, "no te olvides" de madrugada y cobros que vencen.
   Texto plano (sin Markdown): así se lee bien en el iPhone y en la app ntfy. */

const MAX_BODY_BYTES = 3600; // ntfy acepta hasta 4096 bytes por mensaje
const EXAM_TYPES = ['parcial', 'final'];
const EXAM_DAYS = [14, 7, 3, 2, 1, 0];

function dayName(date) { return DAY_NAMES[weekdayOf(date)].toLowerCase(); }
function dayShort(date) { return `${DAY_SHORT[weekdayOf(date)].toLowerCase()} ${Number(date.slice(8))}`; }

function clipBytes(text) {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= MAX_BODY_BYTES) return text;
  const lines = text.split('\n');
  while (lines.length && enc.encode(lines.join('\n') + '\n…').length > MAX_BODY_BYTES) lines.pop();
  return lines.join('\n') + '\n…';
}

function joinSections(sections) {
  return clipBytes(sections.filter((s) => s && s.length).map((s) => s.join('\n')).join('\n\n'));
}

function isExam(o) {
  return (o.calendar === 'faculty' && EXAM_TYPES.includes(o.facultyType)) || (o.calendar === 'work' && norm(o.taskType) === 'entrega');
}

function examLabel(o) {
  if (o.calendar === 'work') return o.title;
  const sj = getSubject(o.subjectId);
  const type = FACULTY_TYPES[o.facultyType] || 'Examen';
  return sj ? `${type} de ${sj.name}` : o.title;
}

/* Una línea por evento, pensada para leer rápido */
function occLine(o) {
  const inc = occIncome(o);
  const bits = [];
  if (o.calendar === 'faculty') {
    const extra = [FACULTY_TYPES[o.facultyType], o.room].filter(Boolean).join(' · ');
    bits.push(`🎓 ${o.title}${extra && !o.title.toLowerCase().includes((FACULTY_TYPES[o.facultyType] || '').toLowerCase()) ? ' · ' + extra : o.room ? ' · ' + o.room : ''}`);
    if (+o.travelBefore) bits.push(`salí ${fmtTime(o.start - o.travelBefore)}`);
  } else {
    bits.push(`${o.phone ? '📱' : '💻'} ${o.title}`);
    if (inc) bits.push(fmtMoney(inc.amount, inc.currency));
    if (o.confirmation === 'pending') bits.push('por confirmar');
  }
  const night = o.start < 6 * 60 ? '🌙 ' : '';
  return `${night}${fmtTime(o.start)}–${fmtTime(o.end)} ${bits.join(' · ')}`;
}

function dayOccs(date) {
  return getOccurrences(date, date).slice().sort((a, b) => a.start - b.start);
}

/* Huecos libres de al menos una hora dentro del horario del día */
function freeGaps(date, fromMin) {
  const busy = dayOccs(date).map(occBusyRange).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cursor = Math.max(fromMin, DB.settings.dayStart * 60);
  for (const [a, b] of busy) {
    if (a - cursor >= 60) gaps.push([cursor, a]);
    cursor = Math.max(cursor, b);
  }
  if (MIN_PER_DAY - cursor >= 60) gaps.push([cursor, MIN_PER_DAY]);
  return gaps.map(([a, b]) => `${fmtTime(a)}–${b === MIN_PER_DAY ? '24:00' : fmtTime(b)}`);
}

function upcomingExams(fromDate, days) {
  return getOccurrences(fromDate, addDays(fromDate, days)).filter(isExam).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

function examLine(o, fromDate) {
  const n = diffDays(fromDate, o.date);
  const when = n === 0 ? 'hoy' : n === 1 ? 'mañana' : `faltan ${n} días`;
  return `📝 ${examLabel(o)}: ${when} (${dayShort(o.date)}, ${fmtTime(o.start)})`;
}

function studyBefore(exam, fromDate) {
  if (exam.calendar !== 'faculty') return [];
  return getOccurrences(fromDate, exam.date).filter((o) => o.calendar === 'faculty' && o.facultyType === 'estudio'
    && o.subjectId === exam.subjectId && (o.date < exam.date || o.start < exam.start));
}

function attentionLines(date) {
  const lines = [];
  for (const a of detectAlerts(date, date).filter((x) => x.type === 'overlap' || x.type === 'travel')) lines.push('⚠ ' + a.text);
  for (const o of dayOccs(date).filter((x) => x.calendar === 'work' && x.confirmation === 'pending')) lines.push(`❓ Por confirmar: ${o.title} (${fmtTime(o.start)})`);
  // Vencido o por vencer visto desde el día del aviso (se programa con días de anticipación)
  for (const r of DB.receivables) {
    if (r.status === 'paid') continue;
    if (overdueOn(r, date)) lines.push(`💰 Cobro vencido: ${clientName(r.clientId) || 'sin cliente'} ${fmtMoney(r.amount, r.currency)}`);
    else if (r.dueDate && diffDays(date, r.dueDate) <= 3) lines.push(`💰 Cobro por vencer (${dayShort(r.dueDate)}): ${clientName(r.clientId) || 'sin cliente'} ${fmtMoney(r.amount, r.currency)}`);
  }
  return lines;
}

function overdueOn(r, date) { return r.status === 'overdue' || (r.status !== 'paid' && !!r.dueDate && r.dueDate < date); }

function weekProgressLine(date) {
  const s = DB.settings;
  const [f, t] = weekRange(date);
  const sum = summarize(f, t);
  const goal = Number(s.weeklyGoalHours) || 0;
  if (!goal) return `Semana: ${fmtDur(sum.workMin)} de trabajo programadas`;
  const diff = goal * 60 - sum.workMin;
  return `Semana: ${fmtDur(sum.workMin)} de ${fmtNum(goal)} h${diff > 0 ? ` (faltan ${fmtDur(diff)})` : ' ✓'}`;
}

/* ---------- Resumen del día (a la mañana) ---------- */

function morningDigest(date, atMin) {
  const all = dayOccs(date);
  const upcoming = all.filter((o) => o.start >= atMin);
  const done = all.filter((o) => o.start < atMin);
  const sum = summarize(date, date);
  const main = mainCur();
  const tonight = dayOccs(addDays(date, 1)).filter((o) => o.start < 6 * 60);
  const head = all.length
    ? `☀️ Hoy ${dayName(date)} ${Number(date.slice(8))}: ${all.length} ${all.length === 1 ? 'evento' : 'eventos'}${sum.workMin ? ` · ${fmtDur(sum.workMin)} de trabajo` : ''}`
    : `☀️ Hoy ${dayName(date)} ${Number(date.slice(8))}: día libre en la agenda`;
  const agenda = upcoming.length ? ['HOY', ...upcoming.map(occLine)] : [];
  if (done.length) agenda.push(`(ya pasó: ${done.map((o) => `${fmtTime(o.start)} ${o.title}`).join(', ')})`);
  const totals = [];
  if (all.length) {
    totals.push([sum.workMin ? `${fmtDur(sum.workMin)} de trabajo` : '', sum.facultyMin ? `${fmtDur(sum.facultyMin)} de facultad` : '', sum.incomeMain ? fmtMoney(sum.incomeMain, main) : ''].filter(Boolean).join(' · '));
    const gaps = freeGaps(date, atMin);
    if (gaps.length) totals.push('Libre: ' + gaps.join(', '));
  }
  const night = tonight.length ? ['ESTA NOCHE', ...tonight.map((o) => `🌙 ${fmtTime(o.start)} ${o.title} — no te duermas`)] : [];
  const exams = upcomingExams(date, 21).map((o) => examLine(o, date));
  const att = attentionLines(date);
  return {
    title: head,
    body: joinSections([agenda, totals, night, exams.length ? ['EXÁMENES Y ENTREGAS', ...exams] : [], att.length ? ['OJO', ...att] : [], [weekProgressLine(date)]]),
  };
}

/* ---------- Resumen de mañana (a la noche) ---------- */

function eveningDigest(date) {
  const tomorrow = addDays(date, 1);
  const list = dayOccs(tomorrow);
  const night = list.filter((o) => o.start < 6 * 60);
  const day = list.filter((o) => o.start >= 6 * 60);
  const sum = summarize(tomorrow, tomorrow);
  const main = mainCur();
  let title;
  if (night.length) title = `🌙 Mañana ${dayName(tomorrow)} empieza esta noche: ${fmtTime(night[0].start)} ${night[0].title}`;
  else if (day.length) title = `🌙 Mañana ${dayName(tomorrow)}: arrancás a las ${fmtTime(day[0].start)} con ${day[0].title}`;
  else title = `🌙 Mañana ${dayName(tomorrow)} no tenés nada agendado`;
  const sections = [];
  if (night.length) sections.push(['ESTA NOCHE (MADRUGADA)', ...night.map(occLine)]);
  if (day.length) sections.push([`MAÑANA ${dayName(tomorrow).toUpperCase()} ${Number(tomorrow.slice(8))}`, ...day.map(occLine)]);
  if (list.length) sections.push([[sum.workMin ? `${fmtDur(sum.workMin)} de trabajo` : '', sum.facultyMin ? `${fmtDur(sum.facultyMin)} de facultad` : '', sum.incomeMain ? fmtMoney(sum.incomeMain, main) : ''].filter(Boolean).join(' · ')]);
  const exams = upcomingExams(tomorrow, 7).map((o) => examLine(o, tomorrow));
  if (exams.length) sections.push(['SE VIENE', ...exams]);
  const att = attentionLines(tomorrow);
  if (att.length) sections.push(['OJO', ...att]);
  return { title, body: joinSections(sections) || 'Día libre. ¡A descansar!' };
}

/* ---------- Resumen semanal (lunes) ---------- */

function weeklyDigest(monday) {
  const s = DB.settings;
  const to = addDays(monday, 6);
  const sum = summarize(monday, to);
  const main = mainCur();
  const alerts = detectAlerts(monday, to);
  const goal = Number(s.weeklyGoalHours) || 0;
  const title = `📅 Tu semana (${fmtDateShort(monday)} – ${fmtDateShort(to)}): ${fmtDur(sum.workMin)} de trabajo · ${fmtMoney(sum.incomeMain, main)}`;
  const top = [
    `TRABAJO: ${fmtDur(sum.workMin)}${goal ? ` de ${fmtNum(goal)} h ${sum.workMin >= goal * 60 ? '✓' : `(faltan ${fmtDur(goal * 60 - sum.workMin)})`}` : ''} · ${fmtMoney(sum.incomeMain, main)} estimados`,
    `FACULTAD: ${fmtDur(sum.facultyMin)} · LIBRE: ${fmtDur(sum.freeMin)}`,
    `${sum.checks} ${sum.checks === 1 ? 'check' : 'checks'} · ${sum.workCount} tareas`,
  ];
  const perDay = sum.days.map((d) => `${DAY_SHORT[weekdayOf(d)]} ${fmtDurShort(sum.byDay[d].workMin + sum.byDay[d].facultyMin)}`).join(' · ');
  const busiest = sum.days.reduce((a, d) => (sum.byDay[d].workMin + sum.byDay[d].facultyMin > sum.byDay[a].workMin + sum.byDay[a].facultyMin ? d : a), sum.days[0]);
  const days = ['POR DÍA', perDay, `Día más cargado: ${dayName(busiest)} (${fmtDur(sum.byDay[busiest].workMin + sum.byDay[busiest].facultyMin)})`];
  const clients = [...sum.byClient.values()].sort((a, b) => b.minutes - a.minutes)
    .map((c) => `${c.clientId ? clientName(c.clientId) || 'Cliente' : 'Sin cliente'}: ${fmtDur(c.minutes)} · ${fmtMoney(c.incomeMain, main)}`);
  const exams = upcomingExams(monday, 13).map((o) => examLine(o, monday));
  const att = [];
  const overlaps = alerts.filter((a) => a.type === 'overlap');
  if (overlaps.length) att.push(`⚠ ${overlaps.length} ${overlaps.length === 1 ? 'superposición' : 'superposiciones'}: ${overlaps.map((a) => `${dayShort(a.date)} ${fmtTime(a.start)}`).join(', ')}`);
  const nights = sum.occs.filter((o) => o.start < 6 * 60).length;
  if (nights) att.push(`🌙 ${nights} ${nights === 1 ? 'evento' : 'eventos'} de madrugada`);
  const pending = sum.occs.filter((o) => o.calendar === 'work' && o.confirmation === 'pending');
  if (pending.length) att.push(`❓ Por confirmar: ${pending.map((o) => `${o.title} (${dayShort(o.date)})`).join(', ')}`);
  const pendMain = sumConverted(pendingReceivables(), main);
  const overdue = DB.receivables.filter((r) => overdueOn(r, monday)).length;
  if (pendMain > 0) att.push(`💰 ${fmtMoney(pendMain, main)} pendientes de cobro${overdue ? ` (${overdue} ${overdue === 1 ? 'vencido' : 'vencidos'})` : ''}`);
  return {
    title,
    body: joinSections([top, days, clients.length ? ['POR CLIENTE', ...clients] : [], exams.length ? ['EXÁMENES Y ENTREGAS', ...exams] : [], att.length ? ['OJO', ...att] : []]),
  };
}

/* ---------- Anuncios cortos ---------- */

function classesDigest(date) {
  const classes = dayOccs(date).filter((o) => o.calendar === 'faculty' && o.facultyType !== 'estudio');
  if (!classes.length) return null;
  const name = (o) => { const sj = getSubject(o.subjectId); return isExam(o) ? examLabel(o) : sj ? sj.name : o.title; };
  const title = classes.length === 1
    ? `🎓 Hoy tenés ${name(classes[0])} a las ${fmtTime(classes[0].start)}`
    : `🎓 Hoy tenés ${classes.map((o) => `${name(o)} (${fmtTime(o.start)})`).join(' y ')}`;
  const body = classes.map((o) => [
    `${fmtTime(o.start)}–${fmtTime(o.end)} ${name(o)}`,
    FACULTY_TYPES[o.facultyType], o.room, o.professor,
    +o.travelBefore ? `salí a las ${fmtTime(o.start - o.travelBefore)}` : '',
  ].filter(Boolean).join(' · ')).join('\n');
  return { title, body };
}

function examCountdown(o, daysLeft) {
  const label = examLabel(o);
  const when = `${capitalize(dayName(o.date))} ${Number(o.date.slice(8))} a las ${fmtTime(o.start)}`;
  const title = daysLeft === 0 ? `📝 Hoy: ${label} a las ${fmtTime(o.start)}. ¡Éxitos!`
    : daysLeft === 1 ? `📝 Mañana es el ${label}`
      : `📝 Faltan ${daysLeft} días para el ${label}`;
  const lines = [[when, o.room, +o.travelBefore ? `traslado ${o.travelBefore} min` : ''].filter(Boolean).join(' · ')];
  if (daysLeft > 0 && o.calendar === 'faculty') {
    const study = studyBefore(o, addDays(o.date, -daysLeft));
    const mins = study.reduce((t, x) => t + occDuration(x), 0);
    lines.push(study.length
      ? `Estudio agendado antes: ${study.length} ${study.length === 1 ? 'bloque' : 'bloques'} (${fmtDur(mins)}): ${study.map((x) => dayShort(x.date)).join(', ')}.`
      : `Todavía no agendaste bloques de estudio para esto.`);
  }
  if (o.notes) lines.push(o.notes);
  return { title, body: lines.join('\n') };
}

function nightWarning(o) {
  const inc = occIncome(o);
  return {
    title: `🌙 No te olvides: esta noche a las ${fmtTime(o.start)} tenés ${o.title}`,
    body: [`Es la madrugada del ${dayName(o.date)} (${fmtTime(o.start)}–${fmtTime(o.end)}).`,
      [o.calendar === 'work' ? (o.phone ? '📱 desde el teléfono' : '💻 necesitás la compu') : '', inc ? fmtMoney(inc.amount, inc.currency) : ''].filter(Boolean).join(' · '),
      'Si te vas a dormir, poné una alarma.'].filter(Boolean).join('\n'),
  };
}

function paymentDue(r) {
  return {
    title: `💰 Hoy vence el cobro de ${clientName(r.clientId) || 'un cliente'}: ${fmtMoney(r.amount, r.currency)}`,
    body: [r.concept, r.notes].filter(Boolean).join('\n') || 'Revisalo en Cuentas por cobrar.',
  };
}
