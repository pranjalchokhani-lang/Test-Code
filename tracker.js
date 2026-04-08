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
let isResetting         = true;  // STARTS LOCKED — released only after boot lock
let HOME_DISTRICT       = null;
const mover             = document.getElementById('map-mover');

// ─── BOOT WATCH ───────────────────────────────────────────────────────────────
// Keeps screen fully blocked (isResetting=true) until:
// - _mapReset exists (HTML IIFE has run)
// - path.on exists (map has rendered + select() has fired)
// Locks HOME_DISTRICT from that very first path.on — atomically.
// No user can click before this because isResetting=true blocks all events.
const bootWatch = setInterval(() => {
    if (typeof window._mapReset !== 'function') return;
    if (typeof window.mapApply  !== 'function') return;
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    HOME_DISTRICT = activePath.getAttribute('data-n');
    clearInterval(bootWatch);

    // Small delay to let select()'s boot animation finish visually
    setTimeout(() => {
        isResetting = false;
        console.log('Tracker: boot complete. HOME locked ->', HOME_DISTRICT);
    }, 1500);
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

    console.log('Tracker: resetting...');

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

    // 3. Kill any in-flight stream() instantly by bumping currentToken
    //    stream() checks this on every row and aborts immediately
    currentToken++;

    // 4. Reset zoom — silent
    zoomSfx.volume = 0;
    window._mapReset();
    window.mapApply();
    setTimeout(() => { zoomSfx.volume = 0.15; }, 300);

    // 5. Reset district/data via select() — reveal sound muted
    //    select() will do its own currentToken++ internally which is fine —
    //    it just means the new stream gets a fresh token and runs cleanly
    revealSfx.volume = 0;
    select(HOME_DISTRICT);
    setTimeout(() => { revealSfx.volume = 0.4; }, 300);

    // 6. Fixed 2000ms wait — enough for select()'s 900ms loading bar
    //    + first few rows to appear. No dependency on item count.
    await new Promise(res => setTimeout(res, 2000));

    isResetting = false;
    console.log('Tracker: reset complete — ready.');
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
['touchstart', 'pointerdown', 'wheel', 'touchmove', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, () => { if (!isResetting) startSession(); }, { passive: true });
});
