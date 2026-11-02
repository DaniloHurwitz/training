'use strict';
/* Curso de italiano — dos lecciones pensadas para hispanohablantes y el orden final del curso.
   Orden basado en: pronunciación primero (Wyner, Fluent Forever), transferencia desde el español
   (reglas de conversión y falsos amigos), verbos y vocabulario de alta frecuencia antes que lo raro,
   y práctica de recuperación (exámenes) + repetición espaciada (tarjetas). */

IT_LESSONS.push(
{ n: 101, w: 1, cat: 'pasos', title: 'El atajo del hispanohablante', goal: 'Convertir miles de palabras del español al italiano con un puñado de reglas.',
  blocks: [
    ['p', 'Esta es la mayor ventaja que tenés y casi ningún curso la explota. El español y el italiano vienen del latín y cambiaron de forma <b>regular</b>: si conocés las reglas de conversión, una palabra que nunca viste te sale sola. Funcionan muy seguido, no siempre: usalas para adivinar con buena puntería, y confirmá cuando puedas.'],
    ['h', 'Terminaciones (las más rentables)'],
    ['tb', ['Español', 'Italiano', 'Ejemplos'], [['-ción', '-zione', 'nación → nazione · lección → lezione · operación → operazione'], ['-sión', '-sione', 'decisión → decisione · televisión → televisione'], ['-dad / -tad', '-tà', 'ciudad → città · universidad → università · libertad → libertà'], ['-tud', '-tù', 'virtud → virtù · juventud → gioventù'], ['-ble', '-bile', 'posible → possibile · responsable → responsabile'], ['-oso / -ista / -ismo / -mente', 'igual', 'famoso, turista, organismo, finalmente']]],
    ['v', [['la stazione', 'la estación'], ['l\'operazione', 'la operación'], ['la città', 'la ciudad'], ['la possibilità', 'la posibilidad'], ['possibile', 'posible'], ['incredibile', 'increíble'], ['la gioventù', 'la juventud']]],
    ['h', 'Cambios de sonido'],
    ['tb', ['Español', 'Italiano', 'Ejemplos'], [['termina en consonante', 'agrega vocal', 'doctor → dottore · hospital → ospedale · mar → mare · animal → animale'], ['ct / pt', 'tt', 'octubre → ottobre · septiembre → settembre · exacto → esatto'], ['ll- / pl- / cl- / fl-', 'pi / chi / fi', 'lleno → pieno · llave → chiave · llamar → chiamare · plaza → piazza · flor → fiore'], ['ie', 'e', 'tiempo → tempo · cierto → certo · siete → sette'], ['ue', 'o / uo', 'muerto → morto · fuerte → forte · bueno → buono · nuevo → nuovo'], ['h- inicial', 'f-', 'hijo → figlio · hacer → fare · hambre → fame · humo → fumo'], ['-j-', '-gli- / -cc- / gi-', 'hijo → figlio · mujer → moglie · ojo → occhio · joven → giovane'], ['g, d entre vocales', 'c, t', 'amigo → amico · vida → vita · todo → tutto · poder → potere']]],
    ['v', [['il dottore', 'el doctor'], ['ottobre', 'octubre'], ['pieno', 'lleno'], ['la chiave', 'la llave'], ['il tempo', 'el tiempo'], ['buono', 'bueno'], ['nuovo', 'nuevo'], ['il figlio', 'el hijo'], ['l\'occhio', 'el ojo'], ['la vita', 'la vida'], ['tutto', 'todo']]],
    ['h', 'Verbos'],
    ['p', 'Los infinitivos siguen el mismo patrón: <b>-ar → -are, -er → -ere, -ir → -ire</b>. <i>cantar → cantare, comprar → comprare, vender → vendere, partir → partire</i>. Muchos verbos comunes son distintos (<i>hablar = parlare</i>), pero el vocabulario culto y técnico, como el de medicina, casi siempre se puede adivinar: <i>diagnosticare, operare, prescrivere</i>.'],
    ['t', 'Probalo ahora: ¿cómo dirías "la situación", "la realidad", "la infección" y "el hospital"? → <i>la situazione, la realtà, l\'infezione, l\'ospedale</i>. Las adivinaste sin haberlas estudiado.'],
  ],
  tasks: ['Convertí 10 palabras de tu materia favorita al italiano usando las reglas y verificalas en un diccionario (WordReference).', 'Copiá las dos tablas de reglas en el cuaderno: son tu "decodificador".', 'Escribí 3 palabras donde la regla NO funcionó: esas son las que hay que memorizar.'],
  speak: ['la stazione', 'la città', 'possibile', 'il dottore', 'la chiave', 'il figlio', 'l\'ospedale'],
  quiz: [
    ['wr', 'Convertí al italiano: "la estación".', ['la stazione']],
    ['wr', 'Convertí: "la universidad".', ['l\'università', 'l università', 'luniversità', 'università']],
    ['mc', '"posible" en italiano:', 'possibile', ['posibile', 'possible', 'possibole']],
    ['mc', '"nuevo" en italiano:', 'nuovo', ['nuevo', 'novo', 'nuvo']],
    ['mc', '"hijo" en italiano:', 'figlio', ['hijo', 'figio', 'fillo']],
    ['wr', 'Convertí: "octubre".', ['ottobre']],
    ['mc', '"la llave" en italiano:', 'la chiave', ['la llave', 'la clave', 'la piave']],
    ['ls', 'la realtà', 'la realidad', ['la reina', 'la relación', 'la razón']],
  ] },

{ n: 102, w: 1, cat: 'glosarios', title: 'Falsos amigos: las trampas del español', goal: 'Evitar las palabras que parecen iguales pero significan otra cosa.',
  blocks: [
    ['p', 'La lección del atajo tiene una contracara: como entendés casi todo, tu cerebro va a "adivinar" también donde no debe. Los <i>falsi amici</i> son palabras casi iguales con significado distinto. Son pocas, pero algunas te pueden hacer pasar vergüenza (o pedir un burro en el desayuno).'],
    ['v', [['il burro', 'la manteca', 'burro (animal) = l\'asino'], ['caldo', 'caliente', 'caldo (sopa) = il brodo'], ['guardare', 'mirar', 'guardar = mettere via'], ['l\'aceto', 'el vinagre', 'aceite = l\'olio'], ['salire', 'subir', 'salir = uscire'], ['la camera', 'la habitación', 'cámara de fotos = la macchina fotografica'], ['la gamba', 'la pierna', 'gamba (marisco) = il gambero'], ['il topo', 'el ratón', 'topo (animal) = la talpa'], ['il vaso', 'el florero / el frasco', 'vaso para tomar = il bicchiere'], ['la tasca', 'el bolsillo'], ['subito', 'ya / enseguida', 'no es "súbitamente"'], ['largo', 'ancho', 'largo = lungo'], ['imbarazzato', 'avergonzado', 'embarazada = incinta'], ['fermare', 'parar / detener', 'firmar = firmare'], ['la carta', 'el papel', 'carta (mensaje) = la lettera'], ['morbido', 'blando / suave'], ['nudo', 'desnudo', 'nudo (de cuerda) = il nodo']]],
    ['h', 'Para la cancha y para la vida'],
    ['v', [['Che parata!', '¡Qué atajada!', 'parare = atajar'], ['il portiere', 'el arquero'], ['Che casino!', '¡Qué quilombo!'], ['Mi prendi in giro?', '¿Me estás cargando?'], ['Va bene.', 'Está bien / Dale.'], ['Magari!', '¡Ojalá!']]],
    ['t', 'Regla de supervivencia: si una palabra te suena igual al español pero la frase no tiene sentido, sospechá de un falso amigo. Y anotalos en una página aparte del cuaderno: es la lista que más vale la pena repasar.'],
  ],
  tasks: ['Armá en el cuaderno una página "Falsos amigos" con los de esta lección y sumá los que encuentres.', 'Escribí 5 frases con falsos amigos usados bien (ej.: Guardo la partita in camera).', 'Explicale en voz alta a alguien (o a vos mismo) por qué no hay que pedir "burro" en Italia.'],
  speak: ['il burro', 'Che parata!', 'Che casino!', 'subito', 'la camera', 'Mi prendi in giro?'],
  quiz: [
    ['mc', '«il burro» significa...', 'la manteca', ['el burro', 'el borrador', 'la burla']],
    ['mc', '«salire» significa...', 'subir', ['salir', 'saltar', 'saludar']],
    ['mc', '«guardare» significa...', 'mirar', ['guardar', 'cuidar', 'esperar']],
    ['mc', '«imbarazzata» significa...', 'avergonzada', ['embarazada', 'abrazada', 'enojada']],
    ['mc', '"embarazada" en italiano:', 'incinta', ['imbarazzata', 'embarazzata', 'grávida']],
    ['ls', 'Che parata!', '¡Qué atajada!', ['¡Qué parada!', '¡Qué partido!', '¡Qué desfile!']],
    ['mc', '«subito» significa...', 'ya / enseguida', ['súbitamente', 'subido', 'abajo']],
    ['wr', '¿Cómo se dice "el vaso" (para tomar agua)?', ['il bicchiere', 'bicchiere']],
  ] }
);

