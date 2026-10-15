# Feature: correcciones-torneo — plan de etapas post-carga de datos

Branch `feat/selvarena-front`. Delivery: commits locales, SIN push hasta OK explícito.
Runner: `node "node_modules/typescript/bin/tsc" --noEmit --project tsconfig.json` (no `npx tsc`,
no está en PATH) + `npm test` (`node --import tsx --test`, NO vitest). No tocar Dolce (3000); Eclipse en 3001.

## Specs

- **S1 (E1 — inmutabilidad server)**: TODA ruta que muta una etapa cerrada/jugada debe
  responder 409 `etapa_cerrada`. Faltan 3: `resolveBestThird` (back.ts:1212),
  `createBestThirdDesempate` (back.ts:1267), `reslotGroupSchedule` (back.ts:1329) —
  reutilizando `requireEtapaOpen` (back.ts:360). Regla del usuario (obs #291, verbatim):
  > "Lo que pasa o se decide el día del torneo es imposible de cambiar, quitaría seriedad al torneo."
- **S2 (E1 — front gate)**: con la etapa cerrada, la card de Resultados no debe ofrecer
  carga ni corrección (hoy sólo muestra el banner).
  > "luego de apretar el boton de etapa finalizada (dice que ya no se puede cargar ni editar resultados). En la card de resultados, sigue mostrandose la edicion de partidos donde se puede \"corregir\"."
  Gate en `OrganizerPanel.tsx` sobre `uiState === "closed"`: `ResultadoEntryPanel`,
  `CorregirResultadosPanel`, `MejoresTercerosPanel`, flechas de `ReagendarSection`
  (hoy sólo se gatea por `isCancelled`).
- **S3 (E8 — dedup de jugadores)**:
  > "Tengo por lo menos 3 casos en el que el mismo jugador esta cargado con diferentes nombres (Seba y Sebita) (Gon y Gonza) (Gaso y Gastón)"
  Unificar cada caso en un solo registro canónico; conservar equipos/partidos intactos;
  backup de la DB antes de mutar.
- **S4 (E9 — rename de card)**:
  > "La card de \"Equipos\" Quiero que se pase a llamar \"Crear Etapa\"."
  Labels en `CircuitosSection.tsx:208/244/304` y `OrganizerPanel.tsx:216/229`.
- **S5 (E9 — agenda al finalizar)**:
  > "Es necesario seguir mostrando la card de agenda de partidos cuando se finalizó la etapa?"
  Decisión: visible en MODO LECTURA (flechas de reorden deshabilitadas), no oculta.
- **S6 (E2)**: agenda intercalada A/B/C al crear los partidos de zona de fábrica (hoy sale
  agrupada por grupo; el interleave sólo llega vía botón de re-rotación).
- **S7 (E3 — DESCARTADA por el usuario)**: la edición manual de los cruces de 4tos/semis queda
  eliminada. La regla que la reemplaza (L5, verbatim):
  > "Una vez que se carga el equipo en la etapa, no se puede modificar. (Los equipos solo se pueden
  > cambiar entre etapa y etapa, pero cuando empieza una se tiene que mantener)"
  Verificado contra el código: la regla YA se cumple, no hace falta cambiarlo.
  - El plantel de una etapa no tiene endpoint de edición: `/api/etapas` sólo expone GET (lista) y
    POST (crear). `createEtapa` es el único escritor de filas `Team`.
  - Las únicas mutaciones intra-etapa son de ZONA (`generateZones`, `swapTeam`), y están bloqueadas
    por `requireEtapaOpen` + `requireUnconfirmed` (back.ts:431, 461-465): sólo corren antes de
    confirmar la zonificación, o sea antes de que arranque el fixture.
  - Restricción hacia E5: "modificar una etapa" nunca puede tocar los equipos.
- **S8 (E5)**: CRUD de etapas (crear/modificar/eliminar), sólo para etapas NO jugadas.
  - "Modificar" = sólo `name` y `date` (nunca equipos, ver S7). Implementado en
    `updateEtapaMeta` + `PATCH /api/etapas/:id` + modal "Editar" en `CircuitosSection`.
  - "No jugada" (predicado nuevo, no existía): ninguna `Match` de la etapa con
    `resultStatus != "PENDING"` → `BackError 409 etapa_jugada` (`requireEtapaEditable`).
  - "Eliminar": la app YA tiene borrado suave ("Cancelar fecha", `cancelledAt`, "No se borran
    datos"). Falta la decisión del usuario sobre si quiere además un borrado REAL (delete de la
    fila + cascada) o si "Cancelar fecha" alcanza. PENDIENTE.
