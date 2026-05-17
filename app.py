import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import torch
torch.set_num_threads(1)
import gc
gc.collect()

# Limit memory usage
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

import ast, pickle, requests
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
from rapidfuzz import process, fuzz
from collections import Counter
from unified_movie_system import UnifiedMovieSystem

# ==============================================================================
#  FLASK APP
# ==============================================================================
app = Flask(__name__)
CORS(app)

print("🚀 Starting CineBot API server...")
system = UnifiedMovieSystem()
system.load_data("tmdb_5000_movies.csv", "tmdb_5000_credits.csv")

TMDB_API_KEY = "0f804a1ead2605e1ab9812c2ac9c4c37"


# ── ROUTE 1: Actor ─────────────────────────────────────────────────────────────
@app.route('/api/search/cast', methods=['POST'])
def search_cast():
    data = request.get_json()
    actor = data.get('actor', '').strip()
    if not actor: return jsonify({'error': 'No actor provided'}), 400
    return jsonify({'movies': system.search_by_cast(actor)})

# ── ROUTE 2: Genre ─────────────────────────────────────────────────────────────
@app.route('/api/search/genre', methods=['POST'])
def search_genre():
    data = request.get_json()
    genre = data.get('genre', '').strip()
    if not genre: return jsonify({'error': 'No genre provided'}), 400
    return jsonify({'movies': system.search_by_genre(genre)})

# ── ROUTE 3: Mood ──────────────────────────────────────────────────────────────
@app.route('/api/search/mood', methods=['POST'])
def search_mood():
    data = request.get_json()
    text = data.get('text', '').strip()
    if not text: return jsonify({'error': 'No text provided'}), 400
    return jsonify(system.search_by_mood(text))

# ── ROUTE 4: Theme (Pure AI) ───────────────────────────────────────────────────
@app.route('/api/search/theme', methods=['POST'])
def search_theme():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query: return jsonify({'error': 'No query provided'}), 400
    return jsonify({'movies': system.search_by_theme(query)})

# ── ROUTE 5: Theme (Hybrid) ────────────────────────────────────────────────────
@app.route('/api/search/theme-hybrid', methods=['POST'])
def search_theme_hybrid():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query: return jsonify({'error': 'No query provided'}), 400
    return jsonify({'movies': system.search_by_theme_hybrid(query)})

# ── ROUTE 6: Similar Movies ────────────────────────────────────────────────────
@app.route('/api/search/similar', methods=['POST'])
def search_similar():
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title: return jsonify({'error': 'No title provided'}), 400
    result = system.recommend_similar(title)
    if isinstance(result, str): return jsonify({'error': result})
    return jsonify(result)

# ── ROUTE 7: Smart Search ──────────────────────────────────────────────────────
@app.route('/api/search/smart', methods=['POST'])
def search_smart():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query: return jsonify({'error': 'No query provided'}), 400
    return jsonify(system.search_smart_query(query))


