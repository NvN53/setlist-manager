/* Setlist-related functionality */

// Global variables for setlists
let setlists = []; // Will be loaded from Supabase
let currentSetlist = null; // Currently selected setlist
let editingSetlistId = null; // ID of setlist being edited
let cameFromViewSetlist = false; // Track if we came from view setlist page

// Load setlists from Supabase database
async function loadSetlistsFromDatabase() {
    console.log('Loading setlists from database...');
    try {
        if (window.db) {
            // Fetch all setlists from the database
            const { data, error } = await window.db
                .from('setlists')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching setlists:', error);
                // If there's an error, set to empty array
                setlists = [];
            } else {
                console.log('Fetched setlists data:', data);
                // Map Supabase data to local format
                setlists = data.map(setlist => ({
                    id: setlist.id,
                    title: setlist.title,
                    user_id: setlist.user_id  // Include user_id for ownership checks
                }));
                
                // Now fetch the songs for each setlist
                for (let i = 0; i < setlists.length; i++) {
                    const setlistId = setlists[i].id;
                    const { data: setlistSongsData, error: setlistSongsError } = await window.db
                        .from('setlist_songs')
                        .select('song_id, position')
                        .eq('setlist_id', setlistId)
                        .order('position', { ascending: true });
                    
                    if (setlistSongsError) {
                        console.error('Error fetching setlist songs:', setlistSongsError);
                        setlists[i].songIds = [];
                    } else {
                        setlists[i].songIds = setlistSongsData.map(ss => ss.song_id);
                    }
                }
                console.log('Loaded setlists:', setlists);
            }
        } else {
            // If no db available, set to empty array
            setlists = [];
            console.error('Database not available for setlists');
        }
    } catch (error) {
        console.error('Error loading setlists:', error);
        setlists = [];
    }
    
    // Re-render the setlist list after loading
    renderSetlistsList();
}

// Render the list of setlists
function renderSetlistsList(filteredSetlists = null) {
    const setlistsList = document.getElementById('setlists-list');
    const setlistsToRender = filteredSetlists || setlists;
    setlistsList.innerHTML = setlistsToRender.map(setlist => {
        // Calculate actual song count
        const songCount = setlist.songIds ? setlist.songIds.length : 0;
        
        // Note: We can't determine ownership in the render function due to async nature of auth
        // We'll handle this in the click handler
        const isPlaceholder = true; // Placeholder for template
        
        return `
        <div class="setlist-item" data-id="${setlist.id}" data-user-id="${setlist.user_id}">
            <div class="setlist-title">${setlist.title}</div>
            <div class="setlist-details">${songCount} songs</div>
        </div>`;
    }).join('');
    
    // Add event listeners for setlist items
    const setlistItems = document.querySelectorAll('.setlist-item');
    setlistItems.forEach(item => {
        const setlistId = parseInt(item.getAttribute('data-id'));
        
        // Add click handler for viewing setlist
        item.onclick = async (e) => {
            // Check if the click was on an action button
            if (e.target.classList.contains('duplicate-setlist-btn')) {
                await duplicateSetlist(setlistId);
                return;
            } else if (e.target.classList.contains('edit-setlist-btn')) {
                const setlist = setlists.find(s => s.id === setlistId);
                if (setlist) showEditSetlistPage(setlist);
                return;
            }
            
            // Otherwise, show the setlist
            const setlist = setlists.find(s => s.id === setlistId);
            if (setlist) showViewSetlistPage(setlist);
        };
    });
    
    // Update action buttons after a short delay to allow DOM to render
    setTimeout(updateSetlistActionButtons, 100);
}

// Update setlist action buttons based on ownership
async function updateSetlistActionButtons() {
  const setlistItems = document.querySelectorAll('.setlist-item');
  
  for (const item of setlistItems) {
    const setlistId = parseInt(item.getAttribute('data-id'));
    const setlistUserId = item.getAttribute('data-user-id');
    
    let isOwner = false;
    let isLoggedIn = false;
    
    if (window.db) {
      try {
        const { data: { user }, error } = await window.db.auth.getUser();
        if (!error && user) {
          isLoggedIn = true;
          if (setlistUserId) {
            isOwner = user.id === setlistUserId;
          }
        }
      } catch (e) {
        console.error('Error checking auth state:', e);
      }
    }
    
    // Update the UI based on ownership
    const detailsEl = item.querySelector('.setlist-details');
    if (detailsEl) {
      detailsEl.textContent = detailsEl.textContent.replace(' (Mine)', '').trim();
      if (isOwner) {
        detailsEl.textContent += ' (Mine)';
      }
    }
    
    // Add action buttons based on ownership and login status
    let actionsContainer = item.querySelector('.setlist-actions');
    if (!actionsContainer) {
      actionsContainer = document.createElement('div');
      actionsContainer.className = 'setlist-actions';
      item.appendChild(actionsContainer);
    }
    
    // Clear existing buttons
    actionsContainer.innerHTML = '';
    
    // Add buttons based on conditions
    if (isLoggedIn && !isOwner) {
      const duplicateBtn = document.createElement('button');
      duplicateBtn.className = 'btn btn-sm btn-secondary duplicate-setlist-btn';
      duplicateBtn.textContent = 'Duplicate';
      duplicateBtn.dataset.setlistId = setlistId;
      actionsContainer.appendChild(duplicateBtn);
    }
    
    if (isOwner) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-warning edit-setlist-btn';
      editBtn.textContent = 'Edit';
      editBtn.dataset.setlistId = setlistId;
      actionsContainer.appendChild(editBtn);
    }
  }
}

