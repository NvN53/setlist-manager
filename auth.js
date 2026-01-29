/* Authentication Logic */

// Global Supabase client
let supabase = null;
let db = null; // Will be set to window.db after initialization

// Initialize Supabase
async function initSupabase() {
    try {
        // Get credentials from environment or fallback to hardcoded values
        const SUPABASE_URL = 'https://your-project.supabase.co';
        const SUPABASE_ANON_KEY = 'your-anon-key';

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Missing Supabase credentials');
            return;
        }

        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.db = supabase; // Set global db reference
        db = supabase;

        // Check current auth state
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (!error && user) {
            // User is logged in
            updateAuthUI(user);
        } else {
            // User is not logged in
            updateAuthUI(null);
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                updateAuthUI(session?.user);
            } else if (event === 'SIGNED_OUT') {
                updateAuthUI(null);
            }
        });

        console.log('Supabase initialized successfully');
    } catch (error) {
        console.error('Error initializing Supabase:', error);
    }
}

// Update authentication UI based on user state
function updateAuthUI(user) {
    const userEmailSpan = document.getElementById("user-email");
    const userInfo = document.getElementById("user-info");
    const loginForm = document.getElementById("login-form");
    const logoutBtn = document.getElementById("logout");
    const status = document.getElementById("status");

    if (user) {
        // User is logged in
        document.getElementById("email").value = user.email || '';
        document.getElementById("password").value = '';
        
        userEmailSpan.textContent = user.email;
        userInfo.style.display = "block";
        loginForm.style.display = "none";
        logoutBtn.style.display = "block";
        
        // Show Add Song button
        const addSongBtn = document.getElementById('add-song-btn');
        if (addSongBtn) addSongBtn.style.display = "block";
        
        status.textContent = `✅ Logged in as ${user.email}`;
        status.style.display = "block";
    } else {
        // User is not logged in
        userInfo.style.display = "none";
        loginForm.style.display = "block";
        logoutBtn.style.display = "none";
        
        // Hide Add Song button
        const addSongBtn = document.getElementById('add-song-btn');
        if (addSongBtn) addSongBtn.style.display = "none";
        
        status.textContent = "Please log in";
        status.style.display = "none";
    }
}

// Show authentication page
function showAuthPage() {
    // Hide all other pages with defensive null checks
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
    editSetlistPage?.classList.add('hidden');
    viewSetlistPage?.classList.add('hidden');
    lyricsPage?.classList.add('hidden');
    settingsPage?.classList.add('hidden');
    ambientModal?.classList.add('hidden');
    
    // Show auth page
    const authPage = document.getElementById('auth-page');
    authPage?.classList.remove('hidden');
}

// Login functionality
async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const status = document.getElementById("status");

    if (!email || !password) {
        status.textContent = "⚠️ Please enter both email and password";
        status.style.display = "block";
        return;
    }

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            status.textContent = `❌ ${error.message}`;
            status.style.display = "block";
        } else {
            status.textContent = "✅ Login successful!";
            status.style.display = "block";
        }
    } catch (error) {
        status.textContent = `❌ ${error.message}`;
        status.style.display = "block";
    }
}

// Signup functionality
async function signup() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const status = document.getElementById("status");

    if (!email || !password) {
        status.textContent = "⚠️ Please enter both email and password";
        status.style.display = "block";
        return;
    }

    try {
        const { error } = await supabase.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            status.textContent = `❌ ${error.message}`;
            status.style.display = "block";
        } else {
            status.textContent = "✅ Check your email for confirmation!";
            status.style.display = "block";
        }
    } catch (error) {
        status.textContent = `❌ ${error.message}`;
        status.style.display = "block";
    }
}

// Logout functionality
async function logout() {
    if (supabase) {
        await supabase.auth.signOut();
    }
    const status = document.getElementById("status");
    status.textContent = "👋 Logged out";
    status.style.display = "block";
    
    // Update UI to show login form
    const userInfo = document.getElementById("user-info");
    const loginForm = document.getElementById("login-form");
    const logoutBtn = document.getElementById("logout");
    
    userInfo.style.display = "none";
    loginForm.style.display = "block";
    logoutBtn.style.display = "none";
    
    // Clear inputs
    document.getElementById("email").value = '';
    document.getElementById("password").value = '';
}

// Update lyrics page menu based on authentication status
async function updateLyricsMenu() {
    try {
        const menuContainer = document.getElementById('lyrics-dropdown-menu');
        
        if (window.db) {
            const { data: { user }, error } = await window.db.auth.getUser();
            
            if (!error && user) {
                // User is logged in - show edit/delete options
                menuContainer.innerHTML = `
                    <div class="menu-item" id="edit-song-menu-item">Edit Song</div>
                    <div class="menu-item" id="delete-song-menu-item">Delete Song</div>
                `;
                
                // Add event listeners for the newly created elements
                document.getElementById('edit-song-menu-item').addEventListener('click', function() {
                    if (currentSong) {
                        editSong(currentSong);
                    }
                    menuContainer.classList.add('hidden');
                });
                
                document.getElementById('delete-song-menu-item').addEventListener('click', async function() {
                    if (currentSong) {
                        editingSongId = currentSong.id;
                        await deleteSong();
                    }
                    menuContainer.classList.add('hidden');
                });
            } else {
                // User is not logged in - show only login option
                menuContainer.innerHTML = `
                    <div class="menu-item" id="login-menu-item-lyrics">Log In</div>
                    <div class="menu-subtext" style="font-size: 0.8em; color: #666; padding: 5px 15px;">Log in to make changes or duplicate</div>
                `;
                
                // Add event listener for login
                document.getElementById('login-menu-item-lyrics').addEventListener('click', function() {
                    showAuthPage();
                    menuContainer.classList.add('hidden');
                });
            }
        } else {
            // DB not initialized - show only login option
            menuContainer.innerHTML = `
                <div class="menu-item" id="login-menu-item-lyrics">Log In</div>
                <div class="menu-subtext" style="font-size: 0.8em; color: #666; padding: 5px 15px;">Log in to make changes or duplicate</div>
            `;
            
            // Add event listener for login
            document.getElementById('login-menu-item-lyrics').addEventListener('click', function() {
                showAuthPage();
                menuContainer.classList.add('hidden');
            });
        }
    } catch (error) {
        console.error('Error updating lyrics menu:', error);
        // On error, show login option as fallback
        const menuContainer = document.getElementById('lyrics-dropdown-menu');
        menuContainer.innerHTML = `
            <div class="menu-item" id="login-menu-item-lyrics">Log In</div>
            <div class="menu-subtext" style="font-size: 0.8em; color: #666; padding: 5px 15px;">Log in to make changes or duplicate</div>
        `;
        
        document.getElementById('login-menu-item-lyrics').addEventListener('click', function() {
            showAuthPage();
            menuContainer.classList.add('hidden');
        });
    }
}