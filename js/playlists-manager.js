class PlaylistsManager {
    constructor() {
        this.playlists = JSON.parse(localStorage.getItem('userPlaylists')) || [];
        this.currentEditingPlaylist = null;
        this.selectedRankings = [];

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
        this.renderAvailableRankings();
        this.updateSelectedRankings();
        modal.style.display = 'flex';
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

    toggleRanking(id, name) {
        const index = this.selectedRankings.findIndex(r => r.id === id);

        if (index > -1) {
            // Remove from selection
            this.selectedRankings.splice(index, 1);
        } else {
            // Add to selection
            this.selectedRankings.push({ id, name });
        }

        this.renderAvailableRankings();
        this.updateSelectedRankings();
    }

    updateSelectedRankings() {
        const container = document.getElementById('selectedRankings');
        const countSpan = document.getElementById('selectedCount');

        if (!container || !countSpan) return;

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
        if (!playlist) return;

        // Save playlist to be played
        localStorage.setItem('activePlaylist', JSON.stringify({
            id: playlist.id,
            name: playlist.name,
            rankings: playlist.rankings,
            currentRankingIndex: 0,
            playedIndices: []
        }));

        // Navigate to the playlist viewer page
        window.location.href = 'playlist-viewer.html';
    }

}

// Initialize playlists manager
const playlistsManager = new PlaylistsManager();
