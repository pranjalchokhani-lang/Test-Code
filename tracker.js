const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = ""; 

// DYNAMIC DISCOVERY: Find the home district name on page load
window.addEventListener('load', () => {
    const label = document.querySelector('.title, #selected-name, .district-label'); 
    if (label) {
        homeDistrict = label.innerText.trim();
        
        const observer = new MutationObserver(() => {
            const currentName = label.innerText.trim();
            if (currentName && currentName !== homeDistrict) {
                totalClicks++;
                districtData[currentName] = (districtData[currentName] || 0) + 1;
            }
        });
        observer.observe(label, { childList: true, characterData: true, subtree: true });
    }
});

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10s idle window
}

function finalizeSession() {
    if (totalClicks > 0) {
        const payload = {
            location: KIOSK_LOCATION,
            clicks: totalClicks,
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(districtData) 
        };
        // sendBeacon works silently in the background
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // RESET INTERNALS - NO RELOAD
    totalClicks = 0; districtData = {}; startTime = null; lastInteractionTime = null;
    
    // SNAP BACK TO HOME
    if (typeof select === "function" && homeDistrict) {
        select(homeDistrict); 
    }
}

// Track engagement (scrolling, zooming, etc.)
['mousedown', 'wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
