// =========================================================================
// KIOSK TELEMETRY: ZERO-RELOAD OMNI-CLICK TRACKER
// =========================================================================

const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.href; 

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = true; 
document.body.style.pointerEvents = 'none'; 

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";  
let homeElement = null; 

// 1. BOOT SCANNER (Finds Jhunjhunu automatically)
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; 
        console.log("Tracker: Home locked ->", homeDistrictName);
        
        clearInterval(bootScan); 
        document.body.style.pointerEvents = 'auto'; 
        isResetting = false; 
    }
}, 100); 

// --- THE OMNI-CLICK WEAPON ---
// Fires every type of interaction event to guarantee the map hears it WITHOUT reloading
function forceInteraction(element) {
    if (!element) return;
    const opt = { bubbles: true, cancelable: true, view: window, buttons: 1, isPrimary: true };
    
    // 1. Touch Events 
    try { element.dispatchEvent(new Event('touchstart', opt)); } catch(e){}
    try { element.dispatchEvent(new Event('touchend', opt)); } catch(e){}
    
    // 2. Pointer Events 
    try { element.dispatchEvent(new PointerEvent('pointerdown', opt)); } catch(e){}
    try { element.dispatchEvent(new PointerEvent('pointerup', opt)); } catch(e){}
    
    // 3. Mouse Events 
    element.dispatchEvent(new MouseEvent('mousedown', opt));
    element.dispatchEvent(new MouseEvent('mouseup', opt));
    element.dispatchEvent(new MouseEvent('click', opt));
}

function finalizeSession() {
    if (isResetting) return;
    isResetting = true;

    // 2. TRANSMIT DATA
    if (totalClicks > 0) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    console.log("Tracker: 10s Idle. Executing Omni-Click Reset...");

    // 3. THE BRUTE FORCE RESET SEQUENCE (NO PAGE RELOADS HERE)
    
    // Target A: "Un-click" the currently open district
    const activePath = document.querySelector('path.on');
    if (activePath && activePath !== homeElement) {
        forceInteraction(activePath);
    }

    // Target B: Click the background SVG (Forces most maps to clear selection)
    setTimeout(() => {
        const mapBackground = document.querySelector('svg');
        if (mapBackground) forceInteraction(mapBackground);
        
        // Target C: Force-click Jhunjhunu
        setTimeout(() => {
            if (homeElement) {
                forceInteraction(homeElement);
                console.log("Tracker: Omni-Click Sequence Complete.");
            }
            
            // Clean slate for the next student
            totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
            isResetting = false; 
        }, 150);
    }, 150);
}

// 4. SESSION STARTS ON ANY TOUCH
function startSession() {
    if (isResetting) return; 
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

// 5. TOUCH/SCROLL LISTENERS
document.addEventListener('mousedown', function(e) {
    if (isResetting) return;
    startSession(); 
    
    const target = e.target.closest('path, polygon, circle, rect');
    if (!target) return;
    
    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    rawData[rawIndex] = (rawData[rawIndex] || 0) + 1;
});

['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