- **S9 (E6)** — REQUISITO ACTUALIZADO 2026-10-15 (evidencia y verbatim en L8): vista pública con
  **cuadro completo tipo Mundial** desde "Llaves": cajas por partido y **árbol de dos lados** que
  converge en la FINAL, con el 3er/4to puesto debajo. REVERSA la decisión anterior de "compacto y
  sin recuadro por enfrentamiento" (`home-tabs-y-selector-torneo.md:28-31` + criterio 5, que queda
  superseded) y admite **scroll horizontal en celular**.
  - Layout: spec estático por formato (cuartos / repechaje / estándar) espejado a los dos lados de
    la FINAL. El modo se infiere de los stages presentes en los datos → **no hacen falta props
    nuevas** ni tocar `PublicHome.tsx` / `TournamentTabs.tsx`.
  - Rondas que todavía no existen en los datos: se dibujan como caja vacía (esqueleto), no se
    esconde la columna.
- **S10 (E7)**: paridad local/producción (datos como puntos anuales que no vienen del git).
- **Fuera de plan (S11)**: la E4 queda eliminada por decisión del usuario (verbatim):
  > "La E4 no la hagas, porque ya cargue yo la etapa 6 y quedo guardada ya."

## Tasks

- [x] **E0** — fix 500 `/api/state` (S: fix-state-read-500.md): commits `8f4e5dd` +
      `1c1f8ed` (auditoría), tsc 0, `npm test` 271/271. Pendiente ahí: T5/T6 deploy a main.
- [x] **E1** — inmutabilidad (S1 server + S2 front). Route: inline. RED→GREEN. Test back.integration.test.ts 38/38. tsc 0.
- [x] **E9** — rename Equipos→Crear Etapa (S4) + agenda modo lectura (S5). Route: inline. tsc 0.
- [x] **E2** — agenda intercalada (S6). Route: inline. VERIFICADO: creación ya intercala
      (Etapa 6 en DB = `ABCABCABCABABAB`). Test de regresión añadido (back.integration.test.ts, 39/39). tsc 0.
- [x] **E8** — dedup de jugadores (S3). Route: inline. Backup DB hecho. Prevención aplicada
      (whitelist `canonicalTeamNameKey` en back.ts). DB actual: sin variantes duplicadas → no requiere merge.
- [x] ~~E3~~ — DESCARTADA (S7): los cruces no se editan a mano; el plantel de una etapa no se
      modifica (ya cumplido por diseño, verificado).
- [x] **E5** — CRUD de etapas sólo no jugadas (S8). Route: inline. "Modificar" (name/date) hecho y
      verificado (`a473e80` backend+contrato+tests, `9752d48` UI). "Eliminar": DECIDIDO por el
      usuario = "Cancelar fecha" soft (`cancelledAt`) alcanza; NO se agrega borrado real, sin
      código nuevo. Cerrado.
- [x] **E6** - cuadro publico tipo Mundial (S9, ver L8 y L9). Route: inline. RED->GREEN. bracket.test.ts 24/24. npm test 321/321. tsc 0. Commits: `9145b62` (spec + tests) y `0edc5ea` (UI).
      WU1 spec de layout + tests (RED→GREEN) · WU2 UI (cajas + árbol espejado + scroll en celular) ·
      WU3 docs/evidencia. Archivos: `src/lib/front/bracket.ts`, `src/lib/front/bracket.test.ts`,
      `src/components/public/EliminatoriesView.tsx`.
- [ ] **E7** — paridad local/prod (S10). Route: inline.
- [x] ~~E4~~ — eliminada (S11).

## Log

### L1 — Reporte del usuario (2026-10-15, verbatim)
> 1) Primero Buenas noticias, cargue los datos del torneo y se cargaron perfectamente con un muy buen resultado
> 2) Cargando los datos me di cuenta de algunas cosas que quedaron inconclusas.
> * Tengo por lo menos 3 casos en el que el mismo jugador esta cargado con diferentes nombres (Seba y Sebita) (Gon y Gonza) (Gaso y Gastón)
> * Otra cosa que me di cuenta es que luego de apretar el boton de etapa finalizada (dice que ya no se puede cargar ni editar resultados). En la card de resultados, sigue mostrandose la edicion de partidos donde se puede "corregir".
> 3) La card de "Equipos" Quiero que se pase a llamar "Crear Etapa".
> 4) Es necesario seguir mostrando la card de agenda de partidos cuando se finalizó la etapa?

