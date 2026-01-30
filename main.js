/* Main Application Logic */

// Global variables
let currentSongIndex = 0;
let currentSetlistSongIds = [];
let transposeValue = 0;
let autoscrollActive = false;
let autoscrollInterval = null;
let metronomeActive = false;
let metronomeInterval = null;
let metronomeVolume = 0.5;
let ambientActive = false;
let currentPitch = null;
let audioContext = null;
let oscillators = [];
let analyser = null;
let microphoneStream = null;
let pitchDetectionActive = false;

/* Show songs page */
function showSongsPage() {
    stopMetronome();
    stopAutoscroll();
    
    // Hide all pages with defensive null checks
    const homeSongsPage = document.getElementById('home-songs-page');
    const homeSetlistsPage = document.getElementById('home-setlists-page');
    const editSongPage = document.getElementById('edit-song-page');
    const editSetlistPage = document.getElementById('edit-setlist-page');
    const viewSetlistPage = document.getElementById('view-setlist-page');
    const lyricsPage = document.getElementById('lyrics-page');
    const settingsPage = document.getElementById('settings-page');
    const ambientModal = document.getElementById('ambient-modal');
    const authPage = document.getElementById('auth-page');
    
    homeSongsPage?.classList.remove('hidden');
    homeSetlistsPage?.classList.add('hidden');
    editSongPage?.classList.add('hidden');
    editSetlistPage?.classList.add('hidden');
    viewSetlistPage?.classList.add('hidden');
    lyricsPage?.classList.add('hidden');
    settingsPage?.classList.add('hidden');
    ambientModal?.classList.add('hidden');
    
    // Make sure auth page is hidden
    authPage?.classList.add('hidden');
    
    // Update tabs to show songs as active
    if (document.querySelector('.tab.active')) {
        document.querySelector('.tab.active').classList.remove('active');
    }
    document.getElementById('songs-tab')?.classList.add('active');
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded, initializing application...');
    
    // Initialize Supabase
    await initSupabase();
    
    // Load data from database
    await loadSongsFromDatabase();
    await loadSetlistsFromDatabase();
    
    // Load user preferences
    await loadUserPreferences();
    
    // Initialize ambient pad
    console.log('Initializing ambient pad...');
    initAmbientPad();
    console.log('Ambient pad initialized');
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Explicitly hide ambient modal on initial load
    const ambientModal = document.getElementById('ambient-modal');
    if (ambientModal) {
        ambientModal.classList.add('hidden');
        console.log('Added hidden class to ambient modal on startup');
        // Additional safeguard - force hidden state
        ambientModal.style.display = 'none';
    } else {
        console.warn('Ambient modal element not found!');
    }
    
    // Show home page initially
    showSongsPage();
    
    console.log('Application initialized');
});

