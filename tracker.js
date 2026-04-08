// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
const PRISTINE_URL = window.location.href; 
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 

// INJECT FADE CSS FOR SEAMLESS RELOAD
const style = document.createElement('style');
style.innerHTML = `
    body { transition: opacity 0.4s ease-in-out; opacity: 0; }
    body.ready { opacity: 1; }
`;
document.head.appendChild(style);

window.addEventListener('load', () => {
    document.body.classList.add('ready'); // Fade in smoothly on load
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
    
    console.log("Tracker: 10s Idle. Executing Pristine Reload...");

    // 3. FADE OUT
    document.body.classList.remove('ready'); 
    
    setTimeout(() => {
        // Clear short-term memory so the map doesn't try to "remember" the last click
        sessionStorage.clear(); 
        
        // Reload using the EXACT URL we captured when the machine first turned on
        window.location.replace(PRISTINE_URL); 
    }, 400); // Wait for the fade out to finish
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
