# Cómo funciona el torneo en el sistema

Este documento describe cómo funciona hoy la aplicación con la que se juegan las etapas.
No es un reglamento ni una propuesta: es material de referencia, por si sirve para contrastar
lo que ya está escrito.

---

## La etapa

Una etapa es un torneo de un día. Al crearla se definen el circuito, la temporada, el número
de etapa, el formato de llaves y el formato de los partidos. Después de creada, el sistema solo
permite editar el nombre y la fecha.

Cada circuito (Principiantes e Intermedios) tiene su propia tabla anual y su propia numeración
de etapas. La numeración reinicia cada temporada.

## Equipos

- Entre **6 y 12 equipos** por etapa.
- Cada equipo es **mixto fijo**: un jugador y una jugadora.
- Nombres de equipo y de jugador: hasta 60 caracteres.
- Los nombres de equipo son únicos. Si se carga uno repetido, el sistema conserva el primero.
- Algunos apodos se unifican solos: "Seba", "Sebi" y "Sebita" son la misma persona; también
  "Gon", "Gonz" y "Gonza"; y "Gaso" con "Gastón". Cualquier otro nombre parecido se toma como
  una persona distinta.
- El plantel se congela al cargarse: no se modifica dentro de la etapa.

## Zonas

- De 6 a 10 equipos: **2 zonas**. De 11 a 12 equipos: **3 zonas**.
- El reparto es parejo, con una diferencia máxima de un equipo entre zonas. Con 11 equipos
  queda 4/4/3; con 13 no se puede, porque el máximo es 12.
- Cuando sobra un equipo, la zona que lo recibe se sortea.
- Antes de confirmar se puede volver a sortear o mover equipos a mano, las veces que haga falta.
- Confirmar las zonas cierra el tema: el fixture ya está armado y no se vuelve a tocar.

## Fixture

- Todos contra todos dentro de la zona: cada equipo juega una vez contra cada rival de su zona.
- Una sola cancha, partidos uno detrás del otro.
- Los partidos alternan zonas (A, B, C, A, B, C…) para que ningún equipo juegue dos seguidos.
- Por defecto, 20 minutos por partido y 5 de preparación antes del primero.
- Los horarios se recalculan solos a medida que se cargan resultados. El horario del fixture es
  la base, no una promesa.

## Formato de los partidos

Se elige un formato por etapa. Hay cuatro:

| Formato | Sets | Cómo termina |
| --- | --- | --- |
| Un set a 21 | 1 | Gana el primero en llegar a 21 con 2 de diferencia |
| Dos sets a 15 | 2 o 3 | Cada set a 15; si queda 1 a 1, tercer set a 15 |
| Dos sets a 21 y tercero a 15 | 2 o 3 | Cada set a 21; si queda 1 a 1, tercer set a 15 |
| Mejor de tres a 21 | 2 o 3 | Gana el primero en ganar 2 sets; si queda 1 a 1, tercer set |

Reglas de puntaje, iguales en todos los formatos:

- Un set se gana con 2 de diferencia. **21-20 no es válido; 22-20 sí.**
- Si van 20-20, se sigue hasta sacar 2 de diferencia.
- El techo de un set es 30 puntos.
- Si el partido va 1 a 1, el tercer set es obligatorio.
- Nunca hay cuarto set.
- El ganador siempre sale del resultado de los sets.
- Se puede cargar solo el ganador, sin puntajes. Ese partido no aporta diferencia de sets a la
  tabla de zona.

**Dato:** el formato elegido aplica a todos los partidos de la etapa, final incluida. Si se
elige "un set a 21", la final también es un set a 21.

## Tabla de zona

Orden actual, de mayor a menor:

1. Partidos ganados.
2. Diferencia de sets (sets a favor menos sets en contra). Solo cuentan los partidos con sets
   completos.
3. Diferencia de puntos (puntos a favor menos puntos en contra). Solo cuentan los partidos con
   sets completos.
4. Puntos a favor. Solo cuentan los partidos con sets completos.
5. Mano a mano: entre los equipos que siguen empatados en todo lo anterior, queda arriba el que
   ganó el partido entre ellos.

El nombre y el identificador **nunca** desempatan. Si tres o más equipos quedan empatados en
todo y el mano a mano da una vuelta (cada uno le ganó a uno), el sistema no inventa un orden:
queda **en espera**. No arma la llave y la fase sigue en zona. La organización decide desde el
panel: puede jugar un desempate más corto, o definir el orden a mano y confirmarlo. Con ese
orden se arman los cruces. Si después se corrige un resultado y el empate ya no es el mismo, el
orden guardado se ignora y la zona vuelve a quedar en espera.

**Dato:** la planilla de Intermedios usa este mismo orden. El mano a mano ya no va antes de la
diferencia de sets: va último, porque con tres equipos que ganaron y perdieron lo mismo los
resultados directos forman un círculo y no desempatan a nadie.

## Llaves

Hay tres formatos. La cantidad de equipos limita cuáles se pueden usar.

