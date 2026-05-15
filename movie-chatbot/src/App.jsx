import { useState, useRef, useEffect } from 'react'
import './App.css'

// ─── API CONFIG ────────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:5000/api'

// ─── SEARCH MODES ──────────────────────────────────────────────────────────────
const MODES = [
  { id: 'actor',   icon: '🎭', label: 'By Actor',       color: 'mode-red',    prompt: 'Which actor or actress are you looking for?' },
  { id: 'genre',   icon: '🎞️', label: 'By Genre',       color: 'mode-blue',   prompt: 'What genre? (e.g. Action, Romance, Horror, Sci-Fi...)' },
  { id: 'mood',    icon: '😊', label: 'By Mood',        color: 'mode-green',  prompt: 'How are you feeling right now? Describe your vibe...' },
  { id: 'theme',   icon: '🔍', label: 'AI Theme',       color: 'mode-purple', prompt: 'Describe a theme or concept (e.g. "loyal animal companion in space")' },
  { id: 'hybrid',  icon: '⚡', label: 'Popular Theme',  color: 'mode-yellow', prompt: 'Describe a theme — I\'ll balance AI relevance with popularity...' },
  { id: 'similar', icon: '🎯', label: 'Similar Movies', color: 'mode-orange', prompt: 'Name a movie you love and I\'ll find similar picks...' },
  { id: 'smart',   icon: '🧠', label: 'Smart Search',   color: 'mode-teal',   prompt: 'Try something like "Tom Hanks comedy" or "Scarlett Johansson thriller"...' },
]

