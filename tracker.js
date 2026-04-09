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
let isResetting         = true;
let HOME_DISTRICT       = null;
let idleTimer           = null;
const mover             = document.getElementById('map-mover');
const viewport          = document.getElementById('map-viewport');

// ─── IDLE TIMER ───────────────────────────────────────────────────────────────
// Plain setTimeout — restarted on EVERY interaction.
// When it fires after 10s of silence → reset.
function resetIdleTimer() {
    if (isResetting) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, IDLE_MS);
}

// ─── ON ANY INTERACTION ───────────────────────────────────────────────────────
// Called for every touch, move, zoom, pan, click — anything at all.
// Starts the session clock on first interaction, resets idle timer on every one.
function onInteraction() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    resetIdleTimer();
}

// ─── BOOT WATCH ───────────────────────────────────────────────────────────────
const bootWatch = setInterval(() => {
    if (typeof window._mapReset !== 'function') return;
    if (typeof window.mapApply  !== 'function') return;
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    HOME_DISTRICT = activePath.getAttribute('data-n');
    clearInterval(bootWatch);
    console.log('Tracker: HOME locked ->', HOME_DISTRICT, '| Location:', KIOSK_LOCATION);

    // Wrap mapApply — every zoom/pan calls this → onInteraction fires
    const _origApply = window.mapApply;
    window.mapApply = function() {
        _origApply();
        onInteraction();
    };

    setTimeout(() => {
        isResetting = false;
        console.log('Tracker: ready.');
    }, 1500);
}, 50);

// ─── RESET ────────────────────────────────────────────────────────────────────
function finalizeSession() {
    if (isResetting) return;
    isResetting = true;
    clearTimeout(idleTimer);

    // 1. Capture duration
    var sessionDuration = (startTime && lastInteractionTime)
        ? Math.floor((lastInteractionTime - startTime) / 1000)
        : 0;
    if (sessionDuration < 0) sessionDuration = 0;

    console.log('Tracker: session ended | duration:', sessionDuration, '| clicks:', totalClicks);

    // 2. Always send — zero-click sessions are valid
    navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify({
        location : KIOSK_LOCATION,
        clicks   : totalClicks,
        duration : sessionDuration,
        breakdown: JSON.stringify(rawData)
    })], { type: 'text/plain' }));

    // 3. Wipe
    totalClicks         = 0;
    rawData             = {};
    startTime           = null;
    lastInteractionTime = null;

    // 4. Kill stream
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

    // 7. Release
    isResetting = false;
    console.log('Tracker: reset complete.');
}

// ─── CLICK TRACKING ───────────────────────────────────────────────────────────
document.addEventListener('mousedown', (e) => {
    if (isResetting) return;
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;
    onInteraction();
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
    onInteraction();
}, { passive: true });

// Every other interaction type — all call onInteraction()
document.addEventListener('mousemove',   () => onInteraction(), { passive: true });
document.addEventListener('wheel',       () => onInteraction(), { passive: true });
document.addEventListener('pointerdown', () => onInteraction(), { passive: true });

if (viewport) {
    viewport.addEventListener('touchstart',  () => onInteraction(), { passive: true });
    viewport.addEventListener('touchmove',   () => onInteraction(), { passive: true });
    viewport.addEventListener('wheel',       () => onInteraction(), { passive: true });
    viewport.addEventListener('pointerdown', () => onInteraction(), { passive: true });
}
