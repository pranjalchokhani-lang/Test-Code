const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrictName = ""; 

// DYNAMIC DISCOVERY: Find the starting district name on page load
window.addEventListener('load', () => {
    const label = document.querySelector('.title, #selected-name, .district-label'); 
    if (label) homeDistrictName = label.innerText.trim();
});

function finalizeSession() {
    if (totalClicks > 0) {
        const payload = {
            location: KIOSK_LOCATION,
            clicks: totalClicks,
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(districtData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // RESET INTERNALS
    totalClicks = 0; districtData = {}; startTime = null; lastInteractionTime = null;
    
    // SILENT SNAP-BACK: No page reload
    if (typeof select === "function" && homeDistrictName) {
        select(homeDistrictName); 
    }
}

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

document.addEventListener('mousedown', function(e) {
    const target = e.target.closest('path, polygon, circle, rect');
    startSession(); 
    
    if (!target) return;

    // Only count if the click changes the district name label
    const label = document.querySelector('.title, #selected-name, .district-label');
    if (label) {
        const currentName = label.innerText.trim();
        // Delay slightly to allow the map's own click handler to update the label
        setTimeout(() => {
            const newName = label.innerText.trim();
            if (newName && newName !== homeDistrictName) {
                totalClicks++;
                districtData[newName] = (districtData[newName] || 0) + 1;
            }
        }, 50);
    }
});

['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
