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
- **S7 (E3)**: cruces de 4tos/semis definibles a mano (el cuadro real de Andi cruzó dos
  1ºs; el motor separa los 1ºs).
- **S8 (E5)**: CRUD de etapas (crear/modificar/eliminar), sólo para etapas NO jugadas.
- **S9 (E6)**: vista pública con cuadro gráfico tipo Mundial desde "Llaves".
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
- [ ] **E3** — cruces manuales 4tos/semis (S7). Route: inline.
- [ ] **E5** — CRUD de etapas sólo no jugadas (S8). Route: inline.
- [ ] **E6** — cuadro público (S9). Route: inline.
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
