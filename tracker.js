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
let lastInteractionTime = null; // null = no active session
let isResetting         = true;
let HOME_DISTRICT       = null;
const mover             = document.getElementById('map-mover');
const viewport          = document.getElementById('map-viewport');

// ─── RAF IDLE DETECTION — never throttled by browser ─────────────────────────
// Polls Date.now() on every frame — fires finalizeSession exactly at 10s
// lastInteractionTime === null means no active session, RAF just loops silently
let rafId = null;

function startRAF() {
    if (rafId) return;
    function tick() {
        if (!isResetting && lastInteractionTime !== null) {
            const elapsed = Date.now() - lastInteractionTime;
            if (elapsed >= IDLE_MS) {
                lastInteractionTime = null; // prevent double-fire
                finalizeSession();
                return;
            }
        }
        rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
}

function stopRAF() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
// Called on ANY interaction — touch, move, zoom, pan, click
// Sets startTime on first interaction, updates lastInteractionTime on every one
function startSession() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
}

// ─── BOOT WATCH ───────────────────────────────────────────────────────────────
// isResetting=true from top — screen fully locked until map is ready
// HOME_DISTRICT locked from very first path.on before any user can interact
const bootWatch = setInterval(() => {
    if (typeof window._mapReset !== 'function') return;
    if (typeof window.mapApply  !== 'function') return;
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    HOME_DISTRICT = activePath.getAttribute('data-n');
    clearInterval(bootWatch);
    console.log('Tracker: HOME locked ->', HOME_DISTRICT, '| Location:', KIOSK_LOCATION);

    // Wrap mapApply so every zoom/pan registers as activity
    const _origApply = window.mapApply;
    window.mapApply = function() {
        _origApply();
        if (!isResetting) startSession();
    };

    setTimeout(() => {
        isResetting = false;
        // DO NOT set lastInteractionTime here — wait for real user interaction
        startRAF();
        console.log('Tracker: boot complete. Waiting for first interaction.');
    }, 1500);
}, 50);

// ─── ACTIVITY WATCHER ─────────────────────────────────────────────────────────
// MutationObserver watches DOM directly — catches zoom/pan/clicks
// Works on both touchscreen and laptop without relying on event bubbling
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
}

// ─── RESET ────────────────────────────────────────────────────────────────────
function finalizeSession() {
    console.log('finalizeSession fired — isResetting:', isResetting);
    if (isResetting) return;
    isResetting = true;
    stopRAF();

    console.log('Tracker: resetting... duration:', 
        startTime && lastInteractionTime 
            ? Math.floor((lastInteractionTime - startTime) / 1000) 
            : 0, 
        'sec | clicks:', totalClicks);

    // 1. Capture duration BEFORE wiping — always non-negative
    var sessionDuration = (startTime && lastInteractionTime)
        ? Math.floor((lastInteractionTime - startTime) / 1000)
        : 0;
    if (sessionDuration < 0) sessionDuration = 0;

    // 2. ALWAYS send — zero-click sessions are valid data
    //    clicks=0 means student zoomed/panned/touched but never tapped a district
    const payload = {
        location : KIOSK_LOCATION,
        clicks   : totalClicks,
        duration : sessionDuration,
        breakdown: JSON.stringify(rawData)
    };
    navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    console.log('Tracker: beacon sent ->', payload);

    // 3. Wipe counters AFTER sending
    totalClicks         = 0;
    rawData             = {};
    startTime           = null;
    lastInteractionTime = null;

    // 4. Kill any in-flight stream instantly
    currentToken++;

    // 5. Reset zoom silently
    zoomSfx.volume = 0;
    window._mapReset();
    window.mapApply();
    zoomSfx.volume = 0.15;

    // 6. Reset district silently
    revealSfx.volume = 0;
    select(HOME_DISTRICT);
    revealSfx.volume = 0.4;

    // 7. Release shield immediately
    isResetting = false;
    console.log('Tracker: reset complete — ready for next student.');

    // 8. Restart RAF but DO NOT set lastInteractionTime
    //    Session only begins when next student actually interacts
    //    RAF loops silently until then
    startRAF();
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

// Touchscreen — any finger contact starts session + counts district taps
document.addEventListener('touchstart', (e) => {
    if (isResetting) return;
    const target = e.target.closest('path, polygon, circle, rect');
    if (target) {
        totalClicks++;
        const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
        const idx = allShapes.indexOf(target);
        rawData[idx] = (rawData[idx] || 0) + 1;
    }
    startSession(); // ANY touch — tap, drag, pinch — starts/extends session
}, { passive: true });

// Laptop — any mouse movement or scroll starts/extends session
document.addEventListener('mousemove', () => { if (!isResetting) startSession(); }, { passive: true });
document.addEventListener('wheel',     () => { if (!isResetting) startSession(); }, { passive: true });

// Viewport level — catches events IIFE may have stopped from bubbling
if (viewport) {
    viewport.addEventListener('touchstart',  () => { if (!isResetting) startSession(); }, { passive: true });
    viewport.addEventListener('wheel',       () => { if (!isResetting) startSession(); }, { passive: true });
    viewport.addEventListener('pointerdown', () => { if (!isResetting) startSession(); }, { passive: true });
}

// Start activity watcher after map fully renders
setTimeout(startActivityWatcher, 2000);
