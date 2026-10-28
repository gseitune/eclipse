# Circuito Intermedios + temporada anual

Feature: habilitar el circuito Intermedios con el mismo motor que Principiantes,
separar los circuitos por temporada anual y permitir elegir el formato de set al
crear la etapa.
Rama: `feat/selvarena-front` · Runner: `node --import tsx --test`

## Specs

- **S1.** Circuito = temporada anual. La identidad de agrupación es
  (categoría, año): `Principiantes 2026` e `Intermedios 2026` son circuitos
  distintos, y `Intermedios 2027` es uno nuevo que arranca de cero.
- **S2.** Etapa = torneo de un día, con el desarrollo actual (zonas, fixture,
  llaves, resultados, cierre). No cambia su mecánica por circuito.
- **S3.** Tabla anual = puntaje individual de los puntos ganados en el circuito.
  Se calcula igual en los dos circuitos, pero cada uno tiene su propia tabla.
- **S4.** El switch `Principiantes / Intermedios` decide qué tabla y qué datos se
  muestran. Las dos tablas nunca se mezclan.
- **S5.** En el panel, dentro de "Crear Etapa", arriba de "Número del circuito
  (Etapa)", hay un desplegable para elegir si la etapa es de Principiantes o de
  Intermedios.
- **S6.** La numeración de etapas reinicia por circuito: `Etapa 1` existe una vez
  por circuito.
- **S7.** Los dos circuitos viven en la misma base de producción. No hay segunda
  base ni segundo proyecto Prisma.
- **S8.** 2026 es la primera temporada con el sistema. La tabla suma desde cero
  cada año y el selector de temporada recién aparece cuando el circuito tiene
  más de una temporada cargada.
- **S9.** Al crear la etapa se elige el formato de set, en los dos circuitos, y
  aplica a todos los partidos de esa etapa (final incluida). Formatos:
  1 set a 21, o 2 sets a 21 con tercer set a 15 si quedan 1–1. Las etapas
  existentes, sin formato elegido, mantienen la convención por instancia.
- **S10.** El historial de Intermedios se carga con partidos y sets completos, como
  etapas cerradas reales, para que la tabla anual se calcule sola.
- **S11.** El plantel de una etapa sigue congelado una vez cargado.
- **S12.** Orden de la tabla de zona (decidido 2026-10-28): partidos ganados →
  diferencia de sets → diferencia de puntos → puntos a favor → mano a mano
  (último recurso, solo dentro de la zona). Nombre e id nunca desempatan; un
  empate que sobrevive a todo bloquea la llave. Pendientes de Andi que no
  bloquean el modelo: rango de equipos de Intermedios y escala de puntos.

## Tasks

- **T1.** ✅ Modelo: `Circuit` y `season` en `Etapa`, `setFormat` opcional en
  `Etapa`, y el valor nuevo de formato (2×21 + tercero a 15). Migración
  `20261020120000_add_circuit_season_setformat` aplicada en `dev.db` (backup
  previo en el temp del sistema). Sin aplicar a producción.
- **T2.** ✅ Backend: `resolveEtapaId(etapaId, circuit, season)`,
  `listEtapas(circuit, season)` y numeración reiniciando por circuito con
  `max(sortOrder) + 1` (el `count() + 1` anterior colisionaba con el índice único
  cuando faltaba una etapa intermedia).
- **T3.** ✅ API: `?circuit=`/`?season=` en `state`, `etapas` y `ranking`;
  valores inválidos devuelven 400 y `/api/state` respeta el status del error.
  `POST /api/etapas` acepta y valida `circuit`, `season`, `bracketFormat` y
  `setFormat`.
- **T4.** ✅ Panel: desplegable de circuito arriba de "Número del circuito
  (Etapa)", lista y numeración por circuito, y el panel entero sigue el circuito
  elegido (`useLiveState({ circuit })`).
- **T5.** ✅ `setCapFor()` define el tope por set; `recordResult`/`editResult`
  usan el formato elegido por la etapa por encima de la convención por instancia;
  selector "Formato de los partidos" al crear (por instancia / 1 set a 21 /
  2 sets a 21 + tercero a 15). ✅ Entrada multi-set en el panel: segundo set y
  tercero condicional (solo con 1-1), validación cliente con `describeSetProblem`,
  y selector de formato por partido cuando la etapa va "por instancia" y la
  instancia admite más de uno (semis: 1×21 o 2×15).
