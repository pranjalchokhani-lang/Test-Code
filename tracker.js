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
const HOME_DISTRICT  = 'Jaipur';

// ─── SESSION STATE ────────────────────────────────────────────────────────────
let totalClicks         = 0;
let rawData             = {};
let startTime           = null;
let lastInteractionTime = null;
let idleTimer           = null;
let isResetting         = false;

// ─── LOCK BOOT TRANSFORM ──────────────────────────────────────────────────────
// Polls until the map IIFE has done its first apply(), then locks that
// transform string as the home position — no need to touch internal variables.
let bootTransform = null;
const mover = document.getElementById('map-mover');

const bootWatch = setInterval(() => {
    if (mover && mover.style.transform) {
        setTimeout(() => {
            bootTransform = mover.style.transform;
            console.log('Tracker: boot transform locked ->', bootTransform);
            clearInterval(bootWatch);
        }, 800); // wait for select('Jaipur') animation to finish
    }
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
function finalizeSession() {
    // 1. Send data before wiping
    if (totalClicks > 0) {
        const payload = {
            location : KIOSK_LOCATION,
            clicks   : totalClicks,
            duration : startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(rawData)
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }

    // 2. Wipe all session data + engage blindfold
    isResetting         = true;
    totalClicks         = 0;
    rawData             = {};
    startTime           = null;
    lastInteractionTime = null;
    clearTimeout(idleTimer);
    idleTimer           = null;

    console.log('Tracker: idle timeout — resetting...');

    // 3. Kill any in-flight stream() animations by bumping currentToken
    //    select() checks this token and aborts if it has changed
    currentToken++;

    // 4. Snap map zoom/pan back to boot position — pure DOM, no events
    if (mover && bootTransform) {
        mover.style.transition = 'transform 0.6s ease-in-out';
        mover.style.transform  = bootTransform;
    }

    // 5. Use the map's own select() to properly reset data + sound + labels
    //    Wrapped in setTimeout so the token bump above has already killed
    //    any prior stream() before select() starts a fresh one
    setTimeout(() => {
        select(HOME_DISTRICT);

        // 6. Remove transition lock after animation so next zoom is responsive
        setTimeout(() => {
            if (mover) mover.style.transition = '';
            isResetting = false;
            console.log('Tracker: reset complete — ready.');
        }, 600);

    }, 50);
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
