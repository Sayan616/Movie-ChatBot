# 🎬 CineBot — AI Movie Recommender ChatBot

> *"What should I watch tonight?"* — Everyone, every Friday night, forever.

CineBot is tired of you scrolling Netflix for 45 minutes and watching nothing. So it took matters into its own hands.

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Flask](https://img.shields.io/badge/Flask-API-black?style=flat-square&logo=flask)
![HuggingFace](https://img.shields.io/badge/HuggingFace-Transformers-yellow?style=flat-square)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?style=flat-square&logo=bootstrap)
![jsPDF](https://img.shields.io/badge/jsPDF-Export-red?style=flat-square)

---

## 🧠 What Makes It Different

Just type anything — CineBot figures out what you mean automatically.

> Type *"Brad Pitt"* → Actor Search  
> Type *"I feel sad"* → Mood Search  
> Type *"space adventure"* → AI Theme Search  
> Type *"Inception"* → Similar Movies  
> Type *"Tom Hanks comedy"* → Smart Search  

No buttons. No dropdowns. Just type — or speak.

---

## ✨ Features

### 🔮 Auto-Detect Mode
Type anything freely — CineBot uses AI to automatically detect whether you're searching by actor, genre, mood, theme, or movie title.

**Detection priority:**
1. Actor + Genre together → Smart Search
2. Person name (BERT NER) → Actor Search
3. Genre keyword → Genre Search
4. Strong emotion detected → Mood Search
5. Known movie title (fuzzy match ≥82%) → Similar Movies
6. Default → Hybrid Theme Search

### 7 AI-Powered Search Modes
| Mode | What It Does |
|------|-------------|
| 🎭 By Actor | Every film a star has touched, ranked by popularity |
| 🎞️ By Genre | Fast genre filtering with slang support ("scary" → Horror) |
| 😊 By Mood | Detects your actual emotion using NLP — not just what you type |
| 🔍 Pure AI Theme | Finds films by meaning — *"loyal dog in space"* just works |
| ⚡ Hybrid Theme | Balances AI relevance with real-world popularity |
| 🎯 Similar Movies | Content-based filtering using TF-IDF cosine similarity |
| 🧠 Smart Search | Combines actor + genre detection in one natural query |

### 🎙️ Voice-to-Text Search
Click the microphone button and speak your query — no typing needed.

- Uses the **Web Speech API** built into modern browsers
- Auto-fills the input box with your transcribed speech
- Works in **Chrome** and **Edge** (not supported in Firefox/Safari)
- Red pulsing animation while listening, auto-stops after you finish speaking
- Instantly sends to the same auto-detect pipeline as typed queries

### ⬇️ PDF Export (powered by jsPDF)
Download your entire conversation as a beautifully formatted PDF.

- Click the **⬇ PDF** button in the header at any time
- Exports all messages — your queries and CineBot's recommendations
- Styled with dark cinema theme: dark bubbles, amber accents, coloured headings
- Multi-page support with automatic page breaks
- Includes movie titles, years, ratings, and overview snippets
- Footer shows page numbers on every page
- Filename includes timestamp so exports never overwrite each other

### 🔍 TMDB Live Fallback
If no results found in the local 4,800-movie database, CineBot automatically searches TMDB's live API and shows results with a teal badge.

### ⚡ Shortcuts
Expand mode chips for precision searches when auto-detect isn't what you need.

---

## 🛠️ Tech Stack

### Backend
| Library | Role |
|---------|------|
| `Flask` | REST API server |
| `HuggingFace Transformers` | Emotion detection (`j-hartmann/emotion-english-distilroberta-base`) |
| `Sentence Transformers` | Semantic search (`all-MiniLM-L6-v2`) |
| `BERT NER` | Actor name extraction (`dslim/bert-base-NER`) |
| `scikit-learn` | TF-IDF cosine similarity matrix |
| `RapidFuzz` | Fuzzy movie title matching |
| `requests` | TMDB live API fallback |
| `TMDB 5000 Dataset` | 4,800+ movies with cast, genres & keywords |

### Frontend
| Tool | Role |
|------|------|
| `React 19 + Vite` | Fast, modern UI |
| `Bootstrap 5` | Layout & utilities |
| `jsPDF` | PDF chat export with styled layout |
| `Web Speech API` | Browser-native voice-to-text (no library needed) |
| Custom CSS | Cinematic dark theme with amber accents |

---

## 📁 Project Structure

```
Movie-ChatBot/
│
├── app.py                      # Flask API + auto-detect routing
├── unified_movie_system.py     # AI backend — all 7 search methods
├── tmdb_5000_movies.csv        # Movie metadata
├── tmdb_5000_credits.csv       # Cast data
├── .devcontainer/
│   └── devcontainer.json       # Codespaces port config
│
└── movie-chatbot/              # React frontend
    ├── src/
    │   ├── App.jsx             # Chatbot UI + voice + PDF logic
    │   ├── App.css             # Cinematic dark theme
    │   ├── main.jsx            # Entry point
    │   └── index.css           # Global reset
    ├── vite.config.js          # Dev proxy config
    └── package.json
```

---

## 🚀 Getting Started

### Running Locally

**1. Clone the repo**
```bash
git clone https://github.com/Sayan616/Movie-ChatBot.git
cd Movie-ChatBot
```

**2. Install Python dependencies**
```bash
pip install flask flask-cors torch transformers sentence-transformers rapidfuzz pandas scikit-learn requests
```

**3. Add dataset files** to the root folder:
- `tmdb_5000_movies.csv`
- `tmdb_5000_credits.csv`

> Download from [Kaggle — TMDB 5000 Movie Dataset](https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata)

**4. Install frontend dependencies**
```bash
cd movie-chatbot
npm install
```

**5. Start Flask** (Terminal 1)
```bash
python app.py
```

**6. Start React** (Terminal 2)
```bash
cd movie-chatbot
npm run dev
```

**7. Open browser**
```
http://localhost:5173
```

---

### Running on GitHub Codespaces

Ports auto-set to public via `.devcontainer/devcontainer.json`.

**Terminal 1:**
```bash
python app.py
```

**Terminal 2:**
```bash
cd movie-chatbot && npm run dev
```

Click the 🌐 globe icon next to port **5173** in the Ports tab to open the app.

---

## ⚡ First Run Note

The first launch takes **2–3 minutes** to build AI embeddings for all 4,800 movies. Everything is cached after that — next runs start in seconds.

Auto-generated cache files:
- `movie_df.pkl` — processed movie data
- `embeddings.pkl` — semantic AI vectors
- `similarity_matrix.pkl` — TF-IDF similarity scores

---

## 🔑 Optional: TMDB API Key

Get a free key at [themoviedb.org](https://www.themoviedb.org) → Settings → API, then set it in `app.py`:

```python
TMDB_API_KEY = "your_key_here"
```

---

## 🎙️ Voice Search — Browser Compatibility

| Browser | Supported |
|---------|-----------|
| Chrome  | ✅ Yes |
| Edge    | ✅ Yes |
| Firefox | ❌ No |
| Safari  | ❌ No |

Voice search uses the browser's built-in `SpeechRecognition` API — no external service or API key needed.

---

## ⬇️ PDF Export — What's Included

Each exported PDF contains:
- Header with CineBot branding and export timestamp
- Your messages (right-aligned, amber bubbles)
- CineBot responses (left-aligned, dark bubbles)
- Full movie recommendation lists with numbering
- Page numbers on every page
- Timestamped filename to avoid overwriting

---

## 💡 How Auto-Detect Works

```
User types or speaks anything
           ↓
Genre keyword check (dictionary lookup)
           ↓
Actor name extraction (BERT NER model)
  + Validation: must have ≥3 movies in DB
           ↓
Emotion detection (DistilRoBERTa >55% confidence)
           ↓
Movie title fuzzy match (RapidFuzz ≥82%)
  — skipped if emotional words detected
           ↓
Default → Hybrid Theme Search (AI + Popularity)
           ↓
Empty results? → TMDB Live API Fallback
```

---

## 🎭 Built With

Too much coffee, three AI models running simultaneously, a Web Speech API, a PDF renderer, and a genuine frustration with decision paralysis on Sunday nights.

---

*If this helped you finally pick a movie — drop a ⭐*
