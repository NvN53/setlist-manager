/* Song-related functionality */

// Global variables for songs
let songs = []; // Will be loaded from Supabase
let currentSong = null; // Currently selected song
let editingSongId = null; // ID of song being edited

// Load songs from Supabase database
async function loadSongsFromDatabase() {
    console.log('Loading songs from database...');
    console.log('Initial songs array length:', songs.length);
    try {
        if (window.db) {
            // Fetch all songs from the database
            const { data, error } = await window.db
                .from('songs')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching songs:', error);
                // If there's an error, set to empty array
                songs = [];
            } else {
                console.log('Fetched songs data:', data);
                // Map Supabase data to local format
                songs = data.map(song => ({
                    id: song.id,
                    title: song.title,
                    key: song.key || '',
                    bpm: song.bpm || 120,  // Default to 120 if not provided
                    timeSig: '', // timeSig not in DB, so set to empty
                    lyrics: song.lyrics || '',
                    user_id: song.user_id  // Include user_id for ownership checks
                }));
                console.log('Mapped songs array:', songs);
            }
        } else {
            // If no db available, set to empty array
            songs = [];
            console.error('Database not available');
        }
    } catch (error) {
        console.error('Error loading songs:', error);
        songs = [];
    }
    
    console.log('Final songs array:', songs);
    // Re-render the song list after loading
    renderSongsList();
}

// Render the list of songs
function renderSongsList(filteredSongs = null) {
    const songsList = document.getElementById('songs-list');
    const songsToRender = filteredSongs || songs;
    songsList.innerHTML = songsToRender.map(song => `
        <div class="song-item" data-id="${song.id}" data-user-id="${song.user_id}">
            <div class="song-title">${song.title}</div>
            <div class="song-details">${song.key} • ${song.bpm} bpm</div>
        </div>
    `).join('');
    
    // Update action buttons after a short delay to allow DOM to render
    setTimeout(updateSongActionButtons, 100);
    
    // Add click handlers to song items after a short delay
    setTimeout(() => {
        const songItems = document.querySelectorAll('.song-item');
        songItems.forEach(item => {
            // Remove any existing click listeners to prevent duplicates
            if (item._songClickListenerAdded) {
                return;
            }
            
            item._songClickListenerAdded = true;
            
            item.addEventListener('click', function() {
                // Get the song ID from the data attribute
                const dataId = item.getAttribute('data-id');
                const songId = dataId || null;
                // Find the corresponding song in the songs array
                const song = songs.find(s => s.id === songId);
                // If song exists, show the lyrics page
                if (song) {
                    showLyricsPage(song);
                } else {
                    // As fallback, try to find a song by title if available
                    const titleElement = item.querySelector('.song-title');
                    if (titleElement) {
                        const title = titleElement.textContent;
                        const fallbackSong = songs.find(s => s.title === title);
                        if (fallbackSong) {
                            showLyricsPage(fallbackSong);
                        }
                    }
                }
            });
        });
    }, 50); // Small delay to ensure DOM is ready
}

// Update song action buttons based on ownership
async function updateSongActionButtons() {
  const songItems = document.querySelectorAll('.song-item');
  
  for (const item of songItems) {
    const songId = item.getAttribute('data-id');
    const songUserId = item.getAttribute('data-user-id');
    
    let isOwner = false;
    let isLoggedIn = false;
    
    if (window.db) {
      try {
        const { data: { user }, error } = await window.db.auth.getUser();
        if (!error && user) {
          isLoggedIn = true;
          if (songUserId) {
            isOwner = user.id === songUserId;
          }
        }
      } catch (e) {
        console.error('Error checking auth state:', e);
      }
    }
    
    // Update the UI based on ownership
    const detailsEl = item.querySelector('.song-details');
    if (detailsEl) {
      detailsEl.textContent = detailsEl.textContent.replace(' (Mine)', '').trim();
      if (isOwner) {
        detailsEl.textContent += ' (Mine)';
      }
    }
    
    // Add action buttons based on ownership and login status
    let actionsContainer = item.querySelector('.song-actions');
    if (!actionsContainer) {
      actionsContainer = document.createElement('div');
      actionsContainer.className = 'song-actions';
      item.appendChild(actionsContainer);
    }
    
    // Clear existing buttons
    actionsContainer.innerHTML = '';
    
    // Add buttons based on conditions
    if (isLoggedIn && !isOwner) {
      const duplicateBtn = document.createElement('button');
      duplicateBtn.className = 'btn btn-sm btn-secondary duplicate-song-btn';
      duplicateBtn.textContent = 'Duplicate';
      duplicateBtn.dataset.songId = songId;
      actionsContainer.appendChild(duplicateBtn);
    }
    
    if (isOwner) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-warning edit-song-btn';
      editBtn.textContent = 'Edit';
      editBtn.dataset.songId = songId;
      actionsContainer.appendChild(editBtn);
    }
  }
}

