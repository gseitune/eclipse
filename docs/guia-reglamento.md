# Guía para armar el reglamento — Eclipse / Selvarena

**Qué es este documento.** No es el reglamento. Es la guía para escribirlo: tiene las reglas
que el sistema ya impone (para copiar tal cual) y las decisiones que hay que tomar (para
tildar). Al final hay una hoja de decisiones que se completa y se devuelve.

**Cómo se usa.** Tres pasos:

1. Leer las tres decisiones irreversibles de la sección 0.
2. Recorrer las secciones 1 a 10 y tildar cada decisión.
3. Completar la **Hoja de decisiones** (sección 12) y devolverla junto con el reglamento.

**Leyenda**

| Marca | Significado |
| --- | --- |
| `[FIJO]` | Lo impone el sistema. No se elige: se redacta como está. |
| `[ELEGÍS]` | Hay opciones reales. Se tilda una. |
| `[PENDIENTE]` | El sistema todavía no tiene una regla definida. Hay que decidirla. |
| `[OJO]` | Una trampa: algo que parece libre pero no lo es, o que no se puede cambiar después. |

> **Regla de oro:** si el reglamento dice algo distinto de lo que dice esta guía en un punto
> `[FIJO]`, el torneo se va a jugar como dice el sistema, no como dice el reglamento. Para que
> valga lo escrito hay que cambiar el sistema primero.

---

## 0. Las tres decisiones que no se pueden cambiar después

Se eligen al crear la etapa. Una vez creada, la app solo deja editar el **nombre** y la
**fecha**. Todo lo demás queda clavado.

| Decisión | Se elige en | Se puede cambiar |
| --- | --- | --- |
| Formato de llaves | Creación de la etapa | No |
| Formato de los partidos (sets) | Creación de la etapa | No |
| Plantel de equipos | Carga de equipos | No (se congela al cargar) |

---

## 1. El torneo

### 1.1 Circuito `[ELEGÍS]`

- [ ] **Principiantes**
- [ ] **Intermedios**

Cada circuito tiene su propia tabla anual y arranca de cero cada temporada. Las dos tablas
nunca se mezclan.

**Texto sugerido:**
> El torneo pertenece al circuito ___ (Principiantes / Intermedios).

### 1.2 Temporada `[ELEGÍS]`

- [ ] Año: ____

La numeración de etapas reinicia en cada temporada: "Etapa 1" existe una vez por circuito
y por año.

### 1.3 La etapa `[ELEGÍS]`

- Nombre: ____ (hasta 120 caracteres)
- Fecha: ____
- Número de etapa dentro del circuito: ____ (no se repite en el mismo circuito y año)

### 1.4 Cuántos equipos `[FIJO]` + `[ELEGÍS]`

`[FIJO]` **Mínimo 6, máximo 12.** Fuera de ese rango la etapa no se puede crear.

`[ELEGÍS]`

- [ ] 6 equipos
- [ ] 7 equipos
- [ ] 8 equipos
- [ ] 9 equipos
- [ ] 10 equipos
- [ ] 11 equipos
- [ ] 12 equipos

> `[OJO]` La cantidad de equipos decide la cantidad de zonas y qué formatos de llaves son
> válidos. No es un dato menor: ver sección 2.

### 1.5 Composición del equipo `[FIJO]`

Cada equipo es **mixto fijo**: exactamente un jugador y una jugadora. El sistema rechaza un
equipo sin los dos nombres.

**Texto sugerido:**
> Cada equipo está formado por un jugador y una jugadora, sin excepciones. No se admiten
> equipos de dos jugadores del mismo género ni equipos de tres personas.

### 1.6 Nombres `[FIJO]`

- Nombres de equipo y de jugador: hasta 60 caracteres.
- Los nombres de equipo **no pueden repetirse**. Si se cargan dos iguales, el sistema
  descarta el segundo sin avisar, y la etapa puede quedar con menos equipos de los esperados.
- El sistema unifica **solo alias confirmados** de jugadores: "Seba", "Sebi" y "Sebita" son
  la misma persona; "Gon", "Gonz" y "Gonza"; "Gaso" y "Gastón". Cualquier otro nombre parecido
  se toma como una persona distinta.

**Texto sugerido:**
> Los nombres de equipo son únicos dentro de la etapa. Los nombres de jugadores se registran
> con su forma canónica para que la tabla anual no duplique personas.

---

## 2. Formato de llaves `[ELEGÍS]` — la decisión más importante

Hay tres formatos. La cantidad de equipos limita cuáles se pueden usar.

