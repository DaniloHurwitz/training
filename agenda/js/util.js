'use strict';
/* Utilidades generales: fechas, formato, colores, descarga de archivos. */

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const CURRENCIES = ['USD', 'ARS', 'EUR'];
const MIN_PER_DAY = 1440;

/* ---------- Fechas (siempre 'YYYY-MM-DD', aritmética en UTC para evitar problemas de horario de verano) ---------- */

function pad2(n) { return String(n).padStart(2, '0'); }

function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function todayYmd() { return ymd(new Date()); }

function isYmd(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

function toDayNum(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 864e5);
}

function fromDayNum(n) {
  const d = new Date(n * 864e5);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDays(s, n) { return fromDayNum(toDayNum(s) + n); }

function diffDays(a, b) { return toDayNum(b) - toDayNum(a); }

function weekdayOf(s) { return new Date(toDayNum(s) * 864e5).getUTCDay(); }

function startOfWeek(s, weekStart) { return addDays(s, -((weekdayOf(s) - weekStart + 7) % 7)); }

function startOfMonth(s) { return s.slice(0, 8) + '01'; }

function addMonths(s, n) {
  const [y, m] = s.split('-').map(Number);
  const t = (y * 12 + (m - 1)) + n;
  return `${Math.floor(t / 12)}-${pad2((t % 12) + 1)}-01`;
}

function endOfMonth(s) { return addDays(addMonths(startOfMonth(s), 1), -1); }

function dateRange(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function monthKey(s) { return s.slice(0, 7); }

/* ---------- Formato de fechas y horas ---------- */

function fmtTime(min) {
  const m = ((Math.round(min) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

function parseTime(str) {
  if (!str || !/^\d{1,2}:\d{2}/.test(str)) return null;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

function fmtDur(min) {
  min = Math.round(min);
  if (min <= 0) return '0 min';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function fmtDurShort(min) {
  min = Math.round(min);
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${pad2(m)}` : `${h}h`;
}

function fmtDateLong(s, withYear) {
  const [y, m, d] = s.split('-').map(Number);
  return `${DAY_NAMES[weekdayOf(s)].toLowerCase()} ${d} de ${MONTHS[m - 1]}${withYear ? ' de ' + y : ''}`;
}

function fmtDateShort(s) {
  const [, m, d] = s.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

function fmtDateNum(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function fmtMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${fmtDateNum(ymd(d))} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtRelative(iso) {
  if (!iso) return 'nunca';
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return 'recién';
  if (diff < 60) return `hace ${Math.round(diff)} min`;
  if (diff < 60 * 24) return `hace ${Math.round(diff / 60)} h`;
  const days = Math.round(diff / 1440);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

/* ---------- Números y dinero ---------- */

function fmtNum(n, maxDec = 2) {
  const r = Math.round(n * 10 ** maxDec) / 10 ** maxDec;
  const hasDec = Math.abs(r % 1) > 1e-9;
  return r.toLocaleString('es-AR', { minimumFractionDigits: hasDec ? Math.min(2, maxDec) : 0, maximumFractionDigits: maxDec });
}

function fmtMoney(amount, cur) {
  if (amount == null || isNaN(amount)) return '—';
  const dec = cur === 'ARS' && Math.abs(amount) >= 1000 ? 0 : 2;
  return `${cur} ${fmtNum(amount, dec)}`;
}

function toNumber(v) {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/* ---------- Texto ---------- */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function deepClone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

function sameValue(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/* ---------- Colores ---------- */

function hexToRgb(hex) {
  let h = String(hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) { return '#' + rgb.map((v) => pad2(Math.round(clamp(v, 0, 255)).toString(16))).join(''); }

/* Mezcla: t = proporción de `a` (0..1) */
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v * t + B[i] * (1 - t)));
}

function luminance(hex) {
  const c = hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

/* Texto claro u oscuro según el fondo */
function readableOn(hex) {
  const L = luminance(hex);
  const cWhite = 1.05 / (L + 0.05), cDark = (L + 0.05) / 0.0625;
  return cWhite >= cDark * 0.8 ? '#ffffff' : '#1c1b19';
}

/* ---------- Archivos ---------- */

function downloadFile(name, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function icon(name, cls = '') { return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
