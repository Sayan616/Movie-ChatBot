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

This isn't your average "just filter by genre" recommender. CineBot runs **7 AI-powered search modes**, each smarter than the last:

| Mode | What It Does |
|------|-------------|
| 🎭 By Actor | Every film a star has touched, ranked by popularity |
| 🎞️ By Genre | Classic but fast |
| 😊 By Mood | Detects your *actual* emotion using NLP — not just what you say |
| 🔍 Pure AI Theme | Finds films by meaning — *"loyal dog in space"* just works |
| ⚡ Hybrid Theme | Balances AI relevance with real-world popularity |
| 🎯 Similar Movies | Content-based filtering using TF-IDF cosine similarity |
| 🧠 Smart Search | Type *"Brad Pitt thriller"* — it figures out the rest |

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
| Custom CSS | Cinematic dark theme with film grain & amber accents |

---

## 📁 Project Structure

```
cinebot/
│
├── app.py                   # Flask API + UnifiedMovieSystem class
├── tmdb_5000_movies.csv     # Movie metadata
├── tmdb_5000_credits.csv    # Cast data
│
└── Movie-ChatBot/           # React frontend
    ├── src/
    │   ├── App.jsx          # Chatbot UI + all logic
    │   ├── App.css          # Cinematic dark theme
    │   ├── main.jsx         # Entry point
    │   └── index.css        # Global reset
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/Sayan616/cinebot.git
cd cinebot
```

### 2. Install Python dependencies
```bash
pip install flask flask-cors torch transformers sentence-transformers rapidfuzz pandas scikit-learn
```

### 3. Add your dataset files
Place these two CSV files in the root folder:
- `tmdb_5000_movies.csv`
- `tmdb_5000_credits.csv`

> Download from [Kaggle — TMDB 5000 Movie Dataset](https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata)

### 4. Start the Flask backend
```bash
# Terminal 1
python app.py
```
You should see:
```
✅ CineBot API running at http://localhost:5000
```

### 5. Start the React frontend
```bash
# Terminal 2
cd Movie-ChatBot
npm install
npm run dev
```

### 6. Open your browser
```
http://localhost:5173
```

---

## ⚡ First Run Note

The first launch takes **2–3 minutes** to compute AI embeddings for all 4,800 movies. After that, everything is cached locally (`embeddings.pkl`, `similarity_matrix.pkl`) and starts **instantly** on every run after.

---

## 🖥️ Running on GitHub Codespaces?

Add this to `vite.config.js` to fix the API connection:

```js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
```

And change this line in `App.jsx`:
```js
// FROM
const API_BASE = 'http://localhost:5000/api'

// TO
const API_BASE = '/api'
```

---

## 💡 How It Works

```
User types a query
       ↓
React frontend sends POST request to Flask API
       ↓
Flask routes to the correct search method
       ↓
AI model processes the query (emotion / semantic / NER)
       ↓
Results ranked by relevance + popularity
       ↓
Chatbot displays movie recommendations
```

---

## 🎭 Built With

Too much coffee, three AI models running simultaneously, and a genuine frustration with decision paralysis on Friday nights.

---

*If this repo helped you finally pick a movie — drop a ⭐*