// Initialize event listeners
function initializeEventListeners() {
    // Search functionality for songs
    const songSearch = document.getElementById('song-search');
    const clearSongSearch = document.getElementById('clear-song-search');
    if (songSearch) {
        songSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            if (searchTerm) {
                clearSongSearch.classList.remove('hidden');
            } else {
                clearSongSearch.classList.add('hidden');
            }
            
            const filteredSongs = songs.filter(song => 
                song.title.toLowerCase().includes(searchTerm) || 
                song.key.toLowerCase().includes(searchTerm)
            );
            renderSongsList(filteredSongs);
        });
    }
    
    if (clearSongSearch) {
        clearSongSearch.addEventListener('click', function() {
            document.getElementById('song-search').value = '';
            clearSongSearch.classList.add('hidden');
            renderSongsList(); // Show all songs
        });
    }
    
    // Search functionality for setlists
    const setlistSearch = document.getElementById('setlist-search');
    const clearSetlistSearch = document.getElementById('clear-setlist-search');
    if (setlistSearch) {
        setlistSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            if (searchTerm) {
                clearSetlistSearch.classList.remove('hidden');
            } else {
                clearSetlistSearch.classList.add('hidden');
            }
            
            const filteredSetlists = setlists.filter(setlist => 
                setlist.title.toLowerCase().includes(searchTerm)
            );
            renderSetlistsList(filteredSetlists);
        });
    }
    
    if (clearSetlistSearch) {
        clearSetlistSearch.addEventListener('click', function() {
            document.getElementById('setlist-search').value = '';
            clearSetlistSearch.classList.add('hidden');
            renderSetlistsList(); // Show all setlists
        });
    }
    
    // Add song button
    const addSongBtn = document.getElementById('add-song-btn');
    if (addSongBtn) {
        addSongBtn.addEventListener('click', function() {
            showEditSongPage();
        });
    }
    
    // Add setlist button
    const addSetlistBtn = document.getElementById('add-setlist-btn');
    if (addSetlistBtn) {
        addSetlistBtn.addEventListener('click', function() {
            showEditSetlistPage();
        });
    }
    
    // Song tab
    const songsTab = document.getElementById('songs-tab');
    if (songsTab) {
        songsTab.addEventListener('click', function() {
            document.querySelector('.tab.active').classList.remove('active');
            this.classList.add('active');
            document.getElementById('home-songs-page').classList.remove('hidden');
            document.getElementById('home-setlists-page').classList.add('hidden');
        });
    }
    
    // Setlists tab
    const setlistsTab = document.getElementById('setlists-tab');
    if (setlistsTab) {
        setlistsTab.addEventListener('click', function() {
            document.querySelector('.tab.active').classList.remove('active');
            this.classList.add('active');
            document.getElementById('home-songs-page').classList.add('hidden');
            document.getElementById('home-setlists-page').classList.remove('hidden');
        });
    }
    
    // Back to songs tab from setlists
    const backToSongsTab = document.getElementById('back-to-songs-tab');
    if (backToSongsTab) {
        backToSongsTab.addEventListener('click', function() {
            document.querySelector('.tab.active').classList.remove('active');
            document.getElementById('songs-tab').classList.add('active');
            document.getElementById('home-songs-page').classList.remove('hidden');
            document.getElementById('home-setlists-page').classList.add('hidden');
        });
    }
    
    // Back to setlists tab from active
    const setlistsTabActive = document.getElementById('setlists-tab-active');
    if (setlistsTabActive) {
        setlistsTabActive.addEventListener('click', function() {
            document.querySelector('.tab.active').classList.remove('active');
            this.classList.add('active');
            document.getElementById('home-songs-page').classList.add('hidden');
            document.getElementById('home-setlists-page').classList.remove('hidden');
        });
    }
    
    // Menu icon toggles
    document.querySelectorAll('.menu-icon').forEach(icon => {
        icon.addEventListener('click', function(e) {
            const menu = this.parentElement.querySelector('.dropdown-menu');
            // Close all other menus first
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                if (m !== menu) m.classList.add('hidden');
            });
            // Toggle this menu
            menu.classList.toggle('hidden');
        });
    });
    
    // Close menus when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.menu-container')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });
    
    // Settings menu item
    document.getElementById('settings-menu-item')?.addEventListener('click', function() {
        showSettingsPage();
    });
    
    document.getElementById('settings-menu-item-2')?.addEventListener('click', function() {
        showSettingsPage();
    });
    
    // Account menu items
    document.getElementById('account-menu-item-songs')?.addEventListener('click', function() {
        showAuthPage();
    });
    
    document.getElementById('account-menu-item-setlists')?.addEventListener('click', function() {
        showAuthPage();
    });
    
    // Auth menu item
    document.getElementById('auth-menu-item')?.addEventListener('click', async function() {
        if (window.db) {
            await logout();
        }
    });
    
    // Auth page back button
    document.getElementById('back-to-songs-from-auth')?.addEventListener('click', function() {
        showSongsPage();
    });
    
    // Edit song button
    document.getElementById('edit-song-menu-item')?.addEventListener('click', function() {
        if (currentSong) {
            editSong(currentSong);
        }
    });
    
    // Delete song button
    document.getElementById('delete-song-menu-item')?.addEventListener('click', async function() {
        if (currentSong) {
            editingSongId = currentSong.id;
            await deleteSong();
        }
    });
    
    // Cancel edit button
    document.getElementById('cancel-edit-btn')?.addEventListener('click', function() {
        showSongsPage();
    });
    
    // Save song button
    document.getElementById('save-song-btn')?.addEventListener('click', saveSong);
    
    // Delete song button on edit page
    document.getElementById('delete-song-btn')?.addEventListener('click', async function() {
        if (editingSongId) {
            await deleteSong();
        }
    });
    
    // Duplicate song button
    document.getElementById('duplicate-song-btn')?.addEventListener('click', duplicateSong);
    
    // Back to songs from lyrics
    document.getElementById('back-to-songs-from-lyrics')?.addEventListener('click', function() {
        showSongsPage();
    });
    
    // Cancel edit setlist button
    document.getElementById('cancel-edit-setlist-btn')?.addEventListener('click', function() {
        if (cameFromViewSetlist) {
            // If we came from view setlist, go back there
            if (editingSetlistId) {
                const setlist = setlists.find(s => s.id === editingSetlistId);
                if (setlist) {
                    showViewSetlistPage(setlist);
                    return;
                }
            }
        }
        showSetlistsPage();
    });
    
    // Save setlist button
    document.getElementById('save-setlist-btn')?.addEventListener('click', async function() {
        const title = document.getElementById('setlist-title').value;
        if (!title) {
            alert('Please enter a setlist title');
            return;
        }
        
        try {
            if (!window.db) {
                throw new Error('Database not initialized');
            }
            
            // Get current user
            const { data: { user }, error: userError } = await window.db.auth.getUser();
            
            if (userError || !user) {
                // If user is not logged in, redirect to auth page
                showAuthPage();
                return;
            }
            
            // Get songs in the setlist
            const container = document.getElementById('setlist-songs-container');
            const songIds = container
              ? Array.from(container.querySelectorAll('[data-song-id]'))
                  .map(el => el.getAttribute('data-song-id'))
              : [];
            
            // Prepare setlist data
            const setlistData = {
                title: title,
                user_id: user.id
            };
            
            if (editingSetlistId) {
                console.log('Attempting to save setlist with ID:', editingSetlistId, 'Type:', typeof editingSetlistId);
                
                // Ensure editingSetlistId is a string (UUID) and validate it
                const stringEditingSetlistId = typeof editingSetlistId === 'string' ? editingSetlistId : String(editingSetlistId);
                
                const validatedSetlistId = validateAndFormatId(stringEditingSetlistId, 'editing setlist ID');
                if (!validatedSetlistId) {
                    console.error('Failed to validate setlist ID for saving:', editingSetlistId);
                    alert('Invalid setlist ID format');
                    return;
                }
                
                const finalEditingSetlistId = validatedSetlistId;
                
                // Update existing setlist
                const { error } = await window.db
                    .from('setlists')
                    .update(setlistData)
                    .eq('id', finalEditingSetlistId);
                
                if (error) {
                    console.error('Error updating setlist:', error);
                    alert('Error updating setlist: ' + error.message);
                    return;
                }
                
                // Delete existing setlist songs
                await window.db
                    .from('setlist_songs')
                    .delete()
                    .eq('setlist_id', finalEditingSetlistId);
                
                // Add updated setlist songs
                if (songIds.length > 0) {
                    const setlistSongsData = songIds.map((songId, index) => ({
                        setlist_id: finalEditingSetlistId,
                        song_id: songId,
                        position: index
                    }));
                    
                    await window.db
                        .from('setlist_songs')
                        .insert(setlistSongsData);
                }
                
                // Update in local setlists array
                const index = setlists.findIndex(s => s.id === finalEditingSetlistId);
                if (index !== -1) {
                    setlists[index] = { ...setlists[index], title, songIds };
                }
            } else {
                // Insert new setlist
                const { data, error } = await window.db
                    .from('setlists')
                    .insert([setlistData])
                    .select()
                    .single();
                
                if (error) {
                    console.error('Error inserting setlist:', error);
                    alert('Error saving setlist: ' + error.message);
                    return;
                }
                
                // Add setlist songs
                if (songIds.length > 0) {
                    const setlistSongsData = songIds.map((songId, index) => ({
                        setlist_id: data.id,
                        song_id: songId,
                        position: index
                    }));
                    
                    await window.db
                        .from('setlist_songs')
                        .insert(setlistSongsData);
                }
                
                // Add to local setlists array
                setlists.unshift({ id: data.id, title, songIds, user_id: user.id });
            }
            
            // Re-fetch setlists from database to ensure latest data
            await loadSetlistsFromDatabase();
            
            if (cameFromViewSetlist) {
                // If we came from view setlist, go back there
                if (editingSetlistId) {
                    // Ensure editingSetlistId is a string (UUID) and validate it
                    const stringEditingSetlistId = typeof editingSetlistId === 'string' ? editingSetlistId : String(editingSetlistId);
                    
                    const validatedSetlistId = validateAndFormatId(stringEditingSetlistId, 'editing setlist ID');
                    if (!validatedSetlistId) {
                        alert('Invalid setlist ID format');
                        return;
                    }
                    
                    const finalEditingSetlistId = validatedSetlistId;
                    
                    const setlist = setlists.find(s => s.id === finalEditingSetlistId);
                    if (setlist) {
                        showViewSetlistPage(setlist);
                        return;
                    }
                }
            }
            showSetlistsPage();
        } catch (error) {
            console.error('Error saving setlist:', error);
            alert('Error saving setlist: ' + error.message);
        }
    });
    
    // Delete setlist button
    document.getElementById('delete-setlist-btn')?.addEventListener('click', async function() {
        console.log('Attempting to delete setlist with ID:', editingSetlistId, 'Type:', typeof editingSetlistId);
        
        // Ensure editingSetlistId is a string (UUID) and validate it
        const stringEditingSetlistId = typeof editingSetlistId === 'string' ? editingSetlistId : String(editingSetlistId);
        
        const validatedSetlistId = validateAndFormatId(stringEditingSetlistId, 'editing setlist ID');
        if (!validatedSetlistId) {
            console.error('Failed to validate setlist ID for deletion:', editingSetlistId);
            alert('Invalid setlist ID format');
            return;
        }
        
        const finalEditingSetlistId = validatedSetlistId;
        
        if (stringEditingSetlistId && confirm('Are you sure you want to delete this setlist?')) {
            try {
                if (!window.db) {
                    throw new Error('Database not initialized');
                }
                
                // Get current user
                const { data: { user }, error: userError } = await window.db.auth.getUser();
                
                if (userError || !user) {
                    // If user is not logged in, redirect to auth page
                    showAuthPage();
                    return;
                }
                

                
                // Delete from Supabase database
                const { error } = await window.db
                    .from('setlists')
                    .delete()
                    .match({ id: finalEditingSetlistId, user_id: user.id }); // Ensure user owns the setlist
                
                if (error) {
                    console.error('Error deleting setlist:', error);
                    alert('Error deleting setlist: ' + error.message);
                    return;
                }
                
                // Also delete associated setlist_songs records
                await window.db
                    .from('setlist_songs')
                    .delete()
                    .eq('setlist_id', finalEditingSetlistId);
                
                // Re-fetch setlists from database to ensure latest data
                await loadSetlistsFromDatabase();
                
                if (cameFromViewSetlist) {
                    // If we came from view setlist, go back to setlists list
                    showSetlistsPage();
                } else {
                    showSetlistsPage();
                }
            } catch (error) {
                console.error('Error in delete setlist:', error);
                alert('Error deleting setlist: ' + error.message);
            }
        }
    });
    
    // Back to setlists from view setlist
    document.getElementById('back-to-setlists-from-view')?.addEventListener('click', function() {
        showSetlistsPage();
    });
    
    // Edit setlist menu item
    document.getElementById('edit-setlist-menu-item')?.addEventListener('click', function() {
        if (currentSetlist) {
            showEditSetlistPage(currentSetlist, true);
        }
    });
    
    // Metronome toggle
    document.getElementById('metronome-toggle')?.addEventListener('click', function() {
        if (metronomeActive) {
            stopMetronome();
            this.classList.remove('active');
        } else {
            startMetronome();
            this.classList.add('active');
        }
    });
    
    // Autoscroll toggle
    document.getElementById('autoscroll-toggle')?.addEventListener('click', function() {
        if (autoscrollActive) {
            stopAutoscroll();
            this.textContent = 'Off';
        } else {
            startAutoscroll();
            this.textContent = 'On';
        }
    });
    
    // Autoscroll level
    document.getElementById('autoscroll-level')?.addEventListener('change', function() {
        if (autoscrollActive) {
            stopAutoscroll();
            startAutoscroll();
        }
    });
    
    // Transpose controls
    document.getElementById('transpose-down-lyrics')?.addEventListener('click', function() {
        transposeValue--;
        updateTransposeDisplay();
        if (currentSong) {
            renderLyrics(currentSong);
        }
    });
    
    document.getElementById('transpose-up-lyrics')?.addEventListener('click', function() {
        transposeValue++;
        updateTransposeDisplay();
        if (currentSong) {
            renderLyrics(currentSong);
        }
    });
    
    // Ambient toggle
    try {
        const ambientToggle = document.getElementById('ambient-toggle');
        if (ambientToggle) {
            ambientToggle.addEventListener('click', function() {
                console.log('Ambient toggle clicked, current state:', ambientActive ? 'ON' : 'OFF');
                if (ambientActive) {
                    stopAmbientPad();
                } else {
                    startAmbientPad();
                }
            });
        }
    } catch (error) {
        console.error('Error attaching ambient toggle listener:', error);
    }
    
    // Ambient dropdown
    try {
        const ambientDropdown = document.getElementById('ambient-dropdown');
        if (ambientDropdown) {
            ambientDropdown.addEventListener('click', function() {
                console.log('Ambient dropdown clicked');
                const ambientModal = document.getElementById('ambient-modal');
                if (ambientModal) {
                    ambientModal.classList.remove('hidden');
                    console.log('Ambient modal shown');
                }
            });
        }
    } catch (error) {
        console.error('Error attaching ambient dropdown listener:', error);
    }
    
    // Close ambient modal
    try {
        const closeAmbientModal = document.getElementById('close-ambient-modal');
        if (closeAmbientModal) {
            closeAmbientModal.addEventListener('click', function() {
                console.log('Close ambient modal clicked');
                const ambientModal = document.getElementById('ambient-modal');
                if (ambientModal) {
                    ambientModal.classList.add('hidden');
                    console.log('Ambient modal hidden');
                }
            });
        }
    } catch (error) {
        console.error('Error attaching close ambient modal listener:', error);
    }
    
    // Settings page back button
    document.getElementById('back-to-home-from-settings')?.addEventListener('click', function() {
        showSongsPage();
    });
    
    // Dark mode toggle
    document.getElementById('dark-mode-toggle')?.addEventListener('change', function() {
        document.body.classList.toggle('dark-mode', this.checked);
        localStorage.setItem('darkMode', this.checked);
    });
    
    // Metronome volume slider
    document.getElementById('metronome-volume')?.addEventListener('input', function() {
        metronomeVolume = this.value / 100;
        document.getElementById('metronome-volume-value').textContent = this.value;
        localStorage.setItem('metronomeVolume', this.value);
    });
    
    // Add song search in edit setlist
    const addSongSearch = document.getElementById('add-song-search');
    const clearAddSongSearch = document.getElementById('clear-add-song-search');
    if (addSongSearch) {
        addSongSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            if (searchTerm) {
                clearAddSongSearch.classList.remove('hidden');
            } else {
                clearAddSongSearch.classList.add('hidden');
            }
            renderAvailableSongs();
        });
    }
    
    if (clearAddSongSearch) {
        clearAddSongSearch.addEventListener('click', function() {
            document.getElementById('add-song-search').value = '';
            clearAddSongSearch.classList.add('hidden');
            renderAvailableSongs();
        });
    }
    
    // Next song button
    document.getElementById('next-song-btn')?.addEventListener('click', function() {
        if (currentSetlistSongIds && currentSetlistSongIds.length > 0 && currentSongIndex < currentSetlistSongIds.length - 1) {
            currentSongIndex++;
            const nextSongId = currentSetlistSongIds[currentSongIndex];
            const nextSong = songs.find(s => s.id === nextSongId);
            if (nextSong) {
                showLyricsPageFromSetlist(nextSong, currentSetlistSongIds, currentSongIndex);
            }
        }
    });
    
    // Previous song button
    document.getElementById('prev-song-btn')?.addEventListener('click', function() {
        if (currentSetlistSongIds && currentSetlistSongIds.length > 0 && currentSongIndex > 0) {
            currentSongIndex--;
            const prevSongId = currentSetlistSongIds[currentSongIndex];
            const prevSong = songs.find(s => s.id === prevSongId);
            if (prevSong) {
                showLyricsPageFromSetlist(prevSong, currentSetlistSongIds, currentSongIndex);
            }
        }
    });
    
    // Login and signup buttons
    document.getElementById('login')?.addEventListener('click', login);
    document.getElementById('signup')?.addEventListener('click', signup);
    document.getElementById('logout')?.addEventListener('click', logout);
    document.getElementById('auth-logout')?.addEventListener('click', logout);
}

