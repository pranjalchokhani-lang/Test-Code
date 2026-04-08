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
const HOME_DISTRICT  = 'Jaipur';

// ─── SESSION STATE ────────────────────────────────────────────────────────────
let totalClicks         = 0;
let rawData             = {};
let startTime           = null;
let lastInteractionTime = null;
let idleTimer           = null;
let isResetting         = false;

// ─── INTERCEPT THE IIFE TO STEAL RESET ACCESS ────────────────────────────────
// The map IIFE exposes window.mapApply but not scale/tx/ty.
// We patch the mover's style.transform setter to stay in sync,
// so we always know the real home state after boot.
let bootTransform = null;
const mover = document.getElementById('map-mover');

// Wait for the IIFE to finish its first apply() call, then lock the home transform
const bootWatch = setInterval(() => {
    if (mover && mover.style.transform && mover.style.transform !== '') {
        // Give it one extra tick to settle after select('Jaipur') runs
        setTimeout(() => {
            bootTransform = mover.style.transform;
            console.log('Tracker: boot transform locked ->', bootTransform);
            clearInterval(bootWatch);
        }, 800);
    }
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
function finalizeSession() {
    // 1. Send data before wiping
    if (totalClicks > 0) {
        const payload = {
            location : KIOSK_LOCATION,
            clicks   : totalClicks,
            duration : startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(rawData)
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }

    // 2. Wipe all session data
    isResetting         = true;
    totalClicks         = 0;
    rawData             = {};
    startTime           = null;
    lastInteractionTime = null;
    clearTimeout(idleTimer);
    idleTimer           = null;

    console.log('Tracker: idle timeout — resetting...');

    // 3. Snap map back to boot position using the locked transform
    //    This sets the DOM directly — no events fired, no reload risk.
    //    The IIFE's internal scale/tx/ty will re-sync on next user interaction.
    if (mover && bootTransform) {
        mover.style.transition = 'transform 0.6s ease-in-out';
        mover.style.transform  = bootTransform;
    }

    // 4. Reset right panel
    const ctag = document.getElementById('ctag');
    const medList = document.getElementById('med-list');
    const engList = document.getElementById('eng-list');
    const medLoading = document.getElementById('med-loading');
    const engLoading = document.getElementById('eng-loading');

    if (ctag) ctag.innerText = 'SELECT A DISTRICT';
    if (medList) medList.innerHTML = '';
    if (engList) engList.innerHTML = '';
    if (medLoading) { medLoading.style.display = 'none'; medLoading.classList.remove('active'); }
    if (engLoading) { engLoading.style.display = 'none'; engLoading.classList.remove('active'); }

    // 5. Remove pulse rings
    document.querySelectorAll('.pulse-ring').forEach(e => e.remove());

    // 6. Silently swap highlight back to home district — zero events fired
    setTimeout(() => {
        document.querySelectorAll('.dist.on').forEach(p => p.classList.remove('on'));
        document.querySelectorAll('.lbl.on, .lbl.hover-visible').forEach(l => {
            l.classList.remove('on');
            l.classList.remove('hover-visible');
        });

        const home = document.querySelector(`[data-n="${HOME_DISTRICT}"]`);
        if (home) home.classList.add('on');
        const homeLbl = document.getElementById('l-' + HOME_DISTRICT.replace(/\s/g, '_'));
        if (homeLbl) homeLbl.classList.add('on');

        // Remove transition lock so next zoom is responsive
        setTimeout(() => {
            if (mover) mover.style.transition = '';
            isResetting = false;
            console.log('Tracker: reset complete — ready.');
        }, 600);

    }, 600);
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
