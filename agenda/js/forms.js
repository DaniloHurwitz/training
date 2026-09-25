'use strict';
/* Modales, avisos, formulario de eventos, detalle rápido (popover) y formularios de clientes / cobros / pagos. */

/* ---------- Modales ---------- */

const modalStack = [];

function openModal({ title, body, footer = '', size = 'md', dismissible = true, onClose, className = '' }) {
  const root = document.getElementById('modalRoot');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal-backdrop"></div>
    <div class="modal modal-${size} ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head"><h2>${esc(title)}</h2><button type="button" class="btn-icon" data-close aria-label="Cerrar (Esc)">${icon('x')}</button></header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  root.appendChild(wrap);
  const m = { el: wrap.querySelector('.modal'), wrap, onClose, closed: false, prevFocus: document.activeElement };
  m.close = (result) => {
    if (m.closed) return;
    m.closed = true;
    wrap.remove();
    const i = modalStack.indexOf(m);
    if (i >= 0) modalStack.splice(i, 1);
    document.body.classList.toggle('modal-open', modalStack.length > 0);
    if (m.onClose) m.onClose(result);
    if (m.prevFocus && m.prevFocus.focus && document.contains(m.prevFocus)) m.prevFocus.focus({ preventScroll: true });
  };
  wrap.querySelector('[data-close]').addEventListener('click', () => m.close());
  wrap.querySelector('.modal-backdrop').addEventListener('click', () => { if (dismissible) m.close(); });
  modalStack.push(m);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    const f = m.el.querySelector('[autofocus]') || m.el.querySelector('.modal-body input:not([type=hidden]):not([type=checkbox]), .modal-body select, .modal-body textarea');
    if (f && !isMobile()) f.focus();
  });
  return m;
}

function closeTopModal() {
  const m = modalStack[modalStack.length - 1];
  if (!m) return false;
  m.close();
  return true;
}

function toast(msg, { action, onAction, duration = 4500, kind = '', undo = false } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' toast-' + kind : '') + (undo ? ' has-undo' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast-action">${esc(action)}</button>` : ''}`;
  if (action) el.querySelector('button').addEventListener('click', () => { el.remove(); onAction(); });
  if (undo) duration = Math.max(duration, 7000);
  root.appendChild(el);
  while (root.children.length > 3) root.firstElementChild.remove();
  setTimeout(() => el.classList.add('is-out'), duration);
  setTimeout(() => el.remove(), duration + 400);
}

function confirmDialog({ title, message, confirmText = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const m = openModal({
      title, size: 'sm',
      body: `<p class="confirm-msg">${message}</p>`,
      footer: `<span class="spacer"></span><button type="button" class="btn" data-no>Cancelar</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes autofocus>${esc(confirmText)}</button>`,
      onClose: () => resolve(result),
    });
    m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.el.querySelector('[data-yes]').addEventListener('click', () => { result = true; m.close(); });
  });
}

/* ¿Solo esta, esta y las siguientes, o toda la serie? */
function askScope({ title, verb = 'editar', allowOne = true }) {
  return new Promise((resolve) => {
    let result = null;
    const opts = [
      ['one', 'Solo este evento', 'Cambia únicamente esta fecha.', allowOne],
      ['following', 'Este y los siguientes', 'Cambia desde esta fecha en adelante. Las anteriores quedan igual.', true],
      ['all', 'Todos los eventos de la serie', 'Cambia la serie completa, incluidas las fechas pasadas.', true],
    ];
    const first = opts.find((o) => o[3])[0];
    const m = openModal({
      title, size: 'sm',
      body: `<p class="muted small">¿Qué querés ${esc(verb)}?</p><div class="scope-list">${opts.map(([v, l, d, ok]) => `
        <label class="scope-opt${ok ? '' : ' is-disabled'}"><input type="radio" name="scope" value="${v}" ${v === first ? 'checked' : ''} ${ok ? '' : 'disabled'}>
          <span><b>${l}</b><small>${ok ? d : 'No disponible: cambiaste la repetición.'}</small></span></label>`).join('')}</div>`,
      footer: `<span class="spacer"></span><button type="button" class="btn" data-no>Cancelar</button><button type="button" class="btn btn-primary" data-yes>Aceptar</button>`,
      onClose: () => resolve(result),
    });
    m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
    m.el.querySelector('[data-yes]').addEventListener('click', () => {
      result = m.el.querySelector('input[name=scope]:checked').value;
      m.close();
    });
    m.el.querySelectorAll('.scope-opt').forEach((l) => l.addEventListener('dblclick', () => { const r = l.querySelector('input'); if (!r.disabled) { result = r.value; m.close(); } }));
  });
}

/* ---------- Helpers de formularios ---------- */