// Load user preferences
async function loadUserPreferences() {
    // Load dark mode preference
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', darkMode);
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (darkModeToggle) {
        darkModeToggle.checked = darkMode;
    }
    
    // Load metronome volume
    const volume = localStorage.getItem('metronomeVolume');
    if (volume !== null) {
        metronomeVolume = volume / 100;
        const volumeSlider = document.getElementById('metronome-volume');
        const volumeValue = document.getElementById('metronome-volume-value');
        if (volumeSlider) volumeSlider.value = volume;
        if (volumeValue) volumeValue.textContent = volume;
    }
}

// Show settings page
function showSettingsPage() {
    // Hide all other pages with defensive null checks
    const homeSongsPage = document.getElementById('home-songs-page');
    const homeSetlistsPage = document.getElementById('home-setlists-page');
    const editSongPage = document.getElementById('edit-song-page');
    const editSetlistPage = document.getElementById('edit-setlist-page');
    const viewSetlistPage = document.getElementById('view-setlist-page');
    const lyricsPage = document.getElementById('lyrics-page');
    const ambientModal = document.getElementById('ambient-modal');
    const settingsPage = document.getElementById('settings-page');
    
    homeSongsPage?.classList.add('hidden');
    homeSetlistsPage?.classList.add('hidden');
    editSongPage?.classList.add('hidden');
    editSetlistPage?.classList.add('hidden');
    viewSetlistPage?.classList.add('hidden');
    lyricsPage?.classList.add('hidden');
    ambientModal?.classList.add('hidden');
    
    // Show settings page
    settingsPage?.classList.remove('hidden');
}

