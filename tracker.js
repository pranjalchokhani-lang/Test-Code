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
let isResetting         = true;   // locked until boot completes
let HOME_DISTRICT       = null;
const mover             = document.getElementById('map-mover');

// ─── IDLE TIMER LOGIC ─────────────────────────────────────────────────────────
// Separated so we can arm it directly after reset
// without needing a user interaction event
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
// isResetting=true from the very top — screen is locked until boot done.
// We wait for _mapReset (IIFE ran) AND path.on (select() fired).
// HOME_DISTRICT locked from that first path.on atomically.
// No user interaction possible until isResetting=false releases.
const bootWatch = setInterval(() => {
    if (typeof window._mapReset !== 'function') return;
    if (typeof window.mapApply  !== 'function') return;
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    HOME_DISTRICT = activePath.getAttribute('data-n');
    clearInterval(bootWatch);
    console.log('Tracker: HOME locked ->', HOME_DISTRICT);

    // Wait for boot select() animation to finish visually
    setTimeout(() => {
        isResetting = false;
        // Arm idle timer immediately — if nobody touches, still resets
        armIdleTimer();
        console.log('Tracker: boot complete, idle timer armed.');
    }, 1500);
}, 50);

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

    // 3. Kill any in-flight stream() instantly
    currentToken++;

    // 4. Reset zoom silently
    zoomSfx.volume = 0;
    window._mapReset();
    window.mapApply();
    setTimeout(() => { zoomSfx.volume = 0.15; }, 300);

    // 5. Reset district/data — reveal sound muted
    revealSfx.volume = 0;
    select(HOME_DISTRICT);
    setTimeout(() => { revealSfx.volume = 0.4; }, 300);

    // 6. Wait only for loading bar (900ms) + small buffer — 
    //    stream is already killed by currentToken++ above so no
    //    need to wait for all rows to finish typing
    await new Promise(res => setTimeout(res, 1400));

    // 7. Release shield
    isResetting = false;
    console.log('Tracker: reset complete — ready.');

    // 8. Re-arm idle timer so reset fires again even with zero interaction
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

// ─── INACTIVITY DETECTION — covers zoom, pan, drag, touch, scroll ─────────────
// Attached to BOTH document AND #map-viewport because the IIFE uses
// passive:false + preventDefault on viewport which can swallow document events
const viewport = document.getElementById('map-viewport');
const interactionEvents = ['touchstart','touchmove','pointerdown','wheel','mousemove'];

interactionEvents.forEach(ev => {
    // document level
    document.addEventListener(ev, () => { if (!isResetting) startSession(); }, { passive: true });
    // viewport level — catches events the IIFE may have stopped from bubbling
    if (viewport) {
        viewport.addEventListener(ev, () => { if (!isResetting) startSession(); }, { passive: true });
    }
});
