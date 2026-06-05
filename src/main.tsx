import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { matches } from './data/matches'
import { geminiAnalysis, heuristicAiAnalysis } from './lib/ai'
import { allTeams, categories, dailyLimitExplanation, groupedByCategory, recommendMatches, watchTimeLabel } from './lib/scoring'
import { AiAnalysis, DayMoment, FilterCategory, Recommendation, UserProfile } from './lib/types'
import './styles.css'

const storageKey = 'segundos-fc-profile-v3'
const moments: DayMoment[] = ['Mañana', 'Tarde', 'Noche']
const regions: UserProfile['preferredRegions'][number][] = ['CONMEBOL', 'UEFA', 'CAF', 'AFC', 'CONCACAF', 'OFC']

const initialProfile: UserProfile = {
  name: '',
  favoriteTeams: ['Argentina'],
  favoritePlayers: ['Messi', 'Mbappe'],
  preferredRegions: ['CONMEBOL'],
  availableMoments: ['Tarde', 'Noche'],
  maxMatchesPerDay: 2,
  tacticalSurpriseInterest: 3,
  prioritizeHistoricChampions: true,
  interestedInViralPhenomena: true,
  openAnswer: 'Me interesan Argentina, los partidos con historia, figuras y alguna sorpresa táctica si vale la pena.',
}

function App() {
  const [profile, setProfile] = useState<UserProfile>(loadProfile())
  const teams = useMemo(() => allTeams(matches), [])
  const [analysis, setAnalysis] = useState<AiAnalysis>(heuristicAiAnalysis(loadProfile(), allTeams(matches)))
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(loadProfile().name))
  const [view, setView] = useState<'matches' | 'profile'>('matches')
  const [filter, setFilter] = useState<FilterCategory>('Todos')
  const [aiStatus, setAiStatus] = useState('Ponderación heurística aplicada')

  const recommendations = useMemo(() => recommendMatches(matches, profile, analysis.weights, analysis.inferredTeams), [profile, analysis])
  const grouped = useMemo(() => groupedByCategory(recommendations), [recommendations])
  const visibleRecommendations = useMemo(() => {
    return filter === 'Todos' ? recommendations : recommendations.filter((item) => item.category === filter)
  }, [filter, recommendations])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(profile))
    const nextAnalysis = heuristicAiAnalysis(profile, teams)
    setAnalysis(nextAnalysis)
    setAiStatus(`Recalculado automáticamente con reglas locales. ${nextAnalysis.explanation}`)
  }, [profile, teams])

  function updateField<K extends keyof UserProfile>(field: K, value: UserProfile[K]) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  function login(event: React.FormEvent) {
    event.preventDefault()
    setIsLoggedIn(true)
    setView('matches')
  }

  async function applyGemini() {
    try {
      setAiStatus('Consultando IA externa...')
      const nextAnalysis = await geminiAnalysis(profile, teams)
      setAnalysis(nextAnalysis)
      setAiStatus(`Ponderación actualizada con IA externa. ${nextAnalysis.explanation}`)
    } catch (error) {
      const fallback = heuristicAiAnalysis(profile, teams)
      setAnalysis(fallback)
      setAiStatus(`La IA externa falló. Se aplicó fallback heurístico local. ${fallback.explanation}`)
    }
  }

  if (!isLoggedIn) {
    return <Login profile={profile} teams={teams} onSubmit={login} updateField={updateField} />
  }

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Segundos FC · Tu tiempo, tu Mundial</p>
          <h1>Partidos ordenados por relevancia</h1>
          <p>
            Primero ves el ranking completo de mayor a menor relevancia. Después podés filtrar por Imperdible, Relevante o Para ver el resumen.
          </p>
          <div className="heroActions">
            <button className="lightButton" onClick={() => setView('matches')}>Ver partidos</button>
            <button className="lightButton secondaryLight" onClick={() => setView('profile')}>Editar perfil</button>
          </div>
        </div>
        <div className="heroCard">
          <strong>{matches.length}</strong>
          <span>partidos cargados</span>
          <strong>{watchTimeLabel(grouped.Imperdible.length)}</strong>
          <span>si ves solo los imperdibles</span>
        </div>
      </section>

      {view === 'profile' ? (
        <section className="profilePage panelWide">
          <div className="profileHeader">
            <div>
              <p className="eyebrow dark">Perfil activo</p>
              <h2>{profile.name || 'Usuario'}</h2>
            </div>
            <button className="ghost" onClick={() => setView('matches')}>Volver a partidos</button>
          </div>
          <ProfileForm profile={profile} teams={teams} updateField={updateField} />
          <button className="secondary" onClick={applyGemini}>Probar ponderación con IA externa</button>
          <p className="status">{aiStatus}</p>
          <p className="hint">En una app solo frontend la key puede verse en Network aunque no se renderice en pantalla. Para ocultarla realmente hace falta un backend/proxy.</p>
        </section>
      ) : (
        <section className="results fullResults">
          <Stats grouped={grouped} />
          <FilterBar filter={filter} grouped={grouped} setFilter={setFilter} total={recommendations.length} />
          <section className="methodBox">
            <h2>Cómo se pondera</h2>
            <p>
              La recomendación combina afinidad con selecciones elegidas o detectadas por IA, jugadores favoritos, horario disponible en Argentina, calidad deportiva, narrativa, región, historial reciente de los últimos cuatro mundiales, viralidad y factor underdog.
            </p>
            <p>{dailyLimitExplanation(profile)}</p>
            <p>
              La IA no decide los partidos directamente: ajusta los pesos e infiere selecciones desde tu respuesta abierta. Si decís “únicamente me gusta Japón”, Japón pasa a pesar mucho más. Si elegís mañana, tarde y noche, el horario casi no cambia el ranking porque aceptás todo el día argentino.
            </p>
          </section>
          <div className="listHeader">
            <div>
              <p className="eyebrow dark">Ranking</p>
              <h2>{filter === 'Todos' ? 'Todos los partidos por relevancia' : filter}</h2>
            </div>
            <span>{watchTimeLabel(visibleRecommendations.length)}</span>
          </div>
          <div className="cards threeCols">
            {visibleRecommendations.map((item) => {
              const match = matches.find((candidate) => candidate.id === item.matchId)!
              return <MatchCard key={item.matchId} match={match} item={item} />
            })}
          </div>
        </section>
      )}
    </main>
  )
}

