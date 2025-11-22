// Generic Ranking Manager - Works for all challenge types
// Usage: Update the storageKey and challengeType based on your specific challenge

class RankingManager {
    constructor(storageKey = 'rankingData', challengeType = 'generic') {
        this.storageKey = storageKey;
        this.challengeType = challengeType;
        this.items = JSON.parse(localStorage.getItem(this.storageKey)) || this.initializeDefaults();
        this.itemsList = document.getElementById('songsList');
        this.playingVideoIndex = null; // Track which item has video playing
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
            artist: '',
            thumbnailUrl: thumbnailUrl,
            url: url,
            videoId: videoId,
        };
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
            .map((item, index) => this.createItemElement(item, index))
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

        // Restore playing video if one was active
        if (this.playingVideoIndex !== null) {
            const playingItem = this.items[this.playingVideoIndex];
            if (playingItem && playingItem.platform === 'YouTube') {
                // Wait a tick for DOM to be ready, then re-attach the video
                setTimeout(() => {
                    const thumbnailWrapper = document.querySelector(`.thumbnail-wrapper[data-index="${this.playingVideoIndex}"]`);
                    if (thumbnailWrapper) {
                        const videoId = playingItem.videoId || this.extractYouTubeId(playingItem.url);
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
                        thumbnailWrapper.innerHTML = playerHtml;
                        thumbnailWrapper.classList.add('playing');

                        // Add the expanded class to the song-item
                        const songItem = thumbnailWrapper.closest('.song-item');
                        if (songItem) {
                            songItem.classList.add('youtube-expanded');
                        }
                    }
                }, 0);
            }
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

            // Clear the tracking variable
            this.playingVideoIndex = null;

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

            // Track that this video is playing
            this.playingVideoIndex = index;

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

    createItemElement(item, index) {
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

        return `
            <div class="song-item ${rankColor}" data-item-index="${index}" draggable="true">
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
                    platform = element.querySelector('.song-platform')?.textContent || '';
                    thumbnailUrl = element.querySelector('.song-thumbnail')?.src || '';
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
        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rankings - Bou Challenges</title>
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
        <h1>Rankings</h1>
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
                  return `
            <div class="song-item ${rankClass}">
                <div class="song-rank">#${item.rank}</div>
                <img src="${item.thumbnailUrl}" alt="${item.title}" class="song-thumbnail">
                <div class="song-info">
                    <div class="song-title">${this.escapeHtml(item.title)}</div>
                    <div class="song-artist">${this.escapeHtml(item.artist)}</div>
                    <div class="song-platform">${item.platform}</div>
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

        // Generate dynamic filename from the page title (h2 element)
        const pageTitleElement = document.querySelector('.songs-list h2');
        let filename = 'Rankings.html';
        if (pageTitleElement) {
            // Get the text content and format it for a filename
            // e.g., "Top Disney Songs" -> "TopDisneySongs.html"
            const pageTitle = pageTitleElement.textContent.trim();
            filename = pageTitle.replace(/\s+/g, '') + '.html';
        }
        a.download = filename;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
