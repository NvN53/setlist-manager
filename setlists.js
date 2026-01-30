/* Setlist-related functionality */

// Global variables for setlists
let setlists = []; // Will be loaded from Supabase
let currentSetlist = null; // Currently selected setlist
let editingSetlistId = null; // ID of setlist being edited
let cameFromViewSetlist = false; // Track if we came from view setlist page

// Load setlists from Supabase database
async function loadSetlistsFromDatabase() {
    console.log('Loading setlists from database...');
    console.log('Songs array length when loading setlists:', songs.length);
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
                // Map Supabase data to local format, filtering out invalid IDs
                setlists = data.filter(setlist => {
                    const isValid = validateAndFormatId(setlist.id, `loaded setlist ID ${setlist.id}`);
                    if (!isValid) {
                        console.warn('Skipping setlist with invalid ID:', setlist);
                    }
                    return isValid;
                }).map(setlist => ({
                    id: setlist.id,
                    title: setlist.title,
                    user_id: setlist.user_id,  // Include user_id for ownership checks
                    songIds: []  // Initialize with empty array, will be populated below
                }));
                
                // Now fetch the songs for each setlist
                // Process in batches to avoid too many concurrent requests
                const batchSize = 5;
                for (let batchStart = 0; batchStart < setlists.length; batchStart += batchSize) {
                    const batch = setlists.slice(batchStart, batchStart + batchSize);
                    
                    for (let i = 0; i < batch.length; i++) {
                        const setlistIndex = batchStart + i;
                        const setlistId = setlists[setlistIndex].id;
                        
                        // Validate the setlist ID before using it in a query
                        const validatedSetlistId = validateAndFormatId(setlistId, `setlist ID at index ${setlistIndex}`);
                        if (!validatedSetlistId) {
                            console.warn(`Skipping setlist with invalid ID at index ${setlistIndex}:`, setlistId);
                            setlists[setlistIndex].songIds = [];
                            continue;
                        }
                        
                        const { data: setlistSongsData, error: setlistSongsError } = await window.db
                            .from('setlist_songs')
                            .select('song_id, position')
                            .eq('setlist_id', validatedSetlistId)
                            .order('position', { ascending: true });
                        
                        if (setlistSongsError) {
                            console.error('Error fetching setlist songs for setlist', setlistId, ':', setlistSongsError);
                            setlists[setlistIndex].songIds = [];
                        } else {
                            setlists[setlistIndex].songIds = setlistSongsData.map(ss => ss.song_id);
                        }
                    }
                }
                
                console.log('Loaded setlists with song IDs:', setlists);
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
    if (!setlistsList) {
        console.error('Setlists list container not found');
        return;
    }
    
    const setlistsToRender = filteredSetlists || setlists;
    console.log('Rendering setlists list with', setlistsToRender.length, 'setlists');
    
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
    
    // Add event listeners for setlist items using proper event delegation
    const setlistsContainer = document.getElementById('setlists-list');
    if (setlistsContainer) {
        // Update action buttons first to ensure buttons exist
        updateSetlistActionButtons();
        
        // Add click handler using event delegation
        // Use a fresh listener each time to avoid conflicts
        setlistsContainer.removeEventListener('click', handleSetlistItemClick);
        setlistsContainer.addEventListener('click', handleSetlistItemClick);
        
        console.log('Event listener attached to setlists container');
    }
    
    // Update action buttons after a short delay to allow DOM to render
    setTimeout(updateSetlistActionButtons, 100);
}

// Update setlist action buttons based on ownership
async function updateSetlistActionButtons() {
  const setlistItems = document.querySelectorAll('.setlist-item');
  
  for (const item of setlistItems) {
    const setlistId = item.getAttribute('data-id');
    
    // Validate the setlist ID before processing
    const validatedSetlistId = validateAndFormatId(setlistId, 'setlist ID in updateSetlistActionButtons');
    if (!validatedSetlistId) {
      console.warn('Skipping setlist item with invalid ID:', setlistId);
      // Hide the item or mark it as invalid
      item.style.display = 'none';
      continue;
    }
    
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
      duplicateBtn.dataset.setlistId = validatedSetlistId; // Use validated ID
      actionsContainer.appendChild(duplicateBtn);
    }
    
    if (isOwner) {
      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-sm btn-warning edit-setlist-btn';
      editBtn.textContent = 'Edit';
      editBtn.dataset.setlistId = validatedSetlistId; // Use validated ID
      actionsContainer.appendChild(editBtn);
    }
  }
}

// Event handler for setlist item clicks
async function handleSetlistItemClick(e) {
  console.log('Setlist item clicked:', e.target);
  
  const item = e.target.closest('.setlist-item');
  if (!item) return;
  
  const setlistId = item.getAttribute('data-id');
  console.log('Clicked setlist ID:', setlistId);
  
  // Check if the click was on an action button
  if (e.target.classList.contains('duplicate-setlist-btn')) {
    // Get ID from the button's dataset first, fall back to item's data-id
    const buttonSetlistId = e.target.dataset.setlistId;
    const actualSetlistId = buttonSetlistId || setlistId;
    
    // Validate before attempting to duplicate
    const validatedSetlistId = validateAndFormatId(actualSetlistId, 'setlist ID in duplicate handler');
    if (!validatedSetlistId) {
      console.error('Invalid setlist ID found in duplicate handler:', actualSetlistId);
      alert('This setlist has an invalid ID and cannot be duplicated');
      return;
    }
    
    await duplicateSetlist(validatedSetlistId);
    return;
  } else if (e.target.classList.contains('edit-setlist-btn')) {
    // Get ID from the button's dataset first, fall back to item's data-id
    const buttonSetlistId = e.target.dataset.setlistId;
    const actualSetlistId = buttonSetlistId || setlistId;
    const setlist = setlists.find(s => s.id === actualSetlistId);
    if (setlist) {
      // Validate the setlist ID before editing
      const validatedSetlistId = validateAndFormatId(setlist.id, 'setlist ID in edit handler');
      if (!validatedSetlistId) {
        console.error('Invalid setlist ID found in edit handler:', setlist.id);
        alert('This setlist has an invalid ID and cannot be edited');
        return;
      }
      console.log('Showing edit setlist page for:', setlist.title);
      showEditSetlistPage(setlist);
    }
    return;
  }
  
  // Otherwise, show the setlist
  const setlist = setlists.find(s => s.id === setlistId);
  if (setlist) {
    console.log('Opening setlist:', setlist.title);
    
    // Double-check that the setlist ID is valid before showing it
    const validatedSetlistId = validateAndFormatId(setlist.id, 'setlist ID in showViewSetlistPage');
    if (!validatedSetlistId) {
      console.error('Invalid setlist ID found in setlists array:', setlist.id);
      alert('This setlist has an invalid ID and cannot be opened');
      return;
    }
    
    showViewSetlistPage(setlist);
  } else {
    console.error('Setlist not found:', setlistId);
  }
}

// Show view setlist page
function showViewSetlistPage(setlist) {
    console.log('showViewSetlistPage called with:', setlist);
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
    viewSetlistPage?.classList.remove('hidden');
    lyricsPage?.classList.add('hidden');
    settingsPage?.classList.add('hidden');
    ambientModal?.classList.add('hidden');
    
    // Make sure auth page is hidden
    authPage?.classList.add('hidden');
    
    currentSetlist = setlist;
    const viewSetTitle = document.getElementById('view-setlist-title');
    viewSetTitle?.textContent = setlist.title;
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
  // Hide all pages with defensive null checks
  const homeSongsPage = document.getElementById('home-songs-page');
  const homeSetlistsPage = document.getElementById('home-setlists-page');
  const editSongPage = document.getElementById('edit-song-page');
  const editSetlistPage = document.getElementById('edit-setlist-page');
  const viewSetlistPage = document.getElementById('view-setlist-page');
  const lyricsPage = document.getElementById('lyrics-page');
  const settingsPage = document.getElementById('settings-page');
  const ambientModal = document.getElementById('ambient-modal');
  
  homeSongsPage?.classList.add('hidden');
  homeSetlistsPage?.classList.add('hidden');
  editSongPage?.classList.add('hidden');
  editSetlistPage?.classList.remove('hidden');
  viewSetlistPage?.classList.add('hidden');
  lyricsPage?.classList.add('hidden');
  settingsPage?.classList.add('hidden');
  ambientModal?.classList.add('hidden');
  cameFromViewSetlist = fromViewSetlist;

  // clear search box for available songs
  const addSearch = document.getElementById('add-song-search');
  if (addSearch) addSearch.value = '';

  if (setlist) {
    // Editing existing setlist
    const editSetTitle = document.getElementById('edit-setlist-title');
    const setlistTitleInput = document.getElementById('setlist-title');
    const deleteBtn = document.getElementById('delete-setlist-btn');
    
    editSetTitle?.textContent = 'Edit Setlist';
    setlistTitleInput?.value = setlist.title;
    editingSetlistId = setlist.id;

    // Render songs in setlist
    renderSetlistSongs(setlist.songIds);

    // Show delete button
    if (deleteBtn) deleteBtn.style.display = 'block';
  } else {
    // Creating new setlist
    const editSetTitle = document.getElementById('edit-setlist-title');
    const setlistTitleInput = document.getElementById('setlist-title');
    const container = document.getElementById('setlist-songs-container');
    const deleteBtn = document.getElementById('delete-setlist-btn');
    
    editSetTitle?.textContent = 'New Setlist';
    setlistTitleInput?.value = '';
    editingSetlistId = null;

    // Clear songs in setlist
    if (container) container.innerHTML = '';

    // Hide delete button
    if (deleteBtn) deleteBtn.style.display = 'none';
  }

  // Render available songs and wire search
  setTimeout(() => {
    renderAvailableSongs();
    console.log('Available songs rendered, songs array length:', songs.length);
  }, 100);
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
      const newSongIds = Array.from(container.children).map(ch => ch.getAttribute('data-song-id'));
      
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
      const newSongIds = Array.from(container.children).map(ch => ch.getAttribute('data-song-id'));
      
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
  console.log('renderAvailableSongs called');
  console.log('Songs array length:', songs.length);
  console.log('Editing setlist ID:', editingSetlistId);
  
  const container = document.getElementById('available-songs-list');
  if (!container) {
    console.error('Available songs container not found');
    return;
  }
  
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
    el.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event bubbling
      console.log('Adding song to setlist:', song.id, song.title);
      console.log('Editing setlist ID when adding song:', editingSetlistId);
      addSongToSetlist(song.id);
    });
    
    container.appendChild(el);
  });
}

// Add a song to the current setlist
function addSongToSetlist(songId) {
  console.log('addSongToSetlist called with:', songId);
  console.log('Global songs array length:', songs.length);
  console.log('Editing setlist ID:', editingSetlistId);
  
  const container = document.getElementById('setlist-songs-container');
  if (!container) {
    console.error('Setlist songs container not found');
    return;
  }
  
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
    const newSongIds = Array.from(container.children).map(ch => ch.getAttribute('data-song-id'));
    
    // Validate song IDs before updating
    const validatedSongIds = newSongIds.filter(id => {
      if (!id) return false; // Skip null/undefined IDs
      const validated = validateAndFormatId(id, 'song ID in remove handler');
      return validated !== null;
    });
    
    // Update the setlist in the global setlists array
    if (editingSetlistId) {
      const validatedSetlistId = validateAndFormatId(editingSetlistId, 'editing setlist ID in remove handler');
      if (validatedSetlistId) {
        const index = setlists.findIndex(s => s.id === validatedSetlistId);
        if (index !== -1) {
          setlists[index].songIds = validatedSongIds;
          // Sanitize the entire setlists array before saving to localStorage
          const sanitizedSetlists = setlists.map(setlist => ({
            ...setlist,
            songIds: Array.isArray(setlist.songIds) ? 
              setlist.songIds.filter(id => validateAndFormatId(id, 'sanitizing song ID')) :
              []
          }));
          // Save to localStorage
          localStorage.setItem('setlistManager_setlists', JSON.stringify(sanitizedSetlists));
        }
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
    const newSongIds = Array.from(container.children).map(ch => ch.getAttribute('data-song-id'));
    
    // Validate song IDs before updating
    const validatedSongIds = newSongIds.filter(id => {
      if (!id) return false; // Skip null/undefined IDs
      const validated = validateAndFormatId(id, 'song ID in dragend handler');
      return validated !== null;
    });
    
    // Update the setlist in the global setlists array
    if (editingSetlistId) {
      const validatedSetlistId = validateAndFormatId(editingSetlistId, 'editing setlist ID in dragend handler');
      if (validatedSetlistId) {
        const index = setlists.findIndex(s => s.id === validatedSetlistId);
        if (index !== -1) {
          setlists[index].songIds = validatedSongIds;
          // Sanitize the entire setlists array before saving to localStorage
          const sanitizedSetlists = setlists.map(setlist => ({
            ...setlist,
            songIds: Array.isArray(setlist.songIds) ? 
              setlist.songIds.filter(id => validateAndFormatId(id, 'sanitizing song ID')) :
              []
          }));
          // Save to localStorage
          localStorage.setItem('setlistManager_setlists', JSON.stringify(sanitizedSetlists));
        }
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
  const newSongIds = Array.from(container.children).map(ch => ch.getAttribute('data-song-id'));
  
  // Validate song IDs before updating
  const validatedSongIds = newSongIds.filter(id => {
    if (!id) return false; // Skip null/undefined IDs
    const validated = validateAndFormatId(id, 'song ID in addSongToSetlist');
    return validated !== null;
  });
  
  // Update the setlist in the global setlists array
  if (editingSetlistId) {
    const validatedSetlistId = validateAndFormatId(editingSetlistId, 'editing setlist ID in addSongToSetlist');
    if (validatedSetlistId) {
      const index = setlists.findIndex(s => s.id === validatedSetlistId);
      if (index !== -1) {
        setlists[index].songIds = validatedSongIds;
        // Sanitize the entire setlists array before saving to localStorage
        const sanitizedSetlists = setlists.map(setlist => ({
          ...setlist,
          songIds: Array.isArray(setlist.songIds) ? 
            setlist.songIds.filter(id => validateAndFormatId(id, 'sanitizing song ID')) :
            []
        }));
        // Save to localStorage
        localStorage.setItem('setlistManager_setlists', JSON.stringify(sanitizedSetlists));
      }
    }
  }
  
  // Refresh the available songs list to remove the added song
  renderAvailableSongs();
  
  console.log('Song added to setlist, new song IDs:', newSongIds);
}

// Duplicate setlist functionality
async function duplicateSetlist(setlistId) {
  console.log('Attempting to duplicate setlist with ID:', setlistId, 'Type:', typeof setlistId);
  
  // Ensure setlistId is a string (UUID)
  const stringSetlistId = typeof setlistId === 'string' ? setlistId : String(setlistId);
  
  
  // Validate the setlist ID
  const validatedSetlistId = validateAndFormatId(stringSetlistId, 'setlist ID');
  if (!validatedSetlistId) {
    console.error('Failed to validate setlist ID:', setlistId);
    alert('Invalid setlist ID format');
    return;
  }
  
  // Use the validated ID for the rest of the function
  const finalSetlistId = validatedSetlistId;
  
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
    console.log('Fetching original setlist with validated ID:', finalSetlistId);
    const { data: originalSetlist, error: setlistError } = await window.db
      .from('setlists')
      .select('*')
      .eq('id', finalSetlistId)
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
      .eq('setlist_id', finalSetlistId)
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