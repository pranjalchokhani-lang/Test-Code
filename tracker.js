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
let isResetting         = true;
let HOME_DISTRICT       = null;
const mover             = document.getElementById('map-mover');
const viewport          = document.getElementById('map-viewport');

// ─── IDLE TIMER ───────────────────────────────────────────────────────────────
function armIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, IDLE_MS);
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
function startSession() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    armIdleTimer();
}

// ─── BOOT WATCH ───────────────────────────────────────────────────────────────
const bootWatch = setInterval(() => {
    if (typeof window._mapReset !== 'function') return;
    if (typeof window.mapApply  !== 'function') return;
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    HOME_DISTRICT = activePath.getAttribute('data-n');
    clearInterval(bootWatch);
    console.log('Tracker: HOME locked ->', HOME_DISTRICT);

    setTimeout(() => {
        isResetting = false;
        armIdleTimer();
        startActivityWatcher();
        console.log('Tracker: boot complete.');
    }, 1500);
}, 50);

// ─── ACTIVITY WATCHER ─────────────────────────────────────────────────────────
// MutationObserver watches DOM changes directly — works on both
// touchscreen and laptop without relying on event bubbling
function startActivityWatcher() {
    // Watch map-mover transform — catches all zoom and pan
    if (mover) {
        new MutationObserver(() => {
            if (!isResetting) startSession();
        }).observe(mover, { attributes: true, attributeFilter: ['style'] });
    }

    // Watch SVG paths — catches district clicks
    const svg = document.getElementById('rj');
    if (svg) {
        new MutationObserver(() => {
            if (!isResetting) startSession();
        }).observe(svg, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }

    // Watch right panel — catches data loading
    const rightPanel = document.querySelector('.right-panel');
    if (rightPanel) {
        new MutationObserver(() => {
            if (!isResetting) startSession();
        }).observe(rightPanel, { childList: true, subtree: true, characterData: true });
    }

    console.log('Tracker: activity watcher running.');
}

// ─── RESET ────────────────────────────────────────────────────────────────────
// Plain synchronous function — no async/await, no setTimeout for release.
// Browser throttles setTimeout on idle tabs causing 10x delays.
// select() fires synchronously up to its first await so lists/ctag
// are cleared instantly. Stream runs in background, killed by currentToken++.
function finalizeSession() {
    console.log('finalizeSession fired — isResetting:', isResetting);
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

    // 3. Kill any in-flight stream instantly
    currentToken++;

    // 4. Reset zoom — silence zoom sound, reset vars, sync DOM
    zoomSfx.volume = 0;
    window._mapReset();
    window.mapApply();
    zoomSfx.volume = 0.15;

    // 5. Reset district/data — silence reveal sound
    revealSfx.volume = 0;
    select(HOME_DISTRICT);
    revealSfx.volume = 0.4;

    // 6. Release shield immediately — no setTimeout
    //    select() has synchronously cleared lists + ctag + started
    //    loading animation before its first await. Stream is already
    //    killed. Nothing left to wait for.
    isResetting = false;
    console.log('Tracker: reset complete — ready.');

    // 7. Re-arm idle timer for next session
    armIdleTimer();
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

// Touchscreen district taps
document.addEventListener('touchstart', (e) => {
    if (isResetting) return;
    const target = e.target.closest('path, polygon, circle, rect');
    if (target) {
        totalClicks++;
        const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
        const idx = allShapes.indexOf(target);
        rawData[idx] = (rawData[idx] || 0) + 1;
    }
    startSession();
}, { passive: true });

// Laptop — mouse movement or scroll
document.addEventListener('mousemove', () => {
    if (!isResetting) startSession();
}, { passive: true });

document.addEventListener('wheel', () => {
    if (!isResetting) startSession();
}, { passive: true });
