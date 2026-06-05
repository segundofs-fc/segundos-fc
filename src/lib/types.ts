export type DayMoment = 'Mañana' | 'Tarde' | 'Noche'
export type Confederation = 'CONMEBOL' | 'UEFA' | 'CAF' | 'AFC' | 'CONCACAF' | 'OFC'

export type UserProfile = {
  name: string
  favoriteTeams: string[]
  favoritePlayers: string[]
  preferredRegions: Confederation[]
  availableMoments: DayMoment[]
  maxMatchesPerDay: number
  tacticalSurpriseInterest: number
  prioritizeHistoricChampions: boolean
  interestedInViralPhenomena: boolean
  openAnswer: string
}

export type AiWeights = {
  teamAffinity: number
  starAffinity: number
  scheduleFit: number
  matchQuality: number
  narrative: number
  regionalInterest: number
  history: number
  viral: number
  underdog: number
}

export type RecommendationCategory = 'Imperdible' | 'Relevante' | 'Para ver el resumen'
export type FilterCategory = RecommendationCategory | 'Todos'

export type Recommendation = {
  matchId: number
  score: number
  category: RecommendationCategory
  reasons: string[]
  parts: string[]
  breakdown: Record<string, number>
}

export type AiAnalysis = {
  weights: AiWeights
  inferredTeams: string[]
  explanation: string
}