### L2 — Instrucciones de alcance (2026-10-15, verbatim)
> La E4 no la hagas, porque ya cargue yo la etapa 6 y quedo guardada ya. Asi que eso lo dejamos listo. Terminemos estas cosas y luego te voy a pedir otras cosas. Si hay cosas que se cruzan o pisan, consultame antes de hacer.

### L3 — Evidencia de relevamiento E1 (2026-10-15)
Mapa completo de rutas mutantes: 7 ya llaman `requireEtapaOpen` (back.ts 383/413/443/592/1523/1716,
times route 48/59); gaps = resolveBestThird, createBestThirdDesempate, reslotGroupSchedule.
Front: el banner "Etapa finalizada" (OrganizerPanel.tsx:139) es display-only; los paneles
se gatean por `isCancelled`, nunca por `closedAt`. `state.etapa.closedAt` ya llega vía /api/state.

### L4 — Evidencia E2 y E8, y decisiones de alcance (2026-10-15)
**E2 (S6)**: el relevamiento read-only y la DB contradicen la premisa de la spec. En esta branch
`createEtapa` YA usa `interleaveGroupPairs` (mismo algoritmo que el botón de re-rotación
`reslotGroupSchedule`), y el dato real lo confirma: la Etapa 6 de `prisma/dev.db` (CUARTOS, cerrada,
15 partidos de zona) tiene `zoneSeq = ABCABCABCABABAB`. Las Etapas 1/5 (`dev.db` raíz) también
intercalan; solo la Etapa 3 vieja (`ABABAABAA`, pre-fix) quedó agrupada — dato histórico, no código
actual. Acción tomada: NO tocar el camino de creación; fijar el comportamiento con un test de
regresión (`interleaves the GROUPS fixture by zone at creation`, 39/39 verde). No hubo RED porque no
había defecto que reparar (excepción documentada: es un test-guardia, no un fix).

**E8 (S3)**: en `prisma/dev.db` los 3 casos ya están bajo su forma canónica (Gonza/Belén, Roxi/Gaso,
Seba/Liz) — no existen variantes duplicadas que mergear. Se aplicó SOLO la prevención: whitelist
explícita `canonicalTeamNameKey` en `back.ts` (sebita/sebi→seba, gon/gonz→gonza, gaso→gaston;
acentos y mayúsculas normalizados). Regla de oro adoptada: NUNCA deduplicar por parecido
(prefijo/Levenshtein); solo alias EXPLÍCITOS confirmados. Motivo: Cami y CamiC son personas
distintas y cualquier heurística de prefijo las fusionaría. Backup previo:
`prisma/dev.db.backup-20251015-1808.sqlite` (ignorado por git).

**Decisión de alcance**: por L2 ("si hay cosas que se cruzan o pisan, consultame antes de hacer"),
E2 y E8 se cierran sin mutación de datos ni de código de producción de datos; queda a la espera de
OK del usuario cualquier repair de la Etapa 3 histórica.

### L5 — Decisión del usuario sobre E3 (2026-10-15, verbatim)
> 1) lo de editar los cruces no. Una vez que se carga el equipo en la etapa, no se puede modificar. (Los equipos solo se pueden cambiar entre etapa y etapa, pero cuando empieza una se tiene que mantener)

**Lectura**: E3 (editar cruces a mano) se descarta. En su lugar rige la regla del plantel
congelado por etapa. Verificado (S7) que el código ya la cumple; no se agrega ni se cambia código
por esta regla. Queda como restricción de diseño para E5.

### L6 — Commits locales de E1/E9/E8/E2 (2026-10-15)
- `87f071e` fix(etapa): freeze closed etapas and canonicalize player aliases (back.ts + test)
- `394c697` feat(organizador): read-only closed etapa and Crear Etapa card (4 archivos de UI)
- `3739a9e` docs(odd): plan and evidence for the correcciones-torneo stages
Verde: `npm test` 278/278, scan completo 293/293, `tsc` 0. Sin push (decisión del usuario).
Nota: el hook `.githooks/pre-commit` (`core.hooksPath`) incrementa `src/lib/beta-commits.ts` en
cada commit y lo stagea; el contador quedó en 170.