- **T6.** Pendiente. Home: el switch pide datos reales de cada circuito.
- **T7.** Pendiente. Selector de temporada, visible solo con más de una.
- **T8.** Pendiente. Import del historial de Intermedios (bloqueado).
- **T9.** Pendiente. Verificación final.

## Log

- **L1.** Pedido original (verbatim): "Primero quiero que, dentro del Panel
  Organizador. La card de 'etapa finalizada' unicamente aparezca 15 minutos
  despues de apretar el boton de Finalizar etapa. Y que despues se oculte dicha
  Card." — implementado y cerrado.
- **L2.** Pedido del circuito Intermedios (verbatim): "Quiero que analices que
  pasos deberiamos hacer para habilitar la seccion Intermedios y que el mismo
  sistema que funcione permita Generar el torneo para Intermedios. 1) En el panel
  de organizador. Dentro de 'Crear Etapa' En la parte superior de la card de
  creacion de etapa tiene que haber una opcion desplegable, (arriba de la
  eleccion de numero del circuito) de si crear una etapa para Principiantes o
  para Intermedios. 2) Quiero que veamos que cambios deberiamos generar en el
  backend para que tome la misma base de produccion del circuito principiante.
  3) Hay que tener en cuenta que el circuito principiante y el intermedio son dos
  cosas diferentes. Solo tienen en comun, que se organizan de la misma forma.
  4) Luego te pasare los datos de las etapas pasadas de intermedio para que se
  cargue como historial y genere la tabla anual".
- **L3.** Terminología fijada por el usuario (verbatim): "Circuito = Temporada
  Anual. Etapas = Torneos de 1 dia con el desarrollo que hicimos. Tabla anual =
  Puntaje individual de los puntos ganados en el circuito".
- **L4.** Decisión: "Los dos circuitos lo eligen" — el formato de set se elige al
  crear la etapa en ambos circuitos y aplica a todos los partidos.
- **L5.** Evidencia de la Etapa 6 de Intermedios (planilla de Andi): 6 parejas, 2
  zonas de 3, formato de llave repechaje (A2 vs B3, B2 vs A3), 12 partidos, una
  cancha cada 40 minutos. Encabezado del fixture (verbatim): "Una cancha · 40 min
  por partido estimados · 2 sets a 21; si quedan 1–1, tercer set a 15". El orden
  de zona de la planilla difiere del implementado (ver S12).
- **L6.** T1 y T2 ejecutados en local. La base local no tiene historial de
  migraciones (se creó con `db push`), así que la migración se aplicó con el SQL
  exacto del archivo, no con `migrate deploy`. Evidencia: tsc limpio, 362 tests en
  verde (4 nuevos de circuito, 2 de `setCapFor`), `/api/state` responde 200 con
  `circuit=PRINCIPIANTES season=2026`. El índice único
  `(circuit, season, sortOrder)` hizo visible que `count() + 1` colisionaba cuando
  faltaba una etapa intermedia; se pasó a `max(sortOrder) + 1` y quedó pineado con
  test.
- **L7.** Decisión de modelo revisada: se descartó la entidad `Circuito` con FK
  obligatoria (obligaba a reconstruir `Etapa` en SQLite con datos reales) por dos
  columnas aditivas, `circuit` y `season`.
- **L8.** T3, T4 y T5 ejecutados. `recordResult`/`editResult` validan con el
  formato de la etapa cuando existe, y cada partido nuevo hereda ese formato.
  Bug preexistente encontrado y corregido: `POST /api/etapas` nunca reenviaba
  `bracketFormat` al back, así que **toda etapa creada desde el panel quedaba en
  STANDARD** aunque el organizador eligiera repechaje o cuartos. Evidencia: 363
  tests verdes, `/api/etapas?circuit=INTERMEDIOS` → `[]`,
  `?circuit=BOGUS` → 400, `/api/ranking?circuit=INTERMEDIOS` → tabla vacía y
  aislada, `/api/state?circuit=INTERMEDIOS` → 404 `no_etapas`.
- **L9.** Opinión de Andi pendiente, dejada como comentario en `standings.ts`
  (orden de la tabla de zona) según pedido del usuario.
- **L10.** Decisión del usuario: el formato de llave **varía por etapa**, no es
  una regla fija del circuito. El selector pasó a ofrecer solo las opciones
  válidas según la cantidad de equipos (6-10: semis directas o repechaje;
  11-12: semis directas o cuartos) y a caer en semis directas si el formato
  elegido deja de ser válido al cambiar la cantidad. Se eliminó el callejón sin
  salida de elegir cuartos con pocos equipos y que el submit quedara bloqueado.
  Bug corregido: al cambiar de circuito, el selector de números mostraba la
  lista del circuito anterior (la primera etapa de Intermedios se creó como
  "Etapa 7"); ahora la lista se vacía al instante.
- **L11.** Hallazgo: la UI de resultados nunca pudo cargar más de un set
  (`ResultadosSection` mandaba `sets: [{teamA, teamB}]`), así que todo formato
  multi-set solo se podía guardar como "solo ganador". Se agregó la entrada
  multi-set, `describeSetProblem()` con tests, el tercer set condicional y el
  selector de formato por partido para el modo "por instancia". Queda pendiente
  extender lo mismo al panel de corrección de resultados.
- **L12.** Guard de congelamiento: `generateZones` (re-armar zonas) y `swapTeam`
  ahora llaman a `requireEtapaEditable`, así que se bloquean en cuanto existe un
  resultado, no solo cuando la zonificación está confirmada. Antes se podía
  mover un equipo de zona con resultados cargados y la tabla perdía sus puntos en
  silencio.
- **L13.** Regla de puntaje (pedido del usuario): un set se gana a 21 con 2 de
  ventaja; pasado el cap solo continúa si están empatados, así que siempre
  termina por exactamente 2 (22-20, 26-24, 30-28). `isValidFinalSet()` rechaza
  márgenes imposibles (25-2, 10000-5) y nada por encima de 30. Aplica a todos los
  formatos, con el cap de cada set (21 o 15).
- **L14.** El partido por el tercer puesto se juega siempre: `STANDARD` ahora
  crea 4 slots de llave (dos semis, bronce y final) en vez de 3. `REPECHAJE` y
  `CUARTOS` ya lo tenían. Las etapas creadas antes de este cambio no tienen
  bronce; hay que recrearlas para que lo tengan.
- **L15.** El selector de número de etapa ofrece ahora los huecos: 1..8 menos las
  ya cargadas (con la 6 cargada → 1,2,3,4,5,7,8), así una etapa salteada se puede
  cargar después. Regla extraída a `src/lib/front/etapa-numbers.ts` con 6 tests.
  La lista de etapas se ordena por el número del nombre, no por orden de creación.
- **L16.** Dos agregados pedidos: (1) `deleteEtapa` + `DELETE /api/etapas/:id`,
  restringido a etapas canceladas, con confirmación en el panel; libera el número
  para volver a cargarlo. (2) `createCancelledEtapa`: registra una fecha
  suspendida por clima solo con número y fecha, sin equipos ni fixture, ya
  cancelada. En la card de creación hay un botón secundario "Registrar etapa
  cancelada por clima"; el POST usa `cancelled: true`.
- **L17.** Galería por circuito: modelo `CircuitSetting` (circuit único +
  galleryFolder), `getGalleryFolder`/`setGalleryFolder`, `GET|PATCH
  /api/settings/gallery`, card "Galería del main" en el panel (una por circuito,
  remount por `key={circuit}`) y `parseDriveFolderId` para aceptar la URL de Drive
  o el ID pelado. La home lee la carpeta guardada de Principiantes y cae a la env
  var y al álbum por defecto. Falta que el switch público use la de Intermedios
  (T6).
- **L18.** T6 hecho: el switch público maneja de verdad el circuito. PublicHome deriva `circuit` del switch y lo pasa a `useLiveState`, al ranking (`fetchRanking(circuit)`) y a la galería (`/api/gallery?circuit=`). Se eliminó la card 'Próximamente'; un circuito sin etapas muestra su propio estado vacío y el banner de conexión ya no se dispara por `no_etapas`. `RankingPanel` recibe `circuit`. La card del panel pasó a llamarse 'Fotos del circuito'. Verificado: `/api/gallery` devuelve 12 fotos distintas para cada circuito según la carpeta guardada.