// Show edit song page
function showEditSongPage(song = null) {
    stopMetronome();
    stopAutoscroll();
    
    // Hide all pages with defensive null checks
    const homeSongsPage = document.getElementById('home-songs-page');
    const homeSetlistsPage = document.getElementById('home-setlists-page');
    const editSongPage = document.getElementById('edit-song-page');
    const editSetlistPage = document.getElementById('edit-setlist-page');
    const lyricsPage = document.getElementById('lyrics-page');
    const settingsPage = document.getElementById('settings-page');
    const ambientModal = document.getElementById('ambient-modal');
    const authPage = document.getElementById('auth-page');
    
    homeSongsPage?.classList.add('hidden');
    homeSetlistsPage?.classList.add('hidden');
    editSongPage?.classList.remove('hidden');
    editSetlistPage?.classList.add('hidden');
    lyricsPage?.classList.add('hidden');
    settingsPage?.classList.add('hidden');
    ambientModal?.classList.add('hidden');
    
    // Make sure auth page is hidden
    authPage?.classList.add('hidden');
    
    if (song) {
        editingSongId = song.id;
        const songTitleInput = document.getElementById('song-title');
        const songKeyInput = document.getElementById('song-key');
        const songModeInput = document.getElementById('song-mode');
        const songBpmInput = document.getElementById('song-bpm');
        const songTimeSigInput = document.getElementById('song-time-sig');
        const songLyricsInput = document.getElementById('song-lyrics');
        const deleteBtn = document.getElementById('delete-song-btn');
        
        songTitleInput?.value = song.title;
        
        // Parse key to separate key and mode
        let key = song.key;
        let mode = 'major';
        if (key.endsWith('m')) {
            key = key.substring(0, key.length - 1); // Remove 'm'
            mode = 'minor';
        }
        
        songKeyInput?.value = key;
        songModeInput?.value = mode;
        songBpmInput?.value = song.bpm || 120;  // Default to 120 if not provided
        songTimeSigInput?.value = song.timeSig || '4/4';  // Default to 4/4 if not provided
        songLyricsInput?.value = song.lyrics || '';
        
        // Show delete button
        if (deleteBtn) deleteBtn.style.display = 'block';
    } else {
        // New song
        editingSongId = null;
        const songTitleInput = document.getElementById('song-title');
        const songKeyInput = document.getElementById('song-key');
        const songModeInput = document.getElementById('song-mode');
        const songBpmInput = document.getElementById('song-bpm');
        const songTimeSigInput = document.getElementById('song-time-sig');
        const songLyricsInput = document.getElementById('song-lyrics');
        const deleteBtn = document.getElementById('delete-song-btn');
        
        songTitleInput?.value = '';
        songKeyInput?.value = 'C';
        songModeInput?.value = 'major';
        songBpmInput?.value = 120;  // Default for new songs
        songTimeSigInput?.value = '4/4';
        songLyricsInput?.value = '';
        if (deleteBtn) deleteBtn.style.display = 'none';
    }
}