### L7 — E5 parcial: "modificar" una etapa no jugada (2026-10-15)
Alcance elegido dentro de S8: implementar sólo el "U" (modificar nombre/fecha). El "D" (eliminar)
queda pendiente porque se cruza con el "Cancelar fecha" que ya existe (soft, `cancelledAt`,
"No se borran datos") → se le consultó al usuario si quiere borrado real o si alcanza con eso.

- Predicado nuevo `requireEtapaEditable` (no existía ninguno de "etapa jugada"): `requireEtapaOpen`
  + `Match.count({ resultStatus: { not: "PENDING" } }) > 0` → `409 etapa_jugada`.
- `updateEtapaMeta(etapaId, { name?, date? })`: únicos campos editables (`EDITABLE_ETAPA_FIELDS`);
  cualquier otra clave → `400 field_not_editable` (defensa en la capa de datos, no sólo en la ruta).
  Trim del nombre, `name_required`/`name_too_long`/`invalid_date` igual que `createEtapa`.
  `date: null | ""` limpia la fecha. `nothing_to_update` si no viene ningún campo.
- `PATCH /api/etapas/:id` (sesión de organizador, mismo patrón que cancel/close): reenvía el body
  tal cual para que `back.ts` sea la única autoridad sobre qué es editable.
- `EtapaMeta.played` (nuevo, aditivo) calculado con `playedEtapaIds` en `listEtapas` → la UI muestra
  "Editar" sólo si `!cancelledAt && !closedAt && !played`.
- UI: botón "✏️ Editar" + modal (nombre/fecha) en `CircuitosSection.tsx`. El texto del modal aclara
  que los equipos no se tocan.
- Tests (RED → GREEN): 7 nuevos en `back.integration.test.ts` (`describe "updateEtapaMeta"`) — renombra
  y persiste nombre/fecha, limpia la fecha con null, `name_required`, `field_not_editable` (mandar
  `teams`), `etapa_jugada` tras cargar un resultado, `played: true` en `listEtapas`, `etapa_cerrada`.
  RED observado: los 7 fallaban (`updateEtapaMeta is not a function` / `played` undefined).
- Commits: `a473e80` feat(etapas) backend+contrato+tests, `9752d48` feat(organizador) UI.
- Verde: `npm test` 285/285 (278 + 7), `tsc --noEmit` exit 0. Sin push.
- Pendiente: decisión de "eliminar" (borrado real vs cancelar). → RESUELTO en L8: alcanza
  "Cancelar fecha"; E5 cerrado.

### L8 — Cambio de requisito: llaves pasan a cuadro completo tipo Mundial (2026-10-15, verbatim)
Respuesta del usuario al choque de alcance (opción elegida, textual):
> Cuadro completo tipo Mundial

Alcance de esa opción, tal como se le presentó (textual):
> "Cajas por partido y árbol de dos lados que converge en la final (bronce abajo). Es el look
> clásico que pediría 'tipo Mundial', pero REVERSA tu decisión de 'sin recuadros, compacto' y en
> celular obliga a scroll horizontal (o a un layout distinto para el teléfono)."

