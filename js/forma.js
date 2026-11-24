/* ---------- Forma ----------
   Forma (el modo tablet de la notebook) muestra el próximo evento en su inicio. La agenda le manda sus eventos sola
   a Forma, que escucha solo en esta misma computadora (127.0.0.1): al abrirse, cada vez que se guarda algo (también
   lo que llega del teléfono) y una vez por hora. Van los eventos con su repetición, así Forma calcula sola los de
   cualquier día. Queda, por si acaso, escribir en una carpeta elegida o descargar el mismo archivo. */
const FORMA_ARCHIVO = 'proximo-evento.json';
const FORMA_DIAS = 14;      // cuántos días hacia adelante
const FORMA_MAXIMO = 20;    // cuántos eventos como mucho
const FORMA_DB = 'agendaSemanal:forma';
let formaCarpeta = null;    // la carpeta elegida (FileSystemDirectoryHandle)
let formaPermiso = 'nada';  // 'nada' | 'pedir' | 'listo'
let formaUltima = null;     // fecha de la última exportación de esta sesión
let formaEspera = 0;

function formaPuedeCarpeta() { return typeof window.showDirectoryPicker === 'function'; }

/* La carpeta elegida se recuerda en IndexedDB (localStorage no puede guardar el permiso). */
function formaBase() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open(FORMA_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}

async function formaLeerCarpeta() {
  const db = await formaBase();
  return new Promise((ok) => {
    const q = db.transaction('k').objectStore('k').get('carpeta');
    q.onsuccess = () => ok(q.result || null);
    q.onerror = () => ok(null);
  });
}

async function formaGuardarCarpeta(h) {
  const db = await formaBase();
  return new Promise((ok) => {
    const t = db.transaction('k', 'readwrite');
    if (h) t.objectStore('k').put(h, 'carpeta'); else t.objectStore('k').delete('carpeta');
    t.oncomplete = () => ok();
    t.onerror = () => ok();
  });
}

/* Los próximos eventos, desde ahora, ya con las repeticiones resueltas (versión 1), y además cada evento con su
   repetición (versión 2): así Forma calcula sola los de cualquier día aunque la agenda no se abra.
   Solo título, fecha, horario, lugar, calendario y color: nada de clientes, cobros, tarifas ni notas. */
function formaSerie(ev) {
  const r = ev.recurrence;
  const base = makeOcc(ev, ev.date, null);
  const excepciones = {};
  for (const [orig, ov] of Object.entries(ev.exceptions || {})) {
    if (!ov) continue;
    excepciones[orig] = ov.deleted ? { borrada: true } : {
      fecha: ov.date || null,
      inicio: typeof ov.start === 'number' ? ov.start : null,
      fin: typeof ov.end === 'number' ? ov.end : null,
      titulo: ov.title || null,
      lugar: ov.location || null,
    };
  }
  return {
    titulo: ev.title || 'Sin título',
    fecha: ev.date,
    inicio: ev.start,
    fin: ev.end,
    lugar: ev.location || '',
    calendario: calLabel(ev.calendar),
    color: occColor(base),
    repite: r ? {
      tipo: r.type, dias: r.days || [], cada: Math.max(1, Number(r.interval) || 1), unidad: r.unit || null,
      termina: r.end || 'never', hasta: r.until || null, veces: Number(r.count) || 0,
    } : null,
    excepciones,
  };
}

function formaContenido() {
  const ahora = nowInfo();
  const hasta = addDays(ahora.date, FORMA_DIAS);
  const eventos = getOccurrences(ahora.date, hasta)
    .filter((o) => !(o.date === ahora.date && o.end <= ahora.min))
    .slice(0, FORMA_MAXIMO)
    .map((o) => ({
      titulo: o.title || 'Sin título',
      fecha: o.date,
      inicio: o.start,
      fin: o.end,
      lugar: o.location || '',
      calendario: calLabel(o.calendar),
      color: occColor(o),
    }));
  // Solo las series que pueden tener eventos de hoy en adelante.
  const serie = DB.events
    .filter((ev) => { const u = seriesLastDate(ev); return !u || u >= ahora.date || Object.keys(ev.exceptions || {}).length > 0; })
    .map(formaSerie);
  return JSON.stringify({ version: 2, exportado: new Date().toISOString(), eventos, serie });
}

/* Forma escucha en esta misma computadora (127.0.0.1): la agenda le manda los datos sola, sin carpetas ni permisos
   de archivos. Si Forma no está abierta, el envío falla en silencio y se vuelve a probar en el próximo cambio o a la
   hora. Edge puede preguntar una sola vez si la agenda puede conectarse con dispositivos de esta computadora. */
const FORMA_LOCAL = 'http://127.0.0.1:47113/agenda';
let formaConectada = null; // fecha del último envío que Forma recibió

