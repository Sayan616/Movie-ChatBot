# ==============================================================================
#  app.py — Flask API wrapper for UnifiedMovieSystem
#  Run with: python app.py
#  Serves the React frontend at http://localhost:5000
# ==============================================================================
#
#  INSTALL REQUIREMENTS:
#    pip install flask flask-cors
#
#  HOW TO USE:
#    1. Place this file in the same folder as your unified_movie_system.py
#       and your CSV files (tmdb_5000_movies.csv, tmdb_5000_credits.csv)
#    2. Run: python app.py
#    3. In a separate terminal: cd Movie-ChatBot && npm run dev
#    4. Open http://localhost:5173 in your browser
# ==============================================================================

from flask import Flask, request, jsonify
from flask_cors import CORS

# Import your existing UnifiedMovieSystem
# (rename your main script to unified_movie_system.py and remove the
#  interactive menu at the bottom — only keep the class definition)
from unified_movie_system import UnifiedMovieSystem

app = Flask(__name__)
CORS(app)  # Allow requests from the React dev server

# ── Load models once on startup ────────────────────────────────────────────────
print("🚀 Starting CineBot API server...")
system = UnifiedMovieSystem()
system.load_data("tmdb_5000_movies.csv", "tmdb_5000_credits.csv")

# NOTE: If you get a NameError for `mood_to_genres`, add this dict to
# the UnifiedMovieSystem.__init__ method in your Python file:
#
# self.mood_to_genres = {
#     "joy":      ["comedy", "animation", "family", "music"],
#     "sadness":  ["drama", "romance"],
#     "anger":    ["action", "thriller", "crime"],
#     "fear":     ["horror", "mystery", "thriller"],
#     "disgust":  ["horror", "crime"],
#     "surprise": ["mystery", "science fiction", "adventure"],
#     "neutral":  ["drama", "documentary"],
# }


# ── ROUTE 1: Search by Actor ───────────────────────────────────────────────────
@app.route('/api/search/cast', methods=['POST'])
def search_cast():
    data = request.get_json()
    actor = data.get('actor', '').strip()
    if not actor:
        return jsonify({'error': 'No actor name provided'}), 400
    movies = system.search_by_cast(actor)
    return jsonify({'movies': movies})


# ── ROUTE 2: Search by Genre ───────────────────────────────────────────────────
@app.route('/api/search/genre', methods=['POST'])
def search_genre():
    data = request.get_json()
    genre = data.get('genre', '').strip()
    if not genre:
        return jsonify({'error': 'No genre provided'}), 400
    movies = system.search_by_genre(genre)
    return jsonify({'movies': movies})


# ── ROUTE 3: Search by Mood ────────────────────────────────────────────────────
@app.route('/api/search/mood', methods=['POST'])
def search_mood():
    data = request.get_json()
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'error': 'No mood text provided'}), 400
    result = system.search_by_mood(text)
    # result = { "mood": "...", "genres": [...], "movies": [...] }
    return jsonify(result)


# ── ROUTE 4: Search by Theme (Pure AI) ────────────────────────────────────────
@app.route('/api/search/theme', methods=['POST'])
def search_theme():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No theme query provided'}), 400
    movies = system.search_by_theme(query)
    # movies = [{ "title", "year", "overview", "similarity" }, ...]
    return jsonify({'movies': movies})


# ── ROUTE 5: Search by Theme (Hybrid AI + Popularity) ─────────────────────────
@app.route('/api/search/theme-hybrid', methods=['POST'])
def search_theme_hybrid():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No theme query provided'}), 400
    movies = system.search_by_theme_hybrid(query)
    # movies = [{ "title", "year", "overview", "similarity" }, ...]
    return jsonify({'movies': movies})


# ── ROUTE 6: Find Similar Movies ──────────────────────────────────────────────
@app.route('/api/search/similar', methods=['POST'])
def search_similar():
    data = request.get_json()
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'No movie title provided'}), 400
    result = system.recommend_similar(title)
    if isinstance(result, str):
        # Fuzzy match failed — return error message
        return jsonify({'error': result})
    # result = { "matched_movie": "...", "recommendations": [...] }
    return jsonify(result)


# ── ROUTE 7: Smart Search (Actor + Genre extraction) ──────────────────────────
@app.route('/api/search/smart', methods=['POST'])
def search_smart():
    data = request.get_json()
    query = data.get('query', '').strip()
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    result = system.search_smart_query(query)
    # result = { "actor_detected": "...", "genre_detected": "...", "movies": [...] }
    return jsonify(result)


# ── HEALTH CHECK ───────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'movies_loaded': len(system.movie_df)})


# ── START SERVER ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("\n✅ CineBot API running at http://localhost:5000")
    print("   Open your React app at http://localhost:5173\n")
    app.run(debug=True, port=5000)