/* Show setlists page */
function showSetlistsPage() {
    stopMetronome();
    stopAutoscroll();
    
    // Hide all pages with defensive null checks
    const homeSongsPage = document.getElementById('home-songs-page');
    const homeSetlistsPage = document.getElementById('home-setlists-page');
    const editSongPage = document.getElementById('edit-song-page');
    const editSetlistPage = document.getElementById('edit-setlist-page');
    const viewSetlistPage = document.getElementById('view-setlist-page');
    const lyricsPage = document.getElementById('lyrics-page');
    const settingsPage = document.getElementById('settings-page');
    const ambientModal = document.getElementById('ambient-modal');
    const authPage = document.getElementById('auth-page');
    
    homeSongsPage?.classList.add('hidden');
    homeSetlistsPage?.classList.remove('hidden');
    editSongPage?.classList.add('hidden');
    editSetlistPage?.classList.add('hidden');
    viewSetlistPage?.classList.add('hidden');
    lyricsPage?.classList.add('hidden');
    settingsPage?.classList.add('hidden');
    ambientModal?.classList.add('hidden');
    
    // Make sure auth page is hidden
    authPage?.classList.add('hidden');
    
    // Update tabs to show setlists as active
    if (document.querySelector('.tab.active')) {
        document.querySelector('.tab.active').classList.remove('active');
    }
    document.getElementById('setlists-tab-active')?.classList.add('active');
}