// Show view setlist page
function showViewSetlistPage(setlist) {
    stopMetronome();
    stopAutoscroll();
    document.getElementById('home-songs-page').classList.add('hidden');
    document.getElementById('home-setlists-page').classList.add('hidden');
    document.getElementById('edit-song-page').classList.add('hidden');
    document.getElementById('edit-setlist-page').classList.add('hidden');
    document.getElementById('view-setlist-page').classList.remove('hidden');
    document.getElementById('lyrics-page').classList.add('hidden');
    document.getElementById('settings-page').classList.add('hidden');
    document.getElementById('ambient-modal').classList.add('hidden');
    // Make sure auth page is hidden
    document.getElementById('auth-page')?.classList.add('hidden');
    
    currentSetlist = setlist;
    document.getElementById('view-setlist-title').textContent = setlist.title;
    renderViewSetlistSongs(setlist.songIds);
}

// Render songs in view setlist page
function renderViewSetlistSongs(songIds) {
  const container = document.getElementById('view-setlist-songs-container');
  container.innerHTML = '';

  // Build DOM elements in order
  songIds.forEach((songId, index) => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    const el = document.createElement('div');
    el.className = 'view-setlist-song-item';
    el.setAttribute('data-song-id', songId);
    el.setAttribute('data-index', index);

    el.innerHTML = `
      <div class="song-title">${escapeHtml(song.title)}</div>
      <div class="song-details">${escapeHtml(song.key)} • ${song.bpm} bpm</div>
    `;

    el.addEventListener('click', () => {
      showLyricsPageFromSetlist(song, songIds, index);
    });

    container.appendChild(el);
  });
}

// Show edit setlist page
function showEditSetlistPage(setlist = null, fromViewSetlist = false) {
  document.getElementById('home-songs-page').classList.add('hidden');
  document.getElementById('home-setlists-page').classList.add('hidden');
  document.getElementById('edit-song-page').classList.add('hidden');
  document.getElementById('edit-setlist-page').classList.remove('hidden');
  document.getElementById('view-setlist-page').classList.add('hidden');
  document.getElementById('lyrics-page').classList.add('hidden');
  document.getElementById('settings-page').classList.add('hidden');
  document.getElementById('ambient-modal').classList.add('hidden');
  cameFromViewSetlist = fromViewSetlist;

  // clear search box for available songs
  const addSearch = document.getElementById('add-song-search');
  if (addSearch) addSearch.value = '';

  if (setlist) {
    // Editing existing setlist
    document.getElementById('edit-setlist-title').textContent = 'Edit Setlist';
    document.getElementById('setlist-title').value = setlist.title;
    editingSetlistId = setlist.id;

    // Render songs in setlist
    renderSetlistSongs(setlist.songIds);

    // Show delete button
    document.getElementById('delete-setlist-btn').style.display = 'block';
  } else {
    // Creating new setlist
    document.getElementById('edit-setlist-title').textContent = 'New Setlist';
    document.getElementById('setlist-title').value = '';
    editingSetlistId = null;

    // Clear songs in setlist
    document.getElementById('setlist-songs-container').innerHTML = '';

    // Hide delete button
    document.getElementById('delete-setlist-btn').style.display = 'none';
  }

  // Render available songs and wire search
  renderAvailableSongs();
}

