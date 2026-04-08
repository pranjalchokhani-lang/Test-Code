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
const viewport          = document.getElementById('map-viewport');

// ─── RAF IDLE DETECTION — never throttled by browser ─────────────────────────
let rafId = null;

function startRAF() {
    if (rafId) return;
    function tick() {
        if (!isResetting && lastInteractionTime !== null) {
            const elapsed = Date.now() - lastInteractionTime;
            if (elapsed >= IDLE_MS) {
                lastInteractionTime = null;
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

function armRAF() {
    stopRAF();
    startRAF();
}

// ─── SESSION ──────────────────────────────────────────────────────────────────
function startSession() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
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

    // Wrap mapApply so every zoom/pan registers as activity
    const _origApply = window.mapApply;
    window.mapApply = function() {
        _origApply();
        if (!isResetting) startSession();
    };

    setTimeout(() => {
        isResetting = false;
        lastInteractionTime = Date.now();
        startRAF();
        console.log('Tracker: boot complete. Idle detection running.');
    }, 1500);
}, 50);

// ─── ACTIVITY WATCHER ─────────────────────────────────────────────────────────
// MutationObserver watches DOM directly — catches zoom/pan/clicks
// on both touchscreen and laptop without relying on event bubbling
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

    console.log('Tracker: resetting...');

    // 1. Capture duration BEFORE wiping anything
    var sessionDuration = (startTime && lastInteractionTime)
        ? Math.floor((lastInteractionTime - startTime) / 1000)
        : 0;
    if (sessionDuration < 0) sessionDuration = 0;

    console.log('Tracker: duration ->', sessionDuration, 'sec | clicks ->', totalClicks);

    // 2. Send data — send even if zero clicks as long as there was time
    if (totalClicks > 0 || sessionDuration > 0) {
        const payload = {
            location : KIOSK_LOCATION,
            clicks   : totalClicks,
            duration : sessionDuration,
            breakdown: JSON.stringify(rawData)
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
        console.log('Tracker: beacon sent ->', payload);
    }

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

    // 7. Release immediately
    isResetting = false;
    console.log('Tracker: reset complete — ready.');

    // 8. Restart RAF for next session
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

// Touchscreen taps
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

// Laptop interactions
document.addEventListener('mousemove', () => { if (!isResetting) startSession(); }, { passive: true });
document.addEventListener('wheel',     () => { if (!isResetting) startSession(); }, { passive: true });

// Viewport level — catches events IIFE may have stopped from bubbling
if (viewport) {
    viewport.addEventListener('touchstart',  () => { if (!isResetting) startSession(); }, { passive: true });
    viewport.addEventListener('wheel',       () => { if (!isResetting) startSession(); }, { passive: true });
    viewport.addEventListener('pointerdown', () => { if (!isResetting) startSession(); }, { passive: true });
}

// Start activity watcher after a short delay to let map fully render
setTimeout(startActivityWatcher, 2000);
