import { AiAnalysis, AiWeights, UserProfile } from './types'
import { defaultWeights } from './scoring'

const geminiApiKeys = (import.meta.env.VITE_GEMINI_API_KEYS || '').split(',').filter(Boolean);

const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']

export function heuristicAiAnalysis(profile: UserProfile, teams: string[] = []): AiAnalysis {
  const text = normalizeText(profile.openAnswer)
  const weights = { ...defaultWeights }
  const inferredTeams = inferTeamsFromText(profile.openAnswer, teams)
  const onlyTeamIntent = hasAny(text, ['unicamente', 'únicamente', 'solo', 'solamente']) && inferredTeams.length > 0

  if (onlyTeamIntent) {
    weights.teamAffinity = 0.46
    weights.scheduleFit = profile.availableMoments.length <= 1 ? 0.22 : 0.10
    weights.matchQuality = 0.12
    weights.starAffinity = 0.10
    weights.history = 0.08
    weights.underdog = 0.04
    weights.narrative = 0.04
    weights.regionalInterest = 0.03
    weights.viral = 0.01
    return {
      weights: normalize(weights),
      inferredTeams,
      explanation: `Perfil con intención fuerte por ${inferredTeams.join(', ')}. La afinidad con selección pasa a ser el factor dominante.`,
    }
  }

  if (profile.favoriteTeams.length > 0 || inferredTeams.length > 0) weights.teamAffinity += 0.12
  if (profile.prioritizeHistoricChampions || hasAny(text, ['historia', 'campeon', 'campeón', 'mundial historico', 'mundial histórico'])) weights.history += 0.10
  if (profile.interestedInViralPhenomena || hasAny(text, ['viral', 'internet', 'meme', 'furor'])) weights.viral += 0.07
  if (profile.tacticalSurpriseInterest >= 4 || hasAny(text, ['sorpresa', 'underdog', 'revelacion', 'revelación', 'tactica', 'táctica'])) weights.underdog += 0.08
  if (profile.availableMoments.length <= 1 || hasAny(text, ['mañana', 'manana', 'tarde', 'noche', 'horario'])) weights.scheduleFit += 0.08
  if (hasAny(text, ['messi', 'cristiano', 'mbappe', 'haaland', 'salah', 'figura', 'figuras', 'jugador'])) weights.starAffinity += 0.09
  if (hasAny(text, ['clasico', 'clásico', 'rivalidad', 'premium', 'candidato'])) weights.narrative += 0.05

  return {
    weights: normalize(weights),
    inferredTeams,
    explanation: inferredTeams.length > 0
      ? `La IA/heurística detectó interés por ${inferredTeams.join(', ')} y ajustó la afinidad con selección.`
      : 'No se detectó una selección explícita en el texto; se usan selecciones del perfil y relevancia global.',
  }
}

export async function geminiAnalysis(profile: UserProfile, teams: string[]): Promise<AiAnalysis> {
  let lastError: unknown = null
  for (const model of geminiModels) {
    for (const apiKey of geminiApiKeys) {
      try {
        return await requestGemini(profile, teams, apiKey, model)
      } catch (error) {
        lastError = error
      }
    }
  }
  throw lastError ?? new Error('Gemini no respondió')
}

async function requestGemini(profile: UserProfile, teams: string[], apiKey: string, model: string): Promise<AiAnalysis> {
  const prompt = `Analiza este perfil para recomendar partidos de fase de grupos del Mundial 2026.
Devuelve solo JSON válido, sin markdown, con esta forma exacta:
{
  "weights": {"teamAffinity": number, "starAffinity": number, "scheduleFit": number, "matchQuality": number, "narrative": number, "regionalInterest": number, "history": number, "viral": number, "underdog": number},
  "inferredTeams": ["team name"],
  "explanation": "texto breve"
}
Los pesos deben ser positivos y la suma aproximada debe ser 1.
Equipos válidos: ${teams.join(', ')}.
Criterios:
- Si el usuario dice únicamente/solo/solamente una selección, teamAffinity debe quedar entre 0.40 y 0.55.
- Si el usuario elige mañana, tarde y noche, el horario no diferencia tanto porque acepta todo el día argentino.
- Si menciona historia, subí history.
- Si menciona figuras, subí starAffinity.
- Si menciona sorpresas tácticas o underdog, subí underdog.
- No clasifiques partidos. Solo ajustá pesos e inferí equipos.
Perfil: ${JSON.stringify(profile)}`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
  })
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`)
  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const jsonText = text.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(jsonText) as Partial<AiAnalysis>
  const fallback = heuristicAiAnalysis(profile, teams)
  return {
    weights: normalize({ ...fallback.weights, ...(parsed.weights || {}) }),
    inferredTeams: sanitizeTeams(parsed.inferredTeams || fallback.inferredTeams, teams),
    explanation: parsed.explanation || fallback.explanation,
  }
}

export function inferTeamsFromText(rawText: string, teams: string[]): string[] {
  const text = normalizeText(rawText)
  return sanitizeTeams(teams.filter((team) => teamAliases(team).some((alias) => text.includes(normalizeText(alias)))), teams)
}

function sanitizeTeams(values: string[], teams: string[]): string[] {
  const byKey = new Map<string, string>()
  teams.forEach((team) => teamAliases(team).forEach((alias) => byKey.set(normalizeText(alias), team)))
  return Array.from(new Set(values.map((value) => byKey.get(normalizeText(value)) || byKey.get(normalizeText(aliasToTeam(value))) || (teams.includes(value) ? value : undefined)).filter(Boolean))) as string[]
}

function aliasToTeam(value: string): string {
  const normalized = normalizeText(value)
  return teamAliasEntries.find(([, aliases]) => aliases.some((alias) => normalizeText(alias) === normalized))?.[0] || value
}

function teamAliases(team: string): string[] {
  const found = teamAliasEntries.find(([name]) => name === team)
  return found ? [team, ...found[1]] : [team]
}

const teamAliasEntries: [string, string[]][] = [
  ['Japan', ['Japon', 'Japón']],
  ['Korea Republic', ['Corea', 'Corea del Sur']],
  ['United States', ['Estados Unidos', 'USA']],
  ['Germany', ['Alemania']],
  ['Spain', ['España']],
  ['England', ['Inglaterra']],
  ['France', ['Francia']],
  ['Brazil', ['Brasil']],
  ['Argentina', ['Argentina']],
  ['Uruguay', ['Uruguay']],
  ['Mexico', ['México', 'Mexico']],
  ['Portugal', ['Portugal']],
  ['Italy', ['Italia']],
  ['Netherlands', ['Paises Bajos', 'Países Bajos', 'Holanda']],
  ['Morocco', ['Marruecos']],
  ['New Zealand', ['Nueva Zelanda']],
]

function normalize(weights: AiWeights): AiWeights {
  const entries = Object.entries(weights) as [keyof AiWeights, number][]
  const positive = entries.map(([key, value]) => [key, Math.max(0.01, Number(value) || 0.01)] as const)
  const total = positive.reduce((sum, [, value]) => sum + value, 0)
  return Object.fromEntries(positive.map(([key, value]) => [key, Number((value / total).toFixed(3))])) as AiWeights
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(normalizeText(word)))
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
