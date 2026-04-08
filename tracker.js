function finalizeSession() {
    // 1. DATA TRANSMISSION
    if (totalClicks > 0 && !isResetting) {
        const payload = { 
            location: KIOSK_LOCATION, 
            clicks: totalClicks, 
            duration: startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0, 
            breakdown: JSON.stringify(rawData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    
    // 2. LOCK RESET STATE
    isResetting = true;
    totalClicks = 0; rawData = {}; startTime = null; lastInteractionTime = null;
    
    console.log("Tracker: 10s Idle reached. Triggering Deep UI Sync...");

    // --- THE FIX: FORCE THE MAP TO UPDATE DATA & RIPPLES ---
    if (homeElement) {
        // We simulate the exact sequence of a physical touch
        const opt = { bubbles: true, cancelable: true, view: window, buttons: 1 };
        
        // This forces the Sidebar and Ripples to sync to Jhunjhunu
        homeElement.dispatchEvent(new MouseEvent('mousedown', opt));
        homeElement.dispatchEvent(new MouseEvent('mouseup', opt));
        homeElement.dispatchEvent(new MouseEvent('click', opt));
    }

    // --- VISUAL ZOOM-OUT ---
    if (mapSvg && initialViewBox) {
        // Slowed down slightly to allow the Data Panel click to register first
        mapSvg.style.transition = "all 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
        mapSvg.setAttribute('viewBox', initialViewBox);
    }
    if (mapGroup && initialTransform) {
        mapGroup.style.transition = "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
        mapGroup.setAttribute('transform', initialTransform);
    }

    // --- CLEANUP CLASSES ---
    setTimeout(() => {
        // Remove 'on' class from everything else
        document.querySelectorAll('path.on').forEach(p => p.classList.remove('on'));
        
        // Ensure Jhunjhunu is visually highlighted
        if (homeElement) homeElement.classList.add('on');

        setTimeout(() => {
            if (mapSvg) mapSvg.style.transition = "";
            if (mapGroup) mapGroup.style.transition = "";
            isResetting = false; 
            console.log("Tracker: Reset Successful.");
        }, 500);
    }, 700); 
}