async function formaEnviar() {
  if (typeof fetch !== 'function') return false;
  try {
    const r = await fetch(FORMA_LOCAL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: formaContenido(),
      targetAddressSpace: 'loopback',
    });
    if (!r.ok) return false;
    formaConectada = new Date();
    formaRedibujar();
    return true;
  } catch (e) {
    return false; // Forma cerrada o el navegador no dejó
  }
}

async function formaEscribir() {
  const enviado = await formaEnviar();
  if (!formaCarpeta || formaPermiso !== 'listo') return enviado;
  try {
    const archivo = await formaCarpeta.getFileHandle(FORMA_ARCHIVO, { create: true });
    const w = await archivo.createWritable();
    await w.write(formaContenido());
    await w.close();
    formaUltima = new Date();
    return true;
  } catch (e) {
    formaPermiso = 'pedir';
    return false;
  }
}

/* Lo llama saveDB: junta varios cambios seguidos en una sola escritura. */
function formaCambio() {
  clearTimeout(formaEspera);
  formaEspera = setTimeout(formaEscribir, 1500);
}

async function formaElegir() {
  try {
    const h = await window.showDirectoryPicker({ id: 'forma', mode: 'readwrite' });
    formaCarpeta = h;
    formaPermiso = 'listo';
    await formaGuardarCarpeta(h);
    if (await formaEscribir()) toast('Listo: Forma ya puede leer tu próximo evento.');
  } catch (e) { /* canceló el selector */ }
  formaRedibujar();
}

async function formaReanudar() {
  if (!formaCarpeta) return;
  try {
    formaPermiso = (await formaCarpeta.requestPermission({ mode: 'readwrite' })) === 'granted' ? 'listo' : 'pedir';
  } catch (e) { formaPermiso = 'pedir'; }
  if (formaPermiso === 'listo') await formaEscribir();
  formaRedibujar();
}

async function formaDejar() {
  formaCarpeta = null;
  formaPermiso = 'nada';
  await formaGuardarCarpeta(null);
  toast('La agenda ya no exporta para Forma. El archivo que quedó en la carpeta no se borra.');
  formaRedibujar();
}

function formaDescargar() {
  downloadFile(FORMA_ARCHIVO, formaContenido(), 'application/json');
  toast('Guardá el archivo en la carpeta que lee Forma.');
}

function formaBlockHtml() {
  const conexion = formaConectada
    ? `Conectada con Forma: le manda sus eventos sola (último envío: ${fmtTime(formaConectada.getHours() * 60 + formaConectada.getMinutes())}).`
    : 'Forma no respondió todavía. Con Forma abierta en esta computadora, la agenda le manda sus eventos sola, sin exportar nada.';
  let extra = '';
  if (formaPuedeCarpeta() && formaCarpeta) {
    extra = formaPermiso === 'listo'
      ? `<p class="muted small">También escribe en la carpeta <b>${esc(formaCarpeta.name)}</b>.</p>
        <div class="btn-row"><button class="btn btn-ghost" data-action="forma-dejar">Dejar de usar la carpeta</button></div>`
      : `<div class="btn-row"><button class="btn btn-ghost" data-action="forma-dejar">Dejar de usar la carpeta</button></div>`;
  }
  return `<h2>Forma</h2>
    <p>${conexion}</p>
    <p class="muted small">Solo va lo necesario para mostrar los próximos eventos: título, horario, lugar, calendario y cómo se repiten. Nada de clientes, cobros ni notas, y nada sale de esta computadora.</p>
    <div class="btn-row"><button class="btn" data-action="forma-enviar">Mandar ahora</button>
      <button class="btn btn-ghost" data-action="forma-descargar">${icon('download')} Descargar el archivo</button></div>
    ${extra}`;
}

function formaRedibujar() {
  const b = document.getElementById('formaBlock');
  if (b) b.innerHTML = formaBlockHtml();
}

function formaAccion(a) {
  switch (a) {
    case 'forma-elegir': formaElegir(); return true;
    case 'forma-reanudar': formaReanudar(); return true;
    case 'forma-dejar': formaDejar(); return true;
    case 'forma-descargar': formaDescargar(); return true;
    case 'forma-enviar': formaEnviar().then((ok) => toast(ok ? 'Listo: Forma ya tiene tus eventos.' : 'Forma no respondió. ¿Está abierta?')); return true;
    default: return false;
  }
}

async function initForma() {
  // A Forma se le manda siempre, haya carpeta o no (ya no hace falta exportar a mano).
  await formaEnviar();
  // Una vez por hora, por si Forma se abrió después que la agenda.
  setInterval(formaEscribir, 60 * 60 * 1000);
  if (!formaPuedeCarpeta() || !window.indexedDB) return;
  try {
    formaCarpeta = await formaLeerCarpeta();
    if (!formaCarpeta) return;
    formaPermiso = (await formaCarpeta.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'listo' : 'pedir';
    await formaEscribir();
  } catch (e) { formaPermiso = 'pedir'; }
  formaRedibujar();
}
