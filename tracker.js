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
    // Count touchscreen district taps
    const target = e.target.closest('path, polygon, circle, rect');
    if (target) {
        totalClicks++;
        const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
        const idx = allShapes.indexOf(target);
        rawData[idx] = (rawData[idx] || 0) + 1;
    }
    // Always start session on any touch — tap, drag, pinch, anything
    startSession();
}, { passive: true });

// Laptop — movement or scroll restarts idle timer
document.addEventListener('mousemove', () => {
    if (!isResetting) startSession();
}, { passive: true });

document.addEventListener('wheel', () => {
    if (!isResetting) startSession();
}, { passive: true });