// ─── API CALLER ────────────────────────────────────────────────────────────────
async function callAPI(mode, input) {
  const config = {
    actor:   { url: '/search/cast',         body: { actor: input } },
    genre:   { url: '/search/genre',        body: { genre: input } },
    mood:    { url: '/search/mood',         body: { text:  input } },
    theme:   { url: '/search/theme',        body: { query: input } },
    hybrid:  { url: '/search/theme-hybrid', body: { query: input } },
    similar: { url: '/search/similar',      body: { title: input } },
    smart:   { url: '/search/smart',        body: { query: input } },
  }
  const { url, body } = config[mode]
  const res = await fetch(API_BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

// ─── RESPONSE FORMATTER ────────────────────────────────────────────────────────
function buildBotResponse(mode, data, userInput) {
  switch (mode) {
    case 'actor':
      if (!data.movies?.length)
        return { text: `No movies found for "${userInput}". Try checking the spelling!`, movies: [], type: 'basic' }
      return { text: `Top movies starring **${userInput.trim()}**:`, movies: data.movies, type: 'list' }

    case 'genre':
      if (!data.movies?.length)
        return { text: `No movies found for genre "${userInput}". Try "Action", "Romance" or "Thriller".`, movies: [], type: 'basic' }
      return { text: `Top **${userInput.trim()}** movies:`, movies: data.movies, type: 'list' }

    case 'mood':
      return {
        text: `Mood detected: **${data.mood}**`,
        subtext: `Genres matched: ${data.genres?.join(' · ')}`,
        movies: data.movies,
        type: 'mood',
      }

    case 'theme':
      if (!data.movies?.length)
        return { text: `No matches found. Try a more descriptive theme.`, movies: [], type: 'basic' }
      return { text: `Pure AI picks for **"${userInput.trim()}"**:`, movies: data.movies, type: 'scored' }

    case 'hybrid':
      if (!data.movies?.length)
        return { text: `No matches found. Try a different theme.`, movies: [], type: 'basic' }
      return { text: `Hybrid AI + Popularity picks for **"${userInput.trim()}"**:`, movies: data.movies, type: 'scored' }

    case 'similar':
      if (data.error || typeof data === 'string')
        return { text: data.error || data, movies: [], type: 'basic' }
      return {
        text: `Since you liked **${data.matched_movie}**, you might also enjoy:`,
        movies: data.recommendations,
        type: 'list',
      }

    case 'smart': {
      const tags = []
      if (data.actor_detected) tags.push(`🎭 ${data.actor_detected}`)
      if (data.genre_detected) tags.push(`🎞️ ${data.genre_detected}`)
      return {
        text: tags.length
          ? `Detected — **${tags.join('  ·  ')}**`
          : `Here are my picks:`,
        movies: data.movies,
        type: 'list',
      }
    }

    default:
      return { text: 'Something went wrong parsing the response.', movies: [], type: 'basic' }
  }
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function parseMarkdown(text) {
  // Simple bold (**text**) renderer
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

let msgId = 0
function makeMsg(role, content) {
  return { id: ++msgId, role, content, ts: Date.now() }
}

// ─── WELCOME MESSAGE ───────────────────────────────────────────────────────────
const WELCOME = makeMsg('bot', {
  type: 'welcome',
  text: 'Welcome to the **Movie Recommender**. I can find films by actor, genre, mood, theme, or smart search. How would you like to explore?',
})

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [messages, setMessages]     = useState([WELCOME])
  const [currentMode, setMode]      = useState(null)
  const [inputValue, setInput]      = useState('')
  const [isLoading, setLoading]     = useState(false)
  const [isFocused, setFocused]     = useState(false)
  const bottomRef                   = useRef(null)
  const inputRef                    = useRef(null)

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input after mode selected
  useEffect(() => {
    if (currentMode) inputRef.current?.focus()
  }, [currentMode])

  const addMsg = (role, content) =>
    setMessages(prev => [...prev, makeMsg(role, content)])

  // ── Mode chip clicked ──
  function selectMode(mode) {
    setMode(mode)
    addMsg('user', { type: 'chip', label: `${mode.icon} ${mode.label}` })
    addMsg('bot',  { type: 'prompt', text: mode.prompt, modeId: mode.id })
  }

  // ── Send user message ──
  async function handleSend() {
    const text = inputValue.trim()
    if (!text || isLoading) return
    if (!currentMode) return

    setInput('')
    addMsg('user', { type: 'text', text })
    setLoading(true)

    try {
      const data = await callAPI(currentMode.id, text)
      const response = buildBotResponse(currentMode.id, data, text)
      addMsg('bot', response)
    } catch (err) {
      addMsg('bot', {
        type: 'error',
        text: `⚠️ Could not reach the backend. Make sure your Flask server is running on port 5000.\n\n\`${err.message}\``,
      })
    } finally {
      setLoading(false)
      setMode(null) // Reset mode — show chips again
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function reset() {
    setMessages([WELCOME])
    setMode(null)
    setInput('')
  }

  const activeModeInfo = currentMode

  return (
    <div className="app-shell">
      {/* ── HEADER ── */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="film-icon">
            <span className="reel">🎬</span>
          </div>
          <div>
            <h1 className="brand-title">CineBot</h1>
            <p className="brand-sub">AI Movie Recommender</p>
          </div>
        </div>
        <div className="header-actions">
          <div className="status-pill">
            <span className="status-dot"></span>
            <span>AI Active</span>
          </div>
          <button className="reset-btn" onClick={reset} title="Start over">
            ↺ Reset
          </button>
        </div>
      </header>

      {/* ── FILM STRIP ── */}
      <div className="filmstrip">
        {Array.from({ length: 20 }).map((_, i) => (
          <div className="film-hole" key={i} />
        ))}
      </div>

      {/* ── MESSAGES ── */}
      <main className="chat-window">
        <div className="messages-list">
          {messages.map(msg => (
            msg.role === 'bot'
              ? <BotMessage key={msg.id} content={msg.content} />
              : <UserMessage key={msg.id} content={msg.content} />
          ))}

          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── INPUT AREA ── */}
      <footer className="input-area">
        {!currentMode ? (
          /* Mode not selected — show quick chips */
          <div className="mode-grid">
            <p className="chips-label">Choose a search mode:</p>
            <div className="chips-row">
              {MODES.map(m => (
                <button
                  key={m.id}
                  className={`mode-chip ${m.color}`}
                  onClick={() => selectMode(m)}
                >
                  <span className="chip-icon">{m.icon}</span>
                  <span className="chip-label">{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Mode selected — show text input */
          <div className="input-row">
            <button
              className="back-btn"
              onClick={() => setMode(null)}
              title="Change mode"
            >
              ‹
            </button>
            <div className={`input-wrapper ${isFocused ? 'focused' : ''}`}>
              <span className="input-mode-badge">{activeModeInfo.icon} {activeModeInfo.label}</span>
              <input
                ref={inputRef}
                className="chat-input"
                type="text"
                placeholder={activeModeInfo.prompt}
                value={inputValue}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={isLoading}
              />
            </div>
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
            >
              {isLoading ? <Spinner /> : '▶'}
            </button>
          </div>
        )}
      </footer>
    </div>
  )
}

// ─── BOT MESSAGE ───────────────────────────────────────────────────────────────
function BotMessage({ content }) {
  const { type, text, subtext, movies } = content

  return (
    <div className="message-row bot-row">
      <div className="avatar bot-avatar">🤖</div>
      <div className="bubble bot-bubble">

        {type === 'welcome' && (
          <>
            <p
              className="bubble-text"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
            />
            <p className="bubble-hint">Pick a mode below ↓</p>
          </>
        )}

        {type === 'prompt' && (
          <p className="bubble-text prompt-text">{text}</p>
        )}

        {(type === 'list' || type === 'basic') && (
          <>
            <p
              className="bubble-text"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
            />
            {movies?.length > 0 && <MovieList movies={movies} />}
          </>
        )}

        {type === 'mood' && (
          <>
            <p
              className="bubble-text mood-title"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
            />
            {subtext && <p className="bubble-sub">{subtext}</p>}
            {movies?.length > 0 && <MovieList movies={movies} />}
          </>
        )}

        {type === 'scored' && (
          <>
            <p
              className="bubble-text"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(text) }}
            />
            {movies?.length > 0 && <ScoredMovieList movies={movies} />}
          </>
        )}

        {type === 'error' && (
          <p className="bubble-text error-text">{text}</p>
        )}
      </div>
    </div>
  )
}

// ─── USER MESSAGE ──────────────────────────────────────────────────────────────
function UserMessage({ content }) {
  const isChip = content.type === 'chip'
  return (
    <div className="message-row user-row">
      <div className={`bubble user-bubble ${isChip ? 'chip-bubble' : ''}`}>
        {isChip
          ? <span className="chip-selection">{content.label}</span>
          : <p className="bubble-text">{content.text}</p>
        }
      </div>
      <div className="avatar user-avatar">🎬</div>
    </div>
  )
}

// ─── MOVIE LIST ────────────────────────────────────────────────────────────────
function MovieList({ movies }) {
  return (
    <ol className="movie-list">
      {movies.map((title, i) => (
        <li key={i} className="movie-item">
          <span className="movie-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="movie-title">{title}</span>
        </li>
      ))}
    </ol>
  )
}

// ─── SCORED MOVIE LIST (theme searches) ────────────────────────────────────────
function ScoredMovieList({ movies }) {
  return (
    <div className="scored-list">
      {movies.map((m, i) => (
        <div key={i} className="scored-item">
          <div className="scored-header">
            <span className="movie-num">{String(i + 1).padStart(2, '0')}</span>
            <span className="scored-title">{m.title}</span>
            <span className="scored-year">{m.year}</span>
            <span className="scored-badge">{m.similarity}</span>
          </div>
          <p className="scored-overview">{m.overview}</p>
        </div>
      ))}
    </div>
  )
}

// ─── TYPING INDICATOR ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="message-row bot-row">
      <div className="avatar bot-avatar">🤖</div>
      <div className="bubble bot-bubble typing-bubble">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  )
}

// ─── MINI SPINNER ─────────────────────────────────────────────────────────────
function Spinner() {
  return <span className="mini-spinner" />
}
