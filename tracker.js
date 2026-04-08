const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 

// 1. INJECT FADE CSS FOR SEAMLESS RELOAD
const style = document.createElement('style');
style.innerHTML = `
    body { transition: opacity 0.4s ease-in-out; opacity: 0; }
    body.ready { opacity: 1; }
`;
document.head.appendChild(style);

window.addEventListener('load', () => {
    document.body.classList.add('ready'); // Fade in on load
});

function finalizeSession() {
    // 1. Send data only if valid clicks exist and we are NOT resetting
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. ENGAGE LOCK
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Executing Seamless Soft Reload...");

    // 3. FADE OUT AND RELOAD
    document.body.classList.remove('ready'); // Triggers the 0.4s fade to white
    
    setTimeout(() => {
        // location.replace pulls from cache and doesn't add to browser history
        window.location.replace(window.location.pathname); 
    }, 400); // Wait for fade to finish before snapping the cache
}

function startSession() {
    if (isResetting) return; 
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10-Second timeout
}

// CAPTURE CLICKS
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

// KEEP ALIVE
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
