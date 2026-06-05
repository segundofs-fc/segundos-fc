# Metodología de recomendación

La demo clasifica los 72 partidos de la fase de grupos del Mundial 2026. El formato 2026 tiene 48 selecciones, 12 grupos de 4 equipos y 6 partidos por grupo; por eso la fase de grupos tiene 72 partidos.

## Variables usadas

Cada partido recibe un score interno entre 0 y 100. Ese score no se muestra al usuario final, pero sirve para ordenar y clasificar.

- Afinidad con selecciones: sube si juega una o más selecciones favoritas del perfil.
- Afinidad con jugadores: sube si aparecen jugadores favoritos o figuras del partido.
- Horario: sube si el partido cae en mañana, tarde o noche según disponibilidad del usuario.
- Calidad deportiva: combina ranking, paridad entre equipos y rivalidad.
- Narrativa: mide si hay historia atractiva, anfitrión, clásico, candidato, revancha o cierre de grupo.
- Regiones preferidas: sube si alguno de los equipos pertenece a una confederación elegida por el usuario. El perfil permite seleccionar más de una región.
- Histórico reciente: toma como señal el rendimiento de selecciones relevantes en los últimos cuatro mundiales.
- Viralidad: sube si el usuario quiere seguir fenómenos de internet o equipos con potencial viral.
- Underdog: sube cuando hay posibilidad de sorpresa y el usuario declaró interés por equipos tapados.
- Límite de partidos completos por día: no elimina partidos, pero penaliza levemente partidos menos prioritarios si el usuario no quiere ver tantos encuentros completos.

## Ponderación sin IA

Sin IA se usa una ponderación heurística local. Parte de pesos base y los ajusta con reglas simples:

- Si el usuario elige selecciones favoritas, aumenta afinidad con selección.
- Si el usuario marca historia, aumenta histórico reciente.
- Si marca viralidad, aumenta factor viral.
- Si elige alto interés por underdogs, aumenta underdog.
- Si tiene poca disponibilidad horaria, aumenta horario.
- Si menciona jugadores o figuras en la respuesta abierta, aumenta afinidad con jugadores.

La ventaja es que funciona siempre, no depende de internet y es determinística.

## Ponderación con IA

La IA no recomienda partidos directamente. La app le manda el perfil del usuario y le pide devolver solo pesos para los mismos factores: afinidad, jugadores, horario, calidad, narrativa, región, historia, viralidad y underdog.

Después la app usa esos pesos dentro del mismo algoritmo local. Es decir: la IA solo ajusta el peso relativo de cada criterio; la clasificación final sigue siendo trazable y explicable.

Si Gemini falla, la app vuelve automáticamente al cálculo heurístico local.

## Categorías

- Imperdible: score alto o partido con selección favorita y buen encaje horario.
- Relevante: score medio, interesante pero no necesariamente prioritario.
- Para ver el resumen: baja afinidad, horario malo o bajo valor para ese perfil.

## Nota sobre API key

La key no se renderiza en pantalla. De todos modos, al ser una app 100% frontend, cualquier key usada desde el navegador puede verse en Network. Para ocultarla realmente hace falta mover la llamada a un backend/proxy.

## Ajuste de horario argentino e IA

Los horarios se interpretan siempre como horario argentino (`argentinaTime`). Por eso los filtros Mañana, Tarde y Noche no usan el horario local del estadio, sino el momento real en el que una persona en Argentina vería el partido:

- Mañana: 06:00 a 11:59 ARG.
- Tarde: 12:00 a 18:59 ARG.
- Noche: 19:00 a 05:59 ARG.

## Por qué la IA puede modificar mucho o poco

La IA no decide directamente “Imperdible” o “Resumen”. Su rol es transformar la respuesta abierta del usuario en dos cosas:

1. Pesos de ponderación: cuánto importa selección, figuras, historia, horario, región, underdog, etc.
2. Selecciones inferidas: por ejemplo, si el usuario escribe “únicamente me gusta Japón”, el sistema detecta Japón aunque no lo haya marcado manualmente.

Caso fuerte:

> “Únicamente me gusta Japón.”

En este caso, el peso `teamAffinity` pasa a dominar la recomendación. Los partidos de Japón deberían subir claramente porque la intención del usuario es muy específica.

Caso menos diferencial:

> “Me interesa Japón, historia, figuras y alguna sorpresa táctica. Que sea a la mañana, tarde o noche.”

En este caso, Japón sube, pero el horario casi no modifica el ranking porque el usuario aceptó todos los momentos del día argentino. La IA sí ajusta historia, figuras y underdog, pero no puede usar el horario como filtro fuerte porque no hay restricción real.

Si Gemini falla por API key, modelo o red, el sistema aplica una heurística local que imita el mismo comportamiento: detecta selecciones mencionadas en texto y ajusta pesos sin depender de la llamada externa.
