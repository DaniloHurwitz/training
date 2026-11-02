'use strict';
/* Curso de italiano — Módulo 2 (A2 → B1), resto del bloque 9 y bloques 10 y 11, y su lugar en el temario. */

IT_WEEKS.push(
  { n: 10, mod: 2, title: `El congiuntivo: opinar, desear, suponer`, goal: `El modo que más distingue un B1: penso che sia, se avessi tempo, avrei voluto.` },
  { n: 11, mod: 2, title: `Italiano para trabajar y vivir`, goal: `La pasiva, el trabajo freelance, la medicina, opinar y el italiano real de la calle y las redes.` },
);

IT_LESSONS.push(
{ id: `remoto`, n: 46, w: 9, cat: `verbo`, title: `Passato remoto: reconocerlo`, goal: `Entender el pasado de los libros, la historia y el sur de Italia, y producir la 3.ª persona.`,
  blocks: [
    ['p', `El passato remoto equivale a nuestro pretérito ("habló"). En el norte de Italia casi no se usa al hablar (dicen <i>ha parlato</i>), pero aparece en libros, en historia, en Wikipedia y en el habla del sur. Para B1 alcanza con <b>reconocerlo bien</b> y manejar la tercera persona, que es la que más vas a leer.`],
    ['c', `parlare (passato remoto)`, [`parlai`, `parlasti`, `parlò`, `parlammo`, `parlaste`, `parlarono`], [`hablé`, `hablaste`, `habló`, `hablamos`, `hablaron (ustedes)`, `hablaron (ellos)`]],
    ['p', `En <i>-ere</i>: <i>credetti, credesti, credette, credemmo, credeste, credettero</i>. En <i>-ire</i>: <i>dormii, dormisti, dormì, dormimmo, dormiste, dormirono</i>.`],
    ['h', `Irregulares en tercera persona (las que vas a leer)`],
    ['v', [[`essere → fu / furono`, `fue / fueron`], [`avere → ebbe / ebbero`, `tuvo / tuvieron`], [`fare → fece`, `hizo`], [`dire → disse`, `dijo`], [`nascere → nacque`, `nació`], [`vedere → vide`, `vio`], [`venire → venne`, `vino`], [`prendere → prese`, `tomó`], [`vincere → vinse`, `ganó`], [`scrivere → scrisse`, `escribió`]]],
    ['v', [[`Leonardo da Vinci nacque nel 1452.`, `Leonardo da Vinci nació en 1452.`], [`Dante scrisse la Divina Commedia.`, `Dante escribió la Divina Comedia.`], [`Maradona arrivò a Napoli nel 1984.`, `Maradona llegó a Nápoles en 1984.`], [`Il Napoli vinse lo scudetto nel 1987.`, `El Napoli ganó el campeonato en 1987.`], [`Fu un momento storico.`, `Fue un momento histórico.`]]],
  ],
  tasks: [`Buscá en Wikipedia en italiano la biografía de Messi o de Maradona y subrayá 10 verbos en passato remoto.`, `Pasá al passato remoto (3.ª persona): ha vinto, è nato, ha scritto, ha detto, è stato.`, `Escribí 3 hechos históricos en passato remoto.`],
  speak: [`Leonardo da Vinci nacque nel 1452`, `Maradona arrivò a Napoli nel 1984`, `Il Napoli vinse lo scudetto`, `Fu un momento storico`, `parlai, parlasti, parlò`],
  quiz: [
    ['mc', `«nacque» significa...`, `nació`, [`nadó`, `nace`, `nacerá`]],
    ['mc', `«disse» significa...`, `dijo`, [`dice`, `diría`, `diciendo`]],
    ['mc', `"habló" (passato remoto) =`, `parlò`, [`parlé`, `parlava`, `parlo`]],
    ['wr', `Passato remoto de «essere», 3.ª persona singular:`, [`fu`]],
    ['ls', `Dante scrisse la Divina Commedia.`, `Dante escribió la Divina Comedia.`, [`Dante leyó la Divina Comedia.`, `Dante escribe la Divina Comedia.`, `Dante descubrió la Divina Comedia.`]],
    ['mc', `«vinse» significa...`, `ganó`, [`vino`, `vio`, `vivió`]],
    ['mc', `¿Dónde se usa más el passato remoto al hablar?`, `En el sur de Italia`, [`En Milán`, `En ningún lado`, `Solo en Roma`]],
    ['wr', `Passato remoto de «fare», 3.ª persona singular:`, [`fece`]],
  ] },

{ id: `indiretto`, n: 47, w: 9, cat: `gramatica`, title: `Discurso indirecto: lo que dijo otro`, goal: `Contar lo que alguien dijo, preguntó o pidió, con los cambios de tiempo correctos.`,
  blocks: [
    ['p', `Si el verbo que introduce está en presente (<i>dice che</i>), no cambia nada: <i>Dice che è stanco</i>. Si está en pasado (<i>ha detto che</i>), los tiempos "retroceden", igual que en un español cuidado:`],
    ['tb', [`Lo que dijo`, `Cómo se cuenta`, `Ejemplo`], [[`presente`, `imperfecto`, `"Sono stanco" → Ha detto che era stanco.`], [`passato prossimo`, `trapassato`, `"Ho finito" → Ha detto che aveva finito.`], [`futuro`, `condicional PASADO`, `"Verrò" → Ha detto che sarebbe venuto.`], [`imperativo`, `di + infinitivo`, `"Aspetta!" → Mi ha detto di aspettare.`], [`pregunta`, `se / dove / quando...`, `"Vieni?" → Mi ha chiesto se venivo.`]]],
    ['p', `La fila del futuro es la trampa clásica. En español decimos "dijo que <b>vendría</b>" (condicional simple), pero en italiano va <b>condicional compuesto</b>: <i>ha detto che <b>sarebbe venuto</b></i>. Usar <i>verrebbe</i> ahí es un error típico de hispanohablante.`],
    ['h', `También cambian las referencias`],
    ['v', [[`oggi → quel giorno`, `hoy → ese día`], [`domani → il giorno dopo`, `mañana → al día siguiente`], [`ieri → il giorno prima`, `ayer → el día anterior`], [`qui → lì`, `acá → ahí`], [`questo → quello`, `este → ese`]]],
    ['v', [[`La supervisora ha detto che il turno sarebbe cominciato alle due.`, `La supervisora dijo que el turno empezaría a las dos.`], [`Mi ha chiesto se avevo finito il video.`, `Me preguntó si había terminado el video.`], [`Il professore ci ha detto di studiare il capitolo tre.`, `El profesor nos dijo que estudiáramos el capítulo tres.`]]],
  ],
  tasks: [`Pasá a indirecto con "ha detto che": "Domani vengo." "Ho perso il pullman." "Sono contento."`, `Contá una conversación real de esta semana en discurso indirecto (4 frases).`, `Pasá órdenes a indirecto: "Chiamami!" "Non dimenticare!"`],
  speak: [`Ha detto che era stanco`, `Ha detto che sarebbe venuto`, `Mi ha chiesto se avevo finito`, `Mi ha detto di aspettare`],
  quiz: [
    ['mc', `"Verrò" → Ha detto che...`, `sarebbe venuto`, [`verrebbe`, `verrà`, `veniva sempre`]],
    ['mc', `"Sono stanco" → Ha detto che...`, `era stanco`, [`è stato stanco`, `sarà stanco`, `fosse stanco sempre`]],
    ['mc', `"Aspetta!" → Mi ha detto...`, `di aspettare`, [`che aspetta`, `aspettare`, `a aspettare`]],
    ['wr', `"Vieni?" → Mi ha chiesto ___ venivo.`, [`se`]],
    ['ls', `Mi ha chiesto se avevo finito il video.`, `Me preguntó si había terminado el video.`, [`Me pidió que terminara el video.`, `Me dijo que había terminado el video.`, `Le pregunté si había terminado el video.`]],
    ['mc', `"domani" en discurso indirecto pasado →`, `il giorno dopo`, [`il giorno prima`, `quel domani`, `oggi`]],
    ['mc', `"Ho finito" → Ha detto che...`, `aveva finito`, [`ha finito`, `finiva`, `avrà finito`]],
    ['wr', `Traducí: "Dijo que vendría." (él)`, [`ha detto che sarebbe venuto`]],
  ] },

/* ================= BLOQUE 10 ================= */
{ id: `cong-presente`, n: 48, w: 10, cat: `verbo`, title: `Congiuntivo presente: cómo se forma`, goal: `Conjugar el subjuntivo presente, regular e irregular.`,
  blocks: [
    ['p', `Ventaja enorme: el español también tiene subjuntivo y lo usás sin pensar ("que sea", "que tenga"). El congiuntivo es su primo directo: <i>che sia, che abbia</i>. Para un inglés es lo más difícil del italiano; para vos, no tanto.`],
    ['tb', [`Persona`, `-are (parlare)`, `-ere (prendere)`, `-ire (dormire / capire)`], [[`che io`, `parli`, `prenda`, `dorma / capisca`], [`che tu`, `parli`, `prenda`, `dorma / capisca`], [`che lui / lei`, `parli`, `prenda`, `dorma / capisca`], [`che noi`, `parliamo`, `prendiamo`, `dormiamo / capiamo`], [`che voi`, `parliate`, `prendiate`, `dormiate / capiate`], [`che loro`, `parlino`, `prendano`, `dormano / capiscano`]]],
    ['p', `Fijate en el cruce, igual que en español: los <i>-are</i> toman <b>-i</b> (como "hable" toma e) y los <i>-ere / -ire</i> toman <b>-a</b> (como "coma"). Como io, tu y lui son iguales, se suele poner el pronombre: <i>che tu parli</i>.`],
    ['c', `essere (congiuntivo)`, [`sia`, `sia`, `sia`, `siamo`, `siate`, `siano`], [`que yo sea`, `que vos seas`, `que él sea`, `que seamos`, `que sean (ustedes)`, `que sean (ellos)`]],
    ['c', `avere (congiuntivo)`, [`abbia`, `abbia`, `abbia`, `abbiamo`, `abbiate`, `abbiano`], [`que yo tenga`, `que vos tengas`, `que él tenga`, `que tengamos`, `que tengan (ustedes)`, `que tengan (ellos)`]],
    ['h', `Irregulares (salen de la 1.ª persona del presente)`],
    ['v', [[`fare → che faccia`, `que haga`], [`andare → che vada`, `que vaya`], [`venire → che venga`, `que venga`], [`dire → che dica`, `que diga`], [`stare → che stia`, `que esté`], [`dare → che dia`, `que dé`], [`potere → che possa`, `que pueda`], [`volere → che voglia`, `que quiera`], [`dovere → che debba`, `que deba`], [`sapere → che sappia`, `que sepa`], [`uscire → che esca`, `que salga`]]],
    ['t', `Truco: la mayoría de los irregulares salen de la forma <i>io</i> del presente. <i>Faccio → faccia, vado → vada, vengo → venga, dico → dica, esco → esca</i>.`],
  ],
  tasks: [`Conjugá en congiuntivo: lavorare, scrivere, finire, fare, andare.`, `Escribí la forma "che io..." de los 11 irregulares de memoria.`, `Recitá essere y avere en congiuntivo en voz alta.`],
  speak: [`che io sia, che tu sia, che lui sia`, `che abbia`, `che faccia`, `che vada`, `che possa`],
  quiz: [
    ['mc', `Congiuntivo de «parlare» (che io):`, `parli`, [`parla`, `parlo`, `parlassi`]],
    ['mc', `Congiuntivo de «prendere» (che lui):`, `prenda`, [`prende`, `prendi`, `prendesse`]],
    ['mc', `Congiuntivo de «essere» (che loro):`, `siano`, [`sono`, `siino`, `fossero`]],
    ['wr', `Congiuntivo de «fare» (che io):`, [`faccia`, `che faccia`]],
    ['wr', `Congiuntivo de «avere» (che noi):`, [`abbiamo`, `che abbiamo`]],
    ['mc', `Congiuntivo de «capire» (che loro):`, `capiscano`, [`capiano`, `capiscono`, `capissero`]],
    ['mc', `Congiuntivo de «andare» (che tu):`, `vada`, [`vadi`, `vai`, `andi`]],
    ['mc', `Congiuntivo de «sapere» (che lei):`, `sappia`, [`sapia`, `sa`, `sappa`]],
  ] },

{ id: `cong-uso`, n: 49, w: 10, cat: `verbo`, title: `Congiuntivo: cuándo se usa`, goal: `Usar el congiuntivo donde el italiano lo pide, incluso donde el español no.`,
  blocks: [
    ['p', `La mayoría de los usos coinciden con el español (deseo, emoción, "para que"). Pero hay uno que <b>no coincide</b> y es el que delata a un hispanohablante: la <b>opinión</b>.`],
    ['tb', [`Después de...`, `Español`, `Italiano`], [[`opinión: penso, credo, mi sembra che`, `Creo que <b>es</b> difícil. (indicativo)`, `Credo che <b>sia</b> difficile. (congiuntivo)`], [`deseo: voglio, spero che`, `Espero que <b>vengas</b>.`, `Spero che tu <b>venga</b>.`], [`emoción: sono contento che`, `Me alegra que <b>estés</b> bien.`, `Sono contento che tu <b>stia</b> bene.`], [`duda: non so se, dubito che`, `Dudo que <b>llegue</b>.`, `Dubito che <b>arrivi</b>.`], [`impersonal: è importante, bisogna che`, `Es importante que <b>estudies</b>.`, `È importante che tu <b>studi</b>.`], [`conjunciones: benché, affinché, prima che, a meno che`, `aunque, para que, antes de que, a menos que`, `Benché sia stanco, studio.`]]],
    ['p', `Lo contrario: con certeza va indicativo, igual que en español. <i>So che è difficile</i> (Sé que es difícil). Y <b>secondo me</b> va con indicativo: <i>Secondo me è difficile</i>. Si no querés pensar, usá <i>secondo me</i>.`],
    ['v', [[`Penso che sia una buona idea.`, `Creo que es una buena idea.`], [`Credo che il Vélez vinca domenica.`, `Creo que Vélez gana el domingo.`], [`Spero che l'esame vada bene.`, `Espero que el examen salga bien.`], [`Mi sembra che tu abbia ragione.`, `Me parece que tenés razón.`], [`È meglio che tu dorma un po'.`, `Es mejor que duermas un poco.`], [`Te lo spiego affinché tu capisca.`, `Te lo explico para que entiendas.`], [`Prima che tu vada, ti do il mate.`, `Antes de que te vayas, te doy el mate.`]]],
    ['t', `En el italiano hablado de hoy muchos nativos dicen <i>penso che è</i>, pero en un examen, en un mail de trabajo o con un médico, el congiuntivo marca la diferencia entre B1 y A2.`],
  ],
  tasks: [`Escribí 5 opiniones sobre fútbol o la facultad con "penso / credo / mi sembra che".`, `Escribí 3 deseos con "spero che" para personas que querés.`, `Reescribí 2 de tus opiniones con "secondo me" (indicativo) y notá la diferencia.`],
  speak: [`Penso che sia una buona idea`, `Spero che l'esame vada bene`, `Mi sembra che tu abbia ragione`, `È meglio che tu dorma un po'`, `Secondo me è difficile`],
  quiz: [
    ['mc', `"Creo que es difícil" =`, `Credo che sia difficile`, [`Credo che è difficile`, `Credo che fosse difficile sempre`, `Credo essere difficile`]],
    ['mc', `"Sé que es difícil" =`, `So che è difficile`, [`So che sia difficile`, `So che fosse difficile`, `Sapevo che sia difficile`]],
    ['mc', `Secondo me il film ___ bello.`, `è`, [`sia`, `fosse`, `sarebbe stato`]],
    ['wr', `Completá: "Spero che l'esame ___ bene." (andare)`, [`vada`]],
    ['ls', `È meglio che tu dorma un po'.`, `Es mejor que duermas un poco.`, [`Es mejor que duerma un poco.`, `Mejor dormí un poco.`, `Es mejor dormir mucho.`]],
    ['mc', `"para que entiendas" =`, `affinché tu capisca`, [`perché tu capisci`, `per che capisci`, `affinché tu capisci`]],
    ['wr', `Completá: "Mi sembra che tu ___ ragione." (avere)`, [`abbia`]],
    ['mc', `¿Qué expresión de opinión va con indicativo?`, `secondo me`, [`penso che`, `credo che`, `mi sembra che`]],
  ] },

{ id: `ipotetico`, n: 50, w: 10, cat: `verbo`, title: `Congiuntivo imperfetto y "si yo fuera..."`, goal: `Hacer hipótesis: se avessi tempo, studierei; se fossi in te...`,
  blocks: [
    ['c', `parlare (congiuntivo imperfetto)`, [`parlassi`, `parlassi`, `parlasse`, `parlassimo`, `parlaste`, `parlassero`], [`que hablara`, `que hablaras`, `que hablara`, `que habláramos`, `que hablaran (ustedes)`, `que hablaran (ellos)`]],
    ['p', `Es muy regular: sacás <i>-re</i> y agregás <b>-ssi, -ssi, -sse, -ssimo, -ste, -ssero</b>: <i>avere → avessi, dormire → dormissi</i>. Irregulares: <i>essere → fossi</i>, <i>fare → facessi</i>, <i>dire → dicessi</i>, <i>dare → dessi</i>, <i>stare → stessi</i>.`],
    ['c', `essere (congiuntivo imperfetto)`, [`fossi`, `fossi`, `fosse`, `fossimo`, `foste`, `fossero`], [`que fuera`, `que fueras`, `que fuera`, `que fuéramos`, `que fueran (ustedes)`, `que fueran (ellos)`]],
    ['h', `El "periodo ipotetico"`],
    ['tb', [`Tipo`, `Estructura`, `Ejemplo`], [[`Real`, `se + presente → presente / futuro`, `Se piove, resto a casa.`], [`Posible / imaginario`, `se + congiuntivo imperfetto → condicional`, `Se avessi più tempo, studierei di più.`], [`Imposible (pasado)`, `se + congiuntivo trapassato → condicional pasado`, `Se avessi studiato, avrei passato l'esame.`]]],
    ['p', `Es exactamente el español ("si tuviera, haría"). El único error típico: <b>nunca condicional después de "se"</b>. <i>Se avrei tempo</i> está mal, igual que "si tendría" en español.`],
    ['v', [[`Se fossi in te, ci andrei.`, `Si fuera vos, iría.`], [`Se avessi più soldi, comprerei una macchina.`, `Si tuviera más plata, me compraría un auto.`], [`Se vivessi in Italia, parlerei italiano tutti i giorni.`, `Si viviera en Italia, hablaría italiano todos los días.`], [`Magari fosse vero!`, `¡Ojalá fuera verdad!`], [`Come se niente fosse.`, `Como si nada.`]]],
  ],
  tasks: [`Escribí 5 frases "Se avessi / se fossi... + condicional" sobre tu vida.`, `Corregí: "Se avrei tempo, studierei." "Se sarei ricco, comprerei una casa."`, `Escribí 2 frases de tipo real (se + presente).`],
  speak: [`Se fossi in te, ci andrei`, `Se avessi più tempo, studierei di più`, `Magari fosse vero!`, `Come se niente fosse`, `fossi, fossi, fosse, fossimo, foste, fossero`],
  quiz: [
    ['mc', `"Si tuviera tiempo, estudiaría" =`, `Se avessi tempo, studierei`, [`Se avrei tempo, studierei`, `Se ho tempo, studierei`, `Se avessi tempo, studiassi`]],
    ['mc', `"Si fuera vos..." =`, `Se fossi in te...`, [`Se sarei te...`, `Se ero in te...`, `Se fosse in tu...`]],
    ['wr', `Congiuntivo imperfetto de «avere» (che io):`, [`avessi`, `che avessi`]],
    ['mc', `Después de «se» (hipótesis) nunca va...`, `condicional`, [`congiuntivo imperfetto`, `presente`, `congiuntivo trapassato`]],
    ['ls', `Magari fosse vero!`, `¡Ojalá fuera verdad!`, [`¡Quizás es verdad!`, `¡Seguro que es verdad!`, `¡Ojalá no fuera verdad!`]],
    ['wr', `Congiuntivo imperfetto de «essere» (che lui):`, [`fosse`, `che fosse`]],
    ['mc', `"Si llueve, me quedo en casa" =`, `Se piove, resto a casa`, [`Se piovesse, resto a casa`, `Se pioverebbe, resto a casa`, `Se piove, resterei a casa sempre`]],
    ['mc', `"Como si nada" =`, `Come se niente fosse`, [`Come se niente era`, `Come niente sia`, `Come se niente sarebbe`]],
  ] },

{ id: `cond-passato`, n: 51, w: 10, cat: `verbo`, title: `Condicional pasado: avrei voluto`, goal: `Hablar de lo que hubieras hecho, de arrepentimientos y del futuro visto desde el pasado.`,
  blocks: [
    ['p', `Se forma con el <b>condicional de avere / essere + participio</b>: <i>avrei fatto</i> (habría hecho), <i>sarei andato</i> (habría ido).`],
    ['c', `fare (condicional pasado)`, [`avrei fatto`, `avresti fatto`, `avrebbe fatto`, `avremmo fatto`, `avreste fatto`, `avrebbero fatto`], [`habría hecho`, `habrías hecho`, `habría hecho`, `habríamos hecho`, `habrían hecho (ustedes)`, `habrían hecho (ellos)`]],
    ['h', `Tres usos`],
    ['v', [[`Avrei voluto venire, ma avevo un turno.`, `Habría querido ir, pero tenía un turno.`, `deseo no cumplido`], [`Al tuo posto avrei detto la verità.`, `En tu lugar habría dicho la verdad.`], [`Se avessi studiato di più, avrei passato ADN al primo colpo.`, `Si hubiera estudiado más, habría aprobado ADN de entrada.`, `hipótesis imposible`], [`Ha detto che sarebbe arrivato alle otto.`, `Dijo que llegaría a las ocho.`, `futuro en el pasado`], [`Sapevo che ce l'avresti fatta.`, `Sabía que lo ibas a lograr.`]]],
    ['t', `El tercer uso es exclusivo del italiano: el futuro visto desde el pasado va en condicional <b>compuesto</b>. "Sabía que vendrías" = <i>Sapevo che saresti venuto</i>. Ya lo viste en el discurso indirecto: acá está la regla general.`],
  ],
  tasks: [`Escribí 3 cosas que habrías hecho distinto en primer año de la facu.`, `Escribí 3 frases "Mi ha detto che + condicional pasado".`, `Escribí una frase completa de hipótesis imposible: "Se avessi..., avrei...".`],
  speak: [`Avrei voluto venire`, `Al tuo posto avrei detto la verità`, `Ha detto che sarebbe arrivato alle otto`, `Sapevo che ce l'avresti fatta`],
  quiz: [
    ['mc', `"Habría querido" =`, `avrei voluto`, [`vorrei voluto`, `avessi voluto`, `sarei voluto`]],
    ['mc', `"Habría ido" =`, `sarei andato`, [`avrei andato`, `andrei stato`, `fossi andato`]],
    ['mc', `"Sabía que vendrías" =`, `Sapevo che saresti venuto`, [`Sapevo che verresti`, `Sapevo che venivi sempre`, `Sapevo che fossi venuto`]],
    ['wr', `Traducí: "Habría hecho" (yo)`, [`avrei fatto`]],
    ['ls', `Se avessi studiato di più, avrei passato.`, `Si hubiera estudiado más, habría aprobado.`, [`Si estudio más, apruebo.`, `Si estudiara más, aprobaría.`, `Estudié más y aprobé.`]],
    ['mc', `"Si hubiera sabido" =`, `Se avessi saputo`, [`Se avrei saputo`, `Se sapessi stato`, `Se ho saputo`]],
    ['wr', `Completá: "Ha detto che ___ arrivato alle otto."`, [`sarebbe`]],
    ['mc', `"En tu lugar habría dicho la verdad" =`, `Al tuo posto avrei detto la verità`, [`Al tuo posto direi stato la verità`, `Al tuo posto avessi detto la verità`, `Nel tuo posto ho detto la verità`]],
  ] },

{ id: `imp-pronomi`, n: 52, w: 10, cat: `verbo`, title: `Imperativo con pronombres`, goal: `Dar indicaciones naturales: dimmelo, mi dica, non farlo, andiamoci.`,
  blocks: [
    ['p', `Con <b>tu, noi y voi</b>, los pronombres se pegan al final, como en español: <i>Aspettami</i> (Esperame), <i>Mandamelo</i> (Mandámelo). Con <b>Lei</b> van adelante: <i>Mi dica</i> (Dígame), <i>Si accomodi</i> (Tome asiento).`],
    ['v', [[`Aspettami!`, `¡Esperame!`], [`Mandamelo per email.`, `Mandámelo por mail.`], [`Alzati, è tardi!`, `¡Levantate, es tarde!`], [`Facciamolo insieme.`, `Hagámoslo juntos.`], [`Andiamoci!`, `¡Vamos (allá)!`], [`Mi dica.`, `Dígame. (formal)`], [`Me lo dia, per favore.`, `Démelo, por favor. (formal)`]]],
    ['h', `Los cortitos duplican la consonante`],
    ['p', `Con los imperativos de una sílaba (<i>di', fa', da', va', sta'</i>), la consonante del pronombre se duplica. Y <b>gli</b> no se duplica nunca.`],
    ['v', [[`Dimmi!`, `¡Decime!`], [`Fammi vedere.`, `Mostrame. (dejame ver)`], [`Dammi una mano.`, `Dame una mano.`], [`Vacci tu.`, `Andá vos.`], [`Stammi bene!`, `¡Cuidate! (despedida)`], [`Digli la verità.`, `Decile la verdad (a él).`]]],
    ['h', `Negativo`],
    ['p', `Con <i>tu</i>: <b>non + infinitivo</b>, y el pronombre va adelante o pegado: <i>Non farlo</i> o <i>Non lo fare</i>. <i>Non ti preoccupare</i> o <i>Non preoccuparti</i>: las dos formas son correctas.`],
  ],
  tasks: [`Escribí 5 pedidos a tus hermanas con pronombres pegados (passami il sale → passamelo).`, `Escribí 4 indicaciones formales a un paciente con Lei (Si sieda, Mi dica, Lo prenda...).`, `Escribí 3 prohibiciones con "non + infinitivo + pronombre".`],
  speak: [`Dimmi!`, `Fammi vedere`, `Dammi una mano`, `Mandamelo per email`, `Mi dica`, `Non preoccuparti`],
  quiz: [
    ['mc', `"¡Decime!" =`, `Dimmi!`, [`Dimi!`, `Mi di'!`, `Dici mi!`]],
    ['mc', `"Dígame" (formal) =`, `Mi dica`, [`Dicami`, `Dimmi`, `Mi dici`]],
    ['mc', `"No lo hagas" =`, `Non farlo`, [`Non fallo`, `Non lo fai`, `Non fa'lo`]],
    ['wr', `Traducí: "¡Esperame!"`, [`aspettami`, `aspettami!`]],
    ['ls', `Dammi una mano.`, `Dame una mano.`, [`Te doy una mano.`, `Dale una mano.`, `Dame la mano.`]],
    ['mc', `"Decile la verdad" (a él) =`, `Digli la verità`, [`Diggli la verità`, `Dilli la verità`, `Gli di' la verità sempre`]],
    ['wr', `Traducí: "Mandámelo." (tu)`, [`mandamelo`]],
    ['mc', `"Tome asiento" (formal) =`, `Si accomodi`, [`Accomodati`, `Accomodasi`, `Si accomoda`]],
  ] },

/* ================= BLOQUE 11 ================= */
{ id: `passiva`, n: 53, w: 11, cat: `verbo`, title: `La voz pasiva`, goal: `Leer y escribir textos formales y médicos con la pasiva: è stato operato, viene ricoverato, va compilato.`,
  blocks: [
    ['p', `La pasiva es <b>essere + participio (+ da)</b>, como en español "ser + participio (+ por)". El participio concuerda con el sujeto: <i>La paziente è stata operata dal neurochirurgo</i>.`],
    ['v', [[`Il paziente è stato operato ieri.`, `El paciente fue operado ayer.`], [`La paziente è stata dimessa.`, `La paciente fue dada de alta.`], [`Il video è stato montato da Danilo.`, `El video fue editado por Danilo.`], [`Il contratto sarà firmato domani.`, `El contrato será firmado mañana.`]]],
    ['h', `Con venire: proceso`],
    ['p', `En los tiempos simples se puede usar <b>venire</b> en lugar de essere para remarcar la acción: <i>Il paziente viene operato</i> (está siendo operado / lo operan) frente a <i>è operato</i>, que puede sonar a estado.`],
    ['h', `Con andare: obligación`],
    ['p', `<b>Andare + participio</b> = "tiene que ser": <i>Il modulo va compilato</i> (El formulario tiene que completarse). Es muy común en instrucciones, hospitales y trabajo.`],
    ['v', [[`Il paziente viene ricoverato in neurologia.`, `Al paciente lo internan en neurología.`], [`Questo farmaco va preso a stomaco pieno.`, `Este medicamento se tiene que tomar con el estómago lleno.`], [`I commenti offensivi vanno segnalati.`, `Los comentarios ofensivos tienen que reportarse.`], [`Si vendono biglietti online.`, `Se venden entradas online.`, `si passivante (lección 45)`]]],
  ],
  tasks: [`Pasá a pasiva: Il chirurgo opera il paziente. Danilo ha montato il video. Il professore correggerà gli esami.`, `Escribí 3 instrucciones de hospital con "va / vanno + participio".`, `Escribí 2 frases con venire + participio.`],
  speak: [`Il paziente è stato operato ieri`, `La paziente è stata dimessa`, `Il modulo va compilato`, `I commenti offensivi vanno segnalati`],
  quiz: [
    ['mc', `"La paciente fue operada" =`, `La paziente è stata operata`, [`La paziente ha stato operata`, `La paziente è stato operato`, `La paziente è stata operato`]],
    ['mc', `"El formulario tiene que completarse" =`, `Il modulo va compilato`, [`Il modulo viene compilare`, `Il modulo deve compilato`, `Il modulo va a compilare`]],
    ['mc', `"Lo internan" (proceso) =`, `Viene ricoverato`, [`Va ricoverato sempre`, `Ha ricoverato`, `Si ricovera lui`]],
    ['wr', `Traducí: "El paciente fue operado."`, [`il paziente è stato operato`]],
    ['ls', `Questo farmaco va preso a stomaco pieno.`, `Este medicamento se tiene que tomar con el estómago lleno.`, [`Este medicamento se toma en ayunas.`, `Este medicamento va al estómago.`, `Tomé este medicamento con el estómago lleno.`]],
    ['mc', `Agente de la pasiva ("por el cirujano") =`, `dal chirurgo`, [`per il chirurgo`, `del chirurgo`, `con il chirurgo`]],
    ['wr', `Completá: "I commenti offensivi ___ segnalati." (tienen que)`, [`vanno`]],
    ['mc', `En la pasiva con essere, el participio...`, `concuerda con el sujeto`, [`no cambia nunca`, `concuerda con el agente`, `va siempre en masculino`]],
  ] },

{ id: `lavoro`, n: 54, w: 11, cat: `practico`, title: `Italiano para trabajar: freelance y mails`, goal: `Presentarte profesionalmente, hablar de tarifas y plazos y escribir mails de trabajo.`,
  blocks: [
    ['h', `Vocabulario de trabajo`],
    ['v', [[`il lavoro / lavorare`, `el trabajo / trabajar`], [`il libero professionista`, `el freelance`], [`il cliente`, `el cliente`], [`la tariffa`, `la tarifa`], [`il preventivo`, `el presupuesto`], [`la fattura`, `la factura`], [`la scadenza`, `el plazo / la fecha límite`], [`consegnare`, `entregar`], [`il montaggio video`, `la edición de video`], [`i sottotitoli`, `los subtítulos`], [`la moderazione dei contenuti`, `la moderación de contenidos`], [`lavorare da remoto`, `trabajar en remoto`], [`il colloquio`, `la entrevista`], [`lo stipendio`, `el sueldo`]]],
    ['h', `Presentarte`],
    ['v', [[`Mi occupo di montaggio video e moderazione dei contenuti.`, `Me dedico a la edición de video y la moderación de contenidos.`], [`Lavoro da remoto con clienti internazionali.`, `Trabajo en remoto con clientes internacionales.`], [`La mia tariffa è di venticinque dollari all'ora.`, `Mi tarifa es de 25 dólares la hora.`], [`Posso consegnare entro venerdì.`, `Puedo entregar antes del viernes.`], [`Le mando un preventivo.`, `Le mando un presupuesto.`]]],
    ['h', `El mail de trabajo`],
    ['v', [[`Gentile signora Rossi,`, `Estimada señora Rossi:`], [`La ringrazio per avermi contattato.`, `Le agradezco por haberme contactado.`], [`In allegato trova il video finale.`, `Adjunto encontrará el video final.`], [`Mi faccia sapere se ci sono modifiche.`, `Avíseme si hay cambios.`], [`Resto in attesa di un Suo riscontro.`, `Quedo a la espera de su respuesta.`], [`Cordiali saluti`, `Saludos cordiales`]]],
    ['t', `Todo lo de los bloques 7 a 10 aparece acá: pasiva, imperativo formal (<i>mi faccia sapere</i>), pronombres (<i>La ringrazio</i>) y congiuntivo (<i>spero che il video Le piaccia</i>).`],
  ],
  tasks: [`Escribí tu presentación profesional en italiano (5 líneas), como para un perfil de Upwork.`, `Escribí un mail completo entregando un reel a un cliente italiano.`, `Leé tu presentación en voz alta y grabala: es tu pitch en italiano.`],
  speak: [`Mi occupo di montaggio video`, `Lavoro da remoto con clienti internazionali`, `Posso consegnare entro venerdì`, `In allegato trova il video finale`, `Resto in attesa di un Suo riscontro`],
  quiz: [
    ['mc', `"el presupuesto" =`, `il preventivo`, [`il presupposto`, `la fattura`, `il budget sempre`]],
    ['mc', `"la fecha límite" =`, `la scadenza`, [`la data finale`, `il limite`, `la consegna`]],
    ['wr', `Traducí: "la edición de video"`, [`il montaggio video`, `montaggio video`]],
    ['ls', `In allegato trova il video finale.`, `Adjunto encontrará el video final.`, [`Allá encontrará el video final.`, `El video final está en camino.`, `Encontré el video final adjunto.`]],
    ['mc', `"Avíseme" (formal) =`, `Mi faccia sapere`, [`Fammi sapere`, `Mi fa sapere`, `Mi faccio sapere`]],
    ['wr', `Traducí: "Puedo entregar antes del viernes."`, [`posso consegnare entro venerdì`, `posso consegnare entro venerdi`]],
    ['mc', `"el freelance" =`, `il libero professionista`, [`il lavoratore libero`, `il freelance obbligatorio`, `il professionista sciolto`]],
    ['mc', `"Quedo a la espera de su respuesta" =`, `Resto in attesa di un Suo riscontro`, [`Aspetto la tua risposta sempre`, `Sto aspettando di te`, `Rimango risposta Sua`]],
  ] },

{ id: `medicina2`, n: 55, w: 11, cat: `glosarios`, title: `Medicina II: hospital, especialidades y anamnesis`, goal: `Manejar el italiano de hospital: servicios, estudios, síntomas neurológicos y una anamnesis completa.`,
  blocks: [
    ['h', `El hospital`],
    ['v', [[`il pronto soccorso`, `la guardia / emergencias`], [`il reparto`, `el servicio / la sala`], [`la sala operatoria`, `el quirófano`], [`la terapia intensiva`, `la terapia intensiva`], [`la cartella clinica`, `la historia clínica`], [`la ricetta`, `la receta`], [`ricoverare / dimettere`, `internar / dar de alta`], [`lo specializzando`, `el residente`], [`il primario`, `el jefe de servicio`], [`la specializzazione`, `la residencia / especialización`]]],
    ['h', `Especialidades y estudios`],
    ['v', [[`la neurochirurgia`, `la neurocirugía`], [`la neurologia`, `la neurología`], [`la cardiologia`, `la cardiología`], [`la medicina interna`, `la clínica médica`], [`la TAC`, `la tomografía`], [`la risonanza magnetica`, `la resonancia magnética`], [`l'elettroencefalogramma`, `el electroencefalograma`], [`gli esami del sangue`, `los análisis de sangre`]]],
    ['h', `Síntomas neurológicos`],
    ['v', [[`il mal di testa / la cefalea`, `el dolor de cabeza / la cefalea`], [`le vertigini`, `los mareos / el vértigo`], [`la nausea`, `las náuseas`], [`il formicolio`, `el hormigueo`], [`la perdita di coscienza`, `la pérdida de conocimiento`], [`le convulsioni`, `las convulsiones`], [`la debolezza a un braccio`, `la debilidad en un brazo`]]],
    ['d', [[`Specializzando`, `Buongiorno, signor Bianchi. Che cosa La porta qui?`, `Buen día, señor Bianchi. ¿Qué lo trae por acá?`], [`Paziente`, `Da tre giorni ho un mal di testa fortissimo.`, `Hace tres días que tengo un dolor de cabeza fortísimo.`], [`Specializzando`, `Ha avuto nausea o vertigini? Ha mai perso conoscenza?`, `¿Tuvo náuseas o mareos? ¿Perdió el conocimiento alguna vez?`], [`Paziente`, `Nausea sì, ma non ho mai perso conoscenza.`, `Náuseas sí, pero nunca perdí el conocimiento.`], [`Specializzando`, `Va bene. Facciamo una TAC per stare tranquilli.`, `Bien. Hagamos una tomografía para quedarnos tranquilos.`]]],
    ['v', [[`Vorrei fare la specializzazione in neurochirurgia.`, `Quisiera hacer la residencia en neurocirugía.`], [`Il paziente è stato ricoverato in neurochirurgia.`, `El paciente fue internado en neurocirugía.`]]],
  ],
  tasks: [`Escribí 8 preguntas de anamnesis neurológica en italiano, con Lei.`, `Hacé el diálogo en voz alta como especializzando.`, `Escribí en italiano qué especialidad querés hacer y por qué (4 frases, con congiuntivo si podés).`],
  speak: [`Che cosa La porta qui?`, `Ha mai perso conoscenza?`, `Facciamo una TAC`, `Vorrei fare la specializzazione in neurochirurgia`, `la risonanza magnetica`],
  quiz: [
    ['mc', `"la guardia / emergencias" =`, `il pronto soccorso`, [`la guardia medica sempre`, `l'emergenza rapida`, `il soccorso pronto`]],
    ['mc', `"el residente" =`, `lo specializzando`, [`il residente`, `il primario`, `l'interno`]],
    ['mc', `"dar de alta" =`, `dimettere`, [`ricoverare`, `dare l'alta via`, `alzare`]],
    ['wr', `Traducí: "la tomografía" (sigla)`, [`la tac`, `tac`]],
    ['ls', `Ha mai perso conoscenza?`, `¿Perdió el conocimiento alguna vez?`, [`¿Conoce a alguien que perdió algo?`, `¿Perdió la memoria?`, `¿Nunca perdió el conocimiento?`]],
    ['mc', `"el hormigueo" =`, `il formicolio`, [`la formica`, `il formicaio`, `lo sformicolio`]],
    ['wr', `Traducí: "el quirófano"`, [`la sala operatoria`, `sala operatoria`]],
    ['mc', `"la historia clínica" =`, `la cartella clinica`, [`la storia clinica`, `la carta clinica`, `il diario clinico`]],
  ] },

{ id: `opinare`, n: 56, w: 11, cat: `practico`, title: `Opinar y debatir`, goal: `Dar tu opinión, estar de acuerdo o no, matizar y argumentar como en un B1.`,
  blocks: [
    ['v', [[`Secondo me...`, `Para mí...`, `+ indicativo`], [`Penso / Credo che...`, `Creo que...`, `+ congiuntivo`], [`Sono d'accordo.`, `Estoy de acuerdo.`], [`Non sono d'accordo.`, `No estoy de acuerdo.`], [`Hai ragione, però...`, `Tenés razón, pero...`], [`Dipende.`, `Depende.`], [`Da un lato... dall'altro...`, `Por un lado... por el otro...`], [`Il fatto è che...`, `El tema es que...`], [`In realtà...`, `En realidad...`], [`Anzi!`, `¡Al contrario! / ¡Es más!`], [`Non è vero che...`, `No es cierto que...`, `+ congiuntivo`], [`Insomma...`, `En fin... / En resumen...`]]],
    ['d', [[`Esteban`, `Secondo me il Vélez quest'anno non vince niente.`, `Para mí Vélez este año no gana nada.`], [`Danilo`, `Non sono d'accordo. Il fatto è che il centrocampo è migliorato tantissimo.`, `No estoy de acuerdo. El tema es que el mediocampo mejoró muchísimo.`], [`Esteban`, `Sì, però la difesa è un disastro.`, `Sí, pero la defensa es un desastre.`], [`Danilo`, `Da un lato hai ragione, dall'altro penso che l'allenatore sappia cosa fa.`, `Por un lado tenés razón, por el otro creo que el técnico sabe lo que hace.`], [`Esteban`, `Vedremo!`, `¡Ya veremos!`]]],
    ['t', `Una técnica simple para sonar B1: <b>opinión + motivo + ejemplo</b>. <i>Secondo me... perché... Per esempio...</i>. Si cada vez que opinás sumás los tres, tu italiano sube de nivel.`],
  ],
  tasks: [`Escribí tu opinión sobre 3 temas (Messi o Maradona, estudiar con IA, vivir en Pico o en Mar del Plata) con opinión + motivo + ejemplo.`, `Leé el diálogo en voz alta haciendo de Danilo.`, `Grabate un minuto opinando de fútbol sin parar.`],
  speak: [`Secondo me hai ragione`, `Non sono d'accordo`, `Da un lato hai ragione, dall'altro no`, `Il fatto è che...`, `Vedremo!`],
  quiz: [
    ['mc', `"Para mí" (+ indicativo) =`, `Secondo me`, [`Per me che`, `Secondo che`, `A me mi`]],
    ['mc', `Non è vero che il Vélez ___ male.`, `giochi`, [`gioca`, `giocherebbe`, `giocasse sempre`]],
    ['mc', `"¡Al contrario! / ¡Es más!" =`, `Anzi!`, [`Contro!`, `Invece no!`, `Anche!`]],
    ['wr', `Traducí: "No estoy de acuerdo."`, [`non sono d'accordo`, `non sono daccordo`]],
    ['ls', `Il fatto è che il centrocampo è migliorato.`, `El tema es que el mediocampo mejoró.`, [`El hecho es que el equipo empeoró.`, `El tema es que la defensa mejoró.`, `Hicieron que el medio campo mejore.`]],
    ['mc', `"Por un lado... por el otro..." =`, `Da un lato... dall'altro...`, [`Per un lato... per l'altro...`, `Di un lato... d'altro...`, `Dal lato... al lato...`]],
    ['wr', `Traducí: "Depende."`, [`dipende`]],
    ['mc', `"¡Ya veremos!" =`, `Vedremo!`, [`Vediamo già!`, `Abbiamo visto!`, `Vedere!`]],
  ] },

{ id: `colloquiale`, n: 57, w: 11, cat: `practico`, title: `Italiano real: calle, redes y moderación`, goal: `Entender cómo hablan y escriben los italianos de verdad, incluido el italiano de redes.`,
  blocks: [
    ['p', `Los libros enseñan un italiano prolijo; en la calle y en los comentarios vas a encontrar esto. Para un moderador de contenido es justo lo más importante.`],
    ['h', `Palabras de todos los días`],
    ['v', [[`Boh.`, `Ni idea.`], [`Dai!`, `¡Dale! / ¡Vamos! / ¡Dale, no seas así!`], [`Figurati!`, `¡De nada! / ¡Ni lo menciones! / ¡Imaginate!`], [`Magari!`, `¡Ojalá!`], [`Meno male.`, `Menos mal.`], [`Mica male!`, `¡Nada mal!`], [`Che figata!`, `¡Qué bueno! / ¡Qué genial!`], [`Che palle!`, `¡Qué embole!`, `vulgar suave`], [`Ci sta.`, `Tiene sentido / Está bien.`], [`Tipo...`, `Tipo... / Como...`], [`Raga!`, `¡Chicos!`], [`Allora?`, `¿Y? / ¿Entonces?`]]],
    ['h', `Italiano de redes`],
    ['v', [[`cmq`, `comunque (igual)`], [`nn`, `non (no)`], [`xké / xchè`, `perché`], [`tvb`, `ti voglio bene (te quiero)`], [`grz`, `grazie`], [`ahahah`, `jajaja`], [`top`, `excelente`]]],
    ['h', `Vocabulario de moderación`],
    ['v', [[`il commento`, `el comentario`], [`segnalare`, `reportar`], [`nascondere / eliminare`, `ocultar / eliminar`], [`un contenuto offensivo`, `un contenido ofensivo`], [`lo spam`, `el spam`], [`la truffa`, `la estafa`], [`un insulto`, `un insulto`], [`il linguaggio d'odio`, `el discurso de odio`], [`la recensione`, `la reseña`], [`il reclamo`, `el reclamo`]]],
    ['t', `Para tu oído: escuchá podcasts y mirá series en italiano con subtítulos en italiano. El salto de B1 a B2 se hace con horas de input real, no con más gramática.`],
  ],
  tasks: [`Abrí los comentarios de un post de un club italiano en Instagram y clasificá 10: neutral, positivo, negativo, para reportar.`, `Traducí 5 comentarios reales al español rioplatense.`, `Escribí 5 frases usando expresiones de esta lección.`],
  speak: [`Boh`, `Dai!`, `Figurati!`, `Che figata!`, `Meno male`, `Ci sta`],
  quiz: [
    ['mc', `«Boh» significa...`, `Ni idea`, [`Bueno`, `Basta`, `¡Uh!`]],
    ['mc', `«Figurati» como respuesta a "Grazie!" significa...`, `¡De nada! / ¡Ni lo menciones!`, [`¡Imaginate!`, `¡Fijate!`, `¡Figura!`]],
    ['mc', `«cmq» =`, `comunque`, [`come mai`, `con me qui`, `comunicazione`]],
    ['wr', `Traducí: "reportar (un comentario)"`, [`segnalare`]],
    ['ls', `Che figata!`, `¡Qué genial!`, [`¡Qué feo!`, `¡Qué figura!`, `¡Qué embole!`]],
    ['mc', `"la estafa" =`, `la truffa`, [`lo scam sempre`, `la stafa`, `la trappola`]],
    ['mc', `«tvb» =`, `ti voglio bene`, [`ti vedo bene`, `tutto va bene`, `tra voi bene`]],
    ['wr', `Traducí: "el discurso de odio"`, [`il linguaggio d'odio`, `linguaggio d'odio`, `il discorso d'odio`, `discorso d'odio`]],
  ] }
);