**Choque detectado ANTES de escribir código** (regla del usuario L2: "si hay cosas que se cruzan o
pisan, consultame antes de hacer"): el S9 original ("cuadro gráfico tipo Mundial") contradecía una
decisión ya cerrada y verificada en `home-tabs-y-selector-torneo.md` (líneas 28-31, T12 y criterio
de aceptación 5): llaves "compactas, **sin recuadro por enfrentamiento** … sin scroll horizontal en
ningún ancho de pantalla". Se le mostró la evidencia y eligió revertirla. Se agregó un ADDENDUM
fechado en ese doc dejando su criterio 5 como superseded (no se reescribió su historia).

**Verificación contra la data real** (`prisma/dev.db`, Etapa 6, CUARTOS, cerrada, leída read-only):
- Llave completa y ordenada por `slot`: REPECHAJE_1 (16), CUARTOS_1..4 (17-20), SEMIFINAL_1/2
  (21-22), BRONZE (23), FINAL (24). 9 partidos, **todos `WINNER_ONLY`** (sin sets) → el árbol no
  muestra números, sólo ganador.
- Cruces reales confirman el spec del back (`brackets.ts:437-464`): SF1 = ganador QF1 (Vivi y
  Santy) vs ganador QF4 (Gonza y Belén); SF2 = ganador QF2 (Roxi y Gaso) vs ganador QF3 (Lu y
  Mateo).
- OBSERVACIÓN (no es alcance de E6, no se tocó nada): existe un partido BRONZE **jugado** en esa
  etapa, pero para CUARTOS el back NO crea bronce (`brackets.ts:443`, "fill FINAL only (no
  BRONZE)"). El árbol lo dibuja si el dato está.

**Límites de cruce respetados (worktree compartido)**
- Archivos de E6: `src/lib/front/bracket.ts`, `src/lib/front/bracket.test.ts`,
  `src/components/public/EliminatoriesView.tsx`. Ninguno pertenece a la galería en curso.
- NO se toca `package.json` (los tests nuevos van al archivo ya registrado `bracket.test.ts`), ni
  `PublicHome.tsx` / `page.tsx` / `Galeria*`, ni los 8 commits locales (sin push).
- NO se agregan colores a `globals.css`: `ember-50/200/600` están referenciados pero NO definidos
  en `@theme` (son clases no-op). El componente nuevo usa sólo tokens definidos (`sand-*`, `sun-*`,
  `stone-*`, `emerald-*`, `amber-soft-*`).


### L9 - E6 implementado: cuadro tipo Mundial (2026-10-15)

Contexto: las salidas largas del runner devolvian contenido fabricado para archivos del repo
(lecturas de archivo, grep de bloques grandes). Se trabajo con salidas chicas (numero de linea
y linea suelta) y con `git status`/`git log`, y las escrituras por shell si funcionaban.

Cruces verificados contra la fuente (no contra memoria):
- `brackets.ts:437-438` -> "QF1 vs QF4, QF2 vs QF3 (Andi's bracket)".
- `brackets.ts:369 / 401` -> repechaje: SF1 = 1o A + ganador RE2, SF2 = 1o B + ganador RE1.
- `brackets.ts:442` -> "fill FINAL only (no BRONZE)".
- Etapa 6 real: FINAL presente y un BRONZE jugado (dato legacy); 9 partidos, todos WINNER_ONLY.

Implementacion:
- `src/lib/front/bracket.ts`: `BracketLayoutMode`, `TREE_LINKS`, `bracketLayoutMode()` y
  `buildBracketTree()`. El modo se infiere de los stages presentes (CUARTOS_* gana sobre
  REPECHAJE_*), asi que no hacen falta props nuevas ni tocar `TournamentTabs.tsx`/`PublicHome.tsx`.
  Todo nodo se emite siempre (esqueleto), para que el arbol no desaparezca con una ronda pendiente.
- `src/components/public/EliminatoriesView.tsx`: cajas por partido, conectores, dos lados
  espejados que convergen en la FINAL, 3er/4to puesto abajo y `overflow-x-auto` en celular.
  Se preservaron los estados existentes con su texto exacto: fase desconocida ->
  "Estado del torneo: ...", DESEMPATE -> "Cuadro disponible al finalizar el desempate",
  sin datos -> "Generando cuadro...". `schedule`/`matchMinutes` se siguen usando solo para
  `liveMatchIds`, igual que antes.
- Colores: solo tokens definidos en `globals.css` (`sand-*`, `sun-500`, `ember-500`, `amber-soft-*`).

Evidencia:
- RED observado: `bracket.test.ts` con 10 fallas al revertir la libreria a HEAD.
- GREEN: 24/24 en `bracket.test.ts`.
- `npm test`: 321/321 pass, 0 fail. `tsc --noEmit`: 0 errores.
- Commits: `9145b62` (spec + tests) y `0edc5ea` (UI).

Pendiente / observaciones:
- El BRONZE de la etapa 6 es un dato legacy (las reglas de CUARTOS no lo crean). El arbol lo
  dibuja si el dato esta. No se toco nada de eso.
- Falta ojo humano sobre el cuadro en el navegador: no hay infra de tests de UI en el repo.
- E7 (paridad local/prod, S10) sigue abierto.