/* Orden final y bloques. Cada lección tiene un id estable: el progreso se guarda por id. */
(function () {
  const OLD = { 1: 'pron1', 2: 'pron2', 3: 'saludos', 4: 'essere', 5: 'numeri', 6: 'genere', 7: 'plurale', 8: 'articoli', 9: 'indeterminati', 10: 'avere',
    11: 'are', 12: 'ere-ire', 13: 'irregolari', 14: 'negazione', 15: 'aggettivi', 16: 'preposizioni', 17: 'prep-articolate', 18: 'ora', 19: 'data', 20: 'famiglia',
    21: 'lei', 22: 'modali', 23: 'riflessivi', 24: 'piacere', 25: 'corpo', 26: 'pp-avere', 27: 'pp-essere', 28: 'imperfetto', 29: 'futuro', 30: 'imperativo',
    101: 'atajo', 102: 'falsi' };
  const BLOCKS = [
    { title: 'Sonidos y el atajo del hispanohablante', goal: 'Leer cualquier palabra, aprovechar tu español, saludar y presentarte.', ids: ['pron1', 'pron2', 'atajo', 'saludos', 'essere'] },
    { title: 'Los verbos que más se usan', goal: 'Avere y el presente: contar qué hacés, preguntar y negar.', ids: ['avere', 'are', 'ere-ire', 'irregolari', 'negazione'] },
    { title: 'Cosas, personas y trampas', goal: 'Género, plural, artículos, "hay" y los falsos amigos.', ids: ['genere', 'plurale', 'articoli', 'indeterminati', 'falsi'] },
    { title: 'Describir y ubicar', goal: 'Números, adjetivos, preposiciones y tu familia.', ids: ['numeri', 'aggettivi', 'preposizioni', 'prep-articolate', 'famiglia'] },
    { title: 'El día a día', goal: 'La hora, la fecha, poder / querer / deber, tu rutina y tus gustos.', ids: ['ora', 'data', 'modali', 'riflessivi', 'piacere'] },
    { title: 'Como un adulto: formal, médico, pasado y futuro', goal: 'Hablar de usted, la consulta médica, contar tu historia y tus planes.', ids: ['lei', 'corpo', 'pp-avere', 'pp-essere', 'imperfetto', 'futuro', 'imperativo'] },
  ];
  const oldToId = {};
  for (const l of IT_LESSONS) { l.id = OLD[l.n]; oldToId[l.n] = l.id; }
  const byId = Object.fromEntries(IT_LESSONS.map((l) => [l.id, l]));
  const ordered = [];
  BLOCKS.forEach((b, i) => b.ids.forEach((id) => { const l = byId[id]; l.w = i + 1; ordered.push(l); }));
  ordered.forEach((l, i) => { l.n = i + 1; });
  IT_LESSONS.length = 0;
  IT_LESSONS.push(...ordered);
  IT_WEEKS.length = 0;
  BLOCKS.forEach((b, i) => IT_WEEKS.push({ n: i + 1, title: b.title, goal: b.goal }));
  for (const c of IT_TOPICS) c.items = c.items.map(([t, n]) => [t, n == null ? null : byId[oldToId[n]].n]);
  IT_TOPICS.find((c) => c.cat === 'pasos').items.splice(1, 0, ['El atajo del hispanohablante', byId.atajo.n]);
  IT_TOPICS.find((c) => c.cat === 'glosarios').items.splice(0, 0, ['Falsos amigos', byId.falsi.n]);
})();
