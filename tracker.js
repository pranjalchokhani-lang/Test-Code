// CAPTURE THE EXACT URL ON BOOT UP (Before anyone clicks anything)
const scriptUrl = "https://script.google.com/macros/s/AKfycbyxfJ-RPFoAJtsKFRL-b1SVqpIIIZQZ0jC4I_SvqJqlWUrKyG3xXidJUtryDbZAfdWg/exec";  
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

let totalClicks = 0, rawData = {}, startTime = null, lastInteractionTime = null, idleTimer;

// 1. ENGAGE SOFTWARE SHIELD ON BOOT (Ignores all tracking)
let isResetting = true; 

// 2. ENGAGE PHYSICAL SHIELD ON BOOT (Blocks all human touches)
document.body.style.pointerEvents = 'none'; 

// --- STATE MEMORY VAULT ---
let homeDistrictName = "";  
let mapSvg = null;          
let mapGroup = null;        
let initialViewBox = null;  
let initialTransform = null;

// 3. RAPID-FIRE 0th STATE SCANNER
const bootScan = setInterval(() => {
    const activePath = document.querySelector('path.on'); 
    
    if (activePath) {
        // Lock the 0th Name
        homeDistrictName = activePath.getAttribute('data-n');
        
        // Lock the 0th Zoom & Alignment Coordinates
        mapSvg = activePath.closest('svg') || document.querySelector('svg');
        mapGroup = activePath.closest('g') || document.querySelector('svg > g');
        
        if (mapSvg) initialViewBox = mapSvg.getAttribute('viewBox');
        if (mapGroup) initialTransform = mapGroup.getAttribute('transform');

        console.log("Tracker: 0th state locked safely ->", homeDistrictName);
        
        // 4. DROP BOTH SHIELDS (Kiosk is now open for business)
        clearInterval(bootScan); 
        document.body.style.pointerEvents = 'auto'; 
        isResetting = false; 
    }
}, 100); 

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
    
    console.log("Tracker: 10s Idle. Executing Zero-Reload Align & Reset...");

    // 3. TRIGGER NATIVE ZOOM-OUT (By "unclicking" the student's open district)
    const currentlyActivePath = document.querySelector('path.on');
    if (currentlyActivePath) {
        const opt = { bubbles: true, cancelable: true, view: window };
        currentlyActivePath.dispatchEvent(new MouseEvent('pointerdown', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('mousedown', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('pointerup', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('mouseup', opt));
        currentlyActivePath.dispatchEvent(new MouseEvent('click', opt));
    }

    // 4. FORCE VISUAL ALIGNMENT (Ensures the map centers perfectly)
    if (mapSvg && initialViewBox) {
        mapSvg.style.transition = "all 0.5s ease-in-out";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.5s ease-in-out";
        mapGroup.setAttribute('transform', initialTransform);
    }

    // 5. SILENT CSS HIGHLIGHT (Paints the 0th district without triggering a zoom-in)
    setTimeout(() => {
        // Strip the highlight from everything just to be safe
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        
        // Paint the true 0th district
        if (homeDistrictName) {
            const targetShape = document.querySelector(`path[data-n="${homeDistrictName}"]`);
            if (targetShape) targetShape.classList.add('on');
        }

        // Clean up the transition locks so the next student can zoom normally
        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            isResetting = false; 
            console.log("Tracker: Reset complete.");
        }, 500);

    }, 600); // Wait 600ms for the native zoom-out to glide into place
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

// KEEP ALIVE ON DRAG/ZOOM
['wheel', 'touchmove', 'touchstart'].forEach(ev => {
    document.addEventListener(ev, () => { if(!isResetting) startSession(); }, { passive: true });
});
