// --- CONFIGURATION ---
const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec";  
const KIOSK_LOCATION = window.location.href; 

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;
let isResetting = true; 
document.body.style.pointerEvents = 'none'; 

let homeDistrictName = "";  
let mapSvg = null;          
let mapGroup = null;        
let initialViewBox = null;  
let initialTransform = null;
let homeElement = null; 

const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    if (activePath) {
        homeDistrictName = activePath.getAttribute('data-n');
        homeElement = activePath; 
        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');
        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');
        clearInterval(bootScan); 
        document.body.style.pointerEvents = 'auto'; 
        isResetting = false; 
    }
}, 100); 

function finalizeSession() {
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    isResetting = true;

    // --- NEW DEEP SYNC RESET ---
    // Instead of clicking 'Home', we click the 'currently active' path.
    // In most SVG maps, clicking an active path triggers the "Deselect/Home" state.
    const activePath = document.querySelector('path.on');
    if (activePath) {
        const opt = { bubbles: true, cancelable: true, view: window, buttons: 1 };
        
        // Rapid sequence: This forces ripples and result panels to update
        activePath.dispatchEvent(new MouseEvent('mousedown', opt));
        activePath.dispatchEvent(new MouseEvent('mouseup', opt));
        activePath.dispatchEvent(new MouseEvent('click', opt));
        
        console.log("Tracker: Deep Sync Sequence fired at active path.");
    }

    // --- VISUAL ZOOM-OUT ---
    setTimeout(() => {
        if (mapSvg && initialViewBox) {
            mapSvg.style.transition = "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
            mapSvg.setAttribute('viewBox', initialViewBox);
        }
        if (mapGroup && initialTransform) {
            mapGroup.style.transition = "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
            mapGroup.setAttribute('transform', initialTransform);
        }
    }, 100);

    // --- CLEANUP ---
    setTimeout(() => {
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            
            // Reset state for next session
            totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
            isResetting = false; 
            console.log("Tracker: Reset Successful.");
        }, 500);
    }, 800); 
}

function startSession() {
    if (isResetting) return; 
    if (!startTime) {
        startTime = Date.now();
    }
    lastInteractionTime = Date.now();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(finalizeSession, 10000); 
}

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

// START & KEEP ALIVE ON ALL TOUCH/SCROLL
['wheel', 'touchmove', 'touchstart', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => { 
        if(!isResetting) startSession(); 
    }, { passive: true });
});
