const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

// THE MARRIAGE OFFSET: Corrects the shift so Jaisalmer flows as Jaisalmer, not Kurukshetra.
const offsets = { "SIKAR": 3, "GUJARAT": 3, "JAIPUR": 3, "CHANDIGARH": 3 };

const regionNames = {
    "CHANDIGARH": ["Lahaul and Spiti", "Kinnaur", "Kullu", "Chamba", "Kangra", "Una", "Hamirpur", "Mandi", "Bilaspur", "Solan", "Sirmaur", "Shimla", "Uttarkashi", "Chamoli", "Pithoragarh district", "Bageshwar", "Rudraprayag", "Tehri Garhwal", "Almora", "Champawat", "Udham Singh Nagar", "Pauri Garhwal", "Haridwar", "Dehradun", "Central Delhi", "East Delhi", "North East Delhi", "North Delhi", "North West Delhi", "West Delhi", "South West Delhi", "South Delhi", "Ambala", "Panchkula", "Kurukshetra", "Karnal", "Panipat", "Sonipat", "Kaithal", "Jind", "Hisar", "Fatehabad", "Sirsa", "Rohtak", "Jhajjar", "Bhiwani", "Mahendragarh", "Rewari", "Faridabad", "Fatehgarh Sahib", "Ludhiana", "Bathinda", "Moga", "Sri Muktsar Sahib", "Faridkot", "Firozpur", "Amritsar", "Kapurthala", "Gurdaspur", "Jalandhar", "Shaheed Bhagat Singh Nagar", "Hoshiarpur", "Patiala", "New Delhi", "Shahdara", "Gurugram", "South East Delhi", "Yamunanagar", "Nainital", "Sahibzada Ajit Singh Nagar", "Rupnagar", "Fazilka", "Mansa", "Pathankot", "Tarn Taran", "Barnala", "Sangrur", "Nuh", "Palwal", "Charkhi Dadri", "Chandigarh", "Malerkotla"],
    "JAIPUR": ["Barmer", "Jalore", "Pali", "Jaisalmer", "Bikaner", "Sri Ganganagar", "Nagaur", "Sirohi", "Churu", "Hanumangarh", "Jhunjhunu", "Sikar", "Ajmer", "Alwar", "Bharatpur", "Jaipur", "Dausa", "Dhaulpur", "Karauli", "Sawai Madhopur", "Tonk", "Baran", "Jhalawar", "Kota", "Banswara", "Bhilwara", "Bundi", "Dungarpur", "Rajsamand", "Udaipur", "Pratapgarh", "Chittorgarh", "Didwana-Kuchaman", "Deeg", "Phalodi", "Jodhpur", "Kotputli-Behror", "Khairthal-Tijara", "Beawar", "Salumbar", "Balotra"],
    "SIKAR": ["Barmer", "Jalore", "Pali", "Jaisalmer", "Ambala", "Panchkula", "Kurukshetra", "Karnal", "Panipat", "Sonipat", "Kaithal", "Jind", "Hisar", "Fatehabad", "Sirsa", "Rohtak", "Jhajjar", "Bhiwani", "Mahendragarh", "Rewari", "Faridabad", "Bikaner", "Sri Ganganagar", "Nagaur", "Sirohi", "Churu", "Hanumangarh", "Jhunjhunu", "Sikar", "Ajmer", "Alwar", "Bharatpur", "Jaipur", "Dausa", "Dhaulpur", "Karauli", "Sawai Madhopur", "Tonk", "Baran", "Jhalawar", "Kota", "Banswara", "Bhilwara", "Bundi", "Dungarpur", "Rajsamand", "Udaipur", "Gurugram", "Yamunanagar", "Pratapgarh", "Chittorgarh", "Nuh", "Palwal", "Charkhi Dadri", "Didwana-Kuchaman", "Deeg", "Phalodi", "Jodhpur", "Kotputli-Behror", "Khairthal-Tijara", "Beawar", "Salumbar", "Balotra"],
    "GUJARAT": ["Mahesana", "Patan", "Sabarkantha", "Dahod", "Gandhinagar", "Kheda", "Panchmahal", "Vadodara", "Narmada", "Surat", "Dang", "Valsad", "Surendranagar", "Ahmedabad", "Rajkot", "Anand", "Gir Somnath", "Junagadh", "Bhavnagar", "Devbhumi Dwaraka", "Porbandar", "Navsari", "Morbi", "Kutch", "Bharuch", "Chhota Udaipur", "Botad", "Amreli", "Aravalli", "Tapi", "Mahisagar", "Jamnagar", "Banaskantha", "Vav-Tharad"]
};

let totalClicks = 0, districtData = {}, startTime = null, lastInteractionTime = null, idleTimer;

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    resetIdleTimer();
}

function sendData() {
    let dur = startTime ? Math.floor((lastInteractionTime - startTime) / 1000) : 0;
    if (totalClicks > 0) {
        const payload = {
            location: KIOSK_LOCATION,
            clicks: totalClicks,
            duration: dur,
            breakdown: JSON.stringify(districtData) 
        };
        navigator.sendBeacon(scriptUrl, new Blob([JSON.stringify(payload)], { type: 'text/plain' }));
    }
    // RESET FOR NEW USER WITHOUT RELOADING
    totalClicks = 0; 
    districtData = {}; 
    startTime = null; 
    lastInteractionTime = null;
    console.log("Session Pushed Silently. Music/Page Unaffected.");
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (startTime) { sendData(); }
    }, 20000); 
}

document.addEventListener('mousedown', function(e) {
    const target = e.target.closest('path, polygon, circle, rect');
    startSession(); 
    if (!target) return;

    totalClicks++;
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const rawIndex = allShapes.indexOf(target);
    const correctedIndex = rawIndex - (offsets[KIOSK_LOCATION] || 0);
    let name = regionNames[KIOSK_LOCATION][correctedIndex] || "Unknown (" + rawIndex + ")";

    districtData[name] = (districtData[name] || 0) + 1;
    console.log(`Matched: ${name}`);
});

['wheel', 'touchmove', 'touchstart', 'mousemove'].forEach(ev => {
    document.addEventListener(ev, startSession, { passive: true });
});
