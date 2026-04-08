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

// ─── SESSION STATE ────────────────────────────────────────────────────────────
let totalClicks         = 0;
let rawData             = {};
let startTime           = null;
let lastInteractionTime = null;
let idleTimer           = null;
let isResetting         = false;
let HOME_DISTRICT       = null;
const mover             = document.getElementById('map-mover');

// ─── BOOT WATCH — waits for HTML script to finish, locks home once only ───────
const bootWatch = setInterval(() => {
    // Wait until _mapReset AND mapApply AND an active path all exist
    if (typeof window._mapReset !== 'function') return;
    if (typeof window.mapApply  !== 'function') return;
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    // Everything ready — stop watching immediately
    clearInterval(bootWatch);

    // Grace period for select() boot animation to finish
    setTimeout(() => {
        HOME_DISTRICT = activePath.getAttribute('data-n');
        console.log('Tracker: home district LOCKED ->', HOME_DISTRICT);
        console.log('Tracker: _mapReset ready ->', typeof window._mapReset);
    }, 1200);
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

    // 3. Reset internal scale/tx/ty then sync DOM — muted
    zoomSfx.volume = 0;
    window._mapReset();  // sets scale=1, tx=0, ty=0 inside the closure
    window.mapApply();   // writes translate(0px,0px) scale(1) to DOM
    setTimeout(() => { zoomSfx.volume = 0.15; }, 200);

    // 4. Reset data/labels/lists via select() — reveal sound muted
    revealSfx.volume = 0;
    select(HOME_DISTRICT);
    setTimeout(() => { revealSfx.volume = 0.4; }, 200);

    // 5. Hold shield until select() + stream() fully finishes
    const maxItems = Math.max(
        (typeof DATA !== 'undefined' && DATA[HOME_DISTRICT]) ? (DATA[HOME_DISTRICT].m || []).length : 0,
        (typeof DATA !== 'undefined' && DATA[HOME_DISTRICT]) ? (DATA[HOME_DISTRICT].e || []).length : 0
    );
    const waitMs = 900 + (maxItems * 650) + 500;
    await new Promise(res => setTimeout(res, waitMs));

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
