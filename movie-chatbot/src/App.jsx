import { useState, useRef, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import './App.css'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api'

const MODES = [
  { id: 'actor',   icon: '🎭', label: 'Actor',   color: 'mode-red',    prompt: 'Which actor or actress?' },
  { id: 'genre',   icon: '🎞️', label: 'Genre',   color: 'mode-blue',   prompt: 'Which genre? (Action, Horror, Romance...)' },
  { id: 'mood',    icon: '😊', label: 'Mood',    color: 'mode-green',  prompt: 'How are you feeling right now?' },
  { id: 'theme',   icon: '🔍', label: 'AI Theme',color: 'mode-purple', prompt: 'Describe a theme or concept...' },
  { id: 'hybrid',  icon: '⚡', label: 'Popular', color: 'mode-yellow', prompt: 'Describe a theme — balanced with popularity...' },
  { id: 'similar', icon: '🎯', label: 'Similar', color: 'mode-orange', prompt: 'Name a movie you love...' },
  { id: 'smart',   icon: '🧠', label: 'Smart',   color: 'mode-teal',   prompt: 'e.g. "Tom Hanks comedy"...' },
]

const DETECT_META = {
  actor:   { icon: '🎭', label: 'Actor Search',         color: '#e05c5c' },
  genre:   { icon: '🎞️', label: 'Genre Search',         color: '#5c8fe0' },
  mood:    { icon: '😊', label: 'Mood Search',          color: '#5ce0a3' },
  theme:   { icon: '🔍', label: 'AI Theme Search',      color: '#9b5ce0' },
  hybrid:  { icon: '⚡', label: 'Popular Theme Search', color: '#e0c45c' },
  similar: { icon: '🎯', label: 'Similar Movies',       color: '#e0875c' },
  smart:   { icon: '🧠', label: 'Smart Search',         color: '#5cc8e0' },
  auto:    { icon: '✨', label: 'Auto-Detect',          color: '#f5a623' },
}

// ─── API ───────────────────────────────────────────────────────────────────────
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
  const res = await fetch(API_BASE + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

async function callAutoDetect(input) {
  const res = await fetch(API_BASE + '/search/auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: input }) })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

async function callTMDB(query) {
  try {
    const res = await fetch(API_BASE + '/search/tmdb-fallback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
    return res.ok ? res.json() : null
  } catch { return null }
}

function isEmpty(modeId, data) {
  if (modeId === 'similar') return !data.recommendations?.length && !data.error
  return !data.movies?.length
}

function buildResponse(modeId, data, userInput, detectedInfo) {
  const b = { detectedInfo }
  switch (modeId) {
    case 'actor':   return { ...b, type: 'list',  text: `Top movies starring **${detectedInfo || userInput.trim()}**:`, movies: data.movies }
    case 'genre':   return { ...b, type: 'list',  text: `Top **${detectedInfo || userInput.trim()}** movies:`, movies: data.movies }
    case 'mood':    return { ...b, type: 'mood',  text: `Mood detected: **${data.mood}**`, subtext: `Genres: ${data.genres?.join(' · ')}`, movies: data.movies }
    case 'theme':   return { ...b, type: 'scored',text: `Pure AI picks for **"${userInput}"**:`, movies: data.movies }
    case 'hybrid':  return { ...b, type: 'scored',text: `Hybrid picks for **"${userInput}"**:`, movies: data.movies }
    case 'similar':
      if (data.error) return { ...b, type: 'basic', text: data.error, movies: [] }
      return { ...b, type: 'list', text: `Since you liked **${data.matched_movie}**, you might also enjoy:`, movies: data.recommendations }
    case 'smart': {
      const tags = []
      if (data.actor_detected) tags.push(`🎭 ${data.actor_detected}`)
      if (data.genre_detected) tags.push(`🎞️ ${data.genre_detected}`)
      return { ...b, type: 'list', text: tags.length ? `Detected — **${tags.join(' · ')}**` : 'Here are my picks:', movies: data.movies }
    }
    default: return { ...b, type: 'basic', text: 'Something went wrong.', movies: [] }
  }
}

const md = t => t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
let mid = 0
const msg = (role, content) => ({ id: ++mid, role, content })

const WELCOME = msg('bot', {
  type: 'welcome',
  text: 'Welcome to **CineBot**. Just type anything — an actor name, a genre, how you\'re feeling, a theme, or a movie title — and I\'ll figure out the rest automatically.',
})

// ─── PDF ───────────────────────────────────────────────────────────────────────
function exportPDF(messages) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth(), m = 18, mW = W - m * 2
  let y = 20
  const pg = (n = 10) => { if (y + n > 275) { doc.addPage(); y = 20 } }

  doc.setFillColor(10,10,20).rect(0,0,W,28,'F')
  doc.setFont('helvetica','bold').setFontSize(18).setTextColor(245,166,35)
  doc.text('CineBot — Chat Export', m, 17)
  doc.setFontSize(9).setTextColor(140,140,160).text(`Exported on ${new Date().toLocaleString()}`, m, 24)
  y = 36

  messages.forEach(({ role, content }) => {
    if (!content) return; pg(14)
    if (role === 'user') {
      const lbl = content.text || content.label; if (!lbl) return
      doc.setFont('helvetica','bold').setFontSize(9).setTextColor(196,125,10)
      doc.text('YOU', W - m, y, { align: 'right' }); y += 5
      const lines = doc.splitTextToSize(lbl, mW * 0.65)
      const bH = lines.length * 5.5 + 6; pg(bH + 4)
      doc.setFillColor(245,200,100).roundedRect(W - m - mW * 0.65, y - 4, mW * 0.65, bH, 3, 3, 'F')
      doc.setFont('helvetica','normal').setFontSize(10).setTextColor(60,40,10)
      doc.text(lines, W - m - 4, y + 1, { align: 'right' }); y += bH + 6
    } else {
      doc.setFont('helvetica','bold').setFontSize(9).setTextColor(100,100,180)
      doc.text('CINEBOT', m, y); y += 5
      const raw = (content.text || '').replace(/\*\*(.*?)\*\*/g, '$1')
      if (raw) {
        const lines = doc.splitTextToSize(raw, mW * 0.72)
        const bH = lines.length * 5.5 + 6; pg(bH + 4)
        doc.setFillColor(20,22,45).roundedRect(m, y - 4, mW * 0.72, bH, 3, 3, 'F')
        doc.setFont('helvetica','normal').setFontSize(10).setTextColor(220,222,240)
        doc.text(lines, m + 4, y + 1); y += bH + 3
      }
      if (content.subtext) { pg(8); doc.setFont('helvetica','italic').setFontSize(9).setTextColor(130,130,160).text(content.subtext, m+4, y); y+=7 }
      const mvs = content.movies || []
      if (mvs.length) {
        pg(8); doc.setFont('helvetica','bold').setFontSize(9).setTextColor(245,166,35).text('Recommendations:', m+4, y); y+=6
        mvs.forEach((v,i) => { pg(7); const t=typeof v==='string'?v:v.title; doc.setFont('helvetica','normal').setFontSize(10).setTextColor(200,202,220).text(`${String(i+1).padStart(2,'0')}.  ${t}`, m+8, y); y+=6 })
      }
      y += 4
    }
  })
  const ps = doc.internal.getNumberOfPages()
  for (let p=1;p<=ps;p++) { doc.setPage(p); doc.setFont('helvetica','normal').setFontSize(8).setTextColor(80,80,100).text(`CineBot · Page ${p} of ${ps}`, W/2, 290, {align:'center'}) }
  doc.save(`cinebot-${Date.now()}.pdf`)
}

// ─── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages]    = useState([WELCOME])
  const [forcedMode, setForced]    = useState(null)
  const [inputValue, setInput]     = useState('')
  const [isLoading, setLoading]    = useState(false)
  const [isFocused, setFocused]    = useState(false)
  const [isListening, setListen]   = useState(false)
  const [showShortcuts, setShow]   = useState(false)
  const bottomRef = useRef(null), inputRef = useRef(null), recRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isLoading])

  const initVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const r = new SR(); r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1
    r.onresult = e => { setInput(e.results[0][0].transcript); setListen(false) }
    r.onerror = r.onend = () => setListen(false)
    return r
  }, [])

  function toggleVoice() {
    if (isListening) { recRef.current?.stop(); setListen(false); return }
    const r = initVoice()
    if (!r) { alert('Voice not supported. Try Chrome or Edge.'); return }
    recRef.current = r; r.start(); setListen(true)
  }

  const addMsg = (role, content) => setMessages(p => [...p, msg(role, content)])

  async function handleSend() {
    const text = inputValue.trim()
    if (!text || isLoading) return
    setInput(''); addMsg('user', { type: 'text', text }); setLoading(true)

    try {
      let resp

      if (forcedMode) {
        // ── Forced / shortcut mode ──
        const data = await callAPI(forcedMode.id, text)
        if (isEmpty(forcedMode.id, data)) {
          addMsg('bot', { type: 'basic', text: '🔍 Nothing in local DB. Searching TMDB...', movies: [] })
          const tmdb = await callTMDB(text)
          tmdb?.movies?.length
            ? addMsg('bot', { type: 'list', text: `Found on **TMDB** for "${text}":`, movies: tmdb.movies, fromTMDB: true })
            : addMsg('bot', { type: 'basic', text: `❌ No results anywhere for "${text}".`, movies: [] })
        } else {
          resp = buildResponse(forcedMode.id, data, text, null)
          resp.forcedMode = forcedMode.id
          addMsg('bot', resp)
        }

      } else {
        // ── Auto-detect mode ──
        const auto = await callAutoDetect(text)
        const { detected_mode, detected_label, detected_info, data } = auto

        if (isEmpty(detected_mode, data)) {
          addMsg('bot', { type: 'basic', text: '🔍 Nothing in local DB. Searching TMDB...', movies: [] })
          const tmdb = await callTMDB(text)
          tmdb?.movies?.length
            ? addMsg('bot', { type: 'list', text: `Found on **TMDB** for "${text}":`, movies: tmdb.movies, fromTMDB: true, detectedMode: detected_mode, detectedLabel: detected_label })
            : addMsg('bot', { type: 'basic', text: `❌ No results anywhere for "${text}".`, movies: [] })
        } else {
          resp = buildResponse(detected_mode, data, text, detected_info)
          resp.detectedMode = detected_mode; resp.detectedLabel = detected_label
          addMsg('bot', resp)
        }
      }
    } catch (err) {
      addMsg('bot', { type: 'error', text: `⚠️ Cannot reach the backend. Make sure Flask is running.\n\n${err.message}` })
    } finally {
      setLoading(false); setForced(null)
    }
  }

  const handleKey = e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend()} }
  const reset = () => { setMessages([WELCOME]); setForced(null); setInput(''); setShow(false) }

  const voiceOk  = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  const badgeMeta = forcedMode ? DETECT_META[forcedMode.id] : DETECT_META['auto']

  return (
    <div className="app-shell">

      {/* HEADER */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="film-icon"><span className="reel">🎬</span></div>
          <div><h1 className="brand-title">CineBot</h1><p className="brand-sub">AI Movie Recommender</p></div>
        </div>
        <div className="header-actions">
          <div className="status-pill"><span className="status-dot" /><span>AI Active</span></div>
          <button className="pdf-btn" onClick={() => exportPDF(messages)}>⬇ PDF</button>
          <button className="reset-btn" onClick={reset}>↺ Reset</button>
        </div>
      </header>

      {/* FILM STRIP */}
      <div className="filmstrip">{Array.from({length:20}).map((_,i)=><div className="film-hole" key={i}/>)}</div>

      {/* MESSAGES */}
      <main className="chat-window">
        <div className="messages-list">
          {messages.map(m => m.role==='bot' ? <BotMsg key={m.id} c={m.content}/> : <UserMsg key={m.id} c={m.content}/>)}
          {isLoading && <Typing/>}
          <div ref={bottomRef}/>
        </div>
      </main>

      {/* INPUT — always visible */}
      <footer className="input-area">

        {/* Shortcuts bar */}
        <div className="shortcuts-bar">
          <button className={`shortcuts-toggle ${showShortcuts?'open':''}`} onClick={()=>setShow(s=>!s)}>
            <span>⚡ Shortcuts</span><span className="toggle-arrow">{showShortcuts?'▲':'▼'}</span>
          </button>
          {forcedMode && (
            <button className="forced-tag" onClick={()=>setForced(null)} style={{borderColor: DETECT_META[forcedMode.id].color+'55', color: DETECT_META[forcedMode.id].color}}>
              {DETECT_META[forcedMode.id].icon} {forcedMode.label} <span className="tag-x">×</span>
            </button>
          )}
        </div>

        {/* Collapsible chips */}
        {showShortcuts && (
          <div className="chips-row">
            {MODES.map(m => (
              <button key={m.id} className={`mode-chip ${m.color} ${forcedMode?.id===m.id?'chip-active':''}`} onClick={()=>{setForced(m);setShow(false);inputRef.current?.focus()}}>
                <span className="chip-icon">{m.icon}</span><span className="chip-label">{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Text input row */}
        <div className="input-row">
          <div className={`input-wrapper ${isFocused?'focused':''}`}>
            <span className="input-mode-badge" style={{color: badgeMeta.color}}>
              {badgeMeta.icon} {forcedMode ? `${forcedMode.label} mode` : 'Auto-detect — just type anything'}
            </span>
            <input
              ref={inputRef}
              className="chat-input"
              type="text"
              placeholder={forcedMode ? forcedMode.prompt : 'Actor, genre, mood, theme, or a movie title...'}
              value={inputValue}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={handleKey}
              onFocus={()=>setFocused(true)}
              onBlur={()=>setFocused(false)}
              disabled={isLoading}
            />
          </div>
          {voiceOk && (
            <button className={`voice-btn ${isListening?'listening':''}`} onClick={toggleVoice} disabled={isLoading} title={isListening?'Stop':'Voice input'}>
              {isListening?'⏹':'🎙️'}
            </button>
          )}
          <button className="send-btn" onClick={handleSend} disabled={!inputValue.trim()||isLoading}>
            {isLoading?<Spinner/>:'▶'}
          </button>
        </div>

      </footer>
    </div>
  )
}

// ─── BOT MESSAGE ───────────────────────────────────────────────────────────────
function BotMsg({ c }) {
  const { type, text, subtext, movies, fromTMDB, detectedMode, detectedLabel } = c
  return (
    <div className="message-row bot-row">
      <div className="avatar bot-avatar">🤖</div>
      <div className="bubble bot-bubble">
        {detectedMode && (
          <div className="detect-tag" style={{borderColor: DETECT_META[detectedMode]?.color+'44', color: DETECT_META[detectedMode]?.color}}>
            {DETECT_META[detectedMode]?.icon} Auto-detected: <strong>{detectedLabel}</strong>
          </div>
        )}
        {type==='welcome' && <><p className="bubble-text" dangerouslySetInnerHTML={{__html:md(text)}}/><p className="bubble-hint">↓ Type freely or use ⚡ Shortcuts for a specific mode</p></>}
        {type==='prompt'  && <p className="bubble-text prompt-text">{text}</p>}
        {(type==='list'||type==='basic') && <><p className="bubble-text" dangerouslySetInnerHTML={{__html:md(text)}}/>{movies?.length>0&&<MovieList mvs={movies}/>}{fromTMDB&&<TMDBBadge/>}</>}
        {type==='mood'   && <><p className="bubble-text" dangerouslySetInnerHTML={{__html:md(text)}}/>{subtext&&<p className="bubble-sub">{subtext}</p>}{movies?.length>0&&<MovieList mvs={movies}/>}{fromTMDB&&<TMDBBadge/>}</>}
        {type==='scored' && <><p className="bubble-text" dangerouslySetInnerHTML={{__html:md(text)}}/>{movies?.length>0&&<ScoredList mvs={movies}/>}{fromTMDB&&<TMDBBadge/>}</>}
        {type==='error'  && <p className="bubble-text error-text">{text}</p>}
      </div>
    </div>
  )
}

function UserMsg({ c }) {
  return (
    <div className="message-row user-row">
      <div className="bubble user-bubble"><p className="bubble-text">{c.text||c.label}</p></div>
      <div className="avatar user-avatar">🎬</div>
    </div>
  )
}

function MovieList({ mvs }) {
  return (
    <ol className="movie-list">
      {mvs.map((m,i) => {
        const title  = typeof m==='string'?m:m.title
        const year   = typeof m==='object'&&m.year  ?` (${m.year})`   :''
        const rating = typeof m==='object'&&m.rating?` ⭐ ${m.rating}`:''
        return <li key={i} className="movie-item"><span className="movie-num">{String(i+1).padStart(2,'0')}</span><span className="movie-title">{title}{year}</span>{rating&&<span className="movie-rating">{rating}</span>}</li>
      })}
    </ol>
  )
}

function ScoredList({ mvs }) {
  return (
    <div className="scored-list">
      {mvs.map((m,i) => (
        <div key={i} className="scored-item">
          <div className="scored-header"><span className="movie-num">{String(i+1).padStart(2,'0')}</span><span className="scored-title">{m.title}</span><span className="scored-year">{m.year}</span><span className="scored-badge">{m.similarity}</span></div>
          <p className="scored-overview">{m.overview}</p>
        </div>
      ))}
    </div>
  )
}

function TMDBBadge() {
  return <div className="tmdb-badge"><span className="tmdb-dot"/>Live results from TMDB — not in local database</div>
}

function Typing() {
  return <div className="message-row bot-row"><div className="avatar bot-avatar">🤖</div><div className="bubble bot-bubble typing-bubble"><span className="dot"/><span className="dot"/><span className="dot"/></div></div>
}

function Spinner() { return <span className="mini-spinner"/> }