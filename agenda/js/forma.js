/* ---------- Exportar para Forma ----------
   Forma (el modo tablet de la notebook) muestra el próximo evento en su inicio. La agenda le deja un archivo,
   proximo-evento.json, en una carpeta que elegís una vez. Solo van los próximos eventos ya calculados (título,
   fecha, horario, lugar, calendario y color): nada de clientes, cobros, tarifas ni notas.
   Se reescribe cada vez que se guarda algo y una vez por hora mientras la agenda está abierta.
   Si el navegador no deja escribir en carpetas, queda la descarga manual del mismo archivo. */

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

/* Los próximos eventos, desde ahora, ya con las repeticiones resueltas. */
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
  return JSON.stringify({ version: 1, exportado: new Date().toISOString(), eventos }, null, 2);
}

async function formaEscribir() {
  if (!formaCarpeta || formaPermiso !== 'listo') return false;
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
  if (!formaCarpeta) return;
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
  let estado, botones;
  if (!formaPuedeCarpeta()) {
    estado = 'Este navegador no deja escribir en una carpeta. Podés descargar el archivo y guardarlo donde lo lee Forma.';
    botones = `<button class="btn" data-action="forma-descargar">${icon('download')} Descargar el archivo</button>`;
  } else if (!formaCarpeta) {
    estado = 'Elegí la carpeta que te indicó Forma. Después se actualiza solo cada vez que cambies algo.';
    botones = `<button class="btn btn-primary" data-action="forma-elegir">${icon('download')} Exportar para Forma</button>`;
  } else if (formaPermiso !== 'listo') {
    estado = `Exportando a la carpeta <b>${esc(formaCarpeta.name)}</b>. El navegador pide permiso de nuevo cada vez que se abre.`;
    botones = `<button class="btn btn-primary" data-action="forma-reanudar">Seguir exportando</button>
      <button class="btn btn-ghost" data-action="forma-dejar">Dejar de exportar</button>`;
  } else {
    estado = `Exportando a la carpeta <b>${esc(formaCarpeta.name)}</b>${formaUltima ? ` (última vez: ${fmtTime(formaUltima.getHours() * 60 + formaUltima.getMinutes())})` : ''}.`;
    botones = `<button class="btn" data-action="forma-elegir">Cambiar la carpeta</button>
      <button class="btn btn-ghost" data-action="forma-dejar">Dejar de exportar</button>`;
  }
  return `<h2>Forma</h2>
    <p>${estado}</p>
    <p class="muted small">Solo va un archivo con los próximos ${FORMA_DIAS} días: título, horario, lugar y calendario. Nada de clientes, cobros ni notas. Si la agenda no se abre, el archivo queda como estaba y Forma muestra de cuándo es.</p>
    <div class="btn-row">${botones}</div>`;
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
    default: return false;
  }
}

async function initForma() {
  if (!formaPuedeCarpeta() || !window.indexedDB) return;
  try {
    formaCarpeta = await formaLeerCarpeta();
    if (!formaCarpeta) return;
    formaPermiso = (await formaCarpeta.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'listo' : 'pedir';
    await formaEscribir();
  } catch (e) { formaPermiso = 'pedir'; }
  formaRedibujar();
  // Una vez por hora, para que el archivo no quede con eventos que ya pasaron.
  setInterval(formaEscribir, 60 * 60 * 1000);
}
