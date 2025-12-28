class PlaylistsManager {
    constructor() {
        this.playlists = JSON.parse(localStorage.getItem('userPlaylists')) || [];
        this.currentEditingPlaylist = null;
        this.selectedRankings = [];
        this.importedRankings = [];

        this.init();
    }

    init() {
        this.renderPlaylists();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('createPlaylistBtn').addEventListener('click', () => this.openCreateModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('savePlaylistBtn').addEventListener('click', () => this.savePlaylist());
    }

    setupModalEventListeners() {
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
            // Tab switching
            const personalTab = document.getElementById('personalTab');
            const communityTab = document.getElementById('communityTab');
            const personalSection = document.getElementById('personalRankingsSection');
            const communitySection = document.getElementById('communityRankingsSection');

            console.log('Setting up tab listeners:', { personalTab, communityTab });

            if (personalTab && communityTab && personalSection && communitySection) {
                // Remove any existing listeners by cloning
                const newPersonalTab = personalTab.cloneNode(true);
                const newCommunityTab = communityTab.cloneNode(true);
                personalTab.parentNode.replaceChild(newPersonalTab, personalTab);
                communityTab.parentNode.replaceChild(newCommunityTab, communityTab);

                newPersonalTab.addEventListener('click', () => {
                    console.log('Personal tab clicked');
                    personalSection.style.display = 'block';
                    communitySection.style.display = 'none';
                    newPersonalTab.className = 'btn btn-primary';
                    newPersonalTab.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    newCommunityTab.className = 'btn btn-secondary';
                    newCommunityTab.style.background = '';
                });

                newCommunityTab.addEventListener('click', () => {
                    console.log('Community tab clicked');
                    personalSection.style.display = 'none';
                    communitySection.style.display = 'block';
                    newCommunityTab.className = 'btn btn-primary';
                    newCommunityTab.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    newPersonalTab.className = 'btn btn-secondary';
                    newPersonalTab.style.background = '';
                    this.renderImportedRankings();
                });
            } else {
                console.error('Tab elements not found:', { personalTab, communityTab, personalSection, communitySection });
            }

            // File import handling
            const importFile = document.getElementById('importRankingFile');
            if (importFile) {
                importFile.addEventListener('change', (e) => this.handleFileImport(e));
            }
        }, 100);
    }

    openCreateModal() {
        this.currentEditingPlaylist = null;
        this.selectedRankings = [];

        const modal = document.getElementById('playlistModal');
        const modalTitle = document.getElementById('modalTitle');
        const nameInput = document.getElementById('playlistNameInput');

        if (!modal || !modalTitle || !nameInput) {
            console.error('Modal elements not found');
            return;
        }

        modalTitle.textContent = 'Create Playlist';
        nameInput.value = '';
        modal.style.display = 'flex';

        // Setup event listeners after modal is displayed
        this.setupModalEventListeners();
        this.renderAvailableRankings();
        this.updateSelectedRankings();
    }

    openEditModal(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) return;

        this.currentEditingPlaylist = playlist;
        this.selectedRankings = [...playlist.rankings];

        const modal = document.getElementById('playlistModal');
        const modalTitle = document.getElementById('modalTitle');
        const nameInput = document.getElementById('playlistNameInput');

        if (!modal || !modalTitle || !nameInput) {
            console.error('Modal elements not found');
            return;
        }

        modalTitle.textContent = 'Edit Playlist';
        nameInput.value = playlist.name;
        this.renderAvailableRankings();
        this.updateSelectedRankings();
        modal.style.display = 'flex';
    }

    closeModal() {
        const modal = document.getElementById('playlistModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentEditingPlaylist = null;
        this.selectedRankings = [];
    }

    renderAvailableRankings() {
        const container = document.getElementById('availableRankings');

        if (!container) {
            console.error('availableRankings container not found');
            return;
        }

        // Define all available ranking categories
        const availableCategories = [
            { id: 'animeOST', name: 'Anime OST/Theme' },
            { id: 'animeEnding', name: 'Anime Ending' },
            { id: 'animeOpening', name: 'Anime Opening' },
            { id: 'christmasMovies', name: 'Christmas Movies' },
            { id: 'disneySongs', name: 'Disney Songs' },
            { id: 'topMovies', name: 'Top Movies' },
            { id: 'topMovieSongs', name: 'Top Movie Songs' },
            { id: 'topVideoGames', name: 'Top Video Games' },
            { id: 'topVideoGamesMusic', name: 'Top Video Games Music' }
        ];

        container.innerHTML = availableCategories.map(category => {
            const isSelected = this.selectedRankings.some(r => r.id === category.id);
            return `
                <div class="ranking-card" style="padding: 15px; background: ${isSelected ? '#334155' : '#0f172a'}; border: 2px solid ${isSelected ? '#10b981' : '#334155'}; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;" data-id="${category.id}">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="color: #f1f5f9; margin: 0; font-size: 0.95em;">${category.name}</h4>
                        </div>
                        <div style="font-size: 1.5em;">${isSelected ? '✓' : '+'}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click listeners
        container.querySelectorAll('.ranking-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const h4 = card.querySelector('h4');
                if (h4) {
                    this.toggleRanking(id, h4.textContent);
                }
            });
        });
    }

    toggleRanking(id, name, type = 'personal', data = null) {
        const index = this.selectedRankings.findIndex(r => r.id === id && r.type === type);

        if (index > -1) {
            // Remove from selection
            this.selectedRankings.splice(index, 1);
        } else {
            // Add to selection
            const ranking = { id, name, type };
            if (type === 'imported' && data) {
                ranking.data = data; // Store the imported ranking data
            }
            this.selectedRankings.push(ranking);
        }

        this.renderAvailableRankings();
        this.renderImportedRankings();
        this.updateSelectedRankings();
    }

    handleFileImport(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const htmlContent = e.target.result;
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');

                    // Extract ranking data from HTML
                    const rankingData = this.parseRankingHTML(doc, file.name);
                    if (rankingData) {
                        // Add to imported rankings list
                        if (!this.importedRankings) {
                            this.importedRankings = [];
                        }
                        this.importedRankings.push(rankingData);
                        this.renderImportedRankings();
                    }
                } catch (error) {
                    console.error('Error parsing HTML file:', error);
                    alert(`Error importing ${file.name}: ${error.message}`);
                }
            };
            reader.readAsText(file);
        });
    }

    parseRankingHTML(doc, filename) {
        // Extract username from the HTML
        const usernameElement = doc.querySelector('.username');
        const username = usernameElement ? usernameElement.textContent.trim() : 'Unknown';

        // Extract title (ranking category)
        const titleElement = doc.querySelector('h2');
        const title = titleElement ? titleElement.textContent.trim() : filename.replace('.html', '');

        // Extract all ranking items
        const songItems = doc.querySelectorAll('.song-item');
        const items = [];

        songItems.forEach(item => {
            const rank = item.querySelector('.rank-number')?.textContent.replace('#', '').trim();
            const title = item.querySelector('.song-title')?.value || '';
            const artist = item.querySelector('.song-artist')?.value || '';
            const platform = item.querySelector('.platform-select')?.value || 'YouTube';
            const url = item.querySelector('.url-input')?.value || '';
            const thumbnailUrl = item.querySelector('.thumbnail-preview img')?.src || '';
            const duration = item.querySelector('.song-duration')?.textContent || '';

            if (title) {
                items.push({
                    rank: parseInt(rank) || items.length + 1,
                    title,
                    artist,
                    platform,
                    url,
                    thumbnailUrl,
                    duration
                });
            }
        });

        return {
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${username} - ${title}`,
            username,
            category: title,
            items,
            filename
        };
    }

    renderImportedRankings() {
        const container = document.getElementById('importedRankings');
        if (!container || !this.importedRankings) return;

        if (this.importedRankings.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center; grid-column: 1 / -1;">No imported rankings yet. Upload HTML files to add them.</p>';
            return;
        }

        container.innerHTML = this.importedRankings.map(ranking => {
            const isSelected = this.selectedRankings.some(r => r.id === ranking.id && r.type === 'imported');
            return `
                <div class="ranking-card" style="padding: 15px; background: ${isSelected ? '#334155' : '#0f172a'}; border: 2px solid ${isSelected ? '#10b981' : '#334155'}; border-radius: 8px; cursor: pointer; transition: all 0.3s ease;" data-id="${ranking.id}" data-type="imported">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4 style="color: #f1f5f9; margin: 0 0 5px 0; font-size: 0.95em;">${ranking.category}</h4>
                            <p style="color: #94a3b8; margin: 0; font-size: 0.85em;">By: ${ranking.username} (${ranking.items.length} items)</p>
                        </div>
                        <div style="font-size: 1.5em;">${isSelected ? '✓' : '+'}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Add click listeners
        container.querySelectorAll('.ranking-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const ranking = this.importedRankings.find(r => r.id === id);
                if (ranking) {
                    this.toggleRanking(id, ranking.name, 'imported', ranking);
                }
            });
        });
    }

    updateSelectedRankings() {
        const container = document.getElementById('selectedRankings');
        const countSpan = document.getElementById('selectedCount');

        console.log('updateSelectedRankings called, selectedRankings:', this.selectedRankings);

        if (!container || !countSpan) {
            console.error('Container or countSpan not found');
            return;
        }

        countSpan.textContent = this.selectedRankings.length;

        if (this.selectedRankings.length === 0) {
            container.innerHTML = '<p style="color: #64748b; text-align: center;" id="emptyMessage">No rankings selected</p>';
        } else {
            // Render selected rankings as tags
            container.innerHTML = this.selectedRankings.map((ranking, index) => `
                <div class="selected-item" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 6px; margin: 5px; color: white; font-size: 0.9em;">
                    <span>${ranking.name}</span>
                    <button onclick="playlistsManager.removeSelected(${index})" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.1em; padding: 0; line-height: 1;">×</button>
                </div>
            `).join('');
            console.log('Rendered selected rankings:', container.innerHTML);
        }
    }

    removeSelected(index) {
        this.selectedRankings.splice(index, 1);
        this.renderAvailableRankings();
        this.updateSelectedRankings();
    }

    savePlaylist() {
        const name = document.getElementById('playlistNameInput').value.trim();

        if (!name) {
            alert('Please enter a playlist name');
            return;
        }

        if (this.selectedRankings.length === 0) {
            alert('Please select at least one ranking');
            return;
        }

        if (this.currentEditingPlaylist) {
            // Edit existing playlist
            const playlist = this.playlists.find(p => p.id === this.currentEditingPlaylist.id);
            playlist.name = name;
            playlist.rankings = this.selectedRankings;
            playlist.updatedAt = new Date().toISOString();
        } else {
            // Create new playlist
            const newPlaylist = {
                id: Date.now().toString(),
                name: name,
                rankings: this.selectedRankings,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.playlists.push(newPlaylist);
        }

        this.savePlaylists();
        this.renderPlaylists();
        this.closeModal();
    }

    savePlaylists() {
        localStorage.setItem('userPlaylists', JSON.stringify(this.playlists));
    }

    renderPlaylists() {
        const container = document.getElementById('playlistsList');

        if (this.playlists.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                    <div style="font-size: 4em; margin-bottom: 20px;">📋</div>
                    <h3 style="color: #cbd5e1; margin-bottom: 10px;">No Playlists Yet</h3>
                    <p style="color: #64748b;">Create your first playlist to combine multiple rankings</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.playlists.map(playlist => `
            <div class="playlist-card" style="background: linear-gradient(135deg, #1e293b 0%, #253549 100%); padding: 20px; border-radius: 12px; border: 2px solid #334155; transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <h3 style="color: #f1f5f9; margin: 0; font-size: 1.2em;">${playlist.name}</h3>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="playlistsManager.playPlaylist('${playlist.id}')" class="btn btn-primary" title="Play Playlist" style="padding: 6px 12px; font-size: 0.9em; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">▶️</button>
                        <button onclick="playlistsManager.openEditModal('${playlist.id}')" class="btn btn-primary" title="Edit" style="padding: 6px 12px; font-size: 0.9em;">✏️</button>
                        <button onclick="playlistsManager.deletePlaylist('${playlist.id}')" class="btn btn-remove" title="Delete" style="padding: 6px 12px; font-size: 0.9em;">🗑️</button>
                    </div>
                </div>
                <div style="color: #94a3b8; font-size: 0.9em; margin-bottom: 12px;">
                    ${playlist.rankings.length} ranking${playlist.rankings.length !== 1 ? 's' : ''}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    ${playlist.rankings.map(r => `
                        <span style="background: #334155; color: #cbd5e1; padding: 4px 10px; border-radius: 4px; font-size: 0.85em;">${r.name}</span>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    deletePlaylist(playlistId) {
        if (!confirm('Are you sure you want to delete this playlist?')) return;

        this.playlists = this.playlists.filter(p => p.id !== playlistId);
        this.savePlaylists();
        this.renderPlaylists();
    }

    playPlaylist(playlistId) {
        const playlist = this.playlists.find(p => p.id === playlistId);
        if (!playlist) {
            console.error('Playlist not found:', playlistId);
            return;
        }

        console.log('Playing playlist:', playlist);

        // Save playlist to be played
        const playlistData = {
            id: playlist.id,
            name: playlist.name,
            rankings: playlist.rankings,
            currentRankingIndex: 0,
            playedIndices: []
        };

        console.log('Saving to localStorage:', playlistData);
        localStorage.setItem('activePlaylist', JSON.stringify(playlistData));

        // Navigate to the playlist viewer page
        console.log('Navigating to playlist-viewer.html');
        window.location.href = 'playlist-viewer.html';
    }

}

// Initialize playlists manager
const playlistsManager = new PlaylistsManager();
