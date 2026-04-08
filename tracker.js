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
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";
const KIOSK_LOCATION = detectKioskLocation();
const IDLE_MS = 10000;

// ─── CAPTURE HOME DISTRICT DYNAMICALLY ───────────────────────────────────────
// Whatever district is .on at boot IS the home — don't hardcode it
let HOME_DISTRICT = null;
const mover = document.getElementById('map-mover');
let bootTransform = 'translate(0px, 0px) scale(1)';

const bootWatch = setInterval(() => {
    const activePath = document.querySelector('path.on');
    if (activePath && mover && mover.style.transform) {
        setTimeout(() => {
            HOME_DISTRICT = activePath.getAttribute('data-n');
            bootTransform = mover.style.transform;
            console.log('Tracker: home district ->', HOME_DISTRICT);
            console.log('Tracker: boot transform ->', bootTransform);
            clearInterval(bootWatch);
        }, 1200);
    }
}, 50);

// ─── REINJECT ZOOM/PAN IIFE ───────────────────────────────────────────────────
// The IIFE closes over scale/tx/ty — we can't reset them from outside.
// Solution: re-run the entire zoom/pan IIFE with fresh variables (scale=1,tx=0,ty=0).
// This replaces window.mapApply with a new closure that starts from zero.
// All existing event listeners on viewport are replaced cleanly.
function reinjectZoomIIFE() {
    const viewport = document.getElementById('map-viewport');
    if (!viewport || !mover) return;

    // Clone viewport to strip all old event listeners from the IIFE
    const newViewport = viewport.cloneNode(true);
    viewport.parentNode.replaceChild(newViewport, viewport);

    // Re-run the IIFE with scale=1, tx=0, ty=0 from scratch
    (function() {
        const vp = document.getElementById('map-viewport');
        const mv = document.getElementById('map-mover');
        let scale = 1, tx = 0, ty = 0;
        let lastDist = null, drag = false, sx = 0, sy = 0, stx = 0, sty = 0;

        function apply() {
            // Silent — no zoom sound during reinject
            mv.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
            document.querySelectorAll('.lbl').forEach(lbl => {
                const name = lbl.getAttribute('data-name');
                const c = centroids[name];
                if (scale > 1.6 || lbl.classList.contains('on') || lbl.classList.contains('hover-visible')) {
                    lbl.style.opacity = '1';
                } else {
                    lbl.style.opacity = '0';
                }
                if (c) {
                    const labelScale = Math.max(0.4, 1 / Math.pow(scale, 0.7));
                    lbl.setAttribute('transform', `translate(${c.cx},${c.cy}) scale(${labelScale}) translate(${-c.cx},${-c.cy})`);
                }
            });
        }

        vp.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = vp.getBoundingClientRect();
            const mx = e.clientX - rect.left, my = e.clientY - rect.top;
            const factor = e.deltaY < 0 ? 1.12 : 0.89;
            const ns = Math.min(12, Math.max(0.3, scale * factor));
            tx = mx - (mx - tx) * (ns / scale);
            ty = my - (my - ty) * (ns / scale);
            scale = ns;
            apply();
        }, { passive: false });

        vp.addEventListener('mousedown', e => {
            drag = true; sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
            vp.style.cursor = 'grabbing';
        });
        window.addEventListener('mousemove', e => {
            if (!drag) return;
            tx = stx + (e.clientX - sx);
            ty = sty + (e.clientY - sy);
            apply();
        });
        window.addEventListener('mouseup', () => { drag = false; vp.style.cursor = 'grab'; });

        vp.addEventListener('touchstart', e => {
            if (e.touches.length === 1) {
                drag = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; stx = tx; sty = ty;
            } else if (e.touches.length === 2) {
                lastDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        });

        vp.addEventListener('touchmove', e => {
            if (e.touches.length === 1 && drag) {
                tx = stx + (e.touches[0].clientX - sx);
                ty = sty + (e.touches[0].clientY - sy);
                apply();
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const t1 = e.touches[0], t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                const midX = (t1.clientX + t2.clientX) / 2;
                const midY = (t1.clientY + t2.clientY) / 2;
                if (lastDist) {
                    const rect = vp.getBoundingClientRect();
                    const mx = midX - rect.left, my = midY - rect.top;
                    const factor = dist / lastDist;
                    const ns = Math.min(12, Math.max(0.3, scale * factor));
                    tx = mx - (mx - tx) * (ns / scale);
                    ty = my - (my - ty) * (ns / scale);
                    scale = ns;
                    apply();
                }
                lastDist = dist;
            }
        }, { passive: false });

        vp.addEventListener('touchend', () => { drag = false; lastDist = null; });

        // Replace the old mapApply with this fresh closure
        window.mapApply = apply;

        // Apply once to sync DOM to scale=1,tx=0,ty=0
        apply();
    })();
}

// ─── SESSION STATE ────────────────────────────────────────────────────────────
let totalClicks         = 0;
let rawData             = {};
let startTime           = null;
let lastInteractionTime = null;
let idleTimer           = null;
let isResetting         = false;

// ─── SESSION ──────────────────────────────────────────────────────────────────
function startSession() {
    if (isResetting) return;
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, IDLE_MS);
}

// ─── RESET ────────────────────────────────────────────────────────────────────
async function finalizeSession() {
    if (isResetting) return;
    isResetting = true;
    clearTimeout(idleTimer);
    idleTimer = null;

    console.log('Tracker: idle timeout — resetting...');

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

    // 3. Reinject zoom IIFE — this resets scale/tx/ty to 0/0/1 internally
    //    AND replaces all old event listeners with fresh ones
    reinjectZoomIIFE();

    // 4. Reset data/labels/lists via select() with sounds muted
    revealSfx.volume = 0;
    zoomSfx.volume   = 0;
    select(HOME_DISTRICT);
    setTimeout(() => {
        revealSfx.volume = 0.4;
        zoomSfx.volume   = 0.15;
    }, 200);

    // 5. Hold shield until select() + stream() fully finishes
    const maxItems = Math.max(
        (typeof DATA !== 'undefined' && DATA[HOME_DISTRICT]) ? (DATA[HOME_DISTRICT].m || []).length : 0,
        (typeof DATA !== 'undefined' && DATA[HOME_DISTRICT]) ? (DATA[HOME_DISTRICT].e || []).length : 0
    );
    const waitMs = 900 + (maxItems * 650) + 500;
    await new Promise(res => setTimeout(res, waitMs));

    isResetting = false;
    console.log('Tracker: reset complete — ready.');
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
