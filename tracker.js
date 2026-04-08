const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = ""; 
let isResetting = false; // The "Blindfold" flag

// 1. DYNAMIC HOME CAPTURE
function initHome() {
    const label = document.querySelector('.title, #selected-name, .district-label, #district-name'); 
    if (label && label.innerText.trim() !== "") {
        homeDistrict = label.innerText.trim();
        console.log("Tracker: Home locked as [" + homeDistrict + "]");
    } else {
        setTimeout(initHome, 500);
    }
}
initHome();

function finalizeSession() {
    // ONLY send to Google Sheets if a student actually clicked something
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // START RESET PROCESS
    isResetting = true; 
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    // 2. TRIGGER MAP RESET (Silent Snap-back)
    if (typeof window.select === "function" && homeDistrict !== "") {
        window.select(homeDistrict); 
        console.log("Tracker: Resetting to " + homeDistrict);
    } 

    // Remove the blindfold after 1 second (allows map to finish animation)
    setTimeout(() => { isResetting = false; }, 1000);
}

function startSession() {
    if (isResetting) return; // Don't start a session while the map is auto-resetting
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10 Second Window
}

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

// Prevent reset while scrolling or zooming
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
