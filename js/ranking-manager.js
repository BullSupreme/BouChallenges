// Generic Ranking Manager - Works for all challenge types
// Usage: Update the storageKey and challengeType based on your specific challenge

class RankingManager {
    constructor(storageKey = 'rankingData', challengeType = 'generic') {
        this.storageKey = storageKey;
        this.challengeType = challengeType;
        this.items = JSON.parse(localStorage.getItem(this.storageKey)) || this.initializeDefaults();
        this.itemsList = document.getElementById('songsList');
        // Make instance globally available for onclick handlers
        window.rankingManager = this;
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
        this.renderItems();
        // Setup duplicate detection
        this.setupDuplicateDetection();
        // Setup community rankings browser (only on category pages, not home)
        if (this.itemsList && this.itemsList.closest('.songs-list')) {
            this.setupCommunityBrowser();
        }
    }

    // Parse URL and extract metadata (YouTube/Spotify specific)
    async parseItemFromURL(url) {
        try {
            if (this.isYouTubeURL(url)) {
                return await this.getYouTubeData(url);
            } else if (this.isSpotifyURL(url)) {
                return await this.getSpotifyData(url);
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
            /youtube\.com\/shorts\/([^&\n?#]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) return match[1];
        }
        return null;
    }

    async getYouTubeData(url) {
        const videoId = this.getYouTubeVideoId(url);
        if (!videoId) throw new Error('Invalid YouTube URL');

        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        let title = 'YouTube Video';
        let duration = '';
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

        // Try to fetch duration using YouTube Noembed API (no API key required)
        try {
            const noembed_url = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
            const response = await fetch(noembed_url);
            if (response.ok) {
                const data = await response.json();
                if (data.duration) {
                    duration = this.formatDuration(data.duration);
                }
            }
        } catch (error) {
            console.log('Noembed failed, trying alternative method');
        }

        // If Noembed didn't work, try fetching from YouTube's initial data using CORS proxy
        if (!duration) {
            try {
                const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(youtubeUrl)}`;
                const response = await fetch(proxyUrl);
                if (response.ok) {
                    const html = await response.text();
                    // Look for duration in the initial data JSON
                    const durationMatch = html.match(/"lengthSeconds":"(\d+)"/);
                    if (durationMatch && durationMatch[1]) {
                        duration = this.formatDuration(parseInt(durationMatch[1]));
                    }
                }
            } catch (error) {
                console.log('Could not fetch duration from YouTube, continuing without it');
            }
        }

        return {
            platform: 'YouTube',
            title: title,
            artist: '',
            thumbnailUrl: thumbnailUrl,
            url: url,
            videoId: videoId,
            duration: duration,
        };
    }

    formatDuration(seconds) {
        if (!seconds) return '';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${minutes}:${String(secs).padStart(2, '0')}`;
    }

    async getSpotifyData(url) {
        try {
            const trackIdMatch = url.match(/track\/([a-zA-Z0-9]+)/);
            if (!trackIdMatch) throw new Error('Invalid Spotify URL');

            const trackId = trackIdMatch[1];

            // Use Spotify's oEmbed endpoint which provides title and thumbnail
            const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);

            if (!response.ok) {
                return this.getSpotifyFallback(url, trackId);
            }

            const data = await response.json();
            let title = 'Spotify Track';
            let artist = 'Unknown Artist';

            // Extract title from the data.title field
            if (data.title) {
                title = data.title.trim();
            }

            // Try using a CORS proxy to fetch the embed page
            // Using allOrigins as a free CORS proxy
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://open.spotify.com/embed/track/${trackId}`)}`;
                const proxyResponse = await fetch(proxyUrl);

                if (proxyResponse.ok) {
                    const embedHtml = await proxyResponse.text();

                    // Try to find data in Next.js pageProps
                    // Look for pattern: "name":"Song Name" followed by artist data
                    const nameMatch = embedHtml.match(/"name":"([^"]+)","uri":"spotify:track:[^"]+"/);
                    if (nameMatch && nameMatch[1]) {
                        title = nameMatch[1];
                    }

                    // Look for artist information in the artists items array
                    const artistMatch = embedHtml.match(/"artists":\{"items":\[\{"uri":"[^"]+","profile":\{"name":"([^"]+)"/);
                    if (artistMatch && artistMatch[1]) {
                        artist = artistMatch[1];
                    }

                    // Alternative pattern: look for simpler artist name structure
                    if (artist === 'Unknown Artist') {
                        const altArtistMatch = embedHtml.match(/"profile":\{"name":"([^"]+)"/);
                        if (altArtistMatch && altArtistMatch[1]) {
                            artist = altArtistMatch[1];
                        }
                    }
                }
            } catch (proxyError) {
                // If proxy parsing fails, continue with what we have from oEmbed
                console.log('Proxy fetch failed, using oEmbed data only:', proxyError);
            }

            return {
                platform: 'Spotify',
                title: title,
                artist: artist,
                thumbnailUrl: data.thumbnail_url || this.getSpotifyDefaultThumbnail(trackId),
                url: url,
                trackId: trackId,
            };
        } catch (error) {
            console.error('Spotify data fetch error:', error);
            return this.getSpotifyFallback(url);
        }
    }

    getSpotifyFallback(url, trackId = null) {
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
        return 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"%3E%3Crect fill="%231DB954" width="300" height="300"/%3E%3C/svg%3E';
    }

    updateItem(index, field, value) {
        this.items[index][field] = value;
        this.saveItems();
    }

    saveItems() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    }

    getRankColor(rank) {
        if (rank === 1) return 'rank-gold';
        if (rank === 2) return 'rank-silver';
        if (rank === 3) return 'rank-bronze';
        return 'rank-default';
    }

    renderItems() {
        this.itemsList.innerHTML = this.items
            .map((item, index) => {
                return this.createItemElement(item, index);
            })
            .join('');

        // Add event listeners to URL input fields
        document.querySelectorAll('.song-url-input').forEach((input) => {
            input.addEventListener('change', async (e) => {
                const url = e.target.value.trim();
                if (url) {
                    try {
                        // Find the correct index from the parent song-item
                        const songItem = e.target.closest('.song-item');
                        const actualIndex = parseInt(songItem.dataset.itemIndex);

                        const itemData = await this.parseItemFromURL(url);
                        this.items[actualIndex] = { ...this.items[actualIndex], ...itemData, url: url };
                        this.saveItems();
                        this.renderItems();
                    } catch (error) {
                        console.error('Error parsing URL:', error);
                    }
                }
            });
        });

        // Add event listener for "Add Rank" button (with delegation to avoid duplicate listeners)
        const addRankBtn = document.getElementById('addRankBtn');
        if (addRankBtn) {
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
                this.clearItem(index);
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

        // Add event listeners to thumbnail play buttons
        document.querySelectorAll('.thumbnail-play-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.target.dataset.index);
                this.playItem(index);
            });
        });

        // Add event listeners to external link buttons
        document.querySelectorAll('.external-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.openExternal(index);
            });
        });

