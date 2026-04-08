// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = false; 
let homeDistrictName = ""; 

// 1. MEMORIZE THE HOME NAME ON BOOT
window.addEventListener('load', () => {
    setTimeout(() => {
        const homePath = document.querySelector('path.on'); 
        if (homePath) {
            homeDistrictName = homePath.getAttribute('data-n');
            console.log("Tracker: Locked Initial State ->", homeDistrictName);
        }
    }, 1500); 
});

function finalizeSession() {
    // 1. SEND DATA
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. ENGAGE BLINDFOLD
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle. Zooming out and silently highlighting home...");

    // 3. TRIGGER NATIVE ZOOM-OUT / RE-ALIGN
    // In most frameworks, clicking the *currently open* district again toggles it off and zooms out.
    const currentlyActivePath = document.querySelector('path.on');
    if (currentlyActivePath) {
        const opt = { bubbles: true, cancelable: true, view: window };
        currentlyActivePath.dispatchEvent(new MouseEvent('pointerdown', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('mousedown', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('pointerup', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('mouseup', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('click', opt));
    }

    // Backup: If the developer made a UI 'Home' or 'Back' button, click it automatically
    const resetBtn = document.querySelector('.reset-btn, .home-btn, .zoom-out, .back, #reset');
    if (resetBtn) resetBtn.click();

    // 4. THE SILENT CSS HIGHLIGHT
    // Wait 800ms for the map to finish its smooth zoom-out animation
    setTimeout(() => {
        // Strip the highlight from everything just to be safe
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        
        // Silently add the highlight to the home district WITHOUT triggering a click event
        if (homeDistrictName !== "") {
            const targetShape = document.querySelector(`path[data-n="${homeDistrictName}"]`);
            if (targetShape) {
                targetShape.classList.add('on');
            }
        }
        
        // Remove blindfold, ready for next student
        isResetting = false; 
        console.log("Tracker: Reset Complete.");
    }, 800); 
}

function startSession() {
    if (isResetting) return; 
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
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