| Formato | Equipos | Zonas | Partidos de zona | Partidos en total |
| --- | --- | --- | --- | --- |
| A — Dos zonas + semifinales | 6 a 10 | 2 | 6 a 20 | 10 a 24 |
| B — Dos zonas + repechaje | 6 a 10 | 2 | 6 a 20 | 12 a 26 |
| C — Tres zonas + cuartos | **solo 11 o 12** | 3 | 15 o 18 | 24 o 27 |

> Los "partidos en total" incluyen zona, repechaje, cuartos, semifinales, bronce y final.
> Con 20 minutos por partido, 27 partidos son más de 9 horas de cancha.

### Formato A — Dos zonas + semifinales (estándar)

- [ ] Elegido

- Zonas: 2.
- Todos contra todos dentro de la zona.
- Clasifican los **2 primeros de cada zona**.
- Semifinal 1: 1° de A vs 2° de B.
- Semifinal 2: 1° de B vs 2° de A.
- Final y partido por el 3° puesto.

**Texto sugerido:**
> Se juega en dos zonas, todos contra todos. Clasifican los dos primeros de cada zona a
> semifinales: el primero de la zona A enfrenta al segundo de la zona B, y el primero de la
> zona B al segundo de la zona A. Los ganadores disputan la final y los perdedores el partido
> por el tercer puesto.

### Formato B — Dos zonas + repechaje

- [ ] Elegido

- Zonas: 2.
- Todos contra todos.
- Clasifican directamente los **1° de cada zona**.
- **Repechaje 1:** 2° de A vs 3° de B.
- **Repechaje 2:** 2° de B vs 3° de A.
- Semifinal 1: 1° de A vs ganador del repechaje 2.
- Semifinal 2: 1° de B vs ganador del repechaje 1.
- Final y partido por el 3° puesto.

**Texto sugerido:**
> Se juega en dos zonas, todos contra todos. Los primeros de cada zona clasifican directo a
> semifinales. Los segundos y terceros juegan un repechaje cruzado: el segundo de la zona A
> contra el tercero de la zona B, y el segundo de la zona B contra el tercero de la zona A.
> Los ganadores del repechaje completan las semifinales. Luego, final y tercer puesto.

### Formato C — Tres zonas + cuartos de final

- [ ] Elegido

- Zonas: 3. Solo con **11 o 12 equipos** (reparto 4/4/3 o 4/4/4).
- Todos contra todos.
- Clasifican los **1° y 2° de cada zona** (6 equipos), el **mejor tercero** y el **ganador
  del repechaje de terceros**. Total: 8.
- Repechaje: los dos terceros que no son mejor tercero juegan entre sí.
- Cuartos de final:

| Partido | Cruce |
| --- | --- |
| Cuartos 1 | 1° de A vs ganador del repechaje |
| Cuartos 2 | 1° de B vs mejor tercero |
| Cuartos 3 | 2° de A vs 2° de B |
| Cuartos 4 | 1° de C vs 2° de C |

- Semifinal 1: ganador de Cuartos 1 vs ganador de Cuartos 4.
- Semifinal 2: ganador de Cuartos 2 vs ganador de Cuartos 3.
- Final y partido por el 3° puesto.

**Texto sugerido:**
> Se juega en tres zonas, todos contra todos. Clasifican los dos primeros de cada zona, el
> mejor tercero y el ganador del repechaje entre los otros dos terceros. Los cuartos de final
> se ordenan por siembra: el primero de la zona A juega contra el ganador del repechaje, el
> primero de la zona B contra el mejor tercero, el segundo de la zona A contra el segundo de
> la zona B, y el primero de la zona C contra el segundo de la zona C. Las semifinales cruzan
> el ganador de cuartos 1 con el de cuartos 4, y el de cuartos 2 con el de cuartos 3. Luego,
> final y tercer puesto.

> `[OJO]` Este formato **no evita que dos equipos de la misma zona se crucen** en semifinales.
> Es a propósito: el cuadro real lo tiene así.

### 2.1 El mejor tercero (solo Formato C) `[FIJO]`

El mejor tercero se compara **únicamente contra el 1° y el 2° de su propia zona**. El partido
contra el 4° de la zona **no cuenta**. Así, un tercero de una zona de 4 y uno de una zona de 3
quedan comparables.

Criterio, en orden:

1. Partidos ganados.
2. Diferencia de puntos.
3. Puntos a favor.

**Si los tres terceros quedan empatados**, el sistema no inventa un ganador: **la organización
elige**. Hay dos caminos posibles y hay que decir cuál vale:

