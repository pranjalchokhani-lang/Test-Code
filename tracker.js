const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const CURRENT_PAGE = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer;

// GRABS NAME DIRECTLY FROM SVG ATTRIBUTES
function getDistrictName(element) {
    return element.getAttribute('title') || 
           element.getAttribute('data-name') || 
           element.getAttribute('id') || 
           "Unknown Region";
}

function finalizeSession() {
    // Only send data if the student actually clicked a district
    if (totalClicks > 0) {
        const payload = {
            location: CURRENT_PAGE,
            clicks: totalClicks,
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(districtData) 
        };
        
        // sendBeacon ensures the data hits Google even as the page reloads
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }

    // RELOAD: The only 100% way to reset scale, position, and the home district
    window.location.reload();
}

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    // 10-second idle window before reset
    idleTimer = setTimeout(finalizeSession, 10000); 
}

document.addEventListener('mousedown', function(e) {
    // 1. Reset the idle timer for ANY touch (even background)
    startSession(); 

    // 2. Look STRICTLY for the map shapes (path, polygon, etc.)
    const target = e.target.closest('path, polygon, circle, rect');
    
    // 3. If it's not a district shape, do not count the click
    if (!target) return;

    // 4. Record the District Click
    totalClicks++;
    let name = getDistrictName(target);
    districtData[name] = (districtData[name] || 0) + 1;
    
    console.log(`District Click: ${name} | Session Total: ${totalClicks}`);
});

// Capture navigation (zoom/scroll) to keep the session alive
['wheel', 'touchmove', 'touchstart', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