/* El Módulo 2 completa el temario */
(function () {
  const byId = Object.fromEntries(IT_LESSONS.map((l) => [l.id, l.n]));
  const link = { 'Condicional': 'condizionale', 'Passato remoto': 'remoto', 'Pluscuamperfecto': 'trapassato', 'La pasiva': 'passiva', 'Impersonales': 'si-impersonale', 'Subjuntivo': 'cong-presente',
    'Conjunciones': 'connettivi', 'Adverbios': 'avverbi', 'Comparativo y superlativo': 'comparativi', 'Oraciones relativas': 'relativi', 'Oraciones subordinadas': 'cong-uso' };
  for (const c of IT_TOPICS) c.items = c.items.map(([t, n]) => [t, n == null && link[t] ? byId[link[t]] : n]);
  const add = (cat, items) => IT_TOPICS.find((c) => c.cat === cat).items.push(...items.map(([t, id]) => [t, byId[id]]));
  add('verbo', [['Gerundio y stare per', 'gerundio'], ['Usos del subjuntivo', 'cong-uso'], ['Si yo fuera... (periodo ipotetico)', 'ipotetico'], ['Condicional pasado', 'cond-passato'], ['Imperativo con pronombres', 'imp-pronomi']]);
  add('gramatica', [['Pronombres directos', 'diretti'], ['Pronombres indirectos', 'indiretti'], ['Pronombres combinados', 'combinati'], ['Ci y ne', 'ci-ne'], ['Discurso indirecto', 'indiretto']]);
  add('practico', [['Italiano para trabajar', 'lavoro'], ['Opinar y debatir', 'opinare'], ['Italiano de la calle y las redes', 'colloquiale']]);
  add('glosarios', [['Medicina: hospital y especialidades', 'medicina2']]);
})();