- [ ] **Desempate**: se juega un partido entre los terceros empatados y el ganador es el mejor tercero.
- [ ] **Sorteo**: la organización define el mejor tercero por sorteo.

En los dos casos, el que no queda como mejor tercero va al repechaje contra el tercero de la
zona C.

**Texto sugerido:**
> El mejor tercero se define comparando a cada tercero únicamente con el primero y el segundo
> de su zona, en este orden: partidos ganados, diferencia de puntos y puntos a favor. Si los
> terceros quedan empatados, el desempate se resuelve por ___ (partido desempate / sorteo).

> `[PENDIENTE]` Si hay **tres o más** terceros empatados, hoy hay que decidirlo a mano en el
> momento. Si querés que el reglamento cubra ese caso, hay que escribir la regla y después
> llevarla al sistema.

---

## 3. Zonas `[FIJO]` + `[ELEGÍS]`

`[FIJO]` La cantidad de zonas la decide la cantidad de equipos:

- 6 a 10 equipos → **2 zonas**.
- 11 a 12 equipos → **3 zonas**.

`[FIJO]` El reparto es **parejo**: las zonas no pueden diferir en más de un equipo. Cuando
sobra alguno, la zona que recibe el equipo extra se sortea. Ejemplos: 11 equipos → 4/4/3;
13 no existe (máximo 12).

`[ELEGÍS]` Antes de confirmar las zonas se puede:

- [ ] Volver a sortear (las veces que haga falta).
- [ ] Mover equipos a mano de una zona a otra.

`[FIJO]` **Confirmar las zonas es el punto de no retorno.** Desde ese momento no se sortea ni
se mueve nada: el fixture ya está armado y el plantel queda congelado.

**Texto sugerido:**
> La cantidad de zonas depende de la cantidad de equipos: dos zonas hasta 10 equipos y tres
> zonas con 11 o 12. El reparto es parejo, con una diferencia máxima de un equipo por zona.
> El sorteo se puede repetir y los equipos se pueden reubicar a mano hasta la confirmación
> de las zonas. Una vez confirmadas, no se modifican.

---

## 4. Fixture y horarios `[FIJO]` + `[ELEGÍS]`

`[FIJO]` **Todos contra todos** dentro de la zona: cada equipo juega exactamente una vez
contra cada rival de su zona.

`[FIJO]` **Una sola cancha.** Los partidos van uno detrás del otro.

`[FIJO]` El fixture **intercala las zonas** (un partido de A, uno de B, uno de C, y vuelve a
empezar) para que ningún equipo juegue dos partidos seguidos. El orden dentro de cada zona se
mantiene.

`[ELEGÍS]`

- Minutos de preparación antes de arrancar: ____ (por defecto 5)
- Minutos por partido: ____ (por defecto 20)
- ¿Se reordena la agenda a mano? `[ELEGÍS]` sí / no
- ¿Se cargan horarios por partido? `[ELEGÍS]` sí / no

**Texto sugerido:**
> El fixture de zonas es todos contra todos, en una sola cancha. Los partidos se ordenan
> alternando zonas para garantir que ningún equipo juegue dos partidos consecutivos. Cada
> partido tiene una duración estimada de ___ minutos, con ___ minutos de preparación.

> `[OJO]` Los horarios son **estimados**: se recalculan solos a medida que se cargan los
> resultados. El horario escrito en el fixture es la base, no una promesa.

---

## 5. Formato de los partidos `[ELEGÍS]` — la segunda decisión irreversible

Se elige **una** opción para toda la etapa.

- [ ] **Un set a 21.** Gana el primero en llegar a 21 con 2 de diferencia.
- [ ] **Dos sets a 15 con tiebreak.** Cada set a 15. Si queda 1 a 1, se juega un tercer set a 15.
- [ ] **Dos sets a 21 y tercero a 15.** Cada set a 21. Si queda 1 a 1, se juega un tercer set a 15.
- [ ] **Al mejor de tres a 21.** Gana el primero en ganar 2 sets. Si queda 1 a 1, se juega el tercero.

> `[OJO]` **El formato elegido vale para todos los partidos de la etapa, final incluida.** Si
> elegís "un set a 21", la final también es un solo set a 21. Si querés una final al mejor de
> tres, tenés que elegir "al mejor de tres" y entonces los partidos de zona también son al
> mejor de tres.

### 5.1 Cómo se valida un resultado `[FIJO]`

