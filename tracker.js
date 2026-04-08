// ─── LOCATION PROFILING ───────────────────────────────────────────────────────
function detectKioskLocation() {
    const generic = new Set(['index','home','main','default','page','app','www','']);
    const candidates = [];
    new URLSearchParams(window.location.search).forEach((val) => { if (val.trim()) candidates.push(val.trim()); });
    const hash = window.location.hash.replace('#','').trim();
    if (hash) candidates.push(hash);
    const filename = window.location.pathname.split('/').pop().split('.')[0].trim();
    if (filename) candidates.push(filename);
    window.location.pathname.split('/').slice(0,-1).forEach(seg => { if (seg.trim()) candidates.push(seg.trim()); });
    const meta = document.querySelector('meta[name="kiosk-location"]');
    if (meta?.content) candidates.push(meta.content.trim());
    const bodyLoc = document.body.getAttribute('data-location');
    if (bodyLoc) candidates.push(bodyLoc.trim());
    if (document.title) candidates.push(document.title.trim());
    for (const src of candidates) {
        const normalized = src.toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
        if (!generic.has(src.toLowerCase()) && normalized.length > 0) return normalized;
    }
    return 'UNKNOWN';
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const scriptUrl      = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";
const KIOSK_LOCATION = detectKioskLocation();
const IDLE_MS        = 10000;

// ─── STATE ────────────────────────────────────────────────────────────────────
let totalClicks         = 0;
let rawData             = {};
let startTime           = null;
let lastInteractionTime = null;
let idleTimer           = null;
let isResetting         = false;
let HOME_DISTRICT       = null; // locked once, never changes
let bootLocked          = false;
const mover             = document.getElementById('map-mover');

// ─── BOOT WATCH ───────────────────────────────────────────────────────────────
// Fires on every tick until BOTH _mapReset exists AND a path.on exists.
// The moment we see them, we lock HOME_DISTRICT from that exact element
// and IMMEDIATELY block further locking — so no user click can change it.
const bootWatch = setInterval(() => {
    if (bootLocked) { clearInterval(bootWatch); return; }
    if (typeof window._mapReset !== 'function') return;
    if (typeof window.mapApply  !== 'function') return;
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    // Lock immediately — before any user can click
    bootLocked    = true;
    HOME_DISTRICT = activePath.getAttribute('data-n');
    clearInterval(bootWatch);
    console.log('Tracker: HOME_DISTRICT locked at boot ->', HOME_DISTRICT);
}, 50);

// ─── SESSION ──────────────────────────────────────────────────────────────────
function startSession() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, IDLE_MS);
}

// ─── RESET ────────────────────────────────────────────────────────────────────
async function finalizeSession() {
    if (isResetting) return;
    isResetting = true;
    clearTimeout(idleTimer);
    idleTimer = null;

    console.log('Tracker: idle timeout — resetting...');

    // 1. Send data
    if (totalClicks > 0) {
        const payload = {
            location : KIOSK_LOCATION,
            clicks   : totalClicks,
            duration : startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(rawData)
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }

    // 2. Wipe session counters
    totalClicks         = 0;
    rawData             = {};
    startTime           = null;
    lastInteractionTime = null;

    // 3. Reset zoom — silent
    zoomSfx.volume = 0;
    window._mapReset();
    window.mapApply();
    setTimeout(() => { zoomSfx.volume = 0.15; }, 200);

    // 4. Reset data via select() — silent
    revealSfx.volume = 0;
    select(HOME_DISTRICT);
    setTimeout(() => { revealSfx.volume = 0.4; }, 200);

    // 5. Wait for select() + stream() to fully finish
    const maxItems = Math.max(
        (typeof DATA !== 'undefined' && DATA[HOME_DISTRICT]) ? (DATA[HOME_DISTRICT].m || []).length : 0,
        (typeof DATA !== 'undefined' && DATA[HOME_DISTRICT]) ? (DATA[HOME_DISTRICT].e || []).length : 0
    );
    const waitMs = 900 + (maxItems * 650) + 500;
    await new Promise(res => setTimeout(res, waitMs));

    // 6. Release shield — session is ready for next user
    isResetting = false;
    console.log('Tracker: reset complete — ready for next user.');

    // 7. FIX FOR "only works once":
    // After reset completes, arm the idle timer fresh so if nobody
    // touches the screen the next reset will still fire automatically.
    // startSession() is blocked during isResetting so we arm directly here.
    startTime           = null;
    lastInteractionTime = null;
    clearTimeout(idleTimer);
    // Don't start a new idle countdown — wait for actual user touch first.
    // The session starts clean on next interaction via the event listeners.
}

// ─── CLICK TRACKING ───────────────────────────────────────────────────────────
document.addEventListener('mousedown', (e) => {
    if (isResetting) return;
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;
    startSession();
    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const idx = allShapes.indexOf(target);
    rawData[idx] = (rawData[idx] || 0) + 1;
});

// ─── ANY TOUCH/INTERACTION STARTS SESSION ────────────────────────────────────
// This is what re-arms the idle timer after reset for the next user.
['touchstart', 'pointerdown', 'wheel', 'touchmove', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, () => { if (!isResetting) startSession(); }, { passive: true });
});
