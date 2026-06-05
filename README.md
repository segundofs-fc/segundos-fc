# Segundos FC - Tu tiempo, tu Mundial

Aplicación Vite + React para recomendar partidos de fase de grupos del Mundial 2026 según perfil del usuario.

## Qué incluye esta versión

- Login local y perfil persistido en `localStorage`.
- Selección múltiple de selecciones favoritas.
- Preguntas de perfil: región, horarios disponibles, máximo de partidos completos por día, historia, viralidad, underdog y respuesta abierta.
- Ranking inicial con todos los partidos ordenados de mayor a menor relevancia.
- Filtros por categoría: `Imperdible`, `Relevante` y `Para ver el resumen`.
- Página de partidos sin formulario lateral de edición.
- Página separada para editar perfil.
- Recálculo automático cuando cambia el perfil.
- Integración opcional con Gemini para ajustar pesos del modelo.
- Fallback heurístico local si Gemini falla.
- Histórico reciente de los últimos cuatro mundiales como variable de ponderación.

## Cómo correr

```bash
npm install
npm run dev
```

## Cómo se calcula

Cada partido recibe una ponderación interna basada en:

1. Afinidad con selecciones favoritas.
2. Jugadores favoritos.
3. Encaje horario.
4. Calidad deportiva estimada por ranking, paridad y rivalidad.
5. Narrativa del partido.
6. Región preferida.
7. Historial reciente de los últimos cuatro mundiales.
8. Factor viral.
9. Factor underdog.
10. Límite de partidos completos por día.

La app no muestra el score numérico al usuario final: solo muestra el partido, la categoría y las razones.

## IA

La IA no decide directamente qué partido recomendar. Solo ajusta los pesos de los factores según el perfil y la respuesta abierta. Si Gemini responde mal, devuelve 404, falla por CORS o no hay cuota, se usa el cálculo local.

Importante: en una aplicación 100% frontend, cualquier API key usada desde el navegador puede verse en la pestaña Network. Para ocultarla realmente hace falta un backend/proxy o serverless function.

## .env
EL .env deberia tener la api key (Nuestro caso gemini) que se va a utilizar a la hora de levantar el proyecto, Ej: VITE_GEMINI_API_KEYS=AQ.Ab8RN6LYUwVZiWF_FPM3WNNTV4GKa-37tyVcEm4h-b_vOSeuVw,AQ.Ab8RN6JvyUSFATCFY0nyZR2HBvHmgQt6HQ_IblVbedvQ0_fGoA,AQ.Ab8RN6KiixiaRF2fF0iPleYiGZZFjlYXQROfb91-cHg_0zMv7Q,AQ.Ab8RN6Jlpf0NiNj5Og2pQEog5fncZmZmHdPuP5yEydrsRH88Iw
