// Disney Songs Challenge - Main JavaScript

class SongManager {
    constructor() {
        this.songs = JSON.parse(localStorage.getItem('disneysSongs')) || this.initializeDefaults();
        this.songsList = document.getElementById('songsList');

        this.init();
    }

    initializeDefaults() {
        // Create 5 default empty ranking slots
        return [
            { rank: 1, title: '', artist: '', platform: '', thumbnailUrl: '' },
            { rank: 2, title: '', artist: '', platform: '', thumbnailUrl: '' },
            { rank: 3, title: '', artist: '', platform: '', thumbnailUrl: '' },
            { rank: 4, title: '', artist: '', platform: '', thumbnailUrl: '' },
            { rank: 5, title: '', artist: '', platform: '', thumbnailUrl: '' }
        ];
    }

    init() {
        // Initial render
        this.renderSongs();
    }

    // Parse URL and extract metadata
    async parseSongFromURL(url) {
        try {
            // YouTube URL detection
            if (this.isYouTubeURL(url)) {
                return await this.getYouTubeSongData(url);
            }
            // Spotify URL detection
            else if (this.isSpotifyURL(url)) {
                return await this.getSpotifySongData(url);
            } else {
                throw new Error('Invalid URL. Please use YouTube or Spotify.');
            }
        } catch (error) {
            throw error;
        }
    }

    isYouTubeURL(url) {
        return /(?:youtube\.com|youtu\.be)/.test(url);
    }

    isSpotifyURL(url) {
        return /spotify\.com/.test(url);
    }

    getYouTubeVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
            /youtube\.com\/embed\/([^&\n?#]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    async getYouTubeSongData(url) {
        const videoId = this.getYouTubeVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL');

        // YouTube thumbnail URLs in order of preference (fallback to lower quality if higher doesn't exist)
        // Use hqdefault.jpg as it's more universally available than maxresdefault.jpg
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        // Try to fetch video title using YouTube oEmbed API
        let title = 'YouTube Video';
        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const response = await fetch(oembedUrl);
            if (response.ok) {
                const data = await response.json();
                title = data.title || 'YouTube Video';
            }
        } catch (error) {
            console.log('Could not fetch YouTube title via oEmbed, using default');
        }

        return {
            platform: 'YouTube',
            title: title,
            artist: 'Disney',
            thumbnailUrl: thumbnailUrl,
            url: url,
            videoId: videoId,
        };
    }