function opts(list, selected) {
  return list.map(([v, label]) => `<option value="${esc(v)}"${String(v) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

function currencyOptions(sel) { return opts(CURRENCIES.map((c) => [c, c]), sel); }

function clientOptions(sel, { none = '— Sin cliente —', allowNew = true } = {}) {
  const act = sortedClients(true).filter((c) => c.status !== 'finished' || c.id === sel);
  const fin = sortedClients(true).filter((c) => c.status === 'finished' && c.id !== sel);
  let h = `<option value="">${esc(none)}</option>` + opts(act.map((c) => [c.id, c.name + (c.status === 'paused' ? ' (pausado)' : '')]), sel);
  if (fin.length) h += `<optgroup label="Finalizados">${opts(fin.map((c) => [c.id, c.name]), sel)}</optgroup>`;
  if (allowNew) h += '<option value="__new">+ Nuevo cliente…</option>';
  return h;
}

function segHtml(name, items, sel) {
  return `<div class="seg seg-form" data-seg="${name}">${items.map(([v, l]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(String(v) === String(sel))}">${l}</button>`).join('')}</div>`;
}

function bindSeg(root, name, onChange) {
  const seg = root.querySelector(`[data-seg="${name}"]`);
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    seg.classList.remove('is-invalid');
    onChange(b.dataset.v);
  });
}

function setFieldError(form, name, msg) {
  const el = form.querySelector(`[name="${name}"]`) || form.querySelector(`[data-seg="${name}"]`);
  if (!el) return;
  el.classList.add('is-invalid');
  const field = el.closest('.field, .evf-device');
  if (field && msg && !field.querySelector('.field-err')) field.insertAdjacentHTML('beforeend', `<small class="field-err">${esc(msg)}</small>`);
}

function clearErrors(form) {
  form.querySelectorAll('.is-invalid').forEach((x) => x.classList.remove('is-invalid'));
  form.querySelectorAll('.field-err').forEach((x) => x.remove());
}

/* Horas del formulario → minutos (después de medianoche se guarda como el mismo día + 24 h) */
function normalizeTimes(start, end) {
  const s = DB.settings;
  const cut = s.dayEnd * 60 - MIN_PER_DAY;
  if (cut > 0 && start < cut && start < s.dayStart * 60) start += MIN_PER_DAY;
  let e = end;
  while (e <= start) e += MIN_PER_DAY;
  return { start, end: e };
}

function stripOcc(o) {
  const c = Object.assign({}, o);
  for (const k of ['key', 'eventId', 'origDate', 'isRecurring', 'isException', 'base', 'exceptions', 'id', 'createdAt', 'updatedAt', 'demo']) delete c[k];
  return c;
}

/* ---------- Formulario de evento ---------- */

function openEventForm(opts2 = {}) {
  closePopover();
  const s = DB.settings;
  const editing = !!opts2.occ;
  const src = opts2.occ || opts2.duplicateFrom || null;
  const nowI = nowInfo();
  let o;
  if (src) {
    o = deepClone(stripOcc(src));
    if (!editing) o.recurrence = null;
  } else {
    const cal = opts2.calendar || (UI.calFilter === 'faculty' ? 'faculty' : 'work');
    const date = opts2.date || UI.date;
    let start = opts2.start;
    if (start == null) {
      start = date === nowI.date ? Math.ceil(nowI.min / 30) * 30 : 9 * 60;
      start = clamp(start, s.dayStart * 60, s.dayEnd * 60 - 60);
    }
    o = {
      calendar: cal, title: '', date, start, end: opts2.end != null ? opts2.end : start + 60,
      clientId: opts2.clientId || '', project: '', taskType: '', billing: 'hourly', rate: null, currency: '',
      isCheck: false, phone: null, complexity: 'simple', confirmation: 'confirmed',
      subjectId: '', commission: '', professor: '', facultyType: 'clase', room: '', travelBefore: 0, travelAfter: 0,
      notes: '', location: '', link: '', recurrence: null,
    };
  }
  const st = {
    calendar: o.calendar, phone: o.phone == null ? null : !!o.phone, complexity: o.complexity || 'simple',
    confirmation: o.confirmation || 'confirmed', rateTouched: o.rate != null && o.rate !== '',
  };
  if (!editing && !src && o.clientId) {
    const c = getClient(o.clientId);
    if (c) { o.billing = c.billing || 'hourly'; o.currency = c.currency; o.rate = o.billing === 'task' ? c.taskRate : c.hourlyRate; st.rateTouched = false; }
  }
  const client = getClient(o.clientId);
  const subj = getSubject(o.subjectId);
  const rateInfo = occRateInfo(o);
  const r = o.recurrence || { type: 'none', interval: 1, days: [], end: 'never', until: '', count: 10, unit: 'week' };
  const projects = [...new Set(DB.events.map((e) => e.project).filter(Boolean))];
  const title = editing ? 'Editar evento' : src ? 'Duplicar evento' : 'Nuevo evento';
  const mobile = isMobile();
  const wdOrder = [1, 2, 3, 4, 5, 6, 0];

  const body = `<form class="evf" novalidate autocomplete="off">
    ${editing && src.demo ? '<p class="note note-demo">Es un evento de ejemplo. Si lo guardás, pasa a ser tuyo y no se borra al eliminar los datos de ejemplo.</p>' : ''}
    <div class="evf-cal" data-seg="calendar">
      <button type="button" data-v="work" aria-pressed="${st.calendar === 'work'}"><i class="dot" style="background:${s.workColor}"></i>Trabajo</button>
      <button type="button" data-v="faculty" aria-pressed="${st.calendar === 'faculty'}"><i class="dot" style="background:${s.facultyColor}"></i>Facultad</button>
    </div>
    <label class="field"><span>Nombre</span><input name="title" value="${esc(o.title)}" placeholder="Ej.: Disney Spanish Check" maxlength="120" autofocus></label>

    <div class="grid-2 only-work">
      <label class="field"><span>Cliente</span><div class="with-swatch"><i class="swatch" id="evfClientSwatch" style="background:${esc((client && client.color) || s.workColor)}"></i><select name="clientId">${clientOptions(o.clientId)}</select></div></label>
      <label class="field"><span>Proyecto</span><input name="project" value="${esc(o.project)}" list="dlProjects" placeholder="Opcional"></label>
    </div>
    <div class="grid-2 only-fac">
      <label class="field"><span>Materia</span><input name="subjectName" value="${esc(subj ? subj.name : '')}" list="dlSubjects" placeholder="Ej.: Anatomía"></label>
      <label class="field"><span>Tipo</span><select name="facultyType">${opts(Object.entries(FACULTY_TYPES), o.facultyType)}</select></label>
    </div>

    <div class="evf-when">
      <label class="field f-date"><span>Día</span><input type="date" name="date" value="${esc(o.date)}" required></label>
      <label class="field f-time"><span>Inicio</span><input type="time" name="start" value="${fmtTime(o.start)}" step="300" required></label>
      <label class="field f-time"><span>Fin</span><input type="time" name="end" value="${fmtTime(o.end)}" step="300" required></label>
      <div class="field f-dur"><span>Duración</span><output name="duration">${fmtDur(o.end - o.start)}</output></div>
    </div>
    <div class="chips dur-chips">${[15, 30, 45, 60, 90, 120, 180].map((m) => `<button type="button" class="chip" data-dur="${m}">${fmtDurShort(m)}</button>`).join('')}</div>
    <p class="evf-hint" data-hint="time"></p>

    <div class="evf-device only-work">
      <span class="lbl">¿Se puede hacer desde el teléfono?</span>
      ${segHtml('phone', [['1', `${icon('phone')} Sí, desde el teléfono`], ['0', `${icon('laptop')} No, necesito la compu`]], st.phone == null ? '' : st.phone ? '1' : '0')}
      <div class="evf-preview" aria-hidden="true"><div class="ev ev-sample"><div class="ev-body"><div class="ev-top"><span class="ev-title">Vista previa</span></div><div class="ev-time">Así se verá en el calendario</div></div></div></div>
    </div>

    <details class="evf-sec only-work" ${mobile ? '' : 'open'}>
      <summary>Trabajo y tarifa</summary>
      <div class="grid-3">
        <label class="field"><span>Tipo de tarea</span><input name="taskType" value="${esc(o.taskType)}" list="dlTaskTypes" placeholder="Check, traducción…"></label>
        <div class="field"><span>Complejidad</span>${segHtml('complexity', [['simple', 'Simple'], ['complex', 'Compleja']], st.complexity)}</div>
        <div class="field"><span>Confirmación</span>${segHtml('confirmation', [['confirmed', 'Confirmado'], ['pending', 'Pendiente']], st.confirmation)}</div>
      </div>
      <label class="check"><input type="checkbox" name="isCheck" ${o.isCheck ? 'checked' : ''}> Es un chequeo recurrente <small class="muted">(la frecuencia se define en Repetición)</small></label>
      <div class="grid-3">
        <label class="field"><span>Cobro</span><select name="billing">${opts([['hourly', 'Por hora'], ['task', 'Monto fijo por tarea']], rateInfo.billing)}</select></label>
        <label class="field"><span data-rate-label>${rateInfo.billing === 'task' ? 'Monto por tarea' : 'Tarifa por hora'}</span><input name="rate" type="number" min="0" step="0.01" inputmode="decimal" value="${rateInfo.rate == null ? '' : rateInfo.rate}" placeholder="0"></label>
        <label class="field"><span>Moneda</span><select name="currency">${currencyOptions(rateInfo.currency)}</select></label>
      </div>
      <div class="evf-income" data-income></div>
    </details>

    <details class="evf-sec only-fac" ${mobile ? '' : 'open'}>
      <summary>Cursada y traslado</summary>
      <div class="grid-3">
        <label class="field"><span>Comisión</span><input name="commission" value="${esc(o.commission)}"></label>
        <label class="field"><span>Profesor <small>(opcional)</small></span><input name="professor" value="${esc(o.professor)}"></label>
        <label class="field"><span>Aula</span><input name="room" value="${esc(o.room)}"></label>
      </div>
      <div class="grid-2">
        <label class="field"><span>Traslado antes (min)</span><input name="travelBefore" type="number" min="0" max="300" step="5" value="${Number(o.travelBefore) || ''}" placeholder="0"></label>
        <label class="field"><span>Traslado después (min)</span><input name="travelAfter" type="number" min="0" max="300" step="5" value="${Number(o.travelAfter) || ''}" placeholder="0"></label>
      </div>
      <p class="muted small">El traslado se muestra como una zona tenue antes y después de la clase.</p>
    </details>

    <details class="evf-sec" data-sec="rec" ${o.recurrence ? 'open' : ''}>
      <summary>Repetición <span class="sum-note" data-rec-summary></span></summary>
      <div class="grid-2">
        <label class="field"><span>Frecuencia</span><select name="recType">${opts(Object.entries(REC_LABELS), o.recurrence ? r.type : 'none')}</select></label>
        <label class="field" data-show="interval"><span data-interval-label>Cada cuántas semanas</span><div class="inline"><input name="interval" type="number" min="1" max="52" value="${Math.max(1, r.interval || 1)}"><select name="unit" data-show="unit">${opts([['day', 'días'], ['week', 'semanas']], r.unit || 'week')}</select></div></label>
      </div>
      <div class="field" data-show="days"><span>Días</span><div class="daypick">${wdOrder.map((w) => `<label><input type="checkbox" name="recDays" value="${w}" ${(r.days || []).includes(w) ? 'checked' : ''}><span>${DAY_LETTER[w]}</span></label>`).join('')}</div></div>
      <div class="grid-2" data-show="end">
        <label class="field"><span>Termina</span><select name="recEnd">${opts([['never', 'Nunca'], ['until', 'En una fecha'], ['count', 'Después de N veces']], r.end || 'never')}</select></label>
        <label class="field" data-show="until"><span>Hasta el</span><input type="date" name="until" value="${esc(r.until || '')}"></label>
        <label class="field" data-show="count"><span>Cantidad de veces</span><input type="number" name="count" min="1" max="500" value="${r.count || 10}"></label>
      </div>
    </details>

    <details class="evf-sec" ${o.location || o.link || o.notes ? 'open' : ''}>
      <summary>Ubicación, link y notas</summary>
      <div class="grid-2">
        <label class="field"><span>Ubicación <small>(opcional)</small></span><input name="location" value="${esc(o.location)}"></label>
        <label class="field"><span>Link <small>(opcional)</small></span><input name="link" type="url" value="${esc(o.link)}" placeholder="https://"></label>
      </div>
      <label class="field"><span>Notas</span><textarea name="notes" rows="3">${esc(o.notes)}</textarea></label>
    </details>
    <div class="evf-warn" data-warn hidden></div>
    <datalist id="dlProjects">${projects.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
    <datalist id="dlSubjects">${DB.subjects.map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>
    <datalist id="dlTaskTypes">${TASK_TYPES.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
  </form>`;

  const footer = `${editing ? `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash')} Eliminar</button>` : ''}
    <span class="spacer"></span><span class="kbd-hint">Ctrl + Enter para guardar</span>
    <button type="button" class="btn" data-act="cancel">Cancelar</button>
    <button type="button" class="btn btn-primary" data-act="save">${editing ? 'Guardar cambios' : 'Crear evento'}</button>`;

  const m = openModal({ title, body, footer, size: 'lg', dismissible: false, className: 'modal-event' });
  const f = m.el.querySelector('form');
  const E = f.elements;

  const setCal = (cal) => {
    st.calendar = cal;
    f.dataset.cal = cal;
    E.title.placeholder = cal === 'work' ? 'Ej.: Disney Spanish Check' : 'Ej.: Anatomía · clase';
    m.el.querySelectorAll('.evf-cal button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === cal)));
    update();
  };
  m.el.querySelector('.evf-cal').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b) setCal(b.dataset.v); });
  bindSeg(m.el, 'phone', (v) => { st.phone = v === '1'; update(); });
  bindSeg(m.el, 'complexity', (v) => { st.complexity = v; });
  bindSeg(m.el, 'confirmation', (v) => { st.confirmation = v; update(); });

  const applyClient = () => {
    const c = getClient(E.clientId.value);
    m.el.querySelector('#evfClientSwatch').style.background = (c && c.color) || s.workColor;
    if (c && !st.rateTouched) {
      E.billing.value = c.billing || 'hourly';
      E.rate.value = (E.billing.value === 'task' ? c.taskRate : c.hourlyRate) ?? '';
      E.currency.value = c.currency || mainCur();
    }
  };
  E.clientId.addEventListener('change', () => {
    if (E.clientId.value === '__new') {
      E.clientId.value = o.clientId || '';
      openClientForm(null, (nc) => {
        E.clientId.innerHTML = clientOptions(nc.id);
        E.clientId.value = nc.id;
        applyClient();
        update();
      });
      return;
    }
    applyClient();
    update();
  });
  E.rate.addEventListener('input', () => { st.rateTouched = true; update(); });
  E.billing.addEventListener('change', () => {
    m.el.querySelector('[data-rate-label]').textContent = E.billing.value === 'task' ? 'Monto por tarea' : 'Tarifa por hora';
    const c = getClient(E.clientId.value);
    if (c && !st.rateTouched) E.rate.value = (E.billing.value === 'task' ? c.taskRate : c.hourlyRate) ?? '';
    update();
  });
  E.subjectName.addEventListener('change', () => {
    const sj = DB.subjects.find((x) => norm(x.name) === norm(E.subjectName.value.trim()));
    if (sj) {
      if (!E.commission.value) E.commission.value = sj.commission || '';
      if (!E.professor.value) E.professor.value = sj.professor || '';
    }
    update();
  });
  E.isCheck.addEventListener('change', () => {
    if (E.isCheck.checked) {
      const sec = m.el.querySelector('[data-sec="rec"]');
      sec.open = true;
      if (E.recType.value === 'none') { E.recType.value = 'weekly'; }
      update();
    }
  });
  m.el.querySelector('.dur-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dur]');
    if (!b) return;
    const st0 = parseTime(E.start.value);
    if (st0 == null) return;
    E.end.value = fmtTime(st0 + Number(b.dataset.dur));
    update();
  });
  f.addEventListener('input', (e) => { if (e.target.name !== 'rate') update(); });
  f.addEventListener('change', () => update());
  f.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
    else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') e.preventDefault();
  });

  function readRecurrence() {
    const type = E.recType.value;
    if (type === 'none') return null;
    const days = [...f.querySelectorAll('input[name=recDays]:checked')].map((x) => Number(x.value));
    const date = E.date.value;
    const rec = { type, interval: 1, days: [], end: E.recEnd.value, until: '', count: null, unit: 'week' };
    if (type === 'nweeks') rec.interval = Math.max(1, Number(E.interval.value) || 1);
    if (type === 'custom') { rec.interval = Math.max(1, Number(E.interval.value) || 1); rec.unit = E.unit.value; }
    if (type === 'days' || (type === 'custom' && rec.unit === 'week')) rec.days = days.length ? days.sort((a, b) => a - b) : (isYmd(date) ? [weekdayOf(date)] : []);
    if (rec.end === 'until') rec.until = E.until.value || '';
    if (rec.end === 'count') rec.count = Math.max(1, Number(E.count.value) || 1);
    if (rec.end === 'until' && !rec.until) rec.end = 'never';
    return rec;
  }

  function update() {
    f.dataset.cal = st.calendar;
    // Tiempo
    const a = parseTime(E.start.value), b = parseTime(E.end.value);
    const hint = m.el.querySelector('[data-hint=time]');
    let times = null;
    if (a != null && b != null && a !== b) {
      times = normalizeTimes(a, b);
      E.duration.value = fmtDur(times.end - times.start);
      const d = E.date.value;
      const notes = [];
      if (isYmd(d)) {
        const next = addDays(d, 1);
        if (times.start >= MIN_PER_DAY) notes.push(`Empieza después de medianoche (${DAY_NAMES[weekdayOf(next)].toLowerCase()} ${fmtTime(times.start)}); se muestra al final del ${DAY_NAMES[weekdayOf(d)].toLowerCase()}.`);
        else if (times.end > MIN_PER_DAY) notes.push(`Termina después de medianoche: ${DAY_NAMES[weekdayOf(next)].toLowerCase()} a las ${fmtTime(times.end)}.`);
      }
      if (times.end <= s.dayStart * 60 || times.start >= s.dayEnd * 60) notes.push(`Queda fuera del horario visible (${fmtTime(s.dayStart * 60)}–${fmtTime(s.dayEnd * 60)}).`);
      hint.textContent = notes.join(' ');
      hint.hidden = !notes.length;
    } else {
      E.duration.value = '—';
      hint.hidden = true;
    }
    // Vista previa de color
    const cid = E.clientId.value && E.clientId.value !== '__new' ? E.clientId.value : '';
    const sample = m.el.querySelector('.ev-sample');
    if (sample) {
      const fake = { calendar: 'work', clientId: cid, phone: st.phone === true };
      const { v, style } = eventStyleVars(fake);
      sample.className = `ev ev-sample ${v.cls}${st.confirmation === 'pending' ? ' is-pending' : ''}`;
      sample.setAttribute('style', style);
      sample.querySelector('.ev-title').textContent = E.title.value.trim() || (cid ? clientName(cid) : 'Vista previa');
      sample.querySelector('.ev-time').textContent = st.phone == null ? 'Elegí teléfono o computadora' : st.phone ? 'Liviano: se puede hacer desde el teléfono' : 'Sólido: requiere computadora';
      sample.parentElement.classList.toggle('is-unset', st.phone == null);
    }
    // Ingreso estimado
    const incEl = m.el.querySelector('[data-income]');
    const rate = toNumber(E.rate.value);
    if (times && rate != null) {
      const amt = E.billing.value === 'task' ? rate : (rate * (times.end - times.start)) / 60;
      const cur = E.currency.value;
      const eq = CURRENCIES.filter((c) => c !== cur).map((c) => fmtMoney(convert(amt, cur, c), c)).join(' · ');
      incEl.innerHTML = `Ingreso estimado <b>${esc(fmtMoney(amt, cur))}</b> <span class="muted">≈ ${esc(eq)}</span>${E.billing.value === 'hourly' ? `<span class="muted small"> · ${fmtDur(times.end - times.start)} × ${esc(fmtMoney(rate, cur))}/h</span>` : ''}`;
    } else {
      incEl.innerHTML = '<span class="muted">Cargá una tarifa para calcular el ingreso estimado.</span>';
    }
    // Repetición
    const type = E.recType.value;
    const showDays = type === 'days' || (type === 'custom' && E.unit.value === 'week');
    f.querySelector('[data-show=days]').hidden = !showDays;
    f.querySelector('[data-show=interval]').hidden = !(type === 'nweeks' || type === 'custom');
    f.querySelector('[data-show=unit]').hidden = type !== 'custom';
    f.querySelector('[data-interval-label]').textContent = type === 'custom' ? 'Repetir cada' : 'Cada cuántas semanas';
    f.querySelector('[data-show=end]').hidden = type === 'none';
    f.querySelector('[data-show=until]').hidden = E.recEnd.value !== 'until';
    f.querySelector('[data-show=count]').hidden = E.recEnd.value !== 'count';
    if (showDays && !f.querySelector('input[name=recDays]:checked') && isYmd(E.date.value)) {
      const cb = f.querySelector(`input[name=recDays][value="${weekdayOf(E.date.value)}"]`);
      if (cb) cb.checked = true;
    }
    const rec = readRecurrence();
    f.querySelector('[data-rec-summary]').textContent = rec && isYmd(E.date.value) ? '· ' + describeRecurrence(rec, E.date.value) : '';
    // Solapamientos
    const warn = m.el.querySelector('[data-warn]');
    if (times && isYmd(E.date.value)) {
      const clash = getOccurrences(E.date.value, E.date.value).filter((x) =>
        !(editing && x.key === src.key) && x.start < times.end && times.start < x.end);
      warn.hidden = !clash.length;
      warn.innerHTML = clash.length ? `${icon('alert')} <b>Solapamiento</b>: se superpone con ${clash.map((x) => `«${esc(x.title || 'Sin título')}» (${fmtTime(x.start)}–${fmtTime(x.end)})`).join(', ')}. Se puede guardar igual.` : '';
    } else warn.hidden = true;
  }

  async function save() {
    clearErrors(f);
    const data = { calendar: st.calendar };
    data.title = E.title.value.trim();
    data.date = E.date.value;
    const a = parseTime(E.start.value), b = parseTime(E.end.value);
    let ok = true;
    if (!isYmd(data.date)) { setFieldError(f, 'date', 'Elegí un día'); ok = false; }
    if (a == null) { setFieldError(f, 'start', 'Hora inválida'); ok = false; }
    if (b == null) { setFieldError(f, 'end', 'Hora inválida'); ok = false; }
    if (a != null && b != null && a === b) { setFieldError(f, 'end', 'El fin debe ser distinto del inicio'); ok = false; }
    if (st.calendar === 'work' && st.phone == null) { setFieldError(f, 'phone', 'Indicá si se puede hacer desde el teléfono'); ok = false; }
    const rec = readRecurrence();
    if (rec && (rec.type === 'days' || (rec.type === 'custom' && rec.unit === 'week')) && !rec.days.length) { ok = false; toast('Elegí al menos un día para la repetición.'); }
    if (rec && rec.end === 'until' && rec.until < data.date) { setFieldError(f, 'until', 'Debe ser posterior al día del evento'); ok = false; }
    if (!ok) {
      const firstErr = f.querySelector('.is-invalid');
      if (firstErr) { const det = firstErr.closest('details'); if (det) det.open = true; firstErr.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return;
    }
    const t = normalizeTimes(a, b);
    data.start = t.start; data.end = t.end;
    data.notes = E.notes.value.trim();
    data.location = E.location.value.trim();
    data.link = E.link.value.trim();
    data.recurrence = rec;
    let newSubject = null;
    if (st.calendar === 'work') {
      Object.assign(data, {
        clientId: E.clientId.value === '__new' ? '' : E.clientId.value,
        project: E.project.value.trim(), taskType: E.taskType.value.trim(),
        billing: E.billing.value, rate: toNumber(E.rate.value), currency: E.currency.value,
        isCheck: E.isCheck.checked, phone: st.phone, complexity: st.complexity, confirmation: st.confirmation,
      });
      if (!data.title) data.title = [clientName(data.clientId), data.taskType || data.project].filter(Boolean).join(' · ') || 'Trabajo';
    } else {
      const name = E.subjectName.value.trim();
      let sj = DB.subjects.find((x) => norm(x.name) === norm(name));
      if (!sj && name) {
        newSubject = { id: uid(), name, color: nextPaletteColor(DB.subjects.length ? DB.subjects : [{ color: '#2a78d6' }]), commission: E.commission.value.trim(), professor: E.professor.value.trim(), notes: '', demo: false };
        sj = newSubject;
      }
      Object.assign(data, {
        subjectId: sj ? sj.id : '', commission: E.commission.value.trim(), professor: E.professor.value.trim(),
        facultyType: E.facultyType.value, room: E.room.value.trim(),
        travelBefore: Math.max(0, Number(E.travelBefore.value) || 0), travelAfter: Math.max(0, Number(E.travelAfter.value) || 0),
      });
      if (!data.title) data.title = [name, FACULTY_TYPES[data.facultyType]].filter(Boolean).join(' · ') || 'Facultad';
    }
    const now = new Date().toISOString();
    const addSubject = (d) => { if (newSubject) d.subjects.push(newSubject); };

    if (editing) {
      let scope = 'all';
      if (src.isRecurring) {
        const recChanged = !sameValue(rec, src.base.recurrence);
        scope = await askScope({ title: 'Editar un evento que se repite', verb: 'editar', allowOne: !recChanged });
        if (!scope) return;
      }
      m.close();
      commit((d) => { addSubject(d); applyOccurrenceEdit(d, src, data, scope); }, { undo: 'Evento actualizado' });
    } else {
      m.close();
      const ev = Object.assign({ id: uid() }, data, { exceptions: {}, demo: false, createdAt: now, updatedAt: now });
      commit((d) => { addSubject(d); d.events.push(ev); }, { undo: src ? 'Evento duplicado' : 'Evento creado' });
      if (UI.section === 'calendar' && !visibleDays().includes(ev.date) && currentView() !== 'agenda') {
        toast(`Creado para el ${fmtDateLong(ev.date)}.`, { action: 'Ver', onAction: () => focusOccurrence(ev.date, ev.id + '@' + ev.date) });
      }
    }
  }

  m.el.querySelector('[data-act=save]').addEventListener('click', save);
  m.el.querySelector('[data-act=cancel]').addEventListener('click', () => m.close());
  const del = m.el.querySelector('[data-act=delete]');
  if (del) del.addEventListener('click', async () => { if (await deleteOccurrenceFlow(src)) m.close(); });
  setCal(st.calendar);
}

async function deleteOccurrenceFlow(occ) {
  let scope = 'all';
  if (occ.isRecurring) {
    scope = await askScope({ title: 'Eliminar un evento que se repite', verb: 'eliminar' });
    if (!scope) return false;
  } else if (!(await confirmDialog({ title: 'Eliminar evento', message: `¿Eliminar «${esc(occ.title || 'Sin título')}»?`, confirmText: 'Eliminar', danger: true }))) {
    return false;
  }
  closePopover();
  commit((d) => deleteOccurrence(d, occ, scope), { undo: 'Evento eliminado' });
  return true;
}

/* ---------- Detalle rápido (popover) ---------- */

let popoverAnchor = null;

function closePopover() {
  const p = document.getElementById('popover');
  if (!p || p.hidden) return false;
  p.hidden = true;
  p.innerHTML = '';
  document.body.classList.remove('pop-open');
  popoverAnchor = null;
  return true;
}

function openEventPopover(occ, anchor) {
  const p = document.getElementById('popover');
  const inc = occIncome(occ);
  const ri = occRateInfo(occ);
  const c = getClient(occ.clientId);
  const sj = getSubject(occ.subjectId);
  const { style } = eventStyleVars(occ);
  const clashes = getOccurrences(occ.date, occ.date).filter((x) => x.key !== occ.key && x.start < occ.end && occ.start < x.end);
  const rows = [];
  const row = (k, v) => { if (v) rows.push(`<dt>${k}</dt><dd>${v}</dd>`); };
  row('Calendario', occ.calendar === 'work' ? 'Trabajo' : 'Facultad');
  if (occ.calendar === 'work') {
    row('Cliente', c ? `<span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}${occ.project ? ' · ' + esc(occ.project) : ''}` : (occ.project ? esc(occ.project) : '<span class="muted">Sin cliente</span>'));
    row('Tarifa', ri.rate != null ? `${esc(fmtMoney(ri.rate, ri.currency))}${ri.billing === 'task' ? ' por tarea' : '/h'}` : '<span class="muted">Sin tarifa</span>');
    if (inc) row('Ingreso', `<b>${esc(fmtMoney(inc.amount, inc.currency))}</b> <span class="muted small">≈ ${CURRENCIES.filter((x) => x !== inc.currency).map((x) => esc(fmtMoney(convert(inc.amount, inc.currency, x), x))).join(' · ')}</span>`);
    row('Modo', `${icon(occ.phone ? 'phone' : 'laptop')} ${occ.phone ? 'Desde el teléfono' : 'Con computadora'} · ${occ.complexity === 'complex' ? 'Compleja' : 'Simple'}${occ.taskType ? ' · ' + esc(occ.taskType) : ''}`);
    row('Estado', occ.confirmation === 'pending' ? '<span class="tag tag-warn">Pendiente de confirmación</span>' : 'Confirmado');
    if (occ.isCheck) row('Check', 'Chequeo recurrente');
  } else {
    row('Materia', sj ? `<span class="dot" style="background:${esc(sj.color)}"></span>${esc(sj.name)}` : '');
    row('Tipo', esc(FACULTY_TYPES[occ.facultyType] || ''));
    row('Comisión', esc(occ.commission));
    row('Profesor', esc(occ.professor));
    row('Aula', esc(occ.room));
    if (+occ.travelBefore || +occ.travelAfter) row('Traslado', `${+occ.travelBefore || 0} min antes · ${+occ.travelAfter || 0} min después`);
  }
  if (occ.isRecurring) row('Repite', esc(describeRecurrence(occ.base.recurrence, occ.base.date)) + (occ.isException ? ' <span class="muted small">(esta fecha fue modificada)</span>' : ''));
  row('Ubicación', esc(occ.location));
  if (occ.link && /^https?:\/\//i.test(occ.link)) row('Link', `<a href="${esc(occ.link)}" target="_blank" rel="noopener noreferrer">${esc(occ.link.replace(/^https?:\/\//, '').slice(0, 40))}</a>`);
  row('Notas', occ.notes ? `<span class="pre">${esc(occ.notes)}</span>` : '');

  p.innerHTML = `<div class="pop-inner" role="dialog" aria-label="${esc(occ.title)}">
    <div class="pop-head">
      <span class="pop-swatch ev ${eventVisual(occ).cls}" style="${style}"></span>
      <div class="pop-title"><h3>${esc(occ.title || 'Sin título')}${occ.demo ? ' <span class="tag tag-demo">demo</span>' : ''}</h3>
        <p>${esc(capitalize(fmtDateLong(occ.date)))} · ${fmtTime(occ.start)}–${fmtTime(occ.end)}${occ.end > MIN_PER_DAY ? ' <span class="muted">(+1)</span>' : ''} · <b>${fmtDur(occDuration(occ))}</b></p></div>
      <button type="button" class="btn-icon" data-pop="close" aria-label="Cerrar">${icon('x')}</button>
    </div>
    ${clashes.length ? `<div class="pop-warn">${icon('alert')} <b>Solapamiento</b> con ${clashes.map((x) => `«${esc(x.title || 'Sin título')}» ${fmtTime(x.start)}–${fmtTime(x.end)}${x.calendar !== occ.calendar ? ` (${x.calendar === 'work' ? 'Trabajo' : 'Facultad'})` : ''}`).join(', ')}</div>` : ''}
    <dl class="pop-dl">${rows.join('')}</dl>
    <div class="pop-actions">
      <button type="button" class="btn btn-primary btn-sm" data-pop="edit">${icon('edit')} Editar</button>
      <button type="button" class="btn btn-sm" data-pop="dup">${icon('copy')} Duplicar</button>
      <button type="button" class="btn btn-sm" data-pop="dupdays">${icon('calendar')} Duplicar a otros días</button>
      <button type="button" class="btn btn-sm btn-ghost btn-danger-text" data-pop="delete">${icon('trash')} Eliminar</button>
    </div>
  </div>`;
  p.hidden = false;
  popoverAnchor = anchor;
  const sheet = isMobile() || !anchor;
  p.classList.toggle('is-sheet', sheet);
  document.body.classList.toggle('pop-open', sheet);
  if (!sheet) {
    const r = anchor.getBoundingClientRect();
    const pw = p.offsetWidth, ph = p.offsetHeight;
    let left = r.right + 8;
    if (left + pw > window.innerWidth - 8) left = r.left - pw - 8;
    if (left < 8) left = clamp(r.left + r.width / 2 - pw / 2, 8, window.innerWidth - pw - 8);
    let top = clamp(r.top, 8, window.innerHeight - ph - 8);
    p.style.left = left + 'px';
    p.style.top = top + 'px';
  } else {
    p.style.left = ''; p.style.top = '';
  }
  p.onclick = (e) => {
    const b = e.target.closest('[data-pop]');
    if (!b) return;
    const a = b.dataset.pop;
    if (a === 'close') closePopover();
    if (a === 'edit') { closePopover(); openEventForm({ occ }); }
    if (a === 'dup') { closePopover(); openEventForm({ duplicateFrom: occ }); }
    if (a === 'dupdays') { closePopover(); openDuplicateDays(occ); }
    if (a === 'delete') deleteOccurrenceFlow(occ);
  };
  const focusBtn = p.querySelector('[data-pop=edit]');
  if (focusBtn && !isMobile()) focusBtn.focus({ preventScroll: true });
}

/* ---------- Duplicar a otros días ---------- */

function openDuplicateDays(occ) {
  const s = DB.settings;
  const ws = startOfWeek(occ.date, s.weekStart);
  const days = dateRange(ws, addDays(ws, 6));
  const body = `<p class="muted small">Se crean copias de «${esc(occ.title)}» a las ${fmtTime(occ.start)}–${fmtTime(occ.end)} en los días elegidos (como eventos individuales).</p>
    <div class="chips" style="margin:10px 0">
      <button type="button" class="chip" data-pick="all">Toda la semana</button>
      <button type="button" class="chip" data-pick="weekdays">Lunes a viernes</button>
      <button type="button" class="chip" data-pick="none">Ninguno</button>
    </div>
    <div class="dup-days">${days.map((d) => `<label class="check${d === occ.date ? ' is-disabled' : ''}"><input type="checkbox" value="${d}" ${d === occ.date ? 'disabled' : ''}> ${esc(capitalize(fmtDateLong(d)))}${d === occ.date ? ' <small class="muted">(original)</small>' : ''}</label>`).join('')}</div>
    <label class="check" style="margin-top:8px"><input type="checkbox" data-next> También en la semana siguiente</label>`;
  const m = openModal({
    title: 'Duplicar a otros días', size: 'sm', body,
    footer: `<span class="spacer"></span><button type="button" class="btn" data-no>Cancelar</button><button type="button" class="btn btn-primary" data-yes>Duplicar</button>`,
  });
  const boxes = [...m.el.querySelectorAll('.dup-days input:not(:disabled)')];
  m.el.querySelector('.chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    boxes.forEach((x) => {
      const w = weekdayOf(x.value);
      x.checked = b.dataset.pick === 'all' ? true : b.dataset.pick === 'weekdays' ? w >= 1 && w <= 5 : false;
    });
  });
  m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-yes]').addEventListener('click', () => {
    let dates = boxes.filter((x) => x.checked).map((x) => x.value);
    if (m.el.querySelector('[data-next]').checked) dates = dates.concat(dates.map((d) => addDays(d, 7)), [addDays(occ.date, 7)]);
    dates = [...new Set(dates)];
    if (!dates.length) { toast('Elegí al menos un día.'); return; }
    m.close();
    const now = new Date().toISOString();
    const baseData = stripOcc(occ);
    commit((d) => {
      for (const date of dates) d.events.push(Object.assign({}, deepClone(baseData), { id: uid(), date, recurrence: null, exceptions: {}, demo: false, createdAt: now, updatedAt: now }));
    }, { undo: `Duplicado en ${dates.length} ${dates.length === 1 ? 'día' : 'días'}` });
  });
}