        // Add drag and drop functionality with auto-scroll
        let draggedElement = null;
        let autoScrollInterval = null;
        const scrollThreshold = 80; // Distance from edge to trigger scroll
        const scrollSpeed = 5; // Pixels per frame

        const clearAutoScroll = () => {
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
        };

        document.querySelectorAll('.song-item').forEach((item) => {
            item.addEventListener('dragstart', (e) => {
                draggedElement = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                draggedElement = null;
                clearAutoScroll();
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (draggedElement && draggedElement !== item) {
                    item.classList.add('drag-over');
                }

                // Auto-scroll functionality
                const rect = this.itemsList.getBoundingClientRect();
                const mouseY = e.clientY;

                clearAutoScroll();

                // Check if near top
                if (mouseY - rect.top < scrollThreshold && this.itemsList.scrollTop > 0) {
                    autoScrollInterval = setInterval(() => {
                        this.itemsList.scrollTop -= scrollSpeed;
                    }, 16);
                }
                // Check if near bottom
                else if (rect.bottom - mouseY < scrollThreshold &&
                         this.itemsList.scrollTop < this.itemsList.scrollHeight - this.itemsList.clientHeight) {
                    autoScrollInterval = setInterval(() => {
                        this.itemsList.scrollTop += scrollSpeed;
                    }, 16);
                }
            });

            item.addEventListener('dragleave', (e) => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                clearAutoScroll();
                if (draggedElement && draggedElement !== item) {
                    const draggedIndex = parseInt(draggedElement.dataset.itemIndex);
                    const targetIndex = parseInt(item.dataset.itemIndex);
                    this.swapItems(draggedIndex, targetIndex);
                }
            });
        });

        // Update duplicate detection after rendering
        if (typeof this.updateDuplicateDisplay === 'function') {
            this.updateDuplicateDisplay();
        }
    }

    playItem(index) {
        const item = this.items[index];
        if (!item.url) return;

        // Find the thumbnail wrapper for this item
        const thumbnailWrapper = document.querySelector(`.thumbnail-wrapper[data-index="${index}"]`);
        if (!thumbnailWrapper) return;

        // Check if already playing - if so, restore thumbnail
        if (thumbnailWrapper.classList.contains('playing')) {
            // Restore the thumbnail
            thumbnailWrapper.innerHTML = `
                <img src="${item.thumbnailUrl}" alt="${item.title}" class="song-thumbnail" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%231e293b%22 width=%22300%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%2394a3b8%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                <button class="thumbnail-play-btn" data-index="${index}">▶</button>
            `;
            thumbnailWrapper.classList.remove('playing');

            // Get song item and remove scaling class
            const songItem = thumbnailWrapper.closest('.song-item');
            if (songItem) {
                songItem.classList.remove('youtube-expanded');
            }


            // Re-attach event listener to the new play button
            const playBtn = thumbnailWrapper.querySelector('.thumbnail-play-btn');
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.playItem(index);
            });
            return;
        }

        // Embed player based on platform
        if (item.platform === 'YouTube') {
            const videoId = item.videoId || this.extractYouTubeId(item.url);
            const playerHtml = `
                <iframe
                    width="100%"
                    height="100%"
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    style="border-radius: 5px; aspect-ratio: 1;">
                </iframe>
            `;

            // Replace thumbnail with player
            thumbnailWrapper.innerHTML = playerHtml;
            thumbnailWrapper.classList.add('playing');


            // Get the song-item and add scaling class
            const songItem = thumbnailWrapper.closest('.song-item');
            if (songItem) {
                songItem.classList.add('youtube-expanded');
            }
        } else if (item.platform === 'Spotify') {
            const trackId = item.trackId || this.extractSpotifyId(item.url);
            const playerHtml = `
                <iframe
                    style="border-radius: 5px; width: 100%; aspect-ratio: 1;"
                    src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator"
                    frameBorder="0"
                    allowfullscreen=""
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy">
                </iframe>
            `;
            // Replace thumbnail with player (no scaling for Spotify)
            thumbnailWrapper.innerHTML = playerHtml;
            thumbnailWrapper.classList.add('playing');
        }
    }

    extractYouTubeId(url) {
        // Reuse the getYouTubeVideoId method for consistency
        return this.getYouTubeVideoId(url);
    }

    extractSpotifyId(url) {
        const match = url.match(/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    openExternal(index) {
        const item = this.items[index];
        if (item.url) {
            window.open(item.url, '_blank');
        }
    }

    addRank() {
        this.items.push({
            rank: this.items.length + 1,
            title: '',
            artist: '',
            platform: '',
            thumbnailUrl: ''
        });
        this.saveItems();
        this.renderItems();
    }

    removeRank() {
        if (this.items.length > 0) {
            const lastItem = this.items[this.items.length - 1];

            // Check if the last rank has data
            if (lastItem.title || lastItem.artist || lastItem.url) {
                const removeRankBtn = document.getElementById('removeRankBtn');
                this.showMessage('Please clear the rank first using the × button on the right', 'error-message', removeRankBtn);
                return;
            }

            this.items.pop();
            this.saveItems();
            this.renderItems();
        }
    }

    clearItem(index) {
        this.items[index] = {
            rank: this.items[index].rank,
            title: '',
            artist: '',
            platform: '',
            thumbnailUrl: '',
            url: ''
        };
        this.saveItems();
        this.renderItems();
    }

    moveRankUp(index) {
        if (index > 0) {
            [this.items[index], this.items[index - 1]] = [this.items[index - 1], this.items[index]];

            this.items[index - 1].rank = index;
            this.items[index].rank = index + 1;

            this.saveItems();
            this.renderItems();
        }
    }

    moveRankDown(index) {
        if (index < this.items.length - 1) {
            [this.items[index], this.items[index + 1]] = [this.items[index + 1], this.items[index]];

            this.items[index].rank = index + 1;
            this.items[index + 1].rank = index + 2;

            this.saveItems();
            this.renderItems();
        }
    }

    swapItems(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;

        // Swap the items
        [this.items[fromIndex], this.items[toIndex]] = [this.items[toIndex], this.items[fromIndex]];

        // Update ranks for both items
        this.items[fromIndex].rank = fromIndex + 1;
        this.items[toIndex].rank = toIndex + 1;

        this.saveItems();
        this.renderItems();
    }

    createItemElement(item, index, isPlayingVideo = false) {
        const rankColor = this.getRankColor(item.rank);
        const canMoveUp = index > 0;
        const canMoveDown = index < this.items.length - 1;

        // Check if this is a Spotify track with a URL
        const hasUrl = item.url && item.url.trim() !== '';
        const isSpotify = item.platform === 'Spotify' && hasUrl;

        // If Spotify, show full embed layout
        if (isSpotify) {
            const trackId = item.trackId || this.extractSpotifyId(item.url);
            return `
                <div class="song-item song-item-spotify ${rankColor}" data-item-index="${index}">
                    <div class="rank-controls">
                        <button class="rank-arrow up-arrow" data-index="${index}" ${!canMoveUp ? 'disabled' : ''}>▲</button>
                        <div class="song-rank">#${item.rank}</div>
                        <button class="rank-arrow down-arrow" data-index="${index}" ${!canMoveDown ? 'disabled' : ''}>▼</button>
                    </div>
                    <div class="spotify-embed-wrapper">
                        <iframe
                            style="border-radius: 12px"
                            src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator"
                            width="100%"
                            height="152"
                            frameBorder="0"
                            allowfullscreen=""
                            allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy">
                        </iframe>
                    </div>
                    <button class="remove-btn" data-index="${index}">×</button>
                </div>
            `;
        }

        // For YouTube or empty items, use the standard layout
        const displayText = item.title && item.artist && item.artist !== 'Unknown Artist'
            ? `${item.title} - ${item.artist}`
            : item.title || 'Add your item';

        const externalButton = hasUrl ? `<button class="external-btn" data-index="${index}" title="Open in new tab">↗</button>` : '';

        const thumbnailHtml = hasUrl ? `
            <div class="thumbnail-wrapper" data-index="${index}">
                <img src="${item.thumbnailUrl}" alt="${item.title}" class="song-thumbnail" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%231e293b%22 width=%22300%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%2394a3b8%22%3ENo Image%3C/text%3E%3C/svg%3E'">
                <button class="thumbnail-play-btn" data-index="${index}">▶</button>
            </div>
        ` : `
            <img src="${item.thumbnailUrl}" alt="${item.title}" class="song-thumbnail" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%231e293b%22 width=%22300%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-family=%22Arial%22 font-size=%2214%22 fill=%22%2394a3b8%22%3ENo Image%3C/text%3E%3C/svg%3E'">
        `;

        const expandedClass = isPlayingVideo ? 'youtube-expanded' : '';
        const durationDisplay = item.duration ? `<div class="song-duration">⏱️ ${this.escapeHtml(item.duration)}</div>` : '';
        return `
            <div class="song-item ${rankColor} ${expandedClass}" data-item-index="${index}" draggable="true">
                <div class="rank-controls">
                    <button class="rank-arrow up-arrow" data-index="${index}" ${!canMoveUp ? 'disabled' : ''}>▲</button>
                    <div class="song-rank">#${item.rank}</div>
                    <button class="rank-arrow down-arrow" data-index="${index}" ${!canMoveDown ? 'disabled' : ''}>▼</button>
                </div>
                ${thumbnailHtml}
                <div class="song-info">
                    <div class="song-title-display">
                        ${this.escapeHtml(displayText)}
                        ${externalButton}
                    </div>
                    ${durationDisplay}
                    <input type="text" class="song-url-input" placeholder="YouTube or Spotify URL" value="${this.escapeHtml(item.url || '')}">
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

            const itemElements = doc.querySelectorAll('.song-item');
            const importedItems = [];

            itemElements.forEach((element) => {
                const rankText = element.querySelector('.song-rank')?.textContent || '';
                const rank = parseInt(rankText.replace('#', '')) || importedItems.length + 1;

                // Check if this is a Spotify embed
                const spotifyIframe = element.querySelector('.spotify-embed-wrapper iframe');
                let url = '';
                let trackId = '';
                let videoId = '';
                let platform = '';
                let title = '';
                let artist = '';
                let thumbnailUrl = '';

                if (spotifyIframe) {
                    // Spotify embed import
                    platform = 'Spotify';
                    const src = spotifyIframe.getAttribute('src') || '';
                    const trackMatch = src.match(/track\/([a-zA-Z0-9]+)/);
                    if (trackMatch) {
                        trackId = trackMatch[1];
                        url = `https://open.spotify.com/track/${trackId}`;
                    }
                    // For Spotify, we'll need to re-fetch metadata when URL is loaded
                    title = 'Spotify Track'; // Placeholder
                    artist = 'Unknown Artist';
                    thumbnailUrl = '';
                } else {
                    // Regular YouTube/other item import
                    title = element.querySelector('.song-title')?.textContent || '';
                    artist = element.querySelector('.song-artist')?.textContent || '';
                    thumbnailUrl = element.querySelector('.song-thumbnail')?.src || '';

                    // Get platform and URL from song-platform (which may contain a link or text)
                    const platformElement = element.querySelector('.song-platform');
                    if (platformElement) {
                        const link = platformElement.querySelector('a');
                        if (link) {
                            // Extract URL from the link
                            url = link.href || '';
                            platform = link.textContent.includes('youtube') || link.textContent.includes('youtu.be') ? 'YouTube' : 'Unknown';
                            // Try to extract video ID if YouTube
                            if (platform === 'YouTube' && url) {
                                const videoMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
                                if (videoMatch) videoId = videoMatch[1];
                            }
                        } else {
                            // Fallback to text content if no link
                            platform = platformElement.textContent || '';
                        }
                    }
                }

                if (title || url) {
                    importedItems.push({
                        rank: rank,
                        title: title,
                        artist: artist,
                        platform: platform,
                        thumbnailUrl: thumbnailUrl,
                        url: url,
                        trackId: trackId || undefined,
                        videoId: videoId || undefined
                    });
                }
            });

            if (importedItems.length > 0) {
                this.items = importedItems;
                this.saveItems();
                this.renderItems();
                this.showMessage('Successfully imported items!', 'success-message');
            } else {
                this.showMessage('No items found in the imported file.', 'error-message');
            }
        } catch (error) {
            console.error('Error importing file:', error);
            this.showMessage('Error importing file. Please check the file format.', 'error-message');
        }

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
        // Get the category title from the page
        const pageTitleElement = document.querySelector('.songs-list h2');
        const categoryTitle = pageTitleElement ? pageTitleElement.textContent.trim() : 'Rankings';

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(categoryTitle)} - Bou Challenges</title>
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
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .song-item:hover {
            background: linear-gradient(135deg, #2d3f4f 0%, #3a4a5a 100%);
            border-color: #a855f7;
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
            transform: translateY(-2px);
        }
        .song-item-spotify {
            grid-template-columns: 60px 1fr;
        }
        .spotify-embed-wrapper {
            width: 100%;
        }
        .song-rank {
            font-size: 1.8em;
            font-weight: 800;
            background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
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
        .song-platform a {
            cursor: pointer;
            transition: opacity 0.2s ease;
        }
        .song-platform a:hover {
            opacity: 0.8;
            text-decoration: underline;
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
        <h1>${this.escapeHtml(categoryTitle)}</h1>
        <div class="songs-list">
            ${this.items
              .filter(item => item.title)
              .map(item => {
                const rankClass =
                  item.rank === 1 ? 'rank-gold' :
                  item.rank === 2 ? 'rank-silver' :
                  item.rank === 3 ? 'rank-bronze' : '';

                // Check if this is a Spotify track
                const isSpotify = item.platform === 'Spotify' && item.url;

                if (isSpotify) {
                  const trackId = item.trackId || this.extractSpotifyId(item.url);
                  return `
            <div class="song-item song-item-spotify ${rankClass}">
                <div class="song-rank">#${item.rank}</div>
                <div class="spotify-embed-wrapper">
                    <iframe
                        style="border-radius: 12px"
                        src="https://open.spotify.com/embed/track/${trackId}?utm_source=generator"
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allowfullscreen=""
                        allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy">
                    </iframe>
                </div>
            </div>`;
                } else {
                  const platformHtml = item.url
                    ? `<a href="${item.url}" target="_blank" style="color: #a855f7; text-decoration: none; font-weight: 500;">${item.url}</a>`
                    : item.platform;

                  // Add onclick to open URL if it exists
                  const onclickAttr = item.url ? ` onclick="window.open('${item.url}', '_blank');"` : '';
                  return `
            <div class="song-item ${rankClass}"${onclickAttr}>
                <div class="song-rank">#${item.rank}</div>
                <img src="${item.thumbnailUrl}" alt="${item.title}" class="song-thumbnail">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(item.title)}</div>
                    <div class="song-artist">${this.escapeHtml(item.artist)}</div>
                    <div class="song-platform">${platformHtml}</div>
                </div>
            </div>`;
                }
              })
              .join('')}
        </div>
        <footer>
            <p>Created by a Bou for a Bou | Made with ❤️</p>
        </footer>
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Generate dynamic filename from the category title and username
        // e.g., "Top Disney Songs" with username "BullSupreme" -> "BullSupreme_TopDisneySongs.html"
        const username = typeof getUsername === 'function' ? getUsername() : (localStorage.getItem('bouUsername') || '');
        const baseFilename = categoryTitle.replace(/\s+/g, '');
        const filename = username ? `${username}_${baseFilename}.html` : `${baseFilename}.html`;
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Duplicate Detection Methods
    levenshteinDistance(str1, str2) {
        // Calculate edit distance between two strings
        const len1 = str1.length;
        const len2 = str2.length;
        const matrix = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[len1][len2];
    }

    stringSimilarity(str1, str2) {
        // Returns similarity percentage (0-100)
        if (!str1 || !str2) return 0;

        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return 100;

        const distance = this.levenshteinDistance(s1, s2);
        const maxLen = Math.max(s1.length, s2.length);

        return Math.round(((maxLen - distance) / maxLen) * 100);
    }

    detectDuplicates() {
        const duplicates = [];
        const items = this.items.filter(item => item.title && item.title.trim());

        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const item1 = items[i];
                const item2 = items[j];

                const titleSimilarity = this.stringSimilarity(item1.title, item2.title);
                const artistSimilarity = this.stringSimilarity(item1.artist, item2.artist);

                let severity = null;
                let reason = '';

                // RED: 98%+ match on title (exact or near-exact duplicates)
                if (titleSimilarity >= 98) {
                    severity = 'red';
                    reason = `Exact title match (${titleSimilarity}% similar)`;
                }
                // ORANGE: Partial match - same artist + similar title (70%+) OR same title + different artist
                else if (artistSimilarity >= 90 && titleSimilarity >= 70) {
                    severity = 'orange';
                    reason = `Same artist, similar title (${titleSimilarity}% similar)`;
                }
                else if (titleSimilarity >= 90 && artistSimilarity < 70 && item1.artist && item2.artist) {
                    severity = 'orange';
                    reason = `Same title, different artist`;
                }
                // YELLOW: Possible match - same artist OR similar title (60-89%)
                else if (artistSimilarity >= 90) {
                    severity = 'yellow';
                    reason = `Same artist`;
                }
                else if (titleSimilarity >= 60 && titleSimilarity < 90) {
                    severity = 'yellow';
                    reason = `Similar title (${titleSimilarity}% similar)`;
                }

                if (severity) {
                    duplicates.push({
                        rank1: item1.rank,
                        rank2: item2.rank,
                        title1: item1.title,
                        title2: item2.title,
                        artist1: item1.artist || 'N/A',
                        artist2: item2.artist || 'N/A',
                        severity: severity,
                        reason: reason,
                        similarity: Math.max(titleSimilarity, artistSimilarity)
                    });
                }
            }
        }

        return duplicates;
    }

    setupDuplicateDetection() {
        // Create indicator at top
        const header = document.querySelector('header');
        if (!header) return;

        let indicator = document.getElementById('duplicateIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'duplicateIndicator';
            indicator.style.cssText = `
                padding: 12px;
                background: linear-gradient(135deg, #1e293b 0%, #253549 100%);
                border-radius: 8px;
                border: 2px solid #334155;
                display: flex;
                gap: 15px;
                align-items: center;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            indicator.onclick = () => {
                document.getElementById('duplicatesSection')?.scrollIntoView({ behavior: 'smooth' });
            };
            header.appendChild(indicator);
        }

        // Create duplicates section at bottom
        let duplicatesSection = document.getElementById('duplicatesSection');
        if (!duplicatesSection) {
            duplicatesSection = document.createElement('div');
            duplicatesSection.id = 'duplicatesSection';
            duplicatesSection.style.cssText = `
                margin-top: 40px;
                padding: 20px;
                background: linear-gradient(135deg, #1e293b 0%, #253549 100%);
                border-radius: 10px;
                border: 2px solid #334155;
            `;

            const footer = document.querySelector('footer');
            if (footer && footer.parentNode) {
                footer.parentNode.insertBefore(duplicatesSection, footer);
            }
        }

        this.updateDuplicateDisplay();
    }

    updateDuplicateDisplay() {
        const duplicates = this.detectDuplicates();
        const indicator = document.getElementById('duplicateIndicator');
        const section = document.getElementById('duplicatesSection');

        if (!indicator || !section) return;

        const redCount = duplicates.filter(d => d.severity === 'red').length;
        const orangeCount = duplicates.filter(d => d.severity === 'orange').length;
        const yellowCount = duplicates.filter(d => d.severity === 'yellow').length;

        // Update indicator
        if (duplicates.length === 0) {
            indicator.innerHTML = `<span style="color: #10b981; font-weight: 600;">✓ No duplicates detected</span>`;
            section.style.display = 'none';
        } else {
            indicator.innerHTML = `
                <span style="color: #cbd5e1; font-weight: 600;">⚠ Potential Duplicates:</span>
                ${redCount > 0 ? `<span style="background: #dc2626; color: white; padding: 4px 12px; border-radius: 5px; font-weight: 600;">${redCount} Exact</span>` : ''}
                ${orangeCount > 0 ? `<span style="background: #ea580c; color: white; padding: 4px 12px; border-radius: 5px; font-weight: 600;">${orangeCount} Partial</span>` : ''}
                ${yellowCount > 0 ? `<span style="background: #eab308; color: white; padding: 4px 12px; border-radius: 5px; font-weight: 600;">${yellowCount} Possible</span>` : ''}
                <span style="color: #94a3b8; font-size: 0.9em; margin-left: auto;">Click to view details ↓</span>
            `;
            section.style.display = 'block';

            // Update section content
            section.innerHTML = `
                <h3 style="color: #f1f5f9; margin-bottom: 20px; font-size: 1.5em;">Duplicate Detection Results</h3>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${duplicates.map(dup => `
                        <div style="
                            background: ${dup.severity === 'red' ? '#7f1d1d' : dup.severity === 'orange' ? '#7c2d12' : '#713f12'};
                            border-left: 4px solid ${dup.severity === 'red' ? '#dc2626' : dup.severity === 'orange' ? '#ea580c' : '#eab308'};
                            padding: 15px;
                            border-radius: 8px;
                        ">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                                <span style="
                                    background: ${dup.severity === 'red' ? '#dc2626' : dup.severity === 'orange' ? '#ea580c' : '#eab308'};
                                    color: white;
                                    padding: 4px 10px;
                                    border-radius: 5px;
                                    font-size: 0.85em;
                                    font-weight: 600;
                                ">${dup.severity.toUpperCase()}</span>
                                <span style="color: #cbd5e1; font-size: 0.9em;">${dup.reason}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;"
                                     onmouseover="this.style.background='rgba(168, 85, 247, 0.2)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(168, 85, 247, 0.3)';"
                                     onmouseout="this.style.background='rgba(0,0,0,0.3)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';"
                                     onclick="window.rankingManager.scrollToRank(${dup.rank1})">
                                    <div style="color: #94a3b8; font-size: 0.85em; margin-bottom: 5px; text-decoration: underline;">Rank #${dup.rank1}</div>
                                    <div style="color: #f1f5f9; font-weight: 600; margin-bottom: 3px;">${this.escapeHtml(dup.title1)}</div>
                                    <div style="color: #cbd5e1; font-size: 0.9em;">${this.escapeHtml(dup.artist1)}</div>
                                </div>
                                <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s ease;"
                                     onmouseover="this.style.background='rgba(168, 85, 247, 0.2)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(168, 85, 247, 0.3)';"
                                     onmouseout="this.style.background='rgba(0,0,0,0.3)'; this.style.transform='translateY(0)'; this.style.boxShadow='none';"
                                     onclick="window.rankingManager.scrollToRank(${dup.rank2})">
                                    <div style="color: #94a3b8; font-size: 0.85em; margin-bottom: 5px; text-decoration: underline;">Rank #${dup.rank2}</div>
                                    <div style="color: #f1f5f9; font-weight: 600; margin-bottom: 3px;">${this.escapeHtml(dup.title2)}</div>
                                    <div style="color: #cbd5e1; font-size: 0.9em;">${this.escapeHtml(dup.artist2)}</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    scrollToRank(rank) {
        // Find the song-item with the matching rank
        const rankItems = this.itemsList.querySelectorAll('.song-item');
        for (const item of rankItems) {
            const rankElement = item.querySelector('.song-rank');
            if (rankElement) {
                const rankText = rankElement.textContent.replace('#', '').trim();
                const itemRank = parseInt(rankText);
                if (itemRank === rank) {
                    // Scroll to the item
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    // Add temporary highlight effect
                    const originalBackground = item.style.background;
                    item.style.background = 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(236, 72, 153, 0.3) 100%)';
                    item.style.transition = 'background 0.3s ease';

                    setTimeout(() => {
                        item.style.background = originalBackground;
                    }, 2000);

                    break;
                }
            }
        }
    }

    // Community Rankings Methods
    async fetchCommunityRankings() {
        try {
            // Fetch list of users from GitHub
            const response = await fetch(
                'https://api.github.com/repos/BullSupreme/BouChallenges/contents/Users',
                { headers: { 'Accept': 'application/vnd.github.v3+json' } }
            );

            if (!response.ok) return [];

            const users = await response.json();
            return users.filter(item => item.type === 'dir').map(item => item.name);
        } catch (error) {
            console.log('Could not fetch community rankings:', error);
            return [];
        }
    }

    async getCategoryFilesForUser(username, categoryName) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/BullSupreme/BouChallenges/contents/Users/${username}`,
                { headers: { 'Accept': 'application/vnd.github.v3+json' } }
            );

            if (!response.ok) return [];

            const files = await response.json();
            // Filter for files matching the category
            // Replace "/" with "_" and remove spaces to match filename format
            const categoryMatch = categoryName.toLowerCase().replace(/\s+/g, '').replace(/\//g, '_');
            return files.filter(item =>
                item.type === 'file' &&
                item.name.toLowerCase().includes(categoryMatch)
            );
        } catch (error) {
            console.log('Could not fetch category files:', error);
            return [];
        }
    }

    async fetchUserRankingHTML(username, filename) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/BullSupreme/BouChallenges/contents/Users/${username}/${filename}`,
                { headers: { 'Accept': 'application/vnd.github.v3.raw' } }
            );

            if (!response.ok) return null;

            return await response.text();
        } catch (error) {
            console.log('Could not fetch user ranking:', error);
            return null;
        }
    }

    async setupCommunityBrowser() {
        // Create independent left sidebar (not inside main container)
        const body = document.body;
        if (document.getElementById('communitySection')) return;

        // Get container width to adjust body layout
        const container = document.querySelector('.container');
        if (!container) return;

        // Create left sidebar outside of main content
        const communitySection = document.createElement('div');
        communitySection.id = 'communitySection';
        communitySection.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 280px;
            height: 100vh;
            padding: 20px;
            background: linear-gradient(135deg, #1e293b 0%, #253549 100%);
            border-right: 2px solid #334155;
            overflow-y: auto;
            z-index: 100;
        `;

        communitySection.innerHTML = `
            <h3 style="color: #f1f5f9; margin-bottom: 15px; font-size: 1.2em; text-align: center; margin-top: 50px;">Community Rankings</h3>
            <div id="communityUsers" style="display: flex; flex-direction: column; gap: 8px;"></div>
        `;

        body.insertBefore(communitySection, body.firstChild);

        // Shift main container to the right
        container.style.marginLeft = '280px';

        // Get current category from page
        const categoryTitle = document.querySelector('.songs-list h2')?.textContent?.trim() || 'Rankings';

        // Fetch and display users
        const users = await this.fetchCommunityRankings();
        const communityUsers = document.getElementById('communityUsers');

        if (users.length === 0) {
            communityUsers.innerHTML = '<p style="color: #cbd5e1;">No community rankings yet</p>';
            return;
        }

        // Filter users to only show those with files for this category
        const usersWithCategory = [];
        for (const username of users) {
            const files = await this.getCategoryFilesForUser(username, categoryTitle);
            if (files.length > 0) {
                usersWithCategory.push(username);
            }
        }

        if (usersWithCategory.length === 0) {
            communityUsers.innerHTML = '<p style="color: #cbd5e1;">No submissions for this category</p>';
            return;
        }

        // Track selected users for comparison
        const selectedUsers = new Set();

        for (const username of usersWithCategory) {
            const userCard = document.createElement('div');
            userCard.style.cssText = `
                padding: 12px;
                background: rgba(0,0,0,0.3);
                border: 2px solid #334155;
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 10px;
            `;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.cssText = `
                cursor: pointer;
                width: 18px;
                height: 18px;
                flex-shrink: 0;
            `;

            const label = document.createElement('div');
            label.style.cssText = `
                color: #a855f7;
                font-weight: 600;
                flex: 1;
            `;
            label.textContent = username;

            userCard.appendChild(checkbox);
            userCard.appendChild(label);

            userCard.addEventListener('mouseover', function() {
                this.style.background = 'rgba(168, 85, 247, 0.2)';
                this.style.borderColor = '#a855f7';
            });

            userCard.addEventListener('mouseout', function() {
                if (!checkbox.checked) {
                    this.style.background = 'rgba(0,0,0,0.3)';
                    this.style.borderColor = '#334155';
                }
            });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedUsers.add(username);
                    userCard.style.background = 'rgba(168, 85, 247, 0.3)';
                    userCard.style.borderColor = '#a855f7';
                } else {
                    selectedUsers.delete(username);
                    userCard.style.background = 'rgba(0,0,0,0.3)';
                    userCard.style.borderColor = '#334155';
                }

                // Enable/disable compare button
                if (selectedUsers.size >= 2) {
                    compareBtn.style.opacity = '1';
                    compareBtn.style.pointerEvents = 'auto';
                } else {
                    compareBtn.style.opacity = '0.5';
                    compareBtn.style.pointerEvents = 'none';
                }
            });

            // Single click to view ranking
            label.addEventListener('click', (e) => {
                e.stopPropagation();
                this.viewUserRanking(username);
            });

            communityUsers.appendChild(userCard);
        }

        // Add compare button
        const compareBtn = document.createElement('button');
        compareBtn.style.cssText = `
            margin-top: 15px;
            padding: 10px 15px;
            background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            width: 100%;
            opacity: 0.5;
            pointer-events: none;
            transition: all 0.2s ease;
        `;
        compareBtn.textContent = 'Compare Selected';

        compareBtn.addEventListener('mouseover', function() {
            if (selectedUsers.size >= 2) {
                this.style.background = 'linear-gradient(135deg, #0891b2 0%, #2563eb 100%)';
            }
        });

        compareBtn.addEventListener('mouseout', function() {
            this.style.background = 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)';
        });

        compareBtn.addEventListener('click', async () => {
            if (selectedUsers.size >= 2) {
                const usernames = Array.from(selectedUsers).slice(0, 2);
                await this.displayComparisonModal(usernames[0], usernames[1], categoryTitle);
            }
        });

        communityUsers.appendChild(compareBtn);
    }

    async viewUserRanking(username) {
        // Get current category from page
        const categoryTitle = document.querySelector('.songs-list h2')?.textContent?.trim() || 'Rankings';

        // Fetch user's files for this category
        const files = await this.getCategoryFilesForUser(username, categoryTitle);

        if (files.length === 0) {
            alert(`${username} has not submitted rankings for "${categoryTitle}"`);
            return;
        }

        // Get the first matching file
        const filename = files[0].name;
        const htmlContent = await this.fetchUserRankingHTML(username, filename);

        if (!htmlContent) {
            alert('Could not load ranking');
            return;
        }

        // Parse and display
        this.displayUserRankingModal(username, htmlContent, categoryTitle);
    }

    extractYouTubeVideoId(url) {
        // Extract video ID from various YouTube URL formats
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /^([a-zA-Z0-9_-]{11})$/ // 11-char video ID
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1];
            }
        }
        return null;
    }

    displayUserRankingModal(username, htmlContent, categoryTitle) {
        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: linear-gradient(135deg, #1e293b 0%, #253549 100%);
            border: 2px solid #334155;
            border-radius: 10px;
            max-width: 900px;
            width: 100%;
            max-height: 80vh;
            padding: 20px;
            color: #f1f5f9;
            display: flex;
            flex-direction: column;
        `;

        // Parse HTML to extract ranking data
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const items = doc.querySelectorAll('.song-item');

        let itemsHTML = '';
        items.forEach((item) => {
            const rank = item.querySelector('.song-rank')?.textContent || '#?';
            const title = item.querySelector('.song-title')?.textContent || '';
            const thumbnail = item.querySelector('.song-thumbnail')?.src || '';
            const platformLink = item.querySelector('.song-platform a')?.href || item.querySelector('.song-platform')?.textContent || '';

            // Extract just the URL text for display
            const urlDisplay = platformLink.startsWith('http') ? platformLink : '';

            // Check if it's a YouTube link and extract video ID
            const videoId = this.extractYouTubeVideoId(platformLink);
            const isYouTube = videoId !== null;

            itemsHTML += `
                <div style="display: flex; flex-direction: column; gap: 10px; padding: 15px 0; border-bottom: 1px solid #334155;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="font-size: 1.3em; font-weight: 700; color: #a855f7; min-width: 40px; text-align: center;">${rank}</div>
                        <div style="color: #f1f5f9; font-weight: 600;">${title}</div>
                    </div>
                    ${isYouTube ? `
                        <div style="width: 100%; max-width: 400px; position: relative; aspect-ratio: 16/9; background: #0f172a; border-radius: 5px; overflow: hidden;">
                            <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" data-video-id="${videoId}" alt="thumbnail" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" class="yt-thumbnail" onclick="this.parentElement.innerHTML = '<iframe width=\\'100%\\' height=\\'100%\\' src=\\'https://www.youtube.com/embed/${videoId}?autoplay=1\\' frameborder=\\'0\\' allow=\\'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\\' allowfullscreen style=\\'position: absolute; top: 0; left: 0;\\' loading=\\'lazy\\'></iframe>';" style="display: block;">
                            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255, 0, 0, 0.8); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: none;">
                                <div style="width: 0; height: 0; border-left: 20px solid white; border-top: 12px solid transparent; border-bottom: 12px solid transparent; margin-left: 4px;"></div>
                            </div>
                        </div>
                    ` : (thumbnail ? `<img src="${thumbnail}" alt="${title}" style="max-width: 300px; border-radius: 5px; object-fit: cover; cursor: pointer;" onclick="window.open('${platformLink}', '_blank');">` : '')}
                    ${urlDisplay ? `<a href="${platformLink}" target="_blank" style="color: #a855f7; font-size: 0.85em; text-decoration: none; font-weight: 500; word-break: break-all;">${platformLink}</a>` : ''}
                </div>
            `;
        });

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0;">
                <h2 style="color: #a855f7; margin: 0;">${username}'s ${categoryTitle}</h2>
                <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background: #334155; color: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600;">Close</button>
            </div>
            <div style="flex: 1; overflow-y: auto; min-height: 0;">
                ${itemsHTML || '<p style="color: #cbd5e1;">No rankings found</p>'}
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Setup thumbnail fallback handlers for solo modal
        setTimeout(() => {
            const images = modal.querySelectorAll('img[data-video-id]');
            images.forEach(img => {
                const videoId = img.dataset.videoId;
                const qualities = ['hqdefault', 'sddefault', 'mqdefault', 'default'];
                let currentQualityIndex = 0;

                img.onerror = function() {
                    currentQualityIndex++;
                    if (currentQualityIndex < qualities.length) {
                        this.src = `https://img.youtube.com/vi/${videoId}/${qualities[currentQualityIndex]}.jpg`;
                    }
                };
            });
        }, 0);

        // Close on background click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async displayComparisonModal(username1, username2, categoryTitle) {
        // Get files for both users
        const files1 = await this.getCategoryFilesForUser(username1, categoryTitle);
        const files2 = await this.getCategoryFilesForUser(username2, categoryTitle);

        if (files1.length === 0 || files2.length === 0) {
            alert('Could not find rankings for comparison');
            return;
        }

        const htmlContent1 = await this.fetchUserRankingHTML(username1, files1[0].name);
        const htmlContent2 = await this.fetchUserRankingHTML(username2, files2[0].name);

        if (!htmlContent1 || !htmlContent2) {
            alert('Could not load rankings');
            return;
        }

        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: linear-gradient(135deg, #1e293b 0%, #253549 100%);
            border: 2px solid #334155;
            border-radius: 10px;
            width: 100%;
            max-height: 85vh;
            padding: 20px;
            color: #f1f5f9;
            display: flex;
            flex-direction: column;
            max-width: 1400px;
        `;

        // Helper function to parse items from HTML
        const parseItems = (htmlContent) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const items = [];
            doc.querySelectorAll('.song-item').forEach((item) => {
                const rank = item.querySelector('.song-rank')?.textContent || '#?';
                const title = item.querySelector('.song-title')?.textContent || '';
                const thumbnail = item.querySelector('.song-thumbnail')?.src || '';
                const platformLink = item.querySelector('.song-platform a')?.href || item.querySelector('.song-platform')?.textContent || '';
                const urlDisplay = platformLink.startsWith('http') ? platformLink : '';
                const videoId = this.extractYouTubeVideoId(platformLink);
                const isYouTube = videoId !== null;

                items.push({ rank, title, thumbnail, platformLink, urlDisplay, videoId, isYouTube });
            });
            return items;
        };

        const items1 = parseItems(htmlContent1);
        const items2 = parseItems(htmlContent2);

        // Build comparison HTML
        const maxItems = Math.max(items1.length, items2.length);
        let comparisonHTML = '';

        for (let i = 0; i < maxItems; i++) {
            const item1 = items1[i];
            const item2 = items2[i];

            comparisonHTML += `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 15px 0; border-bottom: 1px solid #334155;">
                    <!-- User 1 Item -->
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${item1 ? `
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="font-size: 1.3em; font-weight: 700; color: #a855f7; min-width: 35px; text-align: center;">${item1.rank}</div>
                                <div style="color: #f1f5f9; font-weight: 600; font-size: 0.95em;">${item1.title}</div>
                            </div>
                            ${item1.isYouTube ? `
                                <div style="width: 90%; position: relative; aspect-ratio: 16/9; background: #0f172a; border-radius: 5px; overflow: hidden;">
                                    <img src="https://img.youtube.com/vi/${item1.videoId}/hqdefault.jpg" data-video-id="${item1.videoId}" alt="thumbnail" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="this.parentElement.innerHTML = '<iframe width=\\'100%\\' height=\\'100%\\' src=\\'https://www.youtube.com/embed/${item1.videoId}?autoplay=1\\' frameborder=\\'0\\' allow=\\'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\\' allowfullscreen style=\\'position: absolute; top: 0; left: 0;\\' loading=\\'lazy\\'></iframe>';" style="display: block;">
                                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 45px; height: 45px; background: rgba(255, 0, 0, 0.8); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: none;">
                                        <div style="width: 0; height: 0; border-left: 14px solid white; border-top: 9px solid transparent; border-bottom: 9px solid transparent; margin-left: 2px;"></div>
                                    </div>
                                </div>
                            ` : (item1.thumbnail ? `<img src="${item1.thumbnail}" alt="${item1.title}" style="width: 90%; border-radius: 5px; object-fit: cover;">` : '')}
                            ${item1.urlDisplay ? `<a href="${item1.platformLink}" target="_blank" style="color: #a855f7; font-size: 0.8em; text-decoration: none; font-weight: 500; word-break: break-all;">${item1.platformLink}</a>` : ''}
                        ` : '<div style="color: #64748b;">No ranking</div>'}
                    </div>

                    <!-- User 2 Item -->
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${item2 ? `
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="font-size: 1.3em; font-weight: 700; color: #06b6d4; min-width: 35px; text-align: center;">${item2.rank}</div>
                                <div style="color: #f1f5f9; font-weight: 600; font-size: 0.95em;">${item2.title}</div>
                            </div>
                            ${item2.isYouTube ? `
                                <div style="width: 90%; position: relative; aspect-ratio: 16/9; background: #0f172a; border-radius: 5px; overflow: hidden;">
                                    <img src="https://img.youtube.com/vi/${item2.videoId}/hqdefault.jpg" data-video-id="${item2.videoId}" alt="thumbnail" style="width: 100%; height: 100%; object-fit: cover; cursor: pointer;" onclick="this.parentElement.innerHTML = '<iframe width=\\'100%\\' height=\\'100%\\' src=\\'https://www.youtube.com/embed/${item2.videoId}?autoplay=1\\' frameborder=\\'0\\' allow=\\'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share\\' allowfullscreen style=\\'position: absolute; top: 0; left: 0;\\' loading=\\'lazy\\'></iframe>';" style="display: block;">
                                    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 45px; height: 45px; background: rgba(255, 0, 0, 0.8); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: none;">
                                        <div style="width: 0; height: 0; border-left: 14px solid white; border-top: 9px solid transparent; border-bottom: 9px solid transparent; margin-left: 2px;"></div>
                                    </div>
                                </div>
                            ` : (item2.thumbnail ? `<img src="${item2.thumbnail}" alt="${item2.title}" style="width: 90%; border-radius: 5px; object-fit: cover;">` : '')}
                            ${item2.urlDisplay ? `<a href="${item2.platformLink}" target="_blank" style="color: #06b6d4; font-size: 0.8em; text-decoration: none; font-weight: 500; word-break: break-all;">${item2.platformLink}</a>` : ''}
                        ` : '<div style="color: #64748b;">No ranking</div>'}
                    </div>
                </div>
            `;
        }

        content.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-shrink: 0;">
                <div style="display: flex; gap: 20px; align-items: center; flex: 1;">
                    <h2 style="color: #a855f7; margin: 0; text-align: center; flex: 1; border-right: 2px solid #334155; padding-right: 20px;">${username1}</h2>
                    <h2 style="color: #06b6d4; margin: 0; text-align: center; flex: 1;">${username2}</h2>
                </div>
                <button onclick="this.closest('div').parentElement.parentElement.remove()" style="background: #334155; color: #f1f5f9; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; flex-shrink: 0;">Close</button>
            </div>
            <div style="flex: 1; overflow-y: auto; min-height: 0;">
                <div style="color: #cbd5e1; font-size: 0.9em; margin-bottom: 15px; padding: 0 10px;">
                    <span style="color: #a855f7;">◆</span> ${categoryTitle}
                </div>
                ${comparisonHTML || '<p style="color: #cbd5e1;">No rankings to compare</p>'}
            </div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        // Setup thumbnail fallback handlers
        setTimeout(() => {
            const images = modal.querySelectorAll('img[data-video-id]');
            images.forEach(img => {
                const videoId = img.dataset.videoId;
                const qualities = ['hqdefault', 'sddefault', 'mqdefault', 'default'];
                let currentQualityIndex = 0;

                img.onerror = function() {
                    currentQualityIndex++;
                    if (currentQualityIndex < qualities.length) {
                        this.src = `https://img.youtube.com/vi/${videoId}/${qualities[currentQualityIndex]}.jpg`;
                    }
                };
            });
        }, 0);

        // Close on background click
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}
