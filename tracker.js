const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 

const CURRENT_PAGE = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer;

// GRABS NAME DIRECTLY FROM SVG
function getDistrictName(element) {
    return element.getAttribute('title') || 
           element.getAttribute('data-name') || 
           element.getAttribute('id') || 
           "Unknown Region";
}

function sendDataAndReload() {
    // Only send if there was a real interaction
    if (totalClicks > 0) {
        const payload = {
            location: CURRENT_PAGE,
            clicks: totalClicks,
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(districtData) 
        };
        
        // navigator.sendBeacon is best for reloads as it finishes the request even after page closes
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }

    // This ensures the map is 100% reset to its original scale, position, and district
    window.location.reload();
}

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    // 10-second window
    idleTimer = setTimeout(sendDataAndReload, 10000); 
}

document.addEventListener('mousedown', function(e) {
    // Look strictly for the map shapes (path, polygon, etc.)
    const target = e.target.closest('path, polygon, circle, rect');
    
    // If the click is on the background or UI, it resets the timer but DOES NOT count a click
    startSession(); 
    
    if (!target) return;

    // Only count if it's a valid district shape
    totalClicks++;
    let name = getDistrictName(target);
    districtData[name] = (districtData[name] || 0) + 1;
    
    console.log(`District Clicked: ${name} | Total: ${totalClicks}`);
});

// Track engagement like scrolling or zooming
['wheel', 'touchmove', 'touchstart', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