/* ---------- Clientes ---------- */

function openClientForm(client, onSaved) {
  const editing = !!client;
  const c = client || { name: '', color: nextPaletteColor(DB.clients), currency: mainCur(), hourlyRate: null, taskRate: null, billing: 'hourly', notes: '', status: 'active' };
  const body = `<form class="cf" novalidate autocomplete="off">
    ${editing && c.demo ? '<p class="note note-demo">Cliente de ejemplo. Al guardarlo pasa a ser tuyo.</p>' : ''}
    <label class="field"><span>Nombre</span><input name="name" value="${esc(c.name)}" maxlength="80" placeholder="Ej.: Disney" autofocus></label>
    <div class="field"><span>Color</span>
      <div class="color-row"><input type="color" name="color" value="${esc(c.color)}">
      ${PALETTE.map((p) => `<button type="button" class="swatch-btn" data-color="${p}" style="background:${p}" aria-label="Usar color ${p}"></button>`).join('')}</div>
      <div class="color-preview" data-preview></div>
    </div>
    <div class="grid-3">
      <label class="field"><span>Estado</span><select name="status">${opts(Object.entries(CLIENT_STATUS), c.status)}</select></label>
      <label class="field"><span>Moneda</span><select name="currency">${currencyOptions(c.currency)}</select></label>
      <label class="field"><span>Cobro habitual</span><select name="billing">${opts([['hourly', 'Por hora'], ['task', 'Por tarea']], c.billing || 'hourly')}</select></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>Tarifa por hora</span><input type="number" name="hourlyRate" min="0" step="0.01" inputmode="decimal" value="${c.hourlyRate ?? ''}" placeholder="Ej.: 18"></label>
      <label class="field"><span>Tarifa por tarea <small>(opcional)</small></span><input type="number" name="taskRate" min="0" step="0.01" inputmode="decimal" value="${c.taskRate ?? ''}" placeholder="Monto fijo por check"></label>
    </div>
    ${editing ? '<label class="check" data-apply hidden><input type="checkbox" name="applyRate" checked> Actualizar también los eventos de este cliente que usaban la tarifa anterior</label>' : ''}
    <label class="field"><span>Notas</span><textarea name="notes" rows="3">${esc(c.notes)}</textarea></label>
  </form>`;
  const footer = `${editing ? `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash')} Eliminar</button>` : ''}
    <span class="spacer"></span><button type="button" class="btn" data-act="cancel">Cancelar</button>
    <button type="button" class="btn btn-primary" data-act="save">${editing ? 'Guardar' : 'Crear cliente'}</button>`;
  const m = openModal({ title: editing ? 'Editar cliente' : 'Nuevo cliente', body, footer, size: 'md', dismissible: false });
  const f = m.el.querySelector('form');
  const E = f.elements;
  const preview = () => {
    const col = E.color.value;
    const cream = isDarkTheme() ? '#d9cfb6' : '#f6eedb';
    const pb = mixHex(col, cream, isDarkTheme() ? 0.2 : 0.16);
    const sb = isDarkTheme() ? mixHex(col, '#000000', 0.86) : col;
    f.querySelector('[data-preview]').innerHTML = `<span class="cp cp-phone" style="background:${pb};border-left-color:${col}">${icon('phone')} Teléfono</span><span class="cp" style="background:${sb};color:${readableOn(sb)}">${icon('laptop')} Computadora</span>`;
  };
  f.querySelector('.color-row').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) { E.color.value = b.dataset.color; preview(); } });
  E.color.addEventListener('input', preview);
  const rateChanged = () => editing && (toNumber(E.hourlyRate.value) !== (c.hourlyRate ?? null) || toNumber(E.taskRate.value) !== (c.taskRate ?? null) || E.currency.value !== c.currency);
  f.addEventListener('input', () => { const ap = f.querySelector('[data-apply]'); if (ap) ap.hidden = !rateChanged(); });
  f.addEventListener('change', () => { const ap = f.querySelector('[data-apply]'); if (ap) ap.hidden = !rateChanged(); });
  preview();
  const save = () => {
    clearErrors(f);
    const name = E.name.value.trim();
    if (!name) { setFieldError(f, 'name', 'Poné un nombre'); return; }
    if (DB.clients.some((x) => x.id !== (client && client.id) && norm(x.name) === norm(name))) { setFieldError(f, 'name', 'Ya existe un cliente con ese nombre'); return; }
    const data = {
      name, color: E.color.value, status: E.status.value, currency: E.currency.value, billing: E.billing.value,
      hourlyRate: toNumber(E.hourlyRate.value), taskRate: toNumber(E.taskRate.value), notes: E.notes.value.trim(),
    };
    const apply = editing && rateChanged() && E.applyRate && E.applyRate.checked;
    m.close();
    if (editing) {
      commit((d) => {
        const x = d.clients.find((y) => y.id === client.id);
        if (apply) {
          for (const ev of d.events) {
            if (ev.clientId !== client.id) continue;
            const bill = ev.billing || 'hourly';
            const oldRate = bill === 'task' ? client.taskRate : client.hourlyRate;
            const newRate = bill === 'task' ? data.taskRate : data.hourlyRate;
            if ((ev.rate == null || ev.rate === oldRate) && (ev.currency || client.currency) === client.currency) { ev.rate = newRate; ev.currency = data.currency; }
          }
        }
        Object.assign(x, data, { demo: false });
      }, { toast: 'Cliente guardado' });
    } else {
      const nc = Object.assign({ id: uid(), demo: false, createdAt: new Date().toISOString() }, data);
      commit((d) => d.clients.push(nc), { toast: 'Cliente creado' });
      if (onSaved) onSaved(nc);
    }
  };
  m.el.querySelector('[data-act=save]').addEventListener('click', save);
  m.el.querySelector('[data-act=cancel]').addEventListener('click', () => m.close());
  f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); save(); } });
  const del = m.el.querySelector('[data-act=delete]');
  if (del) del.addEventListener('click', async () => {
    const nEv = DB.events.filter((e) => e.clientId === client.id).length;
    const nR = DB.receivables.filter((r) => r.clientId === client.id).length;
    const nP = DB.payments.filter((p) => p.clientId === client.id).length;
    const extra = nEv + nR + nP ? `<br><br>Tiene ${nEv} eventos, ${nR} cobros y ${nP} pagos asociados: se conservan pero quedan «sin cliente». Si solo dejaste de trabajar con este cliente, conviene marcarlo como <b>Finalizado</b>.` : '';
    if (!(await confirmDialog({ title: 'Eliminar cliente', message: `¿Eliminar a «${esc(client.name)}»?${extra}`, confirmText: 'Eliminar', danger: true }))) return;
    m.close();
    closeDrawer();
    commit((d) => {
      d.clients = d.clients.filter((x) => x.id !== client.id);
      for (const ev of d.events) if (ev.clientId === client.id) { ev.clientId = ''; ev.currency = ev.currency || client.currency; if (ev.rate == null) ev.rate = client.hourlyRate; }
      for (const r of d.receivables) if (r.clientId === client.id) r.clientId = '';
      for (const p of d.payments) if (p.clientId === client.id) p.clientId = '';
    }, { undo: 'Cliente eliminado' });
  });
}

function openSubjectForm(subject) {
  const editing = !!subject;
  const sj = subject || { name: '', color: nextPaletteColor(DB.subjects.length ? DB.subjects : [{ color: '#2a78d6' }]), commission: '', professor: '', notes: '' };
  const body = `<form novalidate autocomplete="off">
    <label class="field"><span>Materia</span><input name="name" value="${esc(sj.name)}" maxlength="80" autofocus></label>
    <div class="field"><span>Color</span><div class="color-row"><input type="color" name="color" value="${esc(sj.color)}">
      ${PALETTE.map((p) => `<button type="button" class="swatch-btn" data-color="${p}" style="background:${p}" aria-label="Usar color ${p}"></button>`).join('')}</div></div>
    <div class="grid-2">
      <label class="field"><span>Comisión</span><input name="commission" value="${esc(sj.commission)}"></label>
      <label class="field"><span>Profesor <small>(opcional)</small></span><input name="professor" value="${esc(sj.professor)}"></label>
    </div>
    <label class="field"><span>Notas</span><textarea name="notes" rows="2">${esc(sj.notes)}</textarea></label>
  </form>`;
  const footer = `${editing ? `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash')} Eliminar</button>` : ''}<span class="spacer"></span>
    <button type="button" class="btn" data-act="cancel">Cancelar</button><button type="button" class="btn btn-primary" data-act="save">Guardar</button>`;
  const m = openModal({ title: editing ? 'Editar materia' : 'Nueva materia', body, footer, size: 'sm', dismissible: false });
  const f = m.el.querySelector('form');
  const E = f.elements;
  f.querySelector('.color-row').addEventListener('click', (e) => { const b = e.target.closest('[data-color]'); if (b) E.color.value = b.dataset.color; });
  const save = () => {
    clearErrors(f);
    const name = E.name.value.trim();
    if (!name) { setFieldError(f, 'name', 'Poné un nombre'); return; }
    const data = { name, color: E.color.value, commission: E.commission.value.trim(), professor: E.professor.value.trim(), notes: E.notes.value.trim(), demo: false };
    m.close();
    if (editing) commit((d) => Object.assign(d.subjects.find((x) => x.id === subject.id), data), { toast: 'Materia guardada' });
    else commit((d) => d.subjects.push(Object.assign({ id: uid() }, data)), { toast: 'Materia creada' });
  };
  m.el.querySelector('[data-act=save]').addEventListener('click', save);
  m.el.querySelector('[data-act=cancel]').addEventListener('click', () => m.close());
  f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); save(); } });
  const del = m.el.querySelector('[data-act=delete]');
  if (del) del.addEventListener('click', async () => {
    const n = DB.events.filter((e) => e.subjectId === subject.id).length;
    if (!(await confirmDialog({ title: 'Eliminar materia', message: `¿Eliminar «${esc(subject.name)}»?${n ? ` Sus ${n} eventos se conservan sin materia asignada.` : ''}`, confirmText: 'Eliminar', danger: true }))) return;
    m.close();
    commit((d) => {
      d.subjects = d.subjects.filter((x) => x.id !== subject.id);
      for (const ev of d.events) if (ev.subjectId === subject.id) ev.subjectId = '';
    }, { undo: 'Materia eliminada' });
  });
}

/* ---------- Cuentas por cobrar ---------- */

function openReceivableForm(rec, preset = {}) {
  const editing = !!rec;
  const today = todayYmd();
  const r = rec || Object.assign({ clientId: '', concept: '', amount: '', currency: mainCur(), date: today, dueDate: addDays(today, 30), status: 'pending', notes: '' }, preset);
  if (!editing && r.clientId) { const c = getClient(r.clientId); if (c) r.currency = c.currency; }
  const body = `<form novalidate autocomplete="off">
    <div class="grid-2">
      <label class="field"><span>Cliente</span><select name="clientId">${clientOptions(r.clientId, { allowNew: false })}</select></label>
      <label class="field"><span>Concepto</span><input name="concept" value="${esc(r.concept)}" placeholder="Ej.: Checks de agosto" autofocus></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>Monto</span><input type="number" name="amount" min="0" step="0.01" inputmode="decimal" value="${r.amount ?? ''}"></label>
      <label class="field"><span>Moneda</span><select name="currency">${currencyOptions(r.currency)}</select></label>
    </div>
    <div class="grid-3">
      <label class="field"><span>Fecha</span><input type="date" name="date" value="${esc(r.date)}"></label>
      <label class="field"><span>Pago esperado</span><input type="date" name="dueDate" value="${esc(r.dueDate || '')}"></label>
      <label class="field"><span>Estado</span><select name="status">${opts([['pending', 'Pendiente'], ['paid', 'Pagado'], ['overdue', 'Vencido']], r.status)}</select></label>
    </div>
    <p class="muted small">Si la fecha esperada ya pasó y sigue pendiente, se marca como vencido automáticamente.</p>
    <label class="field"><span>Notas</span><textarea name="notes" rows="2">${esc(r.notes)}</textarea></label>
    <p class="evf-income" data-eq></p>
  </form>`;
  const footer = `${editing ? `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash')} Eliminar</button>` : ''}<span class="spacer"></span>
    <button type="button" class="btn" data-act="cancel">Cancelar</button><button type="button" class="btn btn-primary" data-act="save">Guardar</button>`;
  const m = openModal({ title: editing ? 'Editar cobro pendiente' : 'Nuevo cobro pendiente', body, footer, size: 'md', dismissible: false });
  const f = m.el.querySelector('form');
  const E = f.elements;
  const eq = () => {
    const a = toNumber(E.amount.value);
    f.querySelector('[data-eq]').innerHTML = a ? `Equivale a ${CURRENCIES.filter((c) => c !== E.currency.value).map((c) => `<b>${esc(fmtMoney(convert(a, E.currency.value, c), c))}</b>`).join(' · ')}` : '';
  };
  E.clientId.addEventListener('change', () => { const c = getClient(E.clientId.value); if (c && !editing) E.currency.value = c.currency; eq(); });
  f.addEventListener('input', eq);
  f.addEventListener('change', eq);
  eq();
  const save = () => {
    clearErrors(f);
    const amount = toNumber(E.amount.value);
    if (amount == null || amount <= 0) { setFieldError(f, 'amount', 'Ingresá un monto'); return; }
    if (!isYmd(E.date.value)) { setFieldError(f, 'date', 'Elegí una fecha'); return; }
    const data = { clientId: E.clientId.value, concept: E.concept.value.trim() || 'Sin concepto', amount, currency: E.currency.value, date: E.date.value, dueDate: E.dueDate.value || '', status: E.status.value, notes: E.notes.value.trim(), demo: false };
    if (data.status === 'paid' && !(rec && rec.paidAt)) data.paidAt = todayYmd();
    if (data.status !== 'paid') data.paidAt = null;
    m.close();
    if (editing) commit((d) => Object.assign(d.receivables.find((x) => x.id === rec.id), data), { toast: 'Cobro guardado' });
    else commit((d) => d.receivables.push(Object.assign({ id: uid() }, data)), { toast: 'Cobro registrado' });
  };
  m.el.querySelector('[data-act=save]').addEventListener('click', save);
  m.el.querySelector('[data-act=cancel]').addEventListener('click', () => m.close());
  const del = m.el.querySelector('[data-act=delete]');
  if (del) del.addEventListener('click', () => { m.close(); commit((d) => { d.receivables = d.receivables.filter((x) => x.id !== rec.id); }, { undo: 'Cobro eliminado' }); });
}

function openMarkPaid(rec) {
  const today = todayYmd();
  const body = `<p>${esc(clientName(rec.clientId) || 'Sin cliente')} · ${esc(rec.concept)} · <b>${esc(fmtMoney(rec.amount, rec.currency))}</b></p>
    <div class="grid-2">
      <label class="field"><span>Fecha de pago</span><input type="date" name="paidAt" value="${today}"></label>
      <label class="field"><span>Monto recibido</span><input type="number" name="amount" min="0" step="0.01" value="${rec.amount}"></label>
    </div>
    <label class="check"><input type="checkbox" name="register" checked> Registrarlo también en Ingresos</label>`;
  const m = openModal({
    title: 'Marcar como pagado', size: 'sm', body,
    footer: `<span class="spacer"></span><button type="button" class="btn" data-no>Cancelar</button><button type="button" class="btn btn-primary" data-yes>${icon('check')} Marcar pagado</button>`,
  });
  m.el.querySelector('[data-no]').addEventListener('click', () => m.close());
  m.el.querySelector('[data-yes]').addEventListener('click', () => {
    const paidAt = m.el.querySelector('[name=paidAt]').value || today;
    const amount = toNumber(m.el.querySelector('[name=amount]').value) ?? rec.amount;
    const register = m.el.querySelector('[name=register]').checked;
    m.close();
    commit((d) => {
      const x = d.receivables.find((y) => y.id === rec.id);
      x.status = 'paid'; x.paidAt = paidAt; x.demo = false;
      if (register) d.payments.push({ id: uid(), date: paidAt, clientId: rec.clientId, concept: rec.concept, project: '', amount, currency: rec.currency, notes: '', receivableId: rec.id, demo: false });
    }, { undo: 'Marcado como pagado' });
  });
}

/* ---------- Ingresos (pagos recibidos) ---------- */

function openPaymentForm(pay) {
  const editing = !!pay;
  const p = pay || { date: todayYmd(), clientId: '', concept: '', project: '', amount: '', currency: mainCur(), notes: '' };
  const projects = [...new Set(DB.events.map((e) => e.project).concat(DB.payments.map((x) => x.project)).filter(Boolean))];
  const body = `<form novalidate autocomplete="off">
    <div class="grid-2">
      <label class="field"><span>Fecha</span><input type="date" name="date" value="${esc(p.date)}"></label>
      <label class="field"><span>Cliente</span><select name="clientId">${clientOptions(p.clientId, { allowNew: false })}</select></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>Concepto</span><input name="concept" value="${esc(p.concept)}" autofocus></label>
      <label class="field"><span>Proyecto <small>(opcional)</small></span><input name="project" value="${esc(p.project)}" list="dlPayProjects"></label>
    </div>
    <div class="grid-2">
      <label class="field"><span>Monto</span><input type="number" name="amount" min="0" step="0.01" inputmode="decimal" value="${p.amount ?? ''}"></label>
      <label class="field"><span>Moneda</span><select name="currency">${currencyOptions(p.currency)}</select></label>
    </div>
    <label class="field"><span>Notas</span><textarea name="notes" rows="2">${esc(p.notes)}</textarea></label>
    <p class="evf-income" data-eq></p>
    <datalist id="dlPayProjects">${projects.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
  </form>`;
  const footer = `${editing ? `<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">${icon('trash')} Eliminar</button>` : ''}<span class="spacer"></span>
    <button type="button" class="btn" data-act="cancel">Cancelar</button><button type="button" class="btn btn-primary" data-act="save">Guardar</button>`;
  const m = openModal({ title: editing ? 'Editar pago recibido' : 'Registrar pago recibido', body, footer, size: 'md', dismissible: false });
  const f = m.el.querySelector('form');
  const E = f.elements;
  const eq = () => {
    const a = toNumber(E.amount.value);
    f.querySelector('[data-eq]').innerHTML = a ? `Equivale a ${CURRENCIES.filter((c) => c !== E.currency.value).map((c) => `<b>${esc(fmtMoney(convert(a, E.currency.value, c), c))}</b>`).join(' · ')}` : '';
  };
  E.clientId.addEventListener('change', () => { const c = getClient(E.clientId.value); if (c && !editing) E.currency.value = c.currency; eq(); });
  f.addEventListener('input', eq);
  f.addEventListener('change', eq);
  eq();
  const save = () => {
    clearErrors(f);
    const amount = toNumber(E.amount.value);
    if (amount == null || amount <= 0) { setFieldError(f, 'amount', 'Ingresá un monto'); return; }
    if (!isYmd(E.date.value)) { setFieldError(f, 'date', 'Elegí una fecha'); return; }
    const data = { date: E.date.value, clientId: E.clientId.value, concept: E.concept.value.trim() || 'Pago', project: E.project.value.trim(), amount, currency: E.currency.value, notes: E.notes.value.trim(), demo: false };
    m.close();
    if (editing) commit((d) => Object.assign(d.payments.find((x) => x.id === pay.id), data), { toast: 'Pago guardado' });
    else commit((d) => d.payments.push(Object.assign({ id: uid() }, data)), { toast: 'Pago registrado' });
  };
  m.el.querySelector('[data-act=save]').addEventListener('click', save);
  m.el.querySelector('[data-act=cancel]').addEventListener('click', () => m.close());
  const del = m.el.querySelector('[data-act=delete]');
  if (del) del.addEventListener('click', () => { m.close(); commit((d) => { d.payments = d.payments.filter((x) => x.id !== pay.id); }, { undo: 'Pago eliminado' }); });
}
