# ==============================================================================
#  UNIFIED MOVIE RECOMMENDATION SYSTEM
#  Combines: Mood Search + Theme Search + Cast/Genre Search + Movie Similarity
# ==============================================================================

import os
import ast
import pickle
import torch
import pandas as pd
from transformers import pipeline
from sentence_transformers import SentenceTransformer, util
from rapidfuzz import process, fuzz
from collections import Counter

# ==============================================================================
#  THE UNIFIED SYSTEM CLASS
#  One class that handles everything — mood, theme, cast, genre, similarity
# ==============================================================================

class UnifiedMovieSystem:

    # --------------------------------------------------------------------------
    #  STEP 1: INITIALISE — Load all AI models when the system starts
    # --------------------------------------------------------------------------
    def __init__(self):
        self.movie_df    = None   # Will hold our full movie database
        self.embeddings  = None   # Will hold AI vectors for theme search
        self.similarity_matrix = None  # Will hold movie-to-movie similarity scores

        # --- Emotion Detection Model (for mood search) ---
        # This model reads your sentence and detects the emotion behind it
        # e.g. "I feel amazing!" → joy
        print("⏳ Loading emotion detection model...")
        self.emotion_detector = pipeline(
            "text-classification",
            model="j-hartmann/emotion-english-distilroberta-base",
            top_k=3   # ← change this from 1 to 3
    )

        # --- Semantic Search Model (for theme search) ---
        # This model converts text into meaning-vectors
        # So "dog" can also match movies about "puppy" or "hound"
        print("⏳ Loading semantic search model...")
        self.semantic_model = SentenceTransformer('all-MiniLM-L6-v2')

       # --- Smart Search Model (NER for Actor Extraction) ---
        print("⏳ Loading smart extraction model...")
        self.extraction_model = pipeline(
            "ner", 
            model="dslim/bert-base-NER",
            aggregation_strategy="simple"
        )
        
        # --- Slang to Official Genre Dictionary ---
        self.genre_map = {
            "action": "action", "adventure": "adventure", "animation": "animation", 
            "comedy": "comedy", "crime": "crime", "documentary": "documentary", 
            "drama": "drama", "family": "family", "fantasy": "fantasy", 
            "history": "history", "horror": "horror", "music": "music", 
            "mystery": "mystery", "romance": "romance", "science fiction": "science fiction", 
            "tv movie": "tv movie", "thriller": "thriller", "war": "war", "western": "western",
            
            # Synonyms & Slang
            "space": "science fiction", "sci-fi": "science fiction", "aliens": "science fiction",
            "scary": "horror", "spooky": "horror",
            "funny": "comedy", "laugh": "comedy",
            "kids": "family", "cartoon": "animation", 
            "rom-com": "romance", "love": "romance", 
            "cowboy": "western", "magic": "fantasy", "mafia": "crime"
        }


    # --------------------------------------------------------------------------
    #  STEP 2: DATA LOADING — Read CSVs and build all searchable columns
    # --------------------------------------------------------------------------
    def load_data(self, movies_path, credits_path):
        """
        Loads and merges the two TMDB CSV files.
        Builds all the searchable columns needed by every search method.
        Uses caching so the slow embedding step only runs once.
        """

        # --- Cache Check: Movie DataFrame ---
        # If we've already processed the data before, load the saved version
        if os.path.exists("movie_df.pkl"):
            print("✅ Loading saved movie data...")
            self.movie_df = pd.read_pickle("movie_df.pkl")

            # ✅ Safety check — if old cache is missing columns, delete and rebuild
            required_columns = ["searchable_genres", "searchable_cast", "searchable_text"]
            if not all(col in self.movie_df.columns for col in required_columns):
                print("⚠️  Cache is outdated. Rebuilding...")
                os.remove("movie_df.pkl")
                self.movie_df = None  # Force the else block to run below

        else:
            # First time only: read and process the CSVs
            print("⏳ First-time setup: Loading and processing CSVs...")
            movies_df  = pd.read_csv(movies_path)
            credits_df = pd.read_csv(credits_path)

            # The credits file uses 'movie_id' — rename it to 'id' so we can merge
            credits_df.rename(columns={"movie_id": "id"}, inplace=True)
            self.movie_df = pd.merge(movies_df, credits_df, on="id", how="inner")

            # Remove movies with no plot — we can't search or embed empty text
            self.movie_df = self.movie_df[
                self.movie_df['overview'].notna()
            ].reset_index(drop=True)

            # --- Build Searchable Columns ---

            # Convert genres from ugly JSON string → clean Python list
            # Before: "[{'id': 28, 'name': 'Action'}]"
            # After:  ["action"]
            self.movie_df['searchable_genres'] = self.movie_df['genres'].apply(
                self._extract_names
            )

            # Same for cast names
            self.movie_df['searchable_cast'] = self.movie_df['cast'].apply(
                self._extract_names
            )

            # Same for keyword tags
            self.movie_df['keyword_list'] = self.movie_df['keywords'].apply(
                self._extract_names
            )

            # Combine plot + keyword tags into one big searchable text block
            # e.g. "a robot learns to feel emotions... artificial intelligence robot future"
            self.movie_df['searchable_text'] = (
                self.movie_df['overview'].str.lower() + ' ' +
                self.movie_df['keyword_list'].apply(lambda x: ' '.join(x))
            )

            # Save processed data so next run is instant
            self.movie_df.to_pickle("movie_df.pkl")
            print(f"✅ Loaded {len(self.movie_df)} movies.")

        # --- Cache Check: AI Embeddings ---
        # Embeddings are the slowest step — cache them separately
        if os.path.exists("embeddings.pkl"):
            print("✅ Loading saved AI embeddings...")
            with open("embeddings.pkl", "rb") as f:
                self.embeddings = pickle.load(f)

        else:
            # Convert every movie's text into an AI meaning-vector
            # Done once here so all theme searches are instant later
            print(f"⏳ Computing AI embeddings for {len(self.movie_df)} movies (~30 sec)...")
            self.embeddings = self.semantic_model.encode(
                self.movie_df['searchable_text'].tolist(),
                convert_to_tensor=True,
                show_progress_bar=True,
                batch_size=64
            )
            with open("embeddings.pkl", "wb") as f:
                pickle.dump(self.embeddings, f)

        # --- Cache Check: Similarity Matrix ---
        # Precomputed cosine similarity between every pair of movies
        if os.path.exists("similarity_matrix.pkl"):
            print("✅ Loading saved similarity matrix...")
            with open("similarity_matrix.pkl", "rb") as f:
                self.similarity_matrix = pickle.load(f)

        else:
            print("⏳ Building movie similarity matrix (one-time only)...")
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity

            tfidf   = TfidfVectorizer(max_features=5000)
            tfidf_matrix = tfidf.fit_transform(self.movie_df['searchable_text'])
            self.similarity_matrix = cosine_similarity(tfidf_matrix)

            with open("similarity_matrix.pkl", "wb") as f:
                pickle.dump(self.similarity_matrix, f)

        print("\n🎬 System ready!\n")


    # --------------------------------------------------------------------------
    #  HELPER: Extract names from TMDB's JSON-like strings
    # --------------------------------------------------------------------------
    def _extract_names(self, text):
        """
        Converts TMDB's ugly string format into a clean Python list.
        e.g. "[{'id': 28, 'name': 'Action'}]" → ["action"]
        If anything goes wrong, returns empty list instead of crashing.
        """
        try:
            return [i['name'].lower() for i in ast.literal_eval(text)]
        except:
            return []


    # --------------------------------------------------------------------------
    #  HELPER: Format and return top N results sorted by popularity
    # --------------------------------------------------------------------------
    def _format_results(self, df, top_n=5):
        """
        Sorts a filtered dataframe by popularity and returns the top N titles.
        Always shows the most well-known movies first.
        """
        if df.empty:
            return []
        return (
            df.sort_values("popularity", ascending=False)
              .head(top_n)["original_title"]
              .tolist()
        )


    # ==========================================================================
    #  SEARCH METHOD 1: Search by Actor / Actress
    # ==========================================================================
    def search_by_cast(self, actor_name, top_n=5):
        """
        Finds all movies where the given actor appears in the cast.
        Uses the pre-built 'searchable_cast' column for fast lookup.
        """
        name = actor_name.lower().strip()

        # Check each movie's cast list — keep only rows where actor is found
        matches = self.movie_df[
            self.movie_df["searchable_cast"].apply(lambda cast: name in cast)
        ]
        return self._format_results(matches, top_n)


    # ==========================================================================
    #  SEARCH METHOD 2: Search by Genre
    # ==========================================================================
    def search_by_genre(self, genre_name, top_n=5):
        """
        Finds all movies that belong to the given genre.
        Uses the pre-built 'searchable_genres' column for fast lookup.
        """
        genre = genre_name.lower().strip()

        # Check each movie's genre list — keep only rows where genre is found
        matches = self.movie_df[
            self.movie_df["searchable_genres"].apply(lambda g: genre in g)
        ]
        return self._format_results(matches, top_n)


    # ==========================================================================
    #  SEARCH METHOD 3: Search by Mood (AI Emotion Detection)
    # ==========================================================================
    def search_by_mood(self, user_text, top_n=5):

        # Get top 3 emotions with their confidence scores
        raw_results = self.emotion_detector(user_text)[0]

        # raw_results looks like:
        # [{"label": "anger", "score": 0.60},
        #  {"label": "sadness", "score": 0.30},
        #  {"label": "fear", "score": 0.10}]

        # Only keep emotions above 15% confidence — ignore very weak ones
        top_emotions = [r for r in raw_results if r["score"] > 0.15]

        # Collect genres from ALL strong emotions, not just the top one
        combined_genres = []
        emotion_summary = []

        for emotion in top_emotions:
            mood   = emotion["label"].lower()
            score  = round(emotion["score"] * 100)
            genres = self.mood_to_genres.get(mood, [])

            emotion_summary.append(f"{mood} ({score}%)")

            # Add genres but avoid duplicates
            for g in genres:
                if g not in combined_genres:
                    combined_genres.append(g)

        # Filter movies matching ANY of the combined genres
        matches = self.movie_df[
            self.movie_df["searchable_genres"].apply(
                lambda x: any(g in x for g in combined_genres)
            )
        ]

        return {
            "mood":    " + ".join(emotion_summary),  # e.g. "anger (60%) + sadness (30%)"
            "genres":  combined_genres,
            "movies":  self._format_results(matches, top_n)
        }


    # ==========================================================================
    #  SEARCH METHOD 4: Search by Theme — Pure AI Semantic Search
    # ==========================================================================
    def search_by_theme(self, theme_query, top_n=5):
        """
        Finds movies by MEANING, not just exact words.
        Uses AI embeddings + cosine similarity.

        e.g. "loyal animal companion" will match movies about dogs
             even if they never use the word "loyal" or "companion"
        """
        # Convert the user's query into the same AI vector space as the movies
        query_vec = self.semantic_model.encode(theme_query, convert_to_tensor=True)

        # Compare query vector against ALL movie vectors at once — very fast
        scores      = util.cos_sim(query_vec, self.embeddings)[0]
        top_indices = torch.topk(scores, k=min(top_n, len(scores))).indices.tolist()

        # Build result list with title, year, plot snippet and similarity score
        return [
            {
                "title":      self.movie_df.iloc[i]['original_title'],
                "year":       str(self.movie_df.iloc[i]['release_date'])[:4],
                "overview":   self.movie_df.iloc[i]['overview'][:120] + "...",
                "similarity": f"{scores[i].item() * 100:.1f}%"
            }
            for i in top_indices
        ]


    # ==========================================================================
    #  SEARCH METHOD 5: Search by Theme — Hybrid AI + Popularity
    # ==========================================================================
    def search_by_theme_hybrid(self, theme_query, top_n=5):
        """
        Combines AI semantic relevance (70%) + movie popularity (30%).
        Use this when pure AI results feel too obscure or unknown.
        """
        query_vec = self.semantic_model.encode(theme_query, convert_to_tensor=True)
        scores    = util.cos_sim(query_vec, self.embeddings)[0]

        df = self.movie_df.copy()
        df['ai_score']  = scores.cpu().numpy()

        # Normalise popularity to 0–1 so it's on the same scale as AI score
        df['pop_score'] = df['popularity'] / df['popularity'].max()

        # Final score = 70% meaning relevance + 30% how popular the movie is
        df['combined']  = (0.7 * df['ai_score']) + (0.3 * df['pop_score'])
        df = df.sort_values('combined', ascending=False).head(top_n)

        return [
            {
                "title":      row['original_title'],
                "year":       str(row['release_date'])[:4],
                "overview":   row['overview'][:120] + "...",
                "similarity": f"{row['ai_score'] * 100:.1f}%"
            }
            for _, row in df.iterrows()
        ]


    # ==========================================================================
    #  SEARCH METHOD 6: Recommend Similar Movies (Content-Based)
    # ==========================================================================
    def recommend_similar(self, movie_title, top_n=5):
        """
        Given a movie title, finds the most similar movies using
        the precomputed TF-IDF cosine similarity matrix.

        Uses fuzzy matching so typos like "Avatr" still find "Avatar".
        """
        # Fuzzy match the user's input to the closest real movie title
        all_titles  = self.movie_df['original_title'].tolist()
        best_match  = process.extractOne(
            movie_title,
            all_titles,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=60   # Minimum 60% match — rejects completely wrong titles
        )

        if not best_match:
            return f"❌ Could not find '{movie_title}'. Check your spelling."

        matched_title = best_match[0]
        idx           = self.movie_df[
            self.movie_df['original_title'] == matched_title
        ].index[0]

        # Get similarity scores for this movie against all others
        sim_scores = list(enumerate(self.similarity_matrix[idx]))

        # Sort by score (highest first), skip index 0 (the movie itself)
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)[1:top_n+1]

        return {
            "matched_movie":   matched_title,
            "recommendations": [self.movie_df.iloc[i]['original_title'] for i, _ in sim_scores]
        }

    # ==========================================================================
    #  SEARCH METHOD 7: Smart Search (Actor + Genre Extraction)
    # ==========================================================================
    def search_smart_query(self, user_text, top_n=5):
        """
        Takes a natural language string, uses AI to find the actor via adaptive 
        context wrapping, uses a dictionary to translate slang into official genres, 
        and auto-corrects fragmented AI names using frequency counting.
        """
        actor_name = None
        target_genre = None

        # ---------------------------------------------------------
        # 1. EXTRACT ACTOR (Adaptive Context Wrapping)
        # ---------------------------------------------------------
        proper_text = user_text.title() 
        word_count = len(user_text.split())
        
        # If it's a short input, wrap it in grammar. If it's a long sentence, pass it directly.
        if word_count <= 4:
            eval_text = f"This movie stars {proper_text}."
        else:
            eval_text = proper_text
            
        entities = self.extraction_model(eval_text)
        
        for entity in entities:
            if entity['entity_group'] == 'PER':
                actor_name = entity['word'].replace("##", "").strip().lower()
                break # Stop searching once we find a person

        # ---------------------------------------------------------
        # 2. EXTRACT GENRE (Dictionary Mapping)
        # ---------------------------------------------------------
        lower_text = user_text.lower()
        
        for keyword, official_genre in self.genre_map.items():
            if keyword in lower_text:
                target_genre = official_genre
                break # Stop once we find a genre match

        # ---------------------------------------------------------
        # 3. FILTER & FREQUENCY AUTO-CORRECT
        # ---------------------------------------------------------
        matches = self.movie_df.copy()

        if actor_name:
            # 1. Dirty Filter: Grab anything matching the AI's partial name (e.g. "pitt")
            matches = matches[
                matches["searchable_cast"].apply(lambda cast: any(actor_name in c for c in cast))
            ]
            
            # 2. Auto-Correct: Find the most frequent full name
            if not matches.empty:
                possible_names = []
                for cast_list in matches["searchable_cast"]:
                    for name in cast_list:
                        if actor_name in name:
                            possible_names.append(name)
                
                if possible_names:
                    best_match = Counter(possible_names).most_common(1)[0][0]
                    actor_name = best_match # Upgrades "pitt" -> "brad pitt" safely!

                    # 🚨 THE FIX: Re-filter the database using the PERFECTED name! 🚨
                    # We must reset 'matches' to discard the background extras.
                    matches = self.movie_df.copy()
                    matches = matches[
                        matches["searchable_cast"].apply(lambda cast: any(actor_name in c for c in cast))
                    ]

        if target_genre:
            matches = matches[
                matches["searchable_genres"].apply(lambda genres: target_genre in genres)
            ]

        # ---------------------------------------------------------
        # THE MISSING RETURN STATEMENT!
        # ---------------------------------------------------------
        return {
            "actor_detected": actor_name,
            "genre_detected": target_genre,
            "movies": self._format_results(matches, top_n)
        }
# ==============================================================================