/* Show lyrics page from setlist */
function showLyricsPageFromSetlist(song, songIds, currentIndex) {
    currentSong = song;
    currentSetlistSongIds = songIds;
    currentSongIndex = currentIndex;
    
    // Show navigation buttons
    const prevBtn = document.getElementById('prev-song-btn');
    const nextBtn = document.getElementById('next-song-btn');
    if (prevBtn) prevBtn.style.display = 'block';
    if (nextBtn) nextBtn.style.display = 'block';
    
    // Update navigation button states
    if (prevBtn) prevBtn.disabled = (currentIndex === 0);
    if (nextBtn) nextBtn.disabled = (currentIndex === songIds.length - 1);
    
    showLyricsPage(song);
}

// Show lyrics page
function showLyricsPage(song) {
    stopMetronome();
    stopAutoscroll();
    
    // Hide all pages with defensive null checks
    const homeSongsPage = document.getElementById('home-songs-page');
    const homeSetlistsPage = document.getElementById('home-setlists-page');
    const editSongPage = document.getElementById('edit-song-page');
    const editSetlistPage = document.getElementById('edit-setlist-page');
    const viewSetlistPage = document.getElementById('view-setlist-page');
    const lyricsPage = document.getElementById('lyrics-page');
    const settingsPage = document.getElementById('settings-page');
    const ambientModal = document.getElementById('ambient-modal');
    const authPage = document.getElementById('auth-page');
    
    homeSongsPage?.classList.add('hidden');
    homeSetlistsPage?.classList.add('hidden');
    editSongPage?.classList.add('hidden');
    editSetlistPage?.classList.add('hidden');
    viewSetlistPage?.classList.add('hidden');
    lyricsPage?.classList.remove('hidden');
    settingsPage?.classList.add('hidden');
    ambientModal?.classList.add('hidden');
    
    // Make sure auth page is hidden
    authPage?.classList.add('hidden');
    
    // Update lyrics page content
    const lyricsTitle = document.getElementById('lyrics-title');
    const lyricsDetails = document.getElementById('lyrics-details');
    lyricsTitle?.textContent = song.title;
    lyricsDetails?.textContent = `${song.key} • ${song.bpm} bpm`;
    renderLyrics(song);
    
    // Update lyrics menu
    updateLyricsMenu();
}

