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
function startActivityWatcher() {
    if (mover) {
        new MutationObserver(() => {
            if (!isResetting) startSession();
        }).observe(mover, { attributes: true, attributeFilter: ['style'] });
    }
    const svg = document.getElementById('rj');
    if (svg) {
        new MutationObserver(() => {
            if (!isResetting) startSession();
        }).observe(svg, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
    const rightPanel = document.querySelector('.right-panel');
    if (rightPanel) {
        new MutationObserver(() => {
            if (!isResetting) startSession();
        }).observe(rightPanel, { childList: true, subtree: true, characterData: true });
    }
    console.log('Tracker: activity watcher running.');
}

// ─── RESET — no async/await, plain setTimeout chain ──────────────────────────
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

    // 3. Kill in-flight stream
    currentToken++;

    // 4. Reset zoom silently
    zoomSfx.volume = 0;
    window._mapReset();
    window.mapApply();

    // 5. Reset district/data — reveal sound muted
    revealSfx.volume = 0;
    select(HOME_DISTRICT);

    // 6. After 300ms restore sounds
    setTimeout(() => {
        zoomSfx.volume   = 0.15;
        revealSfx.volume = 0.4;
    }, 300);

    // 7. After 1400ms release shield + re-arm — plain setTimeout, no await
    setTimeout(() => {
        isResetting = false;
        console.log('Tracker: reset complete — ready.');
        armIdleTimer();
    }, 1400);
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

document.addEventListener('mousemove', () => {
    if (!isResetting) startSession();
}, { passive: true });

document.addEventListener('wheel', () => {
    if (!isResetting) startSession();
}, { passive: true });
