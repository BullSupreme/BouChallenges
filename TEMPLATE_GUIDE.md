# Bou Challenges - Template Guide

This guide explains how to create new challenge pages using the reusable template system.

## Architecture

The system is built with a modular approach:

- **`challenge-template.html`**: Generic HTML template for any challenge type
- **`ranking-manager.js`**: Generic JavaScript class that handles all ranking logic
- **Challenge-specific setup**: Each challenge can customize the storage key and challenge type

## Recent Features (Latest Updates)

- ✅ **YouTube Shorts Support**: Now supports `youtube.com/shorts/` URLs
- ✅ **Spotify Full Embed**: Spotify tracks display as full interactive embeds (no separate thumbnail)
- ✅ **Inline Playback**: YouTube videos play inline when clicking thumbnail (no modal popup)
- ✅ **Import/Export Compatibility**: Import and export now support both YouTube and Spotify formats
- ✅ **Dynamic Export Filenames**: Export filename automatically matches page title (e.g., "Top Disney Songs" → `TopDisneySongs.html`)
- ✅ **No Swap Animations**: Rank swapping happens instantly without animation delay
- ✅ **Drag & Drop Reordering**: Drag and drop ranking items to reorder them with visual feedback

## Creating a New Challenge

### Step 1: Create a New HTML File

Copy `pages/challenge-template.html` and rename it to your challenge name (e.g., `pages/anime-rankings.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Anime Rankings - Bou Challenges</title>
    <link rel="stylesheet" href="../css/styles.css">
</head>
<body>
    <div class="container">
        <header>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
                <a href="../index.html" class="back-button">← Back Home</a>
                <div style="display: flex; gap: 10px;">
                    <button id="importBtn" class="btn btn-primary">Import HTML</button>
                    <button id="exportBtn" class="btn btn-primary">Export as HTML</button>
                </div>
            </div>
            <input type="file" id="importFileInput" accept=".html" style="display: none;">
        </header>

        <main>
            <section class="challenge-section">
                <div class="songs-list">
                    <h2>Top Anime</h2>  <!-- Change this title -->
                    <div id="songsList" class="songs-container">
                        <!-- Rankings will be generated here -->
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button id="addRankBtn" class="btn btn-primary">+ Add Rank</button>
                        <button id="removeRankBtn" class="btn btn-remove">- Remove Rank</button>
                    </div>
                </div>
            </section>
        </main>

        <footer>
            <p>Created by a Bou for a Bou | Made with ❤️</p>
        </footer>
    </div>

    <script src="../js/ranking-manager.js"></script>
    <script>
        // Create a specialized manager for your challenge
        class AnimeManager extends RankingManager {
            constructor() {
                super('animeRankings', 'anime');  // Change storage key and challenge type
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            new AnimeManager();
        });
    </script>
</body>
</html>
```

### Step 2: Update the Title and Content

1. Change the `<title>` in the `<head>` to your challenge name
2. Update the `<h2>` heading to display your challenge title
3. Update the storage key in the script section (e.g., `'animeRankings'`)
4. Update the challenge type (e.g., `'anime'`)

### Step 3: Add Link to Home Page

Update `index.html` to add a link to your new challenge:

```html
<div class="challenge-card">
    <h2>Anime Rankings</h2>
    <p>Rank your favorite anime</p>
    <a href="pages/anime-rankings.html" class="btn btn-primary">View Challenge</a>
</div>
```

## How It Works

### RankingManager Class

The `RankingManager` class in `ranking-manager.js` handles:

- **Data Persistence**: Saves rankings to localStorage
- **URL Parsing**: Extracts metadata from YouTube and Spotify URLs
- **Rendering**: Creates HTML for each ranking item
- **User Interactions**: Handles add, remove, reorder, and clear operations
- **Import/Export**: Allows importing from HTML files and exporting as standalone HTML

### Storage Keys

Each challenge needs a unique storage key for localStorage:

```javascript
super('disneysSongs', 'songs');    // Disney Songs
super('animeRankings', 'anime');   // Anime Rankings
super('movieRankings', 'movies');  // Movie Rankings
```

This ensures each challenge maintains its own separate data.

## Customization Options

### Extending RankingManager

You can create specialized managers for specific challenges:

```javascript
class MovieManager extends RankingManager {
    constructor() {
        super('movieRankings', 'movies');
    }

    // Override methods or add custom logic here
    async parseItemFromURL(url) {
        // Custom URL parsing for movies
        // For example, could support IMDb links
        return super.parseItemFromURL(url);
    }
}
```

### Styling

All styling is in `css/styles.css`. The following CSS classes are used:

- `.song-item` - Individual ranking item
- `.rank-gold`, `.rank-silver`, `.rank-bronze`, `.rank-default` - Rank colors
- `.btn-primary`, `.btn-remove` - Buttons
- `.challenge-section` - Main content section

## Features

Each challenge automatically includes:

- ✅ 5 default empty ranking slots
- ✅ YouTube (including Shorts) and Spotify URL support with auto-metadata extraction
- ✅ Spotify tracks display as full interactive embeds
- ✅ YouTube inline playback (click thumbnail to play)
- ✅ Instant rank reordering (no animations)
- ✅ Drag and drop reordering (click and drag items to reorder)
- ✅ Add/remove ranking slots
- ✅ Clear individual items
- ✅ Import/export functionality (supports both platforms)
- ✅ Dark mode with purple and pink accents
- ✅ Persistent storage (localStorage)
- ✅ Responsive design
- ✅ External link button (↗) to open items in new tab

## File Structure

```
BouChallenges/
├── index.html                 (Home page)
├── css/
│   └── styles.css             (All styling)
├── js/
│   ├── ranking-manager.js     (Generic ranking logic)
│   └── disney-songs.js        (Legacy - can be removed)
└── pages/
    ├── disney-songs.html      (Disney Songs challenge)
    ├── challenge-template.html (Template for new challenges)
    └── [your-challenge].html   (New challenges)
```

## Example: Creating a Movie Rankings Challenge

1. Copy `challenge-template.html` to `movie-rankings.html`
2. Update the title: `<h2>Top Movies</h2>`
3. Update the script section:

```javascript
class MovieManager extends RankingManager {
    constructor() {
        super('movieRankings', 'movies');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MovieManager();
});
```

4. Add to `index.html`:

```html
<div class="challenge-card">
    <h2>Movie Rankings</h2>
    <p>Rank your favorite movies</p>
    <a href="pages/movie-rankings.html" class="btn btn-primary">View Challenge</a>
</div>
```

That's it! Your new challenge is ready to use.
