# Desempate manual de zona — SELVARENA

Objetivo: cuando un empate de zona sobrevive a toda la cadena de mérito, el sistema queda en
standby y la organización define el orden con un botón. Nunca nombre, nunca id, nunca azar.

Branch: `main`. Runner: `npm test` (node --test + tsx).

## Specs

- **S1.** Con la fase de zonas terminada y un empate sin resolver en puestos que el formato
  siembra, el sistema NO crea partidos de llave y la fase queda en `GROUPS`. El panel del
  organizador lista los equipos empatados.
- **S2.** El organizador ordena esos equipos (subir/bajar) y confirma. El sistema guarda el
  orden por etapa+zona, recalcula la tabla con ese orden y arma la llave si ya no queda ningún
  bloqueo.
- **S3.** El orden debe listar exactamente los equipos que siguen empatados en esa zona, cada
  uno una vez. Cualquier otra cosa se rechaza con 400 `invalid_tie_order`.
- **S4.** Solo con sesión de organizador, etapa abierta y fase `GROUPS`. Si no hay empate en esa
  zona: 400 `no_zone_tie`.
- **S5.** Un orden guardado que ya no coincide con el empate actual se ignora: la zona vuelve a
  quedar bloqueada. Confirmar de nuevo reemplaza el orden anterior (uno por etapa+zona).
- **S6.** Si la tabla de resoluciones no existe en la base (migración sin aplicar), el resto de
  la app sigue funcionando: la lectura se trata como "sin resolución" y el botón devuelve un
  error claro.

## Tasks

- [x] T1. Schema `ZoneTieResolution` + migración + `prisma generate`
- [x] T2. `computeZoneStandings(..., manualOrder?)` + tests
- [x] T3. `getStandings` lee resoluciones (tolerante), `resolveZoneTie` + tests
- [x] T4. `POST /api/zone-tie` + cliente `resolveZoneTie`
- [x] T5. Panel `ZoneTiePanel` con orden manual y standby
- [x] T6. Docs (criterios + referencia del torneo)
- [x] T7. Verificación: tsc, 414 tests, `next build`

## Log

- **L1.** Pedido del usuario: "el sistema solo queda en standby hasta que ella lo resuelva con el
  botón"; puede definir el desempate como quiera (incluso partidos más cortos) y el sistema no
  interviene.
- **L2.** Migración `20261028120000_add_zone_tie_resolution` **sin aplicar** a `dev.db` ni a
  Turso: `dev.db` ya venía dos migraciones atrás. La lectura tolera la tabla ausente; el botón
  responde 503 hasta correr `prisma migrate deploy`.
