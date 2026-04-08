const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 

// DYNAMIC CONFIGURATION
const CURRENT_PAGE = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";
const OFFSET = 3; 
const HOME_INDEX = 15; // Target the 16th shape to reset the view

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer, isAutoReset = false;

// GRABS NAME DIRECTLY FROM SVG ATTRIBUTES (id, title, or data-name)
function getDistrictName(element) {
    return element.getAttribute('title') || 
           element.getAttribute('data-name') || 
           element.getAttribute('id') || 
           "Unknown Region";
}

// THE 10-SECOND RESET PIECE
function reinitialiseSession() {
    // 1. Send data ONLY if there was a real interaction
    if (totalClicks > 0) {
        const payload = {
            location: CURRENT_PAGE,
            clicks: totalClicks,
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0,
            breakdown: JSON.stringify(districtData) 
        };
        fetch(scriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        console.log("Data Pushed to Excel.");
    }

    // 2. Wipe internal memory
    totalClicks = 0; districtData = {}; startTime = null; lastInteractionTime = null;

    // 3. Snap map back to Home District
    autoResetMap();
}

function autoResetMap() {
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const targetShape = allShapes[HOME_INDEX + OFFSET];

    if (targetShape) {
        isAutoReset = true; // Signal to ignore this click
        const eventProps = { bubbles: true, cancelable: true, view: window, buttons: 1 };
        targetShape.dispatchEvent(new MouseEvent('mousedown', eventProps));
        targetShape.dispatchEvent(new MouseEvent('click', eventProps));
        setTimeout(() => { isAutoReset = false; }, 200);
        console.log("Map reset to Home State.");
    }
}

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    // SET IDLE WINDOW TO 10 SECONDS
    idleTimer = setTimeout(reinitialiseSession, 10000); 
}

// MAIN CLICK LISTENER
document.addEventListener('mousedown', function(e) {
    if (isAutoReset) return; // Ignore if the reset logic triggered this
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;

    startSession(); 
    totalClicks++;
    
    let name = getDistrictName(target);
    districtData[name] = (districtData[name] || 0) + 1;
    console.log(`Tracked: ${name}`);
});

// Track zoom/scroll as engagement
['wheel', 'touchmove', 'touchstart', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
