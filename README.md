# Setlist Manager for Pianists v1.5.1

A simple, standalone web application for musicians to manage their setlists, songs, and practice sessions.

## Features

1. **Song Management**
   - Create, edit, and delete songs
   - Store song details: title, key, BPM, time signature
   - Add lyrics with chord notation
   - Transpose chords up or down

2. **Setlist Management**
   - Create and organize setlists for performances
   - View setlist duration and song count

3. **Performance Mode**
   - Display lyrics with highlighted chords
   - Built-in metronome
   - Ambient pad for pitch reference

4. **Practice Tools**
   - Ambient pad with advanced pitch detection
   - "Tap to Hum" feature with improved accuracy
   - Major/minor mode selection
   - Volume control

5. **Enhanced Ambient Pad**
   - Dual-section button: "Ambient" toggle and dropdown arrow
   - Stable pitch detection algorithm
   - Real-time pitch feedback
   - Easy pitch detection with microphone
   - Humming guidance (steady note, use 'mmm' sound)

## How to Use

1. Simply open the `setlist-manager.html` file in any modern web browser
2. No installation or internet connection required
3. All data is stored in your browser's local storage

## Main Pages

### Home - Songs
- View all your songs
- Search for specific songs
- Click the "+" button to add a new song
- Click any song to view/edit lyrics

### Home - Setlists
- View all your setlists
- Search for specific setlists
- Click the "+" button to create a new setlist

### Edit Song
- Enter song details (title, key, BPM, time signature)
- Add lyrics and chords in the text area
- Use the transpose buttons to adjust chords
- Save, delete, or duplicate songs

### Lyrics View
- See your song with chords highlighted
- Access the ambient pad for practice
- Use the metronome for timing

### Ambient Pad
- Reference pitch for tuning
- Select major or minor modes
- Choose from all 12 pitches
- Adjust volume level

## Technical Details

This is a standalone HTML file with embedded CSS and JavaScript. All data (songs and setlists) is stored in the browser's localStorage, so it persists between sessions but stays on your device.

The application uses Font Awesome icons for a professional look and feel, and is responsive working on both desktop and mobile devices.