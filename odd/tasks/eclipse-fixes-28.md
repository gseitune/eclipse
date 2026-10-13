# Eclipse — Fixes antes del 28 (retomar desde la pausa del 2026-10-01)

## Objective
Arreglar los bugs que hicieron abandonar Eclipse en cancha y preparar mejoras, antes de la
próxima fecha del torneo (28). El organizador ofreció inscripción gratis a cambio del fix.

## Problem
- Al cargar un resultado, la UI mostraba "Error al cargar el resultado. Intentá de nuevo."
  **pero el resultado SÍ se guardaba** en la base. Había que recargar la página a mano
  constantemente. Síntoma = problema de refresco de estado/UI, no de persistencia.
- Además, el `HEAD` (commit `12e6509`) **no compila**: `CargarResultadoCard.tsx` quedó como
  WIP (commit `e29acea`, 2026-10-01) con errores de sintaxis y de tipos, importado por
  `OrganizerPanel.tsx`. Sin build no se puede levantar ni deployar.

## Why
Retomar el proyecto tras la pausa (2026-10-01) para reproducir en local los bugs de cancha,
arreglarlos y pushear la mejora antes del 28. No se commitea/pushea hasta que el usuario lo pida.

## Scope
- In: restaurar build; levantar local aislado (sin pisar Dolce, puerto 3001); reproducir y
  arreglar el bug "error al cargar pero guarda"; mejoras que pida el usuario.
- Out: no tocar `D:\Proyectos\Dolce` (corre en puerto 3000). No commitear/pushear sin pedido.

## Constraints
- Puertos: Dolce usa 3000 → Eclipse en **3001**.
- No correr `npm run build` sobre un dir cuyo `.next` sirve un `npm start` (rompió Dolce una vez).
- No leer `.env`/`.env.*` (bloqueado por permisos).
- `tsconfig` incluye `**/*.tsx` bajo el proyecto → un archivo "parkeado" dentro del repo
  sigue chequeándose; hay que sacarlo del árbol del proyecto.

## Tasks
- [x] T1 — Repo verificado: `D:\Proyectos\Eclipse\04-Codigo\eclipse-app`, branch
      `feat/selvarena-front`, HEAD `12e6509`. `npm test` 202/202 OK. Bug de DB descartado.
- [x] T2 — Arreglar 4 errores de sintaxis JSX en `CargarResultadoCard.tsx` (divs de más + `</>` extra).
- [x] T3 — Build restaurado: `CargarResultadoCard.tsx` parkeada fuera del proyecto
      (`D:\Proyectos\Eclipse\_wip\`, recuperable del commit `e29acea`) y su import + uso
      quitados de `OrganizerPanel.tsx`. `npx tsc --noEmit` = 0 errores.
- [x] T4 — Eclipse local levantado en puerto 3001 con SQLite local (`prisma/dev.db`), organizador
      creado y Etapa 6 con 24 partidos pendientes.
- [x] T5 — Bug reproducido vía API (24/24 POST 200) y diagnosticado: NO es de server, es de
      estado/UI del cliente. Causa raíz: `handleRecord` saltaba el `refetch()` en el `catch`.
- [x] T6 — Fix aplicado en `ResultadosSection.handleRecord`: en el `catch` reconcilia con el server
      (`fetchState()`); si el resultado quedó guardado muestra "Resultado cargado" y avanza, si no
      muestra el error real; siempre `refetch()`.
- [x] T7 — UX del panel (pedido del usuario): la carga de resultados pasa a ser INLINE dentro de la
      card "Resultados" (siempre visible), sin navegar a la pantalla aparte; y se agregó una card
      nueva (condicional) para la selección de mejores terceros, debajo de la card Resultados.
      Refactor: `ResultadosSection.tsx` ahora exporta `ResultadoEntryPanel` (form inline) y
      `MejoresTercerosPanel` (desempate, render sólo si `bracketsBlocked.reason === "best_third_tie"`),
      ambos reciben `state`/`refetch` por props (una sola suscripción live). `OrganizerPanel.tsx`
      renderiza `ResultsCard` con el form adentro.
- [x] T8 — UX de pendientes: se quitó el bloque "Faltan partidos" (listaba 9 partidos del cuadro
      con equipos sin definir → "Desconocido"). En su lugar, `OrganizerPanel` muestra una campanita
      (`PendingNotice`) arriba que avisa cuando hay un partido esperando resultado (sólo si tiene
      ambos equipos definidos); se apaga al cargarlo y al tocarla hace scroll a `#resultados-card`.
- [x] T9 — La card "Empate en el mejor 3.º" ahora sólo ofrece la elección cuando TODOS los
      partidos de zona están cargados (`nextMatch.stage !== "GROUPS"`). Antes de eso queda gris,
      deshabilitada, con "Se habilita cuando estén cargados todos los resultados de la fase de zonas".

## Acceptance criteria
- `npx tsc --noEmit` sin errores y `npm test` verde.
- En local se puede cargar un resultado y la UI se actualiza sola, sin recargar la página.

## Checks
- Runner: `npm test` (vitest) — 202/202. Tipos: `npx tsc --noEmit`.

## Progress / Evidence
- 2026-10-08: T1 y T2 hechos. Sintaxis de la card arreglada (sin commit). Memoria #250.
- 2026-10-09: T3, T4, T5, T6 hechos. Local en 3001 OK; fix de `handleRecord` aplicado (tsc OK).
- 2026-10-09: T7 hecho. `npx tsc --noEmit` OK; `npm test` 202/202; `GET /organizador` 200 y el HTML
  renderiza "Resultados" + "Cargar resultado" + "Faltan partidos" sin el botón "Volver"; la card de
  terceros NO aparece cuando no hay empate (correcto). Memoria #259 (fix) + session summary.
- 2026-10-09: T8 hecho. tsc OK, `npm test` 202/202, `/organizador` 200 y dev log sin errores de
  compilación. La campanita es client-side (SSR no la trae), así que falta la mirada en navegador.
- 2026-10-09: T9 hecho. tsc OK, `npm test` 202/202. Verificado contra `/api/state` real:
  phase=GROUPS, nextMatch=GROUPS, blocked=best_third_tie → la card rinde **GRIS** (no la elección).

## Next step
Verificación visual en el celu (el organizador) y, si queda OK, commitear/pushear cuando el usuario lo pida.
Pendiente opcional: renombrar `ResultadosSection.tsx` (ya no contiene una "section" de pantalla).
