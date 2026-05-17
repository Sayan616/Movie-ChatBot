import { useState, useRef, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import './App.css'

const API_BASE = '/api'

const MODES = [
  { id: 'actor',   icon: '🎭', label: 'Actor',    color: 'chip-red',    prompt: 'Which actor or actress?' },
  { id: 'genre',   icon: '🎞️', label: 'Genre',    color: 'chip-blue',   prompt: 'Which genre? (Action, Horror, Romance...)' },
  { id: 'mood',    icon: '😊', label: 'Mood',     color: 'chip-green',  prompt: 'How are you feeling right now?' },
  { id: 'theme',   icon: '🔍', label: 'AI Theme', color: 'chip-purple', prompt: 'Describe a theme or concept...' },
  { id: 'hybrid',  icon: '⚡', label: 'Popular',  color: 'chip-yellow', prompt: 'Describe a theme — balanced with popularity...' },
  { id: 'similar', icon: '🎯', label: 'Similar',  color: 'chip-orange', prompt: 'Name a movie you love...' },
  { id: 'smart',   icon: '🧠', label: 'Smart',    color: 'chip-teal',   prompt: 'e.g. "Tom Hanks comedy"...' },
]

const META = {
  actor:   { icon: '🎭', label: 'Actor Search',         color: '#f87171' },
  genre:   { icon: '🎞️', label: 'Genre Search',         color: '#60a5fa' },
  mood:    { icon: '😊', label: 'Mood Search',          color: '#34d399' },
  theme:   { icon: '🔍', label: 'AI Theme Search',      color: '#a78bfa' },
  hybrid:  { icon: '⚡', label: 'Popular Theme Search', color: '#fbbf24' },
  similar: { icon: '🎯', label: 'Similar Movies',       color: '#fb923c' },
  smart:   { icon: '🧠', label: 'Smart Search',         color: '#22d3ee' },
  auto:    { icon: '✨', label: 'Auto-Detect',          color: '#e879f9' },
}

async function callAPI(modeId, input) {
  const config = {
    actor:   { url: '/search/cast',         body: { actor: input } },
    genre:   { url: '/search/genre',        body: { genre: input } },
    mood:    { url: '/search/mood',         body: { text:  input } },
    theme:   { url: '/search/theme',        body: { query: input } },
    hybrid:  { url: '/search/theme-hybrid', body: { query: input } },
    similar: { url: '/search/similar',      body: { title: input } },
    smart:   { url: '/search/smart',        body: { query: input } },
  }
  const { url, body } = config[modeId]
  const res = await fetch(API_BASE + url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function callAuto(input) {
  const res = await fetch(API_BASE + '/search/auto', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: input }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

async function callTMDB(query) {
  try {
    const res = await fetch(API_BASE + '/search/tmdb-fallback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    return res.ok ? res.json() : null
  } catch { return null }
}

function isEmpty(modeId, data) {
  if (modeId === 'similar') return !data.recommendations?.length && !data.error
  return !data.movies?.length
}

function buildResponse(modeId, data, input, info) {
  const b = { detectedInfo: info }
  switch (modeId) {
    case 'actor':   return { ...b, type: 'list',   text: `Top movies starring **${info || input}**:`, movies: data.movies }
    case 'genre':   return { ...b, type: 'list',   text: `Top **${info || input}** movies:`, movies: data.movies }
    case 'mood':    return { ...b, type: 'mood',   text: `Mood: **${data.mood}**`, subtext: `Genres: ${data.genres?.join(' · ')}`, movies: data.movies }
    case 'theme':   return { ...b, type: 'scored', text: `AI picks for **"${input}"**:`, movies: data.movies }
    case 'hybrid':  return { ...b, type: 'scored', text: `Popular picks for **"${input}"**:`, movies: data.movies }
    case 'similar':
      if (data.error) return { ...b, type: 'basic', text: data.error, movies: [] }
      return { ...b, type: 'list', text: `Since you liked **${data.matched_movie}**:`, movies: data.recommendations }
    case 'smart': {
      const tags = []
      if (data.actor_detected) tags.push(`🎭 ${data.actor_detected}`)
      if (data.genre_detected) tags.push(`🎞️ ${data.genre_detected}`)
      return { ...b, type: 'list', text: tags.length ? `Found — **${tags.join(' · ')}**` : 'Here are my picks:', movies: data.movies }
    }
    default: return { ...b, type: 'basic', text: 'Something went wrong.', movies: [] }
  }
}

const md = t => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
let mid = 0
const mkMsg = (role, content) => ({ id: ++mid, role, content })

const WELCOME = mkMsg('bot', {
  type: 'welcome',
  text: 'Hey! I\'m **CineBot**. Just type anything — an actor, a genre, how you\'re feeling, a theme, or a movie name — and I\'ll figure it out.',
})

function exportPDF(messages) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), m = 18, mW = W - m * 2
  let y = 20
  const pg = (n = 10) => { if (y + n > 275) { doc.addPage(); y = 20 } }
  doc.setFillColor(10, 10, 20).rect(0, 0, W, 28, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(232, 121, 249)
  doc.text('CineBot — Chat Export', m, 17)
  doc.setFontSize(9).setTextColor(140, 140, 160).text(`Exported on ${new Date().toLocaleString()}`, m, 24)
  y = 36
  messages.forEach(({ role, content }) => {
    if (!content) return; pg(14)
    if (role === 'user') {
      const lbl = content.text || content.label; if (!lbl) return
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(160, 100, 200)
      doc.text('YOU', W - m, y, { align: 'right' }); y += 5
      const lines = doc.splitTextToSize(lbl, mW * 0.65)
      const bH = lines.length * 5.5 + 6; pg(bH + 4)
      doc.setFillColor(80, 40, 120).roundedRect(W - m - mW * 0.65, y - 4, mW * 0.65, bH, 3, 3, 'F')
      doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(220, 180, 255)
      doc.text(lines, W - m - 4, y + 1, { align: 'right' }); y += bH + 6
    } else {
      doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(100, 100, 200)
      doc.text('CINEBOT', m, y); y += 5
      const raw = (content.text || '').replace(/\*\*(.*?)\*\*/g, '$1')
      if (raw) {
        const lines = doc.splitTextToSize(raw, mW * 0.72)
        const bH = lines.length * 5.5 + 6; pg(bH + 4)
        doc.setFillColor(15, 15, 35).roundedRect(m, y - 4, mW * 0.72, bH, 3, 3, 'F')
        doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(200, 200, 230)
        doc.text(lines, m + 4, y + 1); y += bH + 3
      }
      if (content.subtext) { pg(8); doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(130, 130, 160).text(content.subtext, m + 4, y); y += 7 }
      const mvs = content.movies || []
      if (mvs.length) {
        pg(8); doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(232, 121, 249).text('Recommendations:', m + 4, y); y += 6
        mvs.forEach((v, i) => { pg(7); const t = typeof v === 'string' ? v : v.title; doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(190, 190, 220).text(`${String(i + 1).padStart(2, '0')}.  ${t}`, m + 8, y); y += 6 })
      }
      y += 4
    }
  })
  const ps = doc.internal.getNumberOfPages()
  for (let p = 1; p <= ps; p++) { doc.setPage(p); doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(80, 80, 100).text(`CineBot · Page ${p} of ${ps}`, W / 2, 290, { align: 'center' }) }
  doc.save(`cinebot-${Date.now()}.pdf`)
}

export default function App() {
  const [messages, setMessages] = useState([WELCOME])
  const [forced, setForced]     = useState(null)
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [focused, setFocused]   = useState(false)
  const [listening, setListen]  = useState(false)
  const [shortcuts, setShorts]  = useState(false)
  const bottomRef = useRef(null), inputRef = useRef(null), recRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const initVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1
    r.onresult = e => { setInput(e.results[0][0].transcript); setListen(false) }
    r.onerror = r.onend = () => setListen(false)
    return r
  }, [])

  function toggleVoice() {
    if (listening) { recRef.current?.stop(); setListen(false); return }
    const r = initVoice()
    if (!r) { alert('Voice not supported. Try Chrome.'); return }
    recRef.current = r; r.start(); setListen(true)
  }

  const add = (role, content) => setMessages(p => [...p, mkMsg(role, content)])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput(''); add('user', { type: 'text', text }); setLoading(true)
    try {
      if (forced) {
        const data = await callAPI(forced.id, text)
        if (isEmpty(forced.id, data)) {
          add('bot', { type: 'basic', text: '🔍 Nothing found locally. Searching TMDB...', movies: [] })
          const tmdb = await callTMDB(text)
          tmdb?.movies?.length
            ? add('bot', { type: 'list', text: `Found on **TMDB** for "${text}":`, movies: tmdb.movies, fromTMDB: true })
            : add('bot', { type: 'basic', text: `❌ No results found for "${text}".`, movies: [] })
        } else {
          add('bot', { ...buildResponse(forced.id, data, text, null), forcedMode: forced.id })
        }
      } else {
        const auto = await callAuto(text)
        const { detected_mode, detected_label, detected_info, data } = auto
        if (isEmpty(detected_mode, data)) {
          add('bot', { type: 'basic', text: '🔍 Nothing found locally. Searching TMDB...', movies: [] })
          const tmdb = await callTMDB(text)
          tmdb?.movies?.length
            ? add('bot', { type: 'list', text: `Found on **TMDB** for "${text}":`, movies: tmdb.movies, fromTMDB: true, detectedMode: detected_mode, detectedLabel: detected_label })
            : add('bot', { type: 'basic', text: `❌ No results found for "${text}".`, movies: [] })
        } else {
          const resp = buildResponse(detected_mode, data, text, detected_info)
          add('bot', { ...resp, detectedMode: detected_mode, detectedLabel: detected_label })
        }
      }
    } catch (err) {
      add('bot', { type: 'error', text: `⚠️ Cannot reach backend. Is Flask running?\n\n${err.message}` })
    } finally {
      setLoading(false); setForced(null)
    }
  }

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const reset = () => { setMessages([WELCOME]); setForced(null); setInput(''); setShorts(false) }
  const badge = forced ? META[forced.id] : META['auto']
  const voiceOk = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  return (
    <div className="shell">
      <header className="hdr">
        <div className="hdr-brand">
          <div className="logo"><span className="logo-icon">🎬</span></div>
          <div>
            <h1 className="brand">CineBot</h1>
            <p className="brand-sub">AI Movie Recommender</p>
          </div>
        </div>
        <div className="hdr-right">
          <span className="alive"><span className="alive-dot" />Live</span>
          <button className="btn-pdf" onClick={() => exportPDF(messages)}>⬇ PDF</button>
          <button className="btn-reset" onClick={reset}>↺ Reset</button>
        </div>
      </header>

      <div className="strip">{Array.from({ length: 24 }).map((_, i) => <span className="hole" key={i} />)}</div>

      <main className="chat">
        <div className="msgs">
          {messages.map(m => m.role === 'bot'
            ? <BotMsg key={m.id} c={m.content} />
            : <UserMsg key={m.id} c={m.content} />
          )}
          {loading && <Typing />}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="footer">
        <div className="sbar">
          <button className={`stoggle ${shortcuts ? 'on' : ''}`} onClick={() => setShorts(s => !s)}>
            ⚡ Shortcuts <span className="arr">{shortcuts ? '▲' : '▼'}</span>
          </button>
          {forced && (
            <button className="ftag" onClick={() => setForced(null)} style={{ color: META[forced.id].color, borderColor: META[forced.id].color + '55' }}>
              {META[forced.id].icon} {forced.label} <span className="x">×</span>
            </button>
          )}
        </div>

        {shortcuts && (
          <div className="chips">
            {MODES.map(m => (
              <button key={m.id} className={`chip ${m.color} ${forced?.id === m.id ? 'chip-on' : ''}`}
                onClick={() => { setForced(m); setShorts(false); inputRef.current?.focus() }}>
                <span>{m.icon}</span><span className="clbl">{m.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="irow">
          <div className={`ibox ${focused ? 'ibox-on' : ''}`}>
            <span className="ibadge" style={{ color: badge.color }}>
              {badge.icon} {forced ? `${forced.label} mode` : 'Auto-detect — just type anything'}
            </span>
            <input
              ref={inputRef}
              className="inp"
              type="text"
              placeholder={forced ? forced.prompt : 'Actor, genre, mood, theme, or movie title...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={loading}
            />
          </div>
          {voiceOk && (
            <button className={`vbtn ${listening ? 'vbtn-on' : ''}`} onClick={toggleVoice} disabled={loading}>
              {listening ? '⏹' : '🎙️'}
            </button>
          )}
          <button className="sbtn" onClick={send} disabled={!input.trim() || loading}>
            {loading ? <span className="spin" /> : '▶'}
          </button>
        </div>
      </footer>
    </div>
  )
}

function BotMsg({ c }) {
  const { type, text, subtext, movies, fromTMDB, detectedMode, detectedLabel } = c
  return (
    <div className="mrow brow">
      <div className="av bav">🤖</div>
      <div className="bub bbub">
        {detectedMode && (
          <div className="dtag" style={{ color: META[detectedMode]?.color, borderColor: META[detectedMode]?.color + '44' }}>
            {META[detectedMode]?.icon} Auto-detected: <strong>{detectedLabel}</strong>
          </div>
        )}
        {type === 'welcome' && <><p className="bt" dangerouslySetInnerHTML={{ __html: md(text) }} /><p className="hint">↓ Type freely or use ⚡ Shortcuts</p></>}
        {type === 'prompt' && <p className="bt pt">{text}</p>}
        {(type === 'list' || type === 'basic') && <><p className="bt" dangerouslySetInnerHTML={{ __html: md(text) }} />{movies?.length > 0 && <MList mvs={movies} />}{fromTMDB && <TBadge />}</>}
        {type === 'mood' && <><p className="bt" dangerouslySetInnerHTML={{ __html: md(text) }} />{subtext && <p className="bsub">{subtext}</p>}{movies?.length > 0 && <MList mvs={movies} />}{fromTMDB && <TBadge />}</>}
        {type === 'scored' && <><p className="bt" dangerouslySetInnerHTML={{ __html: md(text) }} />{movies?.length > 0 && <SList mvs={movies} />}{fromTMDB && <TBadge />}</>}
        {type === 'error' && <p className="bt errt">{text}</p>}
      </div>
    </div>
  )
}

function UserMsg({ c }) {
  return (
    <div className="mrow urow">
      <div className="bub ubub"><p className="bt">{c.text || c.label}</p></div>
      <div className="av uav">🎬</div>
    </div>
  )
}

function MList({ mvs }) {
  return (
    <ol className="mlist">
      {mvs.map((m, i) => {
        const title = typeof m === 'string' ? m : m.title
        const year = typeof m === 'object' && m.year ? ` (${m.year})` : ''
        const rating = typeof m === 'object' && m.rating ? ` ⭐ ${m.rating}` : ''
        return (
          <li key={i} className="mitem">
            <span className="mnum">{String(i + 1).padStart(2, '0')}</span>
            <span className="mtitle">{title}{year}</span>
            {rating && <span className="mrat">{rating}</span>}
          </li>
        )
      })}
    </ol>
  )
}

function SList({ mvs }) {
  return (
    <div className="slist">
      {mvs.map((m, i) => (
        <div key={i} className="sitem">
          <div className="shdr">
            <span className="mnum">{String(i + 1).padStart(2, '0')}</span>
            <span className="stitle">{m.title}</span>
            <span className="syear">{m.year}</span>
            <span className="sbadge">{m.similarity}</span>
          </div>
          <p className="sovr">{m.overview}</p>
        </div>
      ))}
    </div>
  )
}

function TBadge() {
  return <div className="tbadge"><span className="tdot" />Live from TMDB — not in local database</div>
}

function Typing() {
  return (
    <div className="mrow brow">
      <div className="av bav">🤖</div>
      <div className="bub bbub typing"><span className="d" /><span className="d" /><span className="d" /></div>
    </div>
  )
}

function Spinner() { return <span className="spin" /> }