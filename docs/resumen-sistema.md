# Cómo está armado el sistema — Circuito SELVARENA

Resumen para revisar las reglas del torneo. Describe lo que el sistema hace hoy.

## Qué administra

Una app web donde el organizador carga las etapas y el público ve todo en vivo:
zonas, posiciones, agenda, llaves y la tabla anual.

## Circuito y temporada

- Un circuito es una **temporada anual**: por ejemplo, Principiantes 2026.
- Cada circuito tiene sus propias etapas y su propia tabla anual, que arranca de
  cero cada año.
- Hoy está activo Principiantes. Intermedios está en preparación.

## Una etapa

Es un torneo de un día. Al crearla, el organizador indica:

- Nombre y fecha.
- Los equipos: nombre de la pareja, nombre del jugador y nombre de la jugadora.
- El formato de llave: estándar, repechaje o cuartos.

Reglas de armado:

- Equipos mixtos fijos: un varón y una mujer.
- Mínimo 6 equipos, máximo 12.
- De 6 a 10 equipos: 2 zonas. Con 11 o 12: 3 zonas.
- Zonas parejas, con diferencia máxima de un equipo por zona.
- Todos contra todos dentro de la zona, una sola vuelta.
- Los equipos quedan congelados: una vez cargados en la etapa, no se cambian.

## Cómo se ordena una zona

1. Partidos ganados.
2. Resultado directo entre los equipos empatados.
3. Diferencia de sets (solo cuenta con partidos completos).
4. Si persiste el empate, orden por nombre.

## Cargar resultados

- Se puede cargar el resultado completo (set por set) o solo el ganador.
- Todos los sets se validan con ventaja de 2: 21-20 no cierra el set, 22-20 sí.
- Formato por instancia, hoy:
  - Zonas, desempate, repechaje, cuartos y tercer puesto: un set a 21.
  - Semifinales: un set a 21, o dos sets a 15 con tie-break.
  - Final: mejor de 3 sets a 21.

## Llaves

- **Estándar**: con 2 zonas pasan A1 vs B2 y B1 vs A2. Con 3 zonas, A1 vs el
  mejor segundo y B1 vs C1. Después final y partido por el tercer puesto.
- **Repechaje** (2 zonas): A2 vs B3 y B2 vs A3; los que ganan cruzan con los
  primeros de cada zona.
- **Cuartos** (3 zonas, 11 o 12 equipos): clasifican los tres primeros de cada
  zona, el mejor tercero y el ganador del repechaje entre los otros dos terceros.
  Siembra 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5.
- El **mejor tercero** se compara solo contra los dos primeros de su zona:
  victorias, diferencia de puntos y puntos a favor.
- Si hay empate exacto en el mejor segundo, se juega un partido de desempate.
  Si el empate es en el mejor tercero, lo define el organizador.

## Cierre de la etapa

- Se puede finalizar recién cuando la final tiene resultado.
- Una vez cerrada no se editan más resultados ni zonas.
- Una etapa también se puede cancelar por suspensión.

## Tabla anual

- Puntaje por puesto: 100, 80, 65, 50, 40, 40, 30, 25, 10 y 10. Del 11.º en
  adelante, 10 puntos.
- Se suman los puntos por jugador, con damas y caballeros en listas separadas.
- Una etapa suma a la tabla solo cuando su final está jugada.
- Los puestos los calcula el sistema: 1.º y 2.º de la final, 3.º y 4.º del
  partido por el tercer puesto (o los perdedores de semis), y del 5.º en adelante
  por posición en la zona.

## Qué hace el sistema y qué hace el organizador

- **Automático**: zonas, fixture, posiciones, llaves, avance de rondas y tabla
  anual.
- **Manual**: crear la etapa, cargar resultados, resolver un empate puntual,
  reagendar horarios, cancelar o finalizar la etapa.

## Próximo paso: Intermedios

Se va a poder elegir al crear la etapa si es de Principiantes o de Intermedios.
Cada circuito tendrá sus etapas, su numeración y su tabla anual.

Falta definir con Andi: cantidad de equipos, cantidad de zonas, formatos de
llave, orden de la tabla de zona, formatos de set y escala de puntos.