// Render songs currently in the setlist editor
function renderSetlistSongs(songIds) {
  const container = document.getElementById('setlist-songs-container');
  container.innerHTML = '';

  // Build DOM elements in order
  songIds.forEach((songId, index) => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    const el = document.createElement('div');
    el.className = 'setlist-song-item';
    el.setAttribute('data-song-id', songId);
    el.setAttribute('draggable', 'true');

    el.innerHTML = `
      <div class="setlist-song-info" style="display:flex;align-items:center;gap:10px;">
        <span class="drag-handle" title="Drag to reorder" style="cursor:grab;">☰</span>
        <div style="min-width:0">
          <div class="setlist-song-title">${escapeHtml(song.title)}</div>
          <div class="setlist-song-details">${escapeHtml(song.key)} • ${song.bpm} bpm</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="remove-song-btn" title="Remove">✕</button>
      </div>
    `;

    // remove handler
    el.querySelector('.remove-song-btn').addEventListener('click', () => {
      el.remove();
      
      // Update the setlist data in localStorage
      const newSongIds = Array.from(container.children).map(ch => parseInt(ch.getAttribute('data-song-id')));
      
      // Update the setlist in the global setlists array
      if (editingSetlistId) {
        const index = setlists.findIndex(s => s.id === editingSetlistId);
        if (index !== -1) {
          setlists[index].songIds = newSongIds;
          // Save to localStorage
          localStorage.setItem('setlistManager_setlists', JSON.stringify(setlists));
        }
      }
      
      // Refresh the available songs list to show the newly removed song
      renderAvailableSongs();
    });

    // Drag and drop handlers
    el.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', index.toString());
      el.classList.add('dragging');
    });
    
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      
      // Update the setlist data after reordering
      const newSongIds = Array.from(container.children).map(ch => parseInt(ch.getAttribute('data-song-id')));
      
      // Update the setlist in the global setlists array
      if (editingSetlistId) {
        const index = setlists.findIndex(s => s.id === editingSetlistId);
        if (index !== -1) {
          setlists[index].songIds = newSongIds;
          // Save to localStorage
          localStorage.setItem('setlistManager_setlists', JSON.stringify(setlists));
        }
      }
    });

    el.addEventListener('dragover', (ev) => {
      ev.preventDefault();
      const afterElement = getDragAfterElement(container, ev.clientY);
      const draggable = document.querySelector('.dragging');
      if (afterElement == null) {
        container.appendChild(draggable);
      } else {
        container.insertBefore(draggable, afterElement);
      }
    });

    container.appendChild(el);
  });
}

// Helper function for drag and drop reordering
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.setlist-song-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Render available songs to add to the setlist
function renderAvailableSongs() {
  const container = document.getElementById('available-songs-list');
  
  // Get the current setlist songs to exclude them from the available list
  let currentSetlistSongIds = [];
  if (editingSetlistId) {
    const currentSetlist = setlists.find(s => s.id === editingSetlistId);
    if (currentSetlist) {
      currentSetlistSongIds = currentSetlist.songIds || [];
    }
  }
  
  // Filter songs to only show those not already in the setlist
  const availableSongs = songs.filter(song => !currentSetlistSongIds.includes(song.id));
  
  // Get search term
  const searchTerm = document.getElementById('add-song-search').value.toLowerCase();
  const filteredSongs = availableSongs.filter(song => song.title.toLowerCase().includes(searchTerm));
  
  container.innerHTML = '';
  
  if (filteredSongs.length === 0) {
    container.innerHTML = '<div class="no-results">No songs available to add</div>';
    return;
  }
  
  filteredSongs.forEach((song, index) => {
    const el = document.createElement('div');
    el.className = 'available-song-item';
    el.setAttribute('data-song-id', song.id);
    
    el.innerHTML = `
      <div class="song-title">${escapeHtml(song.title)}</div>
      <div class="song-details">${escapeHtml(song.key)} • ${song.bpm} bpm</div>
    `;
    
    // Add click handler to add the song to the setlist
    el.addEventListener('click', () => {
      addSongToSetlist(song.id);
    });
    
    container.appendChild(el);
  });
}