// Save song to database
async function saveSong() {
    const title = document.getElementById('song-title').value;
    const key = document.getElementById('song-key').value;
    const mode = document.getElementById('song-mode').value;
    const bpm = parseInt(document.getElementById('song-bpm').value);
    const timeSig = document.getElementById('song-time-sig').value;
    const lyrics = document.getElementById('song-lyrics').value;
    if (!title) { alert('Please enter a song title'); return; }
    
    // Combine key and mode for display (e.g., "C major" or "Am minor")
    const displayKey = mode === 'minor' ? key + 'm' : key;
    
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
        
        // Prepare song data
        const songData = {
            title,
            key: displayKey,
            bpm: bpm || 120,  // Default to 120 if not provided
            lyrics,
            user_id: user.id  // Include user_id as required
        };
        
        if (editingSongId) {
            // Update existing song
            const { error } = await window.db
                .from('songs')
                .update(songData)
                .eq('id', editingSongId);
            
            if (error) {
                console.error('Error updating song:', error);
                alert('Error updating song: ' + error.message);
                return;
            }
            
            // Update in local songs array
            const index = songs.findIndex(s => s.id === editingSongId);
            if (index !== -1) {
                songs[index] = { ...songs[index], title, key: displayKey, bpm, lyrics };
            }
        } else {
            // Insert new song
            const { data, error } = await window.db
                .from('songs')
                .insert([songData]);
            
            if (error) {
                console.error('Error inserting song:', error);
                alert('Error saving song: ' + error.message);
                return;
            }
        }
        
        // Re-fetch songs from database to ensure latest data
        await loadSongsFromDatabase();
        
        // If we came from the lyrics page, go back to it
        if (window.fromLyricsPage) {
            // Find the saved song in the updated list
            const savedSong = songs.find(s => s.title === title && s.key === displayKey);
            if (savedSong) {
                currentSong = savedSong;
                showLyricsPage(savedSong);
                window.fromLyricsPage = false;
            } else {
                showSongsPage();
            }
        } else {
            showSongsPage();
        }
    } catch (error) {
        console.error('Error in saveSong:', error);
        alert('Error saving song: ' + error.message);
    }
}

// Delete song from database
async function deleteSong() {
    if (editingSongId && confirm('Are you sure you want to delete this song?')) {
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
                .from('songs')
                .delete()
                .match({ id: editingSongId, user_id: user.id }); // Ensure user owns the song
            
            if (error) {
                console.error('Error deleting song:', error);
                alert('Error deleting song: ' + error.message);
                return;
            }
            
            // Re-fetch songs from database to ensure latest data
            await loadSongsFromDatabase();
            showSongsPage();
        } catch (error) {
            console.error('Error in deleteSong:', error);
            alert('Error deleting song: ' + error.message);
        }
    }
}

// Duplicate song functionality
async function duplicateSong() {
    const title = document.getElementById('song-title').value;
    const key = document.getElementById('song-key').value;
    const mode = document.getElementById('song-mode').value;
    const bpm = parseInt(document.getElementById('song-bpm').value);
    const timeSig = document.getElementById('song-time-sig').value;
    const lyrics = document.getElementById('song-lyrics').value;
    if (!title) { alert('Please save the song before duplicating'); return; }
    
    // Combine key and mode for display (e.g., "C major" or "Am minor")
    const displayKey = mode === 'minor' ? key + 'm' : key;
    
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
        
        // Prepare duplicated song data
        const duplicatedSongData = {
            title: title + ' (Copy)',
            key: displayKey,
            bpm: bpm || 120,  // Default to 120 if not provided
            lyrics,
            user_id: user.id  // Include user_id as required
        };
        
        // Insert duplicated song into Supabase
        const { data, error } = await window.db
            .from('songs')
            .insert([duplicatedSongData]);
        
        if (error) {
            console.error('Error duplicating song:', error);
            alert('Error duplicating song: ' + error.message);
            return;
        }
        
        // Re-fetch songs from database to ensure latest data
        await loadSongsFromDatabase();
        alert('Song duplicated successfully!');
    } catch (error) {
        console.error('Error in duplicateSong:', error);
        alert('Error duplicating song: ' + error.message);
    }
}

// Edit song function
function editSong(song) { 
    window.fromLyricsPage = true;
    showEditSongPage(song); 
}