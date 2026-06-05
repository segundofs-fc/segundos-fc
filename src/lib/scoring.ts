import { Match } from '../data/matches'
import { AiWeights, DayMoment, Recommendation, RecommendationCategory, UserProfile } from './types'

export const defaultWeights: AiWeights = {
  teamAffinity: 0.22,
  starAffinity: 0.12,
  scheduleFit: 0.17,
  matchQuality: 0.17,
  narrative: 0.10,
  regionalInterest: 0.08,
  history: 0.07,
  viral: 0.03,
  underdog: 0.04,
}

export const categories: RecommendationCategory[] = ['Imperdible', 'Relevante', 'Para ver el resumen']

const confederations: Record<string, string> = {
  Argentina: 'CONMEBOL', Brazil: 'CONMEBOL', Uruguay: 'CONMEBOL', Colombia: 'CONMEBOL', Ecuador: 'CONMEBOL', Chile: 'CONMEBOL', Paraguay: 'CONMEBOL',
  Mexico: 'CONCACAF', Canada: 'CONCACAF', 'United States': 'CONCACAF', 'Costa Rica': 'CONCACAF', Panama: 'CONCACAF', Jamaica: 'CONCACAF',
  Spain: 'UEFA', Portugal: 'UEFA', England: 'UEFA', France: 'UEFA', Germany: 'UEFA', Italy: 'UEFA', Netherlands: 'UEFA', Croatia: 'UEFA', Switzerland: 'UEFA', Serbia: 'UEFA', Denmark: 'UEFA', Austria: 'UEFA', Norway: 'UEFA', Poland: 'UEFA', Sweden: 'UEFA', Scotland: 'UEFA', Belgium: 'UEFA', 'Bosnia and Herzegovina': 'UEFA',
  Morocco: 'CAF', Senegal: 'CAF', Ghana: 'CAF', Egypt: 'CAF', Cameroon: 'CAF', Nigeria: 'CAF', Algeria: 'CAF', Tunisia: 'CAF', 'South Africa': 'CAF',
  Japan: 'AFC', 'Korea Republic': 'AFC', Iran: 'AFC', Qatar: 'AFC', 'Saudi Arabia': 'AFC', Australia: 'AFC',
  'New Zealand': 'OFC',
}

const lastFourWorldCups: Record<string, number> = {
  Argentina: 100, France: 96, Croatia: 86, Morocco: 82,
  Germany: 92, Spain: 88, Netherlands: 84, Belgium: 78,
  Brazil: 76, Uruguay: 72, England: 75, Portugal: 72,
}

const viralTeams = ['New Zealand', 'Japan', 'Jamaica', 'Panama', 'Morocco']

export function allTeams(matches: Match[]): string[] {
  return Array.from(new Set(matches.flatMap((match) => [match.home, match.away]))).sort()
}

export function recommendMatches(matches: Match[], profile: UserProfile, weights: AiWeights, inferredTeams: string[] = []): Recommendation[] {
  return matches
    .map((match) => scoreMatch(match, profile, weights, inferredTeams))
    .sort((a, b) => b.score - a.score)
}

export function groupedByCategory(recommendations: Recommendation[]): Record<RecommendationCategory, Recommendation[]> {
  return categories.reduce((grouped, category) => {
    grouped[category] = recommendations.filter((item) => item.category === category)
    return grouped
  }, {} as Record<RecommendationCategory, Recommendation[]>)
}

export function watchTimeLabel(count: number): string {
  const minutes = count * 105
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (count === 0) return '0 partidos · 0 h'
  return `${count} partidos · ${hours} h ${rest} min aprox.`
}

export function dailyLimitExplanation(profile: UserProfile): string {
  return `El máximo de ${profile.maxMatchesPerDay} partidos completos por día penaliza partidos de menor prioridad cuando en una misma fecha hay más partidos recomendables que tu límite. No oculta partidos: solo baja de categoría los que compiten por tiempo.`
}

function scoreMatch(match: Match, profile: UserProfile, weights: AiWeights, inferredTeams: string[]): Recommendation {
  const breakdown = {
    teamAffinity: teamAffinity(match, profile, inferredTeams),
    starAffinity: starAffinity(match, profile),
    scheduleFit: scheduleFit(match, profile),
    matchQuality: matchQuality(match),
    narrative: narrativeScore(match),
    regionalInterest: regionalInterest(match, profile),
    history: historyScore(match, profile),
    viral: viralScore(match, profile),
    underdog: underdogScore(match, profile),
  }

  const score = Object.entries(breakdown).reduce((total, [key, value]) => {
    return total + value * weights[key as keyof AiWeights]
  }, 0)

  const limitPenalty = dailyLimitPenalty(match, profile)
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score - limitPenalty)))
  return {
    matchId: match.id,
    score: normalizedScore,
    category: categoryFor(normalizedScore, breakdown),
    reasons: explain(match, profile, breakdown, normalizedScore, limitPenalty, inferredTeams),
    parts: parts(match, breakdown),
    breakdown,
  }
}

function teamAffinity(match: Match, profile: UserProfile, inferredTeams: string[]): number {
  const selected = Array.from(new Set([...(profile.favoriteTeams || []), ...inferredTeams]))
  if (selected.includes(match.home) || selected.includes(match.away)) return 100
  return selected.length === 0 ? 45 : 18
}

function starAffinity(match: Match, profile: UserProfile): number {
  const players = profile.favoritePlayers.map((player) => player.toLowerCase().trim()).filter(Boolean)
  const hasFavorite = match.stars.some((star) => players.some((player) => star.toLowerCase().includes(player)))
  if (hasFavorite) return 100
  return Math.min(90, match.stars.length * 24)
}

function scheduleFit(match: Match, profile: UserProfile): number {
  const moment = momentFor(match.argentinaTime)
  if (profile.availableMoments.includes(moment)) return 100
  if (profile.availableMoments.length === 0) return 35
  return 18
}

function matchQuality(match: Match): number {
  const avgRank = (match.fifaRankHome + match.fifaRankAway) / 2
  const rankScore = Math.max(0, 100 - avgRank * 1.2)
  const balance = 100 - Math.min(100, Math.abs(match.fifaRankHome - match.fifaRankAway) * 2)
  return Math.round(rankScore * 0.50 + balance * 0.25 + match.rivalry * 0.25)
}

function narrativeScore(match: Match): number {
  const openingBonus = hasStory(match, 'inaugural') ? 30 : 0
  const premiumBonus = hasStory(match, 'clásico') || hasStory(match, 'clasico') || hasStory(match, 'premium') ? 25 : 0
  return Math.min(100, match.storylines.length * 18 + openingBonus + premiumBonus + match.rivalry * 0.25)
}

function regionalInterest(match: Match, profile: UserProfile): number {
  const regions = [confederations[match.home], confederations[match.away]]
  return regions.some((region) => profile.preferredRegions.includes(region as UserProfile['preferredRegions'][number])) ? 92 : 25
}

function historyScore(match: Match, profile: UserProfile): number {
  const value = Math.max(lastFourWorldCups[match.home] ?? 25, lastFourWorldCups[match.away] ?? 25)
  return profile.prioritizeHistoricChampions ? value : Math.round(value * 0.55)
}

function viralScore(match: Match, profile: UserProfile): number {
  if (!profile.interestedInViralPhenomena) return 35
  return viralTeams.includes(match.home) || viralTeams.includes(match.away) ? 100 : 30
}

function underdogScore(match: Match, profile: UserProfile): number {
  const diff = Math.abs(match.fifaRankHome - match.fifaRankAway)
  const hasUnderdog = Math.max(match.fifaRankHome, match.fifaRankAway) >= 45 && diff >= 20
  const interest = profile.tacticalSurpriseInterest / 5
  return hasUnderdog ? Math.round(45 + interest * 55) : Math.round(35 + interest * 35)
}

function dailyLimitPenalty(match: Match, profile: UserProfile): number {
  const hour = Number(match.argentinaTime.split(':')[0])
  const lateSlot = hour >= 20 ? 1 : 0
  return Math.max(0, 3 - profile.maxMatchesPerDay) * 4 + lateSlot * Math.max(0, 2 - profile.maxMatchesPerDay) * 3
}

function categoryFor(score: number, breakdown: Record<string, number>): RecommendationCategory {
  if (score >= 76 || (breakdown.teamAffinity === 100 && breakdown.scheduleFit >= 70)) return 'Imperdible'
  if (score >= 53) return 'Relevante'
  return 'Para ver el resumen'
}

function explain(match: Match, profile: UserProfile, breakdown: Record<string, number>, score: number, limitPenalty: number, inferredTeams: string[]): string[] {
  const reasons: string[] = []
  const selectedTeams = Array.from(new Set([...profile.favoriteTeams, ...inferredTeams]))
  const favoriteInMatch = selectedTeams.filter((team) => team === match.home || team === match.away)
  if (favoriteInMatch.length > 0) reasons.push(`Incluye selección favorita: ${favoriteInMatch.join(', ')}.`)
  if (breakdown.scheduleFit >= 90) reasons.push(`Entra en tus momentos disponibles en horario argentino: ${momentFor(match.argentinaTime)}.`)
  if (breakdown.regionalInterest >= 80) reasons.push(`Coincide con tus regiones preferidas: ${profile.preferredRegions.join(', ')}.`)
  if (breakdown.history >= 80) reasons.push('Sube por historial de los últimos cuatro mundiales.')
  if (breakdown.viral >= 90) reasons.push('Sube por potencial viral/fenómeno de internet.')
  if (breakdown.underdog >= 80) reasons.push('Tiene potencial de sorpresa táctica o historia underdog.')
  if (breakdown.matchQuality >= 75) reasons.push('Tiene buena calidad deportiva por ranking, paridad y rivalidad.')
  if (breakdown.narrative >= 70) reasons.push(`Narrativa fuerte: ${match.storylines.join(', ')}.`)
  if (limitPenalty > 0) reasons.push('Baja levemente por tu límite de partidos completos por día.')
  if (score < 53) reasons.push('Conviene verlo en resumen por baja afinidad o peor encaje con tu perfil.')
  if (reasons.length === 0) reasons.push('Queda clasificado por balance general entre afinidad, horario, región y calidad.')
  return reasons
}

function parts(match: Match, breakdown: Record<string, number>): string[] {
  return [
    `Horario argentino: ${momentFor(match.argentinaTime)} (${match.argentinaTime} ARG)`,
    `Calidad deportiva: ${label(breakdown.matchQuality)}`,
    `Histórico reciente: ${label(breakdown.history)}`,
    `Viral/underdog: ${label(Math.max(breakdown.viral, breakdown.underdog))}`,
  ]
}

function momentFor(time: string): DayMoment {
  const [hours] = time.split(':').map(Number)
  if (hours >= 6 && hours < 12) return 'Mañana'
  if (hours >= 12 && hours < 19) return 'Tarde'
  return 'Noche'
}

function label(value: number): string {
  if (value >= 75) return 'alto'
  if (value >= 50) return 'medio'
  return 'bajo'
}

function hasStory(match: Match, text: string): boolean {
  return match.storylines.some((storyline) => storyline.toLowerCase().includes(text))
}
