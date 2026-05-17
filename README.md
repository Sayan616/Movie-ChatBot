# 🎬 CineBot — AI Movie Recommender ChatBot

> *"What should I watch tonight?"* — Everyone, every Friday night, forever.

CineBot is tired of you scrolling Netflix for 45 minutes and watching nothing. So it took matters into its own hands.

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Flask](https://img.shields.io/badge/Flask-API-black?style=flat-square&logo=flask)
![HuggingFace](https://img.shields.io/badge/HuggingFace-Transformers-yellow?style=flat-square)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?style=flat-square&logo=bootstrap)

---

## 🧠 What Makes It Different

Just type anything — CineBot figures out what you mean automatically.

> Type *"Brad Pitt"* → Actor Search
> Type *"I feel sad"* → Mood Search
> Type *"space adventure"* → AI Theme Search
> Type *"Inception"* → Similar Movies
> Type *"Tom Hanks comedy"* → Smart Search

No buttons. No dropdowns. Just type.

---

## ✨ Features

### 7 AI-Powered Search Modes
| Mode | What It Does |
|------|-------------|
| 🎭 By Actor | Every film a star has touched, ranked by popularity |
| 🎞️ By Genre | Fast genre filtering with slang support ("scary" → Horror) |
| 😊 By Mood | Detects your actual emotion using NLP — not just what you say |
| 🔍 Pure AI Theme | Finds films by meaning — *"loyal dog in space"* just works |
| ⚡ Hybrid Theme | Balances AI relevance with real-world popularity |
| 🎯 Similar Movies | Content-based filtering using TF-IDF cosine similarity |
| 🧠 Smart Search | Combines actor + genre detection in one query |

### ✨ Auto-Detect Mode
Type anything freely — CineBot uses AI to automatically detect whether you're searching by actor, genre, mood, theme, or movie title. No mode selection needed.

**Detection priority:**
1. Actor + Genre together → Smart Search
2. Person name (NER) → Actor Search
3. Genre keyword → Genre Search
4. Known movie title (fuzzy match) → Similar Movies
5. Strong emotion → Mood Search
6. Default → Hybrid Theme Search

### 🎙️ Voice Search
Click the microphone button and speak your query. Works in Chrome and Edge.

### ⬇️ PDF Export
Download your entire conversation as a beautifully formatted PDF with chat bubbles, movie lists, and page numbers.

### 🔍 TMDB Fallback
If no results are found in the local database, CineBot automatically searches TMDB's live movie database and shows results with a teal badge.

### ⚡ Shortcuts
Collapse/expand mode chips for precision searches when you need a specific mode.

---

## 🛠️ Tech Stack

### Backend — The Brains
| Library | Role |
|---------|------|
| `Flask` | REST API server |
| `HuggingFace Transformers` | Emotion detection (`j-hartmann/emotion-english-distilroberta-base`) |
| `Sentence Transformers` | Semantic search (`all-MiniLM-L6-v2`) |
| `BERT NER` | Actor name extraction (`dslim/bert-base-NER`) |
| `scikit-learn` | TF-IDF cosine similarity matrix |
| `RapidFuzz` | Fuzzy movie title matching — typos welcome |
| `TMDB 5000 Dataset` | 4,800+ movies with cast, genres & keywords |

### Frontend — The Face
| Tool | Role |
|------|------|
| `React 19 + Vite` | Fast, modern UI |
| `Bootstrap 5` | Layout & utilities |
| `jsPDF` | PDF export |
| Custom CSS | Cinematic dark theme with film grain & amber accents |

---

## 📁 Project Structure

```
Movie-ChatBot/
│
├── app.py                      # Flask API + all routes
├── unified_movie_system.py     # AI backend class
├── tmdb_5000_movies.csv        # Movie metadata
├── tmdb_5000_credits.csv       # Cast data
├── .devcontainer/
│   └── devcontainer.json       # Codespaces port config
│
└── movie-chatbot/              # React frontend
    ├── src/
    │   ├── App.jsx             # Chatbot UI + all logic
    │   ├── App.css             # Cinematic dark theme
    │   ├── main.jsx            # Entry point
    │   └── index.css           # Global reset
    ├── .env                    # API URL config
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Getting Started

### Running Locally (Recommended)

**1. Clone the repo**
```bash
git clone https://github.com/Sayan616/cinebot.git
cd Movie-ChatBot
```

**2. Install Python dependencies**
```bash
pip install flask flask-cors torch transformers sentence-transformers rapidfuzz pandas scikit-learn requests
```

**3. Add your dataset files** in the root folder:
- `tmdb_5000_movies.csv`
- `tmdb_5000_credits.csv`

> Download from [Kaggle — TMDB 5000 Movie Dataset](https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata)

**4. Start the Flask backend**
```bash
# Terminal 1
python app.py
```

**5. Start the React frontend**
```bash
# Terminal 2
cd movie-chatbot
npm install
npm run dev
```

**6. Open your browser**
```
http://localhost:5173
```

---

### Running on GitHub Codespaces

Ports are automatically set to public via `.devcontainer/devcontainer.json`.

**Terminal 1 — Flask:**
```bash
python app.py
```

**Terminal 2 — React:**
```bash
cd movie-chatbot
echo "VITE_API_URL=https://YOUR-CODESPACE-NAME-5000.app.github.dev" > .env
npm run dev
```

Replace `YOUR-CODESPACE-NAME` with your actual Codespaces URL from the Ports tab.

---

## ⚡ First Run Note

The first launch takes **2–3 minutes** to compute AI embeddings for all 4,800 movies. After that, everything is cached locally and starts **instantly** on every run after.

Cached files:
- `movie_df.pkl` — processed movie data
- `embeddings.pkl` — AI semantic vectors
- `similarity_matrix.pkl` — TF-IDF similarity scores

---

## 🔑 Optional: TMDB API Key

To enable live TMDB fallback search, get a free API key:
1. Go to [themoviedb.org](https://www.themoviedb.org) → Sign up
2. Settings → API → copy your API Key (v3)
3. Paste it in `app.py`:
```python
TMDB_API_KEY = "your_key_here"
```

---

## 💡 How Auto-Detect Works

```
User types anything
        ↓
Genre keyword check (dictionary lookup)
        ↓
Actor name extraction (BERT NER model)
        ↓
Movie title fuzzy match (RapidFuzz ≥78%)
        ↓
Emotion detection (DistilRoBERTa >55% confidence)
        ↓
Default: Hybrid Theme Search
        ↓
If empty → TMDB Live Fallback
```

---

## 🎭 Built With

Too much coffee, three AI models running simultaneously, and a genuine frustration with decision paralysis on Sunday nights.

---

*If this repo helped you finally pick a movie — drop a ⭐*