// Render lyrics with chord highlighting
function renderLyrics(song) {
    const lyricsContainer = document.getElementById('lyrics-content');
    if (!lyricsContainer) return;
    
    const lyrics = song.lyrics || '';
    const lines = lyrics.split('\n');
    
    let html = '';
    for (const line of lines) {
        if (line.trim() === '') {
            html += '<div class="line-break"><br></div>';
            continue;
        }
        
        // Check if this line contains chords
        const tokens = line.split(/(\[[^\]]+\])/g);
        let hasChords = false;
        
        for (const token of tokens) {
            if (token.startsWith('[') && token.endsWith(']')) {
                hasChords = true;
                break;
            }
        }
        
        if (hasChords) {
            // Process chord line
            let processedLine = '';
            for (const token of tokens) {
                if (token.startsWith('[') && token.endsWith(']')) {
                    // Extract chord from brackets
                    const chord = token.substring(1, token.length - 1);
                    // Apply transpose if applicable
                    const transposedChord = transposeChord(chord, transposeValue);
                    processedLine += `<span class="chord-token">[${transposedChord}]</span>`;
                } else {
                    processedLine += escapeHtml(token);
                }
            }
            html += `<div class="chord-line">${processedLine}</div>`;
        } else {
            // Regular lyric line
            html += `<div class="lyric-line">${escapeHtml(line)}</div>`;
        }
    }
    
    lyricsContainer.innerHTML = html;
}

// Transpose chord function
function transposeChord(chord, semitones) {
    if (semitones === 0) return chord;
    
    // Extract root note and modifiers
    const matches = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!matches) return chord;
    
    const root = matches[1];
    const modifier = matches[2];
    
    // Chromatic scale
    const scale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const altScale = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    
    // Find the current root in the scale
    let currentIndex = scale.indexOf(root);
    if (currentIndex === -1) {
        currentIndex = altScale.indexOf(root);
    }
    
    if (currentIndex === -1) return chord;
    
    // Calculate new index with transposition
    let newIndex = (currentIndex + semitones) % 12;
    if (newIndex < 0) newIndex += 12;
    
    // Use the same accidental type as the original if possible
    let newRoot = scale[newIndex];
    if (root.includes('#') && scale.includes(scale[newIndex])) {
        newRoot = scale[newIndex];
    } else if (root.includes('b') && altScale.includes(altScale[newIndex])) {
        newRoot = altScale[newIndex];
    } else {
        // Default to sharp notation
        newRoot = scale[newIndex];
    }
    
    return newRoot + modifier;
}

// Update transpose display
function updateTransposeDisplay() {
    document.getElementById('transpose-value').textContent = transposeValue;
}

// Start metronome
function startMetronome() {
    if (!currentSong || metronomeActive) return;
    
    metronomeActive = true;
    const bpm = currentSong.bpm || 120;
    const interval = (60 * 1000) / bpm; // ms per beat
    
    metronomeInterval = setInterval(() => {
        playClick();
    }, interval);
}

// Stop metronome
function stopMetronome() {
    if (metronomeInterval) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
    }
    metronomeActive = false;
}

// Play metronome click sound
function playClick() {
    // Create audio context if it doesn't exist
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Create oscillator for click sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.value = 800; // Higher pitch for accent beat
    
    gainNode.gain.value = metronomeVolume;
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.02); // Short beep
}

// Start autoscroll
function startAutoscroll() {
    if (autoscrollActive) return;
    
    autoscrollActive = true;
    const scrollSpeed = 30 - (parseInt(document.getElementById('autoscroll-level').value) * 5); // Adjust based on level
    
    autoscrollInterval = setInterval(() => {
        const lyricsContainer = document.querySelector('.home-content-scrollable');
        if (lyricsContainer) {
            lyricsContainer.scrollTop += 1;
        }
    }, scrollSpeed);
}

// Stop autoscroll
function stopAutoscroll() {
    if (autoscrollInterval) {
        clearInterval(autoscrollInterval);
        autoscrollInterval = null;
    }
    autoscrollActive = false;
}

// Initialize ambient pad
function initAmbientPad() {
    console.log('Initializing ambient pad UI...');
    // Create pitch buttons
    const pitchButtonsContainer = document.getElementById('pitch-buttons');
    if (!pitchButtonsContainer) {
        console.error('Pitch buttons container not found!');
        return;
    }
    
    const pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    pitchButtonsContainer.innerHTML = '';
    
    pitches.forEach(pitch => {
        const button = document.createElement('button');
        button.className = 'btn pitch-btn';
        button.textContent = pitch;
        button.dataset.pitch = pitch;
        button.addEventListener('click', function() {
            console.log('Pitch button clicked:', pitch);
            // Remove active class from all buttons
            document.querySelectorAll('#pitch-buttons .pitch-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Set current pitch
            currentPitch = pitch;
            
            // Update pad status
            updatePadStatus(`${currentPitch} - ${ambientActive ? 'Active' : 'Inactive'}`);
            
            // If ambient is active, restart it with new pitch
            if (ambientActive) {
                stopAmbientPad();
                startAmbientPad();
            }
        });
        pitchButtonsContainer.appendChild(button);
    });
    
    // Set volume slider
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
            if (ambientActive) {
                // Update volume of active oscillators
                oscillators.forEach(osc => {
                    if (osc.gainNode) {
                        osc.gainNode.gain.value = this.value / 100;
                    }
                });
            }
        });
    }
    
    // Tap to hum button
    document.getElementById('tap-to-hum')?.addEventListener('click', async function() {
        console.log('Tap to hum button clicked');
        await startPitchDetection();
    });
    
    // Use detected pitch button
    document.getElementById('use-detected-pitch')?.addEventListener('click', function() {
        const detectedPitch = document.getElementById('detected-pitch-value').textContent;
        if (detectedPitch && detectedPitch !== '-') {
            console.log('Using detected pitch:', detectedPitch);
            // Find the pitch button and activate it
            const pitchBtn = document.querySelector(`.pitch-btn[data-pitch="${detectedPitch}"]`);
            if (pitchBtn) {
                pitchBtn.click(); // This will activate the pitch
            }
        }
    });
    console.log('Ambient pad UI initialized');
}