function Login({ profile, teams, onSubmit, updateField }: { profile: UserProfile; teams: string[]; onSubmit: (event: React.FormEvent) => void; updateField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void }) {
  return (
    <main className="loginPage">
      <section className="loginCard">
        <p className="eyebrow dark">Inicio</p>
        <h1>Armá tu perfil mundialista</h1>
        <p>Después de loguearte vas a ver todos los partidos ordenados por relevancia y filtrables por categoría.</p>
        <form onSubmit={onSubmit}>
          <label>Nombre</label>
          <input required value={profile.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Ej: Santino" />
          <ProfileForm profile={profile} teams={teams} updateField={updateField} />
          <button type="submit">Entrar y recomendar partidos</button>
        </form>
      </section>
    </main>
  )
}

function ProfileForm({ profile, teams, updateField }: { profile: UserProfile; teams: string[]; updateField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void }) {
  return (
    <div>
      <label>¿Cuáles son tus selecciones favoritas? Podés elegir más de una.</label>
      <div className="teamGrid">
        {teams.map((team) => (
          <Checkbox key={team} label={team} checked={profile.favoriteTeams.includes(team)} onChange={(checked) => toggleTeam(team, checked, profile, updateField)} />
        ))}
      </div>

      <label>Jugadores favoritos</label>
      <input value={profile.favoritePlayers.join(', ')} onChange={(event) => updateField('favoritePlayers', split(event.target.value))} placeholder="Messi, Mbappe, Haaland" />

      <label>¿Qué regiones de fútbol preferís ver además de tus equipos? Podés elegir más de una.</label>
      <div className="checks">
        {regions.map((region) => (
          <Checkbox key={region} label={region} checked={profile.preferredRegions.includes(region)} onChange={(checked) => toggleRegion(region, checked, profile, updateField)} />
        ))}
      </div>

      <label>¿En qué momentos del día podés ver partidos?</label>
      <div className="checks">
        {moments.map((moment) => (
          <Checkbox key={moment} label={moment} checked={profile.availableMoments.includes(moment)} onChange={(checked) => toggleMoment(moment, checked, profile, updateField)} />
        ))}
      </div>

      <label>Máximo de partidos completos por día</label>
      <input type="number" min="1" max="4" value={profile.maxMatchesPerDay} onChange={(event) => updateField('maxMatchesPerDay', Number(event.target.value))} />
      <p className="hint">Sirve para no recomendarte demasiados partidos largos en una misma fecha. Cada partido se estima en 105 minutos y los horarios se leen en Argentina.</p>

      <Checkbox label="¿Querés darle prioridad a partidos donde juegue algún campeón del mundo histórico?" checked={profile.prioritizeHistoricChampions} onChange={(checked) => updateField('prioritizeHistoricChampions', checked)} />
      <Checkbox label="¿Te interesan los fenómenos de internet o equipos virales?" checked={profile.interestedInViralPhenomena} onChange={(checked) => updateField('interestedInViralPhenomena', checked)} />

      <Slider label="Interés por sorpresas tácticas o equipos underdog" value={profile.tacticalSurpriseInterest} onChange={(value) => updateField('tacticalSurpriseInterest', value)} />

      <label>Respuesta abierta opcional</label>
      <textarea value={profile.openAnswer} onChange={(event) => updateField('openAnswer', event.target.value)} rows={4} />
    </div>
  )
}

function Stats({ grouped }: { grouped: Record<string, Recommendation[]> }) {
  return (
    <div className="stats">
      {categories.map((category) => (
        <article key={category}>
          <span>{category}</span>
          <strong>{watchTimeLabel(grouped[category].length)}</strong>
        </article>
      ))}
    </div>
  )
}

function FilterBar({ filter, setFilter, grouped, total }: { filter: FilterCategory; setFilter: (filter: FilterCategory) => void; grouped: Record<string, Recommendation[]>; total: number }) {
  const options: FilterCategory[] = ['Todos', ...categories]
  return (
    <div className="filters">
      {options.map((option) => (
        <button key={option} className={filter === option ? 'filter active' : 'filter'} onClick={() => setFilter(option)}>
          {option} <span>{option === 'Todos' ? total : grouped[option]?.length}</span>
        </button>
      ))}
    </div>
  )
}

function MatchCard({ match, item }: { match: (typeof matches)[number]; item: Recommendation }) {
  return (
    <article className="matchCard">
      <div className="matchHeader">
        <span className={`badge ${item.category.toLowerCase().replace(/ /g, '-')}`}>{item.category}</span>
        <span className="group">Grupo {match.group}</span>
      </div>
      <h3>{match.home} vs {match.away}</h3>
      <p>{match.date} · {match.argentinaTime} ARG · {match.city}</p>
      <p>{match.stadium}</p>
      <div className="tags">{match.stars.map((star) => <span key={star}>{star}</span>)}</div>
      <div className="parts">{item.parts.map((part) => <span key={part}>{part}</span>)}</div>
      <ul>{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </article>
  )
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label>{label}: {value}/5</label>
      <input type="range" min="1" max="5" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="checkLabel">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function toggleMoment(moment: DayMoment, checked: boolean, profile: UserProfile, updateField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void) {
  const next = checked ? [...profile.availableMoments, moment] : profile.availableMoments.filter((item) => item !== moment)
  updateField('availableMoments', next)
}


function toggleRegion(region: UserProfile['preferredRegions'][number], checked: boolean, profile: UserProfile, updateField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void) {
  const next = checked ? [...profile.preferredRegions, region] : profile.preferredRegions.filter((item) => item !== region)
  updateField('preferredRegions', Array.from(new Set(next)))
}

function toggleTeam(team: string, checked: boolean, profile: UserProfile, updateField: <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => void) {
  const next = checked ? [...profile.favoriteTeams, team] : profile.favoriteTeams.filter((item) => item !== team)
  updateField('favoriteTeams', next)
}

function split(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function loadProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed = raw ? JSON.parse(raw) : {}
    const legacyFavorite = parsed.favoriteTeam ? [parsed.favoriteTeam] : []
    const legacyRegion = parsed.preferredRegion ? [parsed.preferredRegion] : undefined
    return {
      ...initialProfile,
      ...parsed,
      favoriteTeams: parsed.favoriteTeams || legacyFavorite || initialProfile.favoriteTeams,
      preferredRegions: parsed.preferredRegions || legacyRegion || initialProfile.preferredRegions,
    }
  } catch (error) {
    return initialProfile
  }
}

createRoot(document.getElementById('root')!).render(<App />)