    async getSpotifySongData(url) {
        try {
            // Extract track ID from Spotify URL
            const trackIdMatch = url.match(/track\/([a-zA-Z0-9]+)/);
            if (!trackIdMatch) throw new Error('Invalid Spotify URL');

            const trackId = trackIdMatch[1];

            // Spotify Web API endpoint (no authentication needed for basic info)
            // We'll use a metadata extraction approach instead
            const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);

            if (!response.ok) {
                // Fallback if CORS blocks the request
                return this.getSpotifyFallback(url, trackId);
            }

            const data = await response.json();
            return {
                platform: 'Spotify',
                title: data.title || 'Spotify Track',
                artist: data.provider_name || 'Unknown Artist',
                thumbnailUrl: data.thumbnail_url || this.getSpotifyDefaultThumbnail(trackId),
                url: url,
                trackId: trackId,
            };
        } catch (error) {
            // Fallback approach when API fails
            return this.getSpotifyFallback(url);
        }
    }

    getSpotifyFallback(url, trackId = null) {
        // Extract track ID if not provided
        if (!trackId) {
            const match = url.match(/track\/([a-zA-Z0-9]+)/);
            trackId = match ? match[1] : null;
        }

        return {
            platform: 'Spotify',
            title: 'Spotify Track',
            artist: 'Unknown Artist',
            thumbnailUrl: this.getSpotifyDefaultThumbnail(trackId),
            url: url,
            trackId: trackId,
        };
    }

    getSpotifyDefaultThumbnail(trackId) {
        // Return a Spotify color placeholder
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%231DB954" width="300" height="300"/%3E%3C/svg%3E';
    }

    updateSong(index, field, value) {
        this.songs[index][field] = value;
        this.saveSongs();
    }

    saveSongs() {
        localStorage.setItem('disneysSongs', JSON.stringify(this.songs));
    }

    getRankColor(rank) {
        if (rank === 1) return 'rank-gold';
        if (rank === 2) return 'rank-silver';
        if (rank === 3) return 'rank-bronze';
        return 'rank-default';
    }

    renderSongs() {
        this.songsList.innerHTML = this.songs
            .map((song, index) => this.createSongElement(song, index))
            .join('');

        // Add event listeners to URL input fields
        document.querySelectorAll('.song-url-input').forEach((input, index) => {
            input.addEventListener('change', async (e) => {
                const url = e.target.value.trim();
                if (url) {
                    try {
                        const songData = await this.parseSongFromURL(url);
                        this.songs[index] = { ...this.songs[index], ...songData, url: url };
                        this.saveSongs();
                        this.renderSongs();
                    } catch (error) {
                        console.error('Error parsing URL:', error);
                    }
                }
            });
        });

        // Add event listener for "Add Rank" button (with delegation to avoid duplicate listeners)
        const addRankBtn = document.getElementById('addRankBtn');
        if (addRankBtn) {
            // Remove all existing listeners by cloning and replacing
            const newBtn = addRankBtn.cloneNode(true);
            addRankBtn.parentNode.replaceChild(newBtn, addRankBtn);
            newBtn.addEventListener('click', () => this.addRank());
        }

        // Add event listener for "Remove Rank" button (with delegation to avoid duplicate listeners)
        const removeRankBtn = document.getElementById('removeRankBtn');
        if (removeRankBtn) {
            const newRemoveBtn = removeRankBtn.cloneNode(true);
            removeRankBtn.parentNode.replaceChild(newRemoveBtn, removeRankBtn);
            newRemoveBtn.addEventListener('click', () => this.removeRank());
        }

        // Add event listener for "Import HTML" button (with delegation to avoid duplicate listeners)
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            const newImportBtn = importBtn.cloneNode(true);
            importBtn.parentNode.replaceChild(newImportBtn, importBtn);
            newImportBtn.addEventListener('click', () => this.importFromHTML());
        }

        // Add event listener for file input (only once)
        const fileInput = document.getElementById('importFileInput');
        if (fileInput && !fileInput.hasListener) {
            fileInput.addEventListener('change', (e) => this.handleFileImport(e));
            fileInput.hasListener = true;
        }

        // Add event listener for "Export as HTML" button (with delegation to avoid duplicate listeners)
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            const newExportBtn = exportBtn.cloneNode(true);
            exportBtn.parentNode.replaceChild(newExportBtn, exportBtn);
            newExportBtn.addEventListener('click', () => this.exportToHTML());
        }

        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.clearSong(index);
            });
        });

        // Add event listeners to rank arrow buttons
        document.querySelectorAll('.rank-arrow').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                if (e.target.classList.contains('up-arrow')) {
                    this.moveRankUp(index);
                } else if (e.target.classList.contains('down-arrow')) {
                    this.moveRankDown(index);
                }
            });
        });
    }

    addRank() {
        this.songs.push({
            rank: this.songs.length + 1,
            title: '',
            artist: '',
            platform: '',
            thumbnailUrl: ''
        });
        this.saveSongs();
        this.renderSongs();
    }

    removeRank() {
        if (this.songs.length > 0) {
            const lastSong = this.songs[this.songs.length - 1];

            // Check if the last rank has data
            if (lastSong.title || lastSong.artist || lastSong.url) {
                const removeRankBtn = document.getElementById('removeRankBtn');
                this.showMessage('Please clear the rank first using the × button on the right', 'error-message', removeRankBtn);
                return;
            }

            this.songs.pop();
            this.saveSongs();
            this.renderSongs();
        }
    }

    clearSong(index) {
        this.songs[index] = {
            rank: this.songs[index].rank,
            title: '',
            artist: '',
            platform: '',
            thumbnailUrl: '',
            url: ''
        };
        this.saveSongs();
        this.renderSongs();
    }

    moveRankUp(index) {
        if (index > 0) {
            // Swap with previous song
            [this.songs[index], this.songs[index - 1]] = [this.songs[index - 1], this.songs[index]];

            // Update rank numbers
            this.songs[index - 1].rank = index;
            this.songs[index].rank = index + 1;

            this.saveSongs();
            this.renderSongs();

            // Apply animations after render
            setTimeout(() => {
                const items = document.querySelectorAll('.song-item');
                if (items[index - 1]) items[index - 1].classList.add('animate-swap-down');
                if (items[index]) items[index].classList.add('animate-swap-up');

                // Remove animation classes after animation completes
                setTimeout(() => {
                    if (items[index - 1]) items[index - 1].classList.remove('animate-swap-down');
                    if (items[index]) items[index].classList.remove('animate-swap-up');
                }, 400);
            }, 10);
        }
    }

    moveRankDown(index) {
        if (index < this.songs.length - 1) {
            // Swap with next song
            [this.songs[index], this.songs[index + 1]] = [this.songs[index + 1], this.songs[index]];

            // Update rank numbers
            this.songs[index].rank = index + 1;
            this.songs[index + 1].rank = index + 2;

            this.saveSongs();
            this.renderSongs();

            // Apply animations after render
            setTimeout(() => {
                const items = document.querySelectorAll('.song-item');
                if (items[index]) items[index].classList.add('animate-swap-down');
                if (items[index + 1]) items[index + 1].classList.add('animate-swap-up');

                // Remove animation classes after animation completes
                setTimeout(() => {
                    if (items[index]) items[index].classList.remove('animate-swap-down');
                    if (items[index + 1]) items[index + 1].classList.remove('animate-swap-up');
                }, 400);
            }, 10);
        }
    }

    createSongElement(song, index) {
        const rankColor = this.getRankColor(song.rank);
        const canMoveUp = index > 0;
        const canMoveDown = index < this.songs.length - 1;

        return `
            <div class="song-item ${rankColor}">
                <div class="rank-controls">
                    <button class="rank-arrow up-arrow" data-index="${index}" ${!canMoveUp ? 'disabled' : ''}>▲</button>
                    <div class="song-rank">#${song.rank}</div>
                    <button class="rank-arrow down-arrow" data-index="${index}" ${!canMoveDown ? 'disabled' : ''}>▼</button>
                </div>
                <img src="${song.thumbnailUrl}" alt="${song.title}" class="song-thumbnail" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%231e293b%22 width=%22300%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%2394a3b8%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                <div class="song-info">
                    <div class="song-title-display">${this.escapeHtml(song.title || 'Add your song')}</div>
                    <div class="song-artist-display">${this.escapeHtml(song.artist || '')}</div>
                    <input type="text" class="song-url-input" placeholder="YouTube or Spotify URL" value="${this.escapeHtml(song.url || '')}">
                </div>
                <button class="remove-btn" data-index="${index}">×</button>
            </div>
        `;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    importFromHTML() {
        const fileInput = document.getElementById('importFileInput');
        fileInput.click();
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            // Extract song items from the imported HTML
            const songElements = doc.querySelectorAll('.song-item');
            const importedSongs = [];

            songElements.forEach((element) => {
                const rankText = element.querySelector('.song-rank')?.textContent || '';
                const rank = parseInt(rankText.replace('#', '')) || importedSongs.length + 1;

                const title = element.querySelector('.song-title')?.textContent || '';
                const artist = element.querySelector('.song-artist')?.textContent || '';
                const platform = element.querySelector('.song-platform')?.textContent || '';
                const thumbnailUrl = element.querySelector('.song-thumbnail')?.src || '';

                if (title) {
                    importedSongs.push({
                        rank: rank,
                        title: title,
                        artist: artist,
                        platform: platform,
                        thumbnailUrl: thumbnailUrl,
                        url: ''
                    });
                }
            });

            // Replace current songs with imported songs
            if (importedSongs.length > 0) {
                this.songs = importedSongs;
                this.saveSongs();
                this.renderSongs();
                this.showMessage('Successfully imported songs!', 'success-message');
            } else {
                this.showMessage('No songs found in the imported file.', 'error-message');
            }
        } catch (error) {
            console.error('Error importing file:', error);
            this.showMessage('Error importing file. Please check the file format.', 'error-message');
        }

        // Reset file input
        event.target.value = '';
    }

    showMessage(message, type, targetElement = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = type;
        messageDiv.textContent = message;
        messageDiv.style.position = 'fixed';
        messageDiv.style.zIndex = '1000';
        messageDiv.style.maxWidth = '400px';
        messageDiv.style.padding = '12px 15px';
        messageDiv.style.borderRadius = '8px';
        messageDiv.style.animation = 'slide-up 0.3s ease-out';

        // Position near the target element or top-right
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            messageDiv.style.top = (rect.top - 60) + 'px';
            messageDiv.style.left = (rect.left + rect.width / 2 - 200) + 'px';
        } else {
            messageDiv.style.top = '20px';
            messageDiv.style.right = '20px';
        }

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    exportToHTML() {
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Top Disney Songs - Bou Challenges</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1a1f35 100%);
            color: #f1f5f9;
            padding: 20px;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            font-size: 2.5em;
            background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 30px;
            text-align: center;
        }
        .songs-list {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        .song-item {
            display: grid;
            grid-template-columns: 60px 120px 1fr;
            gap: 20px;
            align-items: center;
            background: linear-gradient(135deg, #1e293b 0%, #253549 100%);
            padding: 15px 20px;
            border-radius: 10px;
            border: 2px solid #334155;
        }
        .song-rank {
            font-size: 1.8em;
            font-weight: 800;
            background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-align: center;
        }
        .rank-gold .song-rank {
            background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .rank-silver .song-rank {
            background: linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .rank-bronze .song-rank {
            background: linear-gradient(135deg, #cd7f32 0%, #e5a76f 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .song-thumbnail {
            width: 100%;
            aspect-ratio: 1;
            border-radius: 5px;
            object-fit: cover;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        .song-info {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        .song-title {
            font-size: 1em;
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 4px;
        }
        .song-artist {
            font-size: 0.9em;
            color: #cbd5e1;
            margin-bottom: 8px;
        }
        .song-platform {
            font-size: 0.85em;
            color: #a855f7;
            font-weight: 500;
        }
        footer {
            text-align: center;
            padding: 20px 0;
            color: #cbd5e1;
            border-top: 2px solid #334155;
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Top Disney Songs</h1>
        <div class="songs-list">
            ${this.songs
              .filter(song => song.title) // Only include songs with titles
              .map(song => {
                const rankClass =
                  song.rank === 1 ? 'rank-gold' :
                  song.rank === 2 ? 'rank-silver' :
                  song.rank === 3 ? 'rank-bronze' : '';
                return `
            <div class="song-item ${rankClass}">
                <div class="song-rank">#${song.rank}</div>
                <img src="${song.thumbnailUrl}" alt="${song.title}" class="song-thumbnail">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(song.title)}</div>
                    <div class="song-artist">${this.escapeHtml(song.artist)}</div>
                    <div class="song-platform">${song.platform}</div>
                </div>
            </div>`;
              })
              .join('')}
        </div>
        <footer>
            <p>Created by a Bou for a Bou | Made with ❤️</p>
        </footer>
    </div>
</body>
</html>`;

        // Create blob and download
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Top-Disney-Songs.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SongManager();
});