// Update pad status
function updatePadStatus(status) {
    const padStatus = document.getElementById('pad-status');
    if (padStatus) {
        padStatus.textContent = status;
    }
}

// Update ambient toggle state
function updateAmbientToggleState() {
    const ambientToggle = document.getElementById('ambient-toggle');
    if (ambientToggle) {
        if (ambientActive) {
            ambientToggle.classList.add('active');
            ambientToggle.textContent = 'Ambient ON';
        } else {
            ambientToggle.classList.remove('active');
            ambientToggle.textContent = 'Ambient';
        }
    }
}

// Start ambient pad
function startAmbientPad() {
    console.log('Starting ambient pad with pitch:', currentPitch);
    if (!currentPitch) {
        alert('Please select a pitch first');
        return;
    }
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Stop any existing ambient sounds
    stopAmbientPad();
    
    // Get the frequency for the current pitch
    const frequency = getFrequencyForNote(currentPitch);
    
    // Create multiple oscillators for a richer sound
    const harmonics = [1, 1.5, 2, 3]; // Fundamental, fifth, octave, twelfth
    const volume = document.getElementById('volume-slider').value / 100;
    
    for (let i = 0; i < harmonics.length; i++) {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * harmonics[i];
        gainNode.gain.value = volume / harmonics.length; // Distribute volume across harmonics
        
        oscillator.start();
        
        // Store reference to stop later
        oscillators.push({ oscillator, gainNode });
    }
    
    ambientActive = true;
    updatePadStatus(`${currentPitch} - Active`);
    updateAmbientToggleState();
    console.log('Ambient pad started successfully');
}

// Stop ambient pad
function stopAmbientPad() {
    console.log('Stopping ambient pad');
    // Stop all oscillators
    oscillators.forEach(osc => {
        try {
            osc.oscillator.stop();
        } catch (e) {
            // Oscillator already stopped
        }
    });
    
    // Clear the oscillators array
    oscillators = [];
    
    ambientActive = false;
    updatePadStatus(`${currentPitch || 'None'} - Inactive`);
    updateAmbientToggleState();
    console.log('Ambient pad stopped');
}

// Start pitch detection
async function startPitchDetection() {
    try {
        // Stop any existing pitch detection
        stopPitchDetection();
        
        // Request microphone access
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Create audio context if it doesn't exist
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Create analyser node
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        // Connect microphone to analyser
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        
        // Start detection loop
        pitchDetectionActive = true;
        detectPitchLoop();
        
        // Update UI
        document.getElementById('tap-to-hum').textContent = 'Detecting...';
        document.getElementById('tap-to-hum').disabled = true;
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please ensure you have granted permission.');
        stopPitchDetection();
    }
}

// Stop pitch detection
function stopPitchDetection() {
    pitchDetectionActive = false;
    
    // Stop microphone stream
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }
    
    // Reset UI
    document.getElementById('tap-to-hum').textContent = 'Tap to Hum';
    document.getElementById('tap-to-hum').disabled = false;
    document.getElementById('detected-pitch-value').textContent = '-';
    document.getElementById('use-detected-pitch').style.display = 'none';
}

// Continuous pitch detection loop
function detectPitchLoop() {
    if (!pitchDetectionActive) return;
    
    // Schedule next detection
    setTimeout(() => {
        if (pitchDetectionActive) {
            detectPitch();
            detectPitchLoop(); // Continue the loop
        }
    }, 200); // Detect every 200ms
}

// Detect pitch from microphone input
function detectPitch() {
    if (!analyser) return;
    
    // Get time-domain data
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    // Convert to float32 for processing
    const float32Data = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
        float32Data[i] = (dataArray[i] - 128) / 128;
    }
    
    // Perform pitch detection using YIN algorithm
    const sampleRate = audioContext.sampleRate;
    const minFreq = 80;  // Min human voice frequency
    const maxFreq = 1000; // Max human voice frequency
    
    const frequency = computeYin(float32Data, sampleRate, minFreq, maxFreq);
    
    if (frequency !== -1) {
        const noteInfo = frequencyToNote(frequency);
        if (noteInfo) {
            document.getElementById('detected-pitch-value').textContent = noteInfo.note;
            document.getElementById('use-detected-pitch').style.display = 'block';
        }
    }
}