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
const mover             = document.getElementById('map-mover');

// ─── IDLE DETECTION VIA RAF — never throttled by browser ─────────────────────
// Instead of setTimeout (which browser throttles 10x on idle tabs),
// we use requestAnimationFrame to poll Date.now() continuously.
// rAF runs at screen refresh rate and is never throttled for idle detection.
let rafId = null;

function startRAF() {
    if (rafId) return; // already running
    function tick() {
        if (!isResetting && lastInteractionTime !== null) {
            const elapsed = Date.now() - lastInteractionTime;
            if (elapsed >= IDLE_MS) {
                lastInteractionTime = null; // prevent double-fire
                finalizeSession();
                return; // stop RAF during reset — armRAF() restarts it after
            }
        }
        rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
}

function stopRAF() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function armRAF() {
    stopRAF();
    startRAF();
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
function startSession() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    // RAF loop is already running — it will detect idleness automatically
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
        // Wrap mapApply so every zoom/pan registers as activity
        const _origApply = window.mapApply;
        window.mapApply = function() {
            _origApply();
            if (!isResetting) startSession();
        };

        isResetting = false;
        lastInteractionTime = Date.now(); // start idle clock from boot
        startRAF();
        console.log('Tracker: boot complete. RAF idle detection running.');
    }, 1500);
}, 50);

// ─── RESET ────────────────────────────────────────────────────────────────────
function finalizeSession() {
    console.log('finalizeSession fired — isResetting:', isResetting);
    if (isResetting) return;
    isResetting = true;
    stopRAF();

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

    // 4. Reset zoom silently
    zoomSfx.volume = 0;
    window._mapReset();
    window.mapApply();
    zoomSfx.volume = 0.15;

    // 5. Reset district/data silently
    revealSfx.volume = 0;
    select(HOME_DISTRICT);
    revealSfx.volume = 0.4;

    // 6. Release immediately — no setTimeout needed
    isResetting = false;
    console.log('Tracker: reset complete — ready.');

    // 7. Restart RAF for next session
    lastInteractionTime = Date.now();
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

// ─── ALL INTERACTION TYPES ────────────────────────────────────────────────────
// touchstart  — any finger contact on touchscreen (tap, drag, pinch)
// mousemove   — laptop mouse movement
// wheel       — laptop scroll/zoom
// pointerdown — covers both mouse and touch pointer events
document.addEventListener('touchstart',  () => { if (!isResetting) startSession(); }, { passive: true });
document.addEventListener('mousemove',   () => { if (!isResetting) startSession(); }, { passive: true });
document.addEventListener('wheel',       () => { if (!isResetting) startSession(); }, { passive: true });
document.addEventListener('pointerdown', () => { if (!isResetting) startSession(); }, { passive: true });

// Also attach directly to viewport — IIFE uses preventDefault which
// can stop events reaching document on some browsers
const _vp = document.getElementById('map-viewport');
if (_vp) {
    _vp.addEventListener('touchstart',  () => { if (!isResetting) startSession(); }, { passive: true });
    _vp.addEventListener('wheel',       () => { if (!isResetting) startSession(); }, { passive: true });
    _vp.addEventListener('pointerdown', () => { if (!isResetting) startSession(); }, { passive: true });
}