- Un set se gana **a 21 (o 15) con 2 de diferencia**. `21-20` no es válido; `22-20` sí.
- Si van `20-20`, se sigue hasta sacar 2 de diferencia.
- El techo de un set es 30 puntos.
- En los formatos de dos sets, si queda **1 a 1 el tercer set es obligatorio**.
- **Nunca hay cuarto set.**
- El ganador **siempre sale del resultado de los sets**. No se puede declarar un ganador que
  no coincida con los sets cargados.

### 5.2 Resultado incompleto `[ELEGÍS]`

El sistema permite cargar **solo el ganador**, sin puntajes.

- [ ] Se permite solo en casos excepcionales (partido no jugado, resultado perdido).
- [ ] No se permite: siempre se cargan los sets completos.

> `[OJO]` Un partido cargado solo con ganador **no aporta diferencia de sets** a la tabla de
> zona. Si se usa mucho, la tabla pierde precision.

**Texto sugerido:**
> Todos los partidos se juegan al formato ___. Un set se gana con 21 (o 15) puntos y dos de
> diferencia. En los formatos de dos sets, si el partido queda 1 a 1 se juega el tercer set.
> El resultado se carga con los puntajes de todos los sets. Solo en casos excepcionales se
> puede cargar únicamente el ganador.

---

## 6. Tabla de zona `[FIJO]`

Orden actual del sistema, de mayor a menor:

1. **Partidos ganados.**
2. **Diferencia de sets** (sets a favor menos sets en contra). Solo cuentan los partidos con
   sets completos.
3. **Diferencia de puntos** (puntos a favor menos puntos en contra). Solo cuentan los partidos
   con sets completos.
4. **Puntos a favor.** Solo cuentan los partidos con sets completos.
5. **Mano a mano**, último recurso: entre los que siguen empatados en todo lo anterior, queda
   arriba el que ganó el partido entre ellos.

El **nombre y el identificador nunca desempatan**. Si tres o más equipos empatan en todo y el
mano a mano da una vuelta, el sistema queda **en espera**: no arma la llave. La organización
define el orden desde el panel y lo confirma; el sistema no elige.

> **Decidido (2026-10-28).** Andi confirmó el orden de su planilla (diferencia de sets →
> diferencia de puntos → puntos a favor). El mano a mano va al final y solo dentro de la zona,
> porque con tres equipos que ganaron y perdieron lo mismo los resultados directos forman un
> círculo. Ya está implementado en el sistema.

**Texto sugerido:**
> La tabla de cada zona se ordena por partidos ganados. Si hay empate, por diferencia de sets.
> Si el empate sigue, por diferencia de puntos. Si todavía persiste, por puntos a favor. Si aun
> así siguen empatados dos equipos, queda arriba el que ganó el partido entre ellos.

---

## 7. Clasificación a playoffs `[FIJO]`

Depende del formato elegido en la sección 2. Ya está detallado ahí. Resumen:

| Formato | Clasifican |
| --- | --- |
| A — Dos zonas + semifinales | 1° y 2° de cada zona |
| B — Dos zonas + repechaje | 1° de cada zona directo; 2° y 3° al repechaje |
| C — Tres zonas + cuartos | 1° y 2° de cada zona + mejor tercero + ganador del repechaje |

### 7.1 Mejor segundo (solo tres zonas sin cuartos) `[FIJO]` + `[PENDIENTE]`

Cuando hay tres zonas y el formato es de semifinales, clasifican los tres primeros más el
**mejor segundo**:

- Si hay un segundo claramente mejor → clasifica directo.
- Si hay **exactamente dos** segundos empatados → se juega un **partido desempate** y el
  ganador clasifica. El cuadro espera ese resultado.
- Si hay **tres o más** segundos empatados → el sistema **se bloquea**.

> `[PENDIENTE]` El caso de tres o más segundos empatados no tiene regla. Si el reglamento
> tiene que cubrirlo, hay que decidir qué pasa.

**Texto sugerido:**
> Cuando hay tres zonas, clasifican los primeros de cada zona y el mejor segundo. Si dos
> segundos empatan, juegan un partido desempate y el ganador clasifica.

> `[OJO]` Si tu formato es "tres zonas + cuartos" (11 o 12 equipos), el mejor segundo **no
> existe**: en su lugar se usa el mejor tercero.

---

## 8. Resultados y correcciones `[FIJO]`

- Un resultado se puede **corregir** solo si **ninguna fase posterior ya tiene resultado**.
- Al corregir, el sistema **arrastra la corrección**: limpia los cruces que dependían de ese
  partido para que se vuelvan a completar.
- Una vez jugada una fase posterior, el resultado anterior queda cerrado.

**Texto sugerido:**
> Un resultado puede corregirse mientras no se haya jugado ninguna instancia posterior que
> dependa de él. La corrección actualiza automáticamente las llaves siguientes.

