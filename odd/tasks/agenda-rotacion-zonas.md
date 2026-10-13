# Agenda: rotación de zonas en la fase de grupos

**Objetivo**: que el fixture de la fase de zonas se juegue rotando **un partido por zona**
(A, B, C, A, B, C, …) en lugar de "toda la zona A, después toda la B, después toda la C",
para que cada pareja descanse entre sus partidos (una sola cancha).

## Problema

`createEtapa` (`src/lib/back.ts`) armaba los partidos de grupo con `groups.flatMap(...)`,
**concatenando zonas enteras**: slots 1..6 = zona A, 7..12 = zona B, etc. En el torneo del
27/09 las parejas jugaban partidos consecutivos. Se terminó jugando con la planilla manual
de Andi (`docs.google.com/.../1lte1z9kSA4EvraJ7pXnDICxLWtfpsvoQ4hmpjETZ4fI`).

## Alcance

- Orden del fixture de grupos **al crear** una etapa.
- NO toca el orden interno de cada zona (sigue saliendo de `roundRobinPairs`), ni las llaves,
  ni los horarios.

## Restricción clave

El orden se persiste en `slot` al crear la etapa → **la corrección aplica sólo a etapas nuevas**.
Las etapas ya existentes conservan el orden viejo.

## Diseño

Nueva función pura `interleaveGroupPairs(groups)` en `src/lib/tournament.ts`: encola los pares
round-robin de cada zona y saca **uno por zona por vuelta** (A, B, C, A, B, C, …), salteando las
zonas ya agotadas. `createEtapa` la usa y asigna `slot` incremental.

## Verificación

- [x] Unit tests (`tournament.test.ts`): secuencia `ABCABCABCABABAB` para 4/4/3, `ABABABABABAB`
      para 2 zonas; se conserva el orden interno; cada par aparece exactamente una vez; ninguna
      pareja juega dos partidos seguidos; determinista.
- [x] End-to-end (script temporal, ya borrado): `createEtapa` real con 11 equipos (A:4/B:4/C:3)
      → secuencia de zonas `ABCABCABCABABAB` = planilla de Andi.
- [x] `npx tsc --noEmit` OK · `npm test` **208/208**.

### Evidencia (end-to-end)

```
SECUENCIA DE ZONAS: ABCABCABCABABAB
 1  A  Ruth y Yuli vs Seba y Liz
 2  B  Lu y Mateo vs Maxi y Kari
 3  C  Gonza y Belén vs Gabi y Nabi
 4  A  Gus y Gise vs Vivi y Santy
 5  B  Dany y Ángela vs Roxi y Gaso
 6  C  Mati y Cin vs Gabi y Nabi
 7  A  Ruth y Yuli vs Vivi y Santy
 ...
15  B  Roxi y Gaso vs Maxi y Kari
```

## Nota honesta

Los cruces internos de cada zona salen del sorteo (`roundRobinPairs`). La zona A coincide con la
planilla de Andi; en B y C la planilla tiene el mismo **conjunto** de cruces pero en otro **orden**
(la planilla no sigue round-robin puro en esas zonas).

## Decisión (2026-10-09)

- El torneo pasado se deja cargado **tal cual lo armó Andi**: no se reordena ninguna etapa existente.
- Para los próximos torneos **la referencia es nuestro orden**: se respeta la rotación de zonas
  que genera `interleaveGroupPairs` (una sola cancha, cada pareja descansa entre partidos).
- Andi arma la planilla **a partir de lo que emite el sistema**, no al revés → **no** hay que calcar
  el orden interno de las zonas B y C de la planilla vieja.

## Checks

`npx tsc --noEmit` · `npm test`