| Formato | Equipos | Zonas | Partidos en total |
| --- | --- | --- | --- |
| Dos zonas + semifinales | 6 a 10 | 2 | 10 a 24 |
| Dos zonas + repechaje | 6 a 10 | 2 | 12 a 26 |
| Tres zonas + cuartos | 11 o 12 | 3 | 24 o 27 |

Los totales incluyen zona, repechaje, cuartos, semifinales, bronce y final. Con 20 minutos por
partido, 27 partidos son más de 9 horas de cancha.

### Dos zonas + semifinales

- Clasifican los dos primeros de cada zona.
- Semifinal 1: 1° de A contra 2° de B.
- Semifinal 2: 1° de B contra 2° de A.
- Final y partido por el tercer puesto.

### Dos zonas + repechaje

- Clasifican directo los primeros de cada zona.
- Repechaje 1: 2° de A contra 3° de B.
- Repechaje 2: 2° de B contra 3° de A.
- Semifinal 1: 1° de A contra el ganador del repechaje 2.
- Semifinal 2: 1° de B contra el ganador del repechaje 1.
- Final y partido por el tercer puesto.

### Tres zonas + cuartos

- Clasifican los dos primeros de cada zona (6 equipos), el mejor tercero y el ganador del
  repechaje entre los otros dos terceros. Total: 8.
- Cuartos de final:

| Partido | Cruce |
| --- | --- |
| Cuartos 1 | 1° de A contra el ganador del repechaje |
| Cuartos 2 | 1° de B contra el mejor tercero |
| Cuartos 3 | 2° de A contra 2° de B |
| Cuartos 4 | 1° de C contra 2° de C |

- Semifinal 1: ganador de Cuartos 1 contra ganador de Cuartos 4.
- Semifinal 2: ganador de Cuartos 2 contra ganador de Cuartos 3.
- Final y partido por el tercer puesto.

En este formato no se evita que dos equipos de la misma zona se crucen en semifinales. El
cuadro real lo tiene así.

## Mejor tercero (solo en el formato de tres zonas con cuartos)

El mejor tercero se compara **únicamente contra el 1° y el 2° de su propia zona**. El partido
contra el 4° de la zona no cuenta, para que un tercero de una zona de 4 y uno de una zona de 3
queden comparables.

Criterio, en orden:

1. Partidos ganados.
2. Diferencia de puntos.
3. Puntos a favor.

Si los terceros quedan empatados, el sistema no elige: la organización define el mejor tercero
por desempate o por sorteo. El que no queda como mejor tercero va al repechaje.

## Mejor segundo (tres zonas, formato de semifinales)

- Si hay un segundo claramente mejor, clasifica directo.
- Si hay exactamente dos segundos empatados, juegan un partido desempate y el ganador clasifica.
  El cuadro espera ese resultado.
- Si hay tres o más segundos empatados, el sistema se detiene y espera una decisión de la
  organización.

## Tercer y cuarto puesto

Hay partido por el bronce en los tres formatos y **siempre se juega**. Define el 3° y el 4° de
la etapa, que son los que reparten puntos en la tabla anual.

## Resultados

- Un resultado se puede corregir mientras ninguna fase posterior tenga resultado.
- Al corregir, el sistema limpia los cruces que dependían de ese partido y los vuelve a
  completar con el nuevo resultado.
- Una vez jugada una fase posterior, el resultado anterior queda cerrado.

## Cierre

- La etapa se finaliza cuando la final tiene resultado.
- Finalizar es irreversible: después no se cargan ni se corrigen resultados, ni se tocan las
  zonas.
- Cancelar una fecha no borra datos. La etapa queda marcada como cancelada y se conserva todo
  lo cargado. Requiere contraseña de la organización.

## Tabla anual

- Puntúa jugadores, no equipos. Cada jugador y cada jugadora suman por separado.
- Cada circuito y cada temporada tienen su propia tabla.
- Solo cuentan las etapas terminadas, es decir, con la final jugada.
- Escala por posición en la etapa:

| Puesto | 1° | 2° | 3° | 4° | 5° | 6° | 7° | 8° | 9° | 10° o más |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Puntos | 100 | 80 | 65 | 50 | 40 | 40 | 30 | 25 | 10 | 10 |

- Del 5° en adelante, los equipos se ordenan por el puesto que ocuparon en su zona y luego por
  diferencia de sets, diferencia de puntos y puntos a favor. Si aun así empatan, comparten el
  puesto y los puntos: el nombre nunca ordena.

## Lo que el sistema no hace

- Cambiar el plantel de una etapa ya cargada.
- Mover equipos de zona después de confirmar las zonas.
- Cambiar el formato de llaves o el formato de sets de una etapa ya creada.
- Armar las llaves a mano.
- Borrar una etapa. Solo se puede cancelar.
- Jugar en más de una cancha a la vez.
- Resolver solo tres o más equipos empatados.
- Configurar la escala de puntos anual.
- Sumar equipos después de crear la etapa.
- Cambiar el circuito o la temporada de una etapa existente.
