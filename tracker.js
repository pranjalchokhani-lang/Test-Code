// ─── RELOAD DETECTOR — paste this at the very top, before everything else ───

// Intercept any attempt to navigate / reload
window.addEventListener('beforeunload', (e) => {
    console.error('TRACKER: beforeunload fired — something is trying to reload!');
    console.trace(); // shows the exact call stack
});

// Intercept location changes
const _origAssign   = window.location.assign.bind(window.location);
const _origReplace  = window.location.replace.bind(window.location);
window.location.assign  = (...a) => { console.error('location.assign called',  a); console.trace(); _origAssign(...a); };
window.location.replace = (...a) => { console.error('location.replace called', a); console.trace(); _origReplace(...a); };

// Intercept history pushes (SPA routers use this)
const _origPush    = history.pushState.bind(history);
const _origReplace2= history.replaceState.bind(history);
history.pushState    = (...a) => { console.log('history.pushState',    a); console.trace(); _origPush(...a); };
history.replaceState = (...a) => { console.log('history.replaceState', a); console.trace(); _origReplace2(...a); };

// Catch any <a> clicks that might be causing navigation
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
        console.warn('TRACKER: <a> clicked — href:', link.href, '| target:', link.target);
        console.trace();
    }
}, true); // capture phase — fires before anything else
// ─── LOCATION PROFILING ───────────────────────────────────────────────────────
function detectKioskLocation() {
    const generic = new Set(['index','home','main','default','page','app','www','']);
    const candidates = [];

    // 1. Query params (?location=HALL_A, ?kiosk=ROOM2, etc.)
    new URLSearchParams(window.location.search).forEach((val) => {
        if (val.trim()) candidates.push(val.trim());
    });

    // 2. Hash (#KIOSK_B)
    const hash = window.location.hash.replace('#','').trim();
    if (hash) candidates.push(hash);

    // 3. Filename (last path segment, no extension)
    const filename = window.location.pathname.split('/').pop().split('.')[0].trim();
    if (filename) candidates.push(filename);

    // 4. All folder/directory segments in the path
    window.location.pathname.split('/').slice(0,-1).forEach(seg => {
        if (seg.trim()) candidates.push(seg.trim());
    });

    // 5. <meta name="kiosk-location" content="...">
    const meta = document.querySelector('meta[name="kiosk-location"]');
    if (meta?.content) candidates.push(meta.content.trim());

    // 6. data-location on <body>
    const bodyLoc = document.body.getAttribute('data-location');
    if (bodyLoc) candidates.push(bodyLoc.trim());

    // 7. Page title (last resort)
    if (document.title) candidates.push(document.title.trim());

    for (const src of candidates) {
        const normalized = src.toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
        if (!generic.has(src.toLowerCase()) && normalized.length > 0) return normalized;
    }
    return 'UNKNOWN';
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const scriptUrl   = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";
const KIOSK_LOCATION = detectKioskLocation();
const IDLE_MS     = 10000;

// ─── SESSION STATE ────────────────────────────────────────────────────────────
let totalClicks        = 0;
let rawData            = {};
let startTime          = null;
let lastInteractionTime= null;
let idleTimer          = null;

// ─── SHIELDS ──────────────────────────────────────────────────────────────────
let isResetting = true;                      // software shield  (ignores events)
document.body.style.pointerEvents = 'none';  // physical shield  (blocks touches)

// ─── 0th STATE VAULT ─────────────────────────────────────────────────────────
let homeDistrictName = '';
let mapSvg           = null;
let mapGroup         = null;
let initialViewBox   = null;
let initialTransform = null;

// ─── BOOT SCANNER ─────────────────────────────────────────────────────────────
// Waits for the map to settle into its default state, then locks everything.
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on');
    if (!activePath) return;

    homeDistrictName = activePath.getAttribute('data-n');
    mapSvg           = activePath.closest('svg')   || document.querySelector('svg');
    mapGroup         = activePath.closest('g')     || document.querySelector('svg > g');
    if (mapSvg)   initialViewBox   = mapSvg.getAttribute('viewBox');
    if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

    console.log(`Tracker: 0th state locked | district="${homeDistrictName}" | location="${KIOSK_LOCATION}"`);

    clearInterval(bootScan);
    document.body.style.pointerEvents = 'auto';
    isResetting = false;
}, 100);

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
    // 1. Transmit data before wiping
    if (totalClicks > 0) {
        const payload = {
            location : KIOSK_LOCATION,
            clicks   : totalClicks,
            duration : startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(rawData)
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }

    // 2. Wipe ALL session data + engage blindfold
    isResetting         = true;
    totalClicks         = 0;
    rawData             = {};
    startTime           = null;
    lastInteractionTime = null;
    clearTimeout(idleTimer);
    idleTimer           = null;

    console.log('Tracker: idle timeout — resetting...');

    // 3. Restore map zoom / pan / viewBox to original state
    //    NO synthetic clicks — those bubble into the map's router and cause reloads.
    //    We manipulate the SVG attributes directly instead.
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = 'all 0.5s ease-in-out';
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = 'transform 0.5s ease-in-out';
        mapGroup.setAttribute('transform', initialTransform);
    }

    // 4. After zoom animation settles, swap the .on class silently
    setTimeout(() => {
        // Strip highlight from whatever district the student left on
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));

        // Re-paint the home district WITHOUT dispatching any events
        if (homeDistrictName) {
            const home = document.querySelector(`path[data-n="${homeDistrictName}"]`);
            if (home) home.classList.add('on');
        }

        // 5. Clean up transitions so next student's zoom works normally
        setTimeout(() => {
            if (mapSvg)   mapSvg.style.transition   = '';
            if (mapGroup) mapGroup.style.transition  = '';
            isResetting = false;
            console.log('Tracker: reset complete — ready for next user.');
        }, 500);

    }, 600);
}

// ─── CLICK TRACKING ───────────────────────────────────────────────────────────
// Records which shape was clicked and increments the counter.
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

// ─── SESSION KEEPALIVE ────────────────────────────────────────────────────────
// Any touch/gesture/scroll after 10 s of inactivity restarts the session timer.
// This covers taps, drags, pinch-zoom, scroll wheel — not just shape clicks.
['touchstart', 'pointerdown', 'wheel', 'touchmove', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, () => { if (!isResetting) startSession(); }, { passive: true });
});
