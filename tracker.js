const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let homeDistrict = ""; 

// 1. DYNAMIC DISCOVERY (The "Offset" Killer)
window.addEventListener('load', () => {
    // Find the element that displays the district name (usually has a class like 'title' or 'district-label')
    const label = document.querySelector('.title, #selected-name, .district-label'); 
    if (label) {
        homeDistrict = label.innerText.trim();
        
        // Watch this label. If the text changes, a real District Click happened.
        const observer = new MutationObserver(() => {
            const currentName = label.innerText.trim();
            if (currentName && currentName !== homeDistrict) {
                totalClicks++;
                districtData[currentName] = (districtData[currentName] || 0) + 1;
                console.log(`District Clicked: ${currentName} | Total: ${totalClicks}`);
            }
        });
        observer.observe(label, { childList: true, characterData: true, subtree: true });
    }
});

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); // 10-second idle window
}

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
    
    // RESET: Wipe memory and call the native select() function to go home
    totalClicks = 0; districtData = {}; startTime = null; lastInteractionTime = null;
    if (typeof select === "function" && homeDistrict) {
        select(homeDistrict); 
    }
}

// Global listeners for any interaction (Scroll/Zoom/Click)
['mousedown', 'wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