# ── ROUTE 8: AUTO-DETECT ──────────────────────────────────────────────────────
@app.route('/api/search/auto', methods=['POST'])
def auto_search():
    """
    Takes any free-form query and automatically decides which search
    method to use, then returns results + what was detected.

    Detection priority:
      1. Actor + Genre together  → Smart Search
      2. Actor name (NER)        → Cast Search
      3. Genre keyword           → Genre Search
      4. Known movie title       → Similar Movies
      5. Strong emotion          → Mood Search
      6. Default                 → Hybrid Theme Search
    """
    data  = request.get_json()
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided'}), 400

    lower = query.lower()

    # ── 1. Genre detection (fast dictionary lookup) ──────────────────────────
    detected_genre = None
    for keyword, official_genre in system.genre_map.items():
        if keyword in lower:
            detected_genre = official_genre
            break

    # ── 2. Actor detection via NER ────────────────────────────────────────────
    word_count = len(query.split())
    eval_text  = f"This movie stars {query.title()}." if word_count <= 4 else query.title()
    entities   = system.extraction_model(eval_text)

    detected_actor = None
    for ent in entities:
        if ent['entity_group'] == 'PER':
            raw_name = ent['word'].replace("##", "").strip().lower()
            # Auto-correct to full name using frequency counting
            candidates = system.movie_df[
                system.movie_df["searchable_cast"].apply(lambda c: any(raw_name in n for n in c))
            ]
            if not candidates.empty:
                all_names = [n for cast in candidates["searchable_cast"] for n in cast if raw_name in n]
                if all_names:
                    detected_actor = Counter(all_names).most_common(1)[0][0]
            else:
                detected_actor = raw_name
            break

    # ── 3. Movie title fuzzy match ────────────────────────────────────────────
    all_titles   = system.movie_df['original_title'].tolist()
    title_match  = process.extractOne(query, all_titles, scorer=fuzz.token_sort_ratio, score_cutoff=78)
    detected_movie = title_match[0] if title_match else None

    # ── 4. Mood / emotion detection ───────────────────────────────────────────
    emotion_result = system.emotion_detector(query)[0]
    top_emotion    = emotion_result[0]
    is_strong_mood = (top_emotion['label'].lower() != 'neutral' and top_emotion['score'] > 0.55)

    # ── ROUTING ───────────────────────────────────────────────────────────────

    # Actor + Genre → Smart Search
    if detected_actor and detected_genre:
        result = system.search_smart_query(query)
        return jsonify({
            'detected_mode':  'smart',
            'detected_label': 'Actor + Genre Search',
            'detected_info':  f"{detected_actor.title()} · {detected_genre.title()}",
            'data':           result,
        })

    # Actor only → Cast Search
    if detected_actor and not detected_movie:
        movies = system.search_by_cast(detected_actor)
        return jsonify({
            'detected_mode':  'actor',
            'detected_label': 'Actor Search',
            'detected_info':  detected_actor.title(),
            'data':           {'movies': movies},
        })

    # Genre only → Genre Search
    if detected_genre:
        movies = system.search_by_genre(detected_genre)
        return jsonify({
            'detected_mode':  'genre',
            'detected_label': 'Genre Search',
            'detected_info':  detected_genre.title(),
            'data':           {'movies': movies},
        })

    # Known movie title → Similar Movies
    if detected_movie:
        result = system.recommend_similar(query)
        return jsonify({
            'detected_mode':  'similar',
            'detected_label': 'Similar Movies',
            'detected_info':  detected_movie,
            'data':           result if isinstance(result, dict) else {'error': result, 'recommendations': []},
        })

    # Strong mood → Mood Search
    if is_strong_mood:
        result = system.search_by_mood(query)
        return jsonify({
            'detected_mode':  'mood',
            'detected_label': 'Mood Search',
            'detected_info':  result.get('mood', top_emotion['label']),
            'data':           result,
        })

    # Default → Hybrid Theme Search
    movies = system.search_by_theme_hybrid(query)
    return jsonify({
        'detected_mode':  'hybrid',
        'detected_label': 'Theme Search',
        'detected_info':  query,
        'data':           {'movies': movies},
    })


# ── ROUTE 9: TMDB Fallback ─────────────────────────────────────────────────────
@app.route('/api/search/tmdb-fallback', methods=['POST'])
def tmdb_fallback():
    data  = request.get_json()
    query = data.get('query', '').strip()
    if not query: return jsonify({'error': 'No query', 'movies': []}), 400

    if TMDB_API_KEY == "YOUR_TMDB_API_KEY_HERE":
        return jsonify({'error': 'TMDB API key not set in app.py', 'movies': []}), 503

    try:
        resp = requests.get(
            'https://api.themoviedb.org/3/search/movie',
            params={'api_key': TMDB_API_KEY, 'query': query, 'language': 'en-US', 'page': 1},
            timeout=8
        )
        resp.raise_for_status()
        results = resp.json().get('results', [])[:5]
        movies  = [
            {
                'title':    m.get('title', 'Unknown'),
                'year':     (m.get('release_date') or '')[:4],
                'overview': (m.get('overview') or '')[:120] + '...',
                'rating':   round(m.get('vote_average', 0), 1),
            }
            for m in results if m.get('title')
        ]
        return jsonify({'movies': movies, 'source': 'tmdb'})
    except requests.exceptions.Timeout:
        return jsonify({'error': 'TMDB timed out', 'movies': []}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': str(e), 'movies': []}), 502


# ── HEALTH CHECK ───────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'movies_loaded': len(system.movie_df), 'tmdb_key_set': TMDB_API_KEY != "YOUR_TMDB_API_KEY_HERE"})


if __name__ == '__main__':
    print("\n✅ CineBot API running at http://localhost:5000")
    print("   React app: http://localhost:5173\n")
    app.run(debug=False, host='0.0.0.0', port=5000)