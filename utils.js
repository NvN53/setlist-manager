/* Utilities */

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Chord detection
function isChordToken(tok) {
    return /^[A-G][#b]?(m|dim|aug|sus|Maj|min|\+|A°)?(\/[A-G][#b]?)?$/.test(tok);
}

// Frequency conversion functions
function frequencyToNote(frequency) {
    if (frequency <= 0) return null;
    const A4 = 440;
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteNumber = Math.round(12 * (Math.log(frequency / A4) / Math.log(2)) + 69);
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return { note: noteName, octave: octave, frequency: frequency };
}

function getFrequencyForNote(note) {
    const noteMap = {
        'C': 261.63, 'C#': 277.18, 'Db': 277.18, 'D': 293.66, 'D#': 311.13, 'Eb': 311.13,
        'E': 329.63, 'F': 349.23, 'F#': 369.99, 'Gb': 369.99, 'G': 392.00, 'G#': 415.30,
        'Ab': 415.30, 'A': 440.00, 'A#': 466.16, 'Bb': 466.16, 'B': 493.88
    };
    // Calculate based on octave - default to octave 4 if not specified
    if (typeof note === 'string' && note.length > 0) {
        const baseNote = note.slice(0, -1);
        const octaveMatch = note.match(/\d+/);
        const octave = octaveMatch ? parseInt(octaveMatch[0]) : 4;
        const baseFreq = noteMap[baseNote] || 440.00;
        return baseFreq * Math.pow(2, octave - 4);
    }
    return noteMap[note] || 440.00;
}

// Apply band-pass filter to audio data
function applyBandPassFilter(data, sampleRate, lowFreq, highFreq) {
    const nyquist = sampleRate / 2;
    const low = Math.max(0, Math.min(lowFreq / nyquist, 1));
    const high = Math.max(0, Math.min(highFreq / nyquist, 1));
    
    // Simple ideal bandpass (in reality, you'd implement a proper filter)
    // For demo purposes, just return the original data
    return data;
}

// Compute YIN pitch detection algorithm
function computeYin(buffer, sampleRate, minFreq, maxFreq, probabilityThreshold = 0.1) {
    const bufferSize = buffer.length;
    const thresholdedBuffer = new Float32Array(bufferSize);
    let yinBuffer = new Float32Array(bufferSize >> 1);
    const maxLag = yinBuffer.length;

    // Difference function
    for (let tau = 0; tau < maxLag; tau++) {
        for (let j = 0; j < maxLag; j++) {
            const index = j * 2;
            const delta = buffer[index] - buffer[index + tau * 2];
            yinBuffer[tau] += delta * delta;
        }
    }

    // Cumulative mean normalized difference function
    if (yinBuffer[0] !== 0) {
        yinBuffer[0] = 1;
    }
    let runningSum = 0;
    for (let tau = 1; tau < maxLag; tau++) {
        runningSum += yinBuffer[tau];
        if (runningSum === 0) {
            yinBuffer[tau] = 1;
        } else {
            yinBuffer[tau] *= tau / runningSum;
        }
    }

    // Absolute threshold
    let tau = -1;
    for (tau = 1; tau < maxLag; tau++) {
        if (yinBuffer[tau] < probabilityThreshold) {
            while (tau < maxLag && yinBuffer[tau] < yinBuffer[tau + 1]) {
                tau++;
            }
            break;
        }
    }

    if (tau === maxLag || yinBuffer[tau] >= probabilityThreshold) {
        tau = -1;
    }

    // Parabolic interpolation
    if (tau !== -1) {
        const s = yinBuffer[tau + 1] + yinBuffer[tau - 1] - 2 * yinBuffer[tau];
        const x = yinBuffer[tau - 1] - yinBuffer[tau + 1];
        if (s !== 0) {
            tau = tau + x / (2 * s);
        }
        return sampleRate / tau;
    }

    return -1;
}