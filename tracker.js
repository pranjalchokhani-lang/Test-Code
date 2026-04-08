// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)

// --- ENHANCED LOCATION PROFILING ---
// Pulls from every available address source and picks the best one
function detectKioskLocation() {
    const sources = [];

    // 1. Filename (last path segment, no extension)
    const filename = window.location.pathname.split("/").pop().split(".")[0].trim();
    if (filename) sources.push(filename);

    // 2. All URL path segments (folder names, directory names)
    const pathSegments = window.location.pathname
        .split("/")
        .map(s => s.trim())
        .filter(s => s.length > 0 && s !== filename); // exclude filename already captured
    sources.push(...pathSegments);

    // 3. URL query params (e.g. ?location=HALL_A or ?kiosk=ROOM2)
    const params = new URLSearchParams(window.location.search);
    for (const [, val] of params.entries()) {
        if (val.trim()) sources.push(val.trim());
    }

    // 4. URL hash (e.g. #KIOSK_B)
    const hash = window.location.hash.replace('#', '').trim();
    if (hash) sources.push(hash);

    // 5. Page title
    if (document.title) sources.push(document.title.trim());

    // 6. <meta name="kiosk-location" content="..."> tag
    const metaTag = document.querySelector('meta[name="kiosk-location"]');
    if (metaTag) sources.push(metaTag.getAttribute('content').trim());

    // 7. data-location attribute on <body>
    const bodyAttr = document.body.getAttribute('data-location');
    if (bodyAttr) sources.push(bodyAttr.trim());

    // Pick the first source that isn't a generic/meaningless value
    const genericValues = new Set(['index', 'home', 'main', 'default', 'page', 'app', 'www', '']);
    for (const src of sources) {
        const normalized = src.toUpperCase().replace(/[^A-Z0-9_\-]/g, '_');
        if (!genericValues.has(src.toLowerCase()) && normalized.length > 0) {
            return normalized;
        }
    }
    return "UNKNOWN";
}

const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";
const KIOSK_LOCATION = detectKioskLocation();

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;

// 1. ENGAGE SOFTWARE SHIELD ON BOOT (Ignores all tracking)
let isResetting = true;

// 2. ENGAGE PHYSICAL SHIELD ON BOOT (Blocks all human touches)
document.body.style.pointerEvents = 'none';

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";
let mapSvg = null;
let mapGroup = null;
let initialViewBox = null;
let initialTransform = null;

// 3. RAPID-FIRE 0th STATE SCANNER
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on');

    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');

        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');

        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

        console.log("Tracker: 0th state locked ->", homeDistrictName, "| Location:", KIOSK_LOCATION);

        // 4. DROP BOTH SHIELDS
        clearInterval(bootScan);
        document.body.style.pointerEvents = 'auto';
        isResetting = false;
    }
}, 100);

function finalizeSession() {
    // 1. SEND DATA (before wiping it)
    if (totalClicks > 0 && !isResetting) {
        const payload = {
            location: KIOSK_LOCATION,
            clicks: totalClicks,
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(rawData)
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }

    // 2. ENGAGE BLINDFOLD + FULL DATA RESET (all tracking state wiped)
    isResetting = true;
    totalClicks = 0;
    rawData = {};
    startTime = null;
    lastInteractionTime = null;
    clearTimeout(idleTimer); // cancel any pending idle timer

    console.log("Tracker: 10s idle. Executing zero-reload align & reset...");

    // 3. TRIGGER NATIVE ZOOM-OUT (unclick the open district)
    const currentlyActivePath = document.querySelector('path.on');
    if (currentlyActivePath) {
        const opt = { bubbles: true, cancelable: true, view: window };
        currentlyActivePath.dispatchEvent(new MouseEvent('pointerdown', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('mousedown', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('pointerup', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('mouseup', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('click', opt));
    }

    // 4. FORCE VISUAL ALIGNMENT
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.5s ease-in-out";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.5s ease-in-out";
        mapGroup.setAttribute('transform', initialTransform);
    }

    // 5. SILENT CSS HIGHLIGHT (paint 0th district without triggering zoom)
    setTimeout(() => {
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));

        if (homeDistrictName) {
            const targetShape = document.querySelector(`path[data-n="${homeDistrictName}"]`);
            if (targetShape) targetShape.classList.add('on');
        }

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            isResetting = false; // DROP BLINDFOLD — kiosk ready for next student
            console.log("Tracker: Reset complete. Ready.");
        }, 500);

    }, 600);
}

function startSession() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000);
}

// CAPTURE CLICKS (shape-specific, increments rawData)
document.addEventListener('mousedown', function(e) {
    if (isResetting) return;
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    startSession();
    totalClicks++;

    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

// SESSION KEEPALIVE — any interaction after 10s idle restarts the session
// This covers taps, scrolls, drags, pointer movement, and touch gestures
['touchstart', 'pointerdown', 'wheel', 'touchmove', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, () => {
        if (!isResetting) startSession();
    }, { passive: true });
});