---

## 9. Cierre y cancelación `[FIJO]`

- La etapa se puede **finalizar** solo cuando la **final tiene resultado**.
- Finalizar es **irreversible**: después no se cargan ni se corrigen resultados, ni se tocan
  las zonas.
- **Cancelar una fecha** no borra datos: la etapa queda marcada como cancelada y se conserva
  todo lo cargado. Requiere contraseña de la organización.

**Texto sugerido:**
> La etapa se cierra cuando se carga el resultado de la final. A partir de ese momento no se
> admiten cambios. Si una fecha se suspende, se cancela y queda registrada como cancelada,
> conservando los datos.

---

## 10. Tabla anual `[FIJO]`

- Puntúa **jugadores**, no equipos. Cada jugador y cada jugadora suman por separado.
- Cada circuito y cada temporada tienen su propia tabla.
- Solo cuentan las etapas **terminadas** (con la final jugada).
- Escala de puntos por posición en la etapa:

| Puesto | 1° | 2° | 3° | 4° | 5° | 6° | 7° | 8° | 9° | 10° o más |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Puntos | 100 | 80 | 65 | 50 | 40 | 40 | 30 | 25 | 10 | 10 |

- El **partido por el 3° puesto define el 3° y el 4°** de la etapa y **siempre se juega**.
- Del **5° en adelante**, los equipos se ordenan por el puesto que ocuparon en su zona y luego
  por diferencia de sets, diferencia de puntos y puntos a favor. Si aun así empatan, comparten
  puesto y puntos; el nombre nunca ordena.

> `[PENDIENTE]` La escala de puntos es fija en el sistema. Si querés otra escala, hay que
> definirla acá y cambiarla en el sistema.

**Texto sugerido:**
> La tabla anual suma los puntos obtenidos por cada jugador y cada jugadora en las etapas
> terminadas del circuito. La escala es: 100, 80, 65, 50, 40, 40, 30, 25, 10 y 10 puntos
> desde el décimo puesto. Cada circuito y cada temporada tienen su propia tabla.

---

## 11. Lo que el sistema NO permite

Si el reglamento dice algo de esta lista, **no se va a poder cumplir**. Hay que sacarlo o
cambiarlo en el sistema primero.

- Cambiar el plantel de una etapa ya cargada.
- Mover equipos de zona después de confirmar las zonas.
- Cambiar el formato de llaves o el formato de sets de una etapa ya creada.
- Armar las llaves a mano.
- Borrar una etapa (solo se puede cancelar).
- Jugar en más de una cancha a la vez.
- Resolver automáticamente tres o más equipos empatados.
- Configurar la escala de puntos anual desde el panel.
- Sumar equipos después de crear la etapa.
- Cambiar el circuito o la temporada de una etapa existente.

---

## 12. Hoja de decisiones

Esta es la parte que se devuelve. Se completa y con eso sabemos exactamente qué reglamento
escribir y qué revisar en el sistema.

| # | Punto | Opciones | Elegido | Nota |
| --- | --- | --- | --- | --- |
| 1 | Circuito | Principiantes / Intermedios | | |
| 2 | Temporada | año | | |
| 3 | Cantidad de equipos | 6 a 12 | | |
| 4 | Formato de llaves | A / B / C | | |
| 5 | Formato de sets | 21 / 2×15 / 2×21+15 / mejor de 3 | | |
| 6 | Mejor tercero empatado | desempate / sorteo | | |
| 7 | Orden de la tabla de zona | sistema / planilla | | |
| 8 | Resultado solo con ganador | sí, excepcional / no | | |
| 9 | Minutos de preparación | número | | |
| 10 | Minutos por partido | número | | |
| 11 | Tres o más empatados | regla a definir | | |
| 12 | Escala de puntos anual | actual / otra | | |

---

## 13. Checklist antes de publicar

- [ ] El formato de llaves coincide con la cantidad de equipos (Formato C solo con 11 o 12).
- [ ] El reglamento no promete cambiar el plantel ni las zonas después de confirmadas.
- [ ] El reglamento no promete cambiar el formato de sets de una etapa ya creada.
- [ ] El orden de la tabla de zona es el que el sistema realmente usa (o está anotado como pendiente).
- [ ] El reglamento dice qué pasa si hay tres o más empatados.
- [ ] El reglamento aclara que la etapa se cierra con la final y no se reabre.
- [ ] El reglamento aclara que la tabla anual puntúa jugadores, no equipos.
- [ ] Nada de la sección 11 aparece como regla.