// Add a song to the current setlist
function addSongToSetlist(songId) {
  const container = document.getElementById('setlist-songs-container');
  
  // Check if the song is already in the setlist
  const existingSong = container.querySelector(`[data-song-id="${songId}"]`);
  if (existingSong) {
    alert('This song is already in the setlist');
    return;
  }
  
  // Find the song in the global songs array
  const song = songs.find(s => s.id === songId);
  if (!song) {
    console.error('Song not found:', songId);
    return;
  }
  
  // Create a new element for the song in the setlist
  const el = document.createElement('div');
  el.className = 'setlist-song-item';
  el.setAttribute('data-song-id', song.id);
  el.setAttribute('draggable', 'true');
  
  el.innerHTML = `
    <div class="setlist-song-info" style="display:flex;align-items:center;gap:10px;">
      <span class="drag-handle" title="Drag to reorder" style="cursor:grab;">☰</span>
      <div style="min-width:0">
        <div class="setlist-song-title">${escapeHtml(song.title)}</div>
        <div class="setlist-song-details">${escapeHtml(song.key)} • ${song.bpm} bpm</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;">
      <button class="remove-song-btn" title="Remove">✕</button>
    </div>
  `;
  
  // remove handler
  el.querySelector('.remove-song-btn').addEventListener('click', () => {
    el.remove();
    
    // Update the setlist data in localStorage
    const newSongIds = Array.from(container.children).map(ch => parseInt(ch.getAttribute('data-song-id')));
    
    // Update the setlist in the global setlists array
    if (editingSetlistId) {
      const index = setlists.findIndex(s => s.id === editingSetlistId);
      if (index !== -1) {
        setlists[index].songIds = newSongIds;
        // Save to localStorage
        localStorage.setItem('setlistManager_setlists', JSON.stringify(setlists));
      }
    }
    
    // Refresh the available songs list to show the newly removed song
    renderAvailableSongs();
  });

  // Drag and drop handlers
  el.addEventListener('dragstart', (ev) => {
    const index = Array.from(container.children).indexOf(el);
    ev.dataTransfer.setData('text/plain', index.toString());
    el.classList.add('dragging');
  });
  
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    
    // Update the setlist data after reordering
    const newSongIds = Array.from(container.children).map(ch => parseInt(ch.getAttribute('data-song-id')));
    
    // Update the setlist in the global setlists array
    if (editingSetlistId) {
      const index = setlists.findIndex(s => s.id === editingSetlistId);
      if (index !== -1) {
        setlists[index].songIds = newSongIds;
        // Save to localStorage
        localStorage.setItem('setlistManager_setlists', JSON.stringify(setlists));
      }
    }
    
    // Refresh the available songs list
    renderAvailableSongs();
  });

  el.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    const afterElement = getDragAfterElement(container, ev.clientY);
    const draggable = document.querySelector('.dragging');
    if (afterElement == null) {
      container.appendChild(draggable);
    } else {
      container.insertBefore(draggable, afterElement);
    }
  });

  container.appendChild(el);
  
  // Update the setlist data in localStorage
  const newSongIds = Array.from(container.children).map(ch => parseInt(ch.getAttribute('data-song-id')));
  
  // Update the setlist in the global setlists array
  if (editingSetlistId) {
    const index = setlists.findIndex(s => s.id === editingSetlistId);
    if (index !== -1) {
      setlists[index].songIds = newSongIds;
      // Save to localStorage
      localStorage.setItem('setlistManager_setlists', JSON.stringify(setlists));
    }
  }
  
  // Refresh the available songs list to remove the added song
  renderAvailableSongs();
}

// Duplicate setlist functionality
async function duplicateSetlist(setlistId) {
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
    
    // Get the original setlist and its songs
    const { data: originalSetlist, error: setlistError } = await window.db
      .from('setlists')
      .select('*')
      .eq('id', setlistId)
      .single();
    
    if (setlistError) {
      console.error('Error fetching original setlist:', setlistError);
      alert('Error accessing setlist: ' + setlistError.message);
      return;
    }
    
    // Get the original setlist songs
    const { data: originalSetlistSongs, error: songsError } = await window.db
      .from('setlist_songs')
      .select('*')
      .eq('setlist_id', setlistId)
      .order('position', { ascending: true });
    
    if (songsError) {
      console.error('Error fetching original setlist songs:', songsError);
      alert('Error accessing setlist songs: ' + songsError.message);
      return;
    }
    
    // Create the new setlist
    const { data: newSetlist, error: createError } = await window.db
      .from('setlists')
      .insert([{
        title: originalSetlist.title + ' (Copy)',
        user_id: user.id
      }])
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating new setlist:', createError);
      alert('Error creating setlist copy: ' + createError.message);
      return;
    }
    
    // Add songs to the new setlist
    if (originalSetlistSongs && originalSetlistSongs.length > 0) {
      const newSetlistSongs = originalSetlistSongs.map((song, index) => ({
        setlist_id: newSetlist.id,
        song_id: song.song_id,
        position: index
      }));
      
      const { error: songsInsertError } = await window.db
        .from('setlist_songs')
        .insert(newSetlistSongs);
      
      if (songsInsertError) {
        console.error('Error inserting songs to new setlist:', songsInsertError);
        // Don't return here, as the setlist was created successfully
      }
    }
    
    // Re-fetch setlists from database to ensure latest data
    await loadSetlistsFromDatabase();
    alert('Setlist duplicated successfully!');
  } catch (error) {
    console.error('Error in duplicateSetlist:', error);
    alert('Error duplicating setlist: ' + error.message);
  }
}