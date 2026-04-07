const scriptUrl = "https://script.google.com/macros/s/AKfycbwMnasHW4SJZ2dQqLaJZ-GcvKW9lJpiJPEm-eBcN5M-seL8qB9-86FmhTn2rbHwikTg/exec"; 
const KIOSK_LOCATION = window.location.pathname.split("/").pop().split(".")[0].toUpperCase() || "UNKNOWN";

// MAPPING LISTS BASED ON YOUR PROVIDED DISTRICT ORDER
const regionNames = {
    "CHANDIGARH": [
        "Lahaul and Spiti", "Kinnaur", "Kullu", "Chamba", "Kangra", "Una", "Hamirpur", "Mandi", "Bilaspur", "Solan", "Sirmaur", "Shimla", "Uttarkashi", "Chamoli", "Pithoragarh district", "Bageshwar", "Rudraprayag", "Tehri Garhwal", "Almora", "Champawat", "Udham Singh Nagar", "Pauri Garhwal", "Haridwar", "Dehradun", "Central Delhi", "East Delhi", "North East Delhi", "North Delhi", "North West Delhi", "West Delhi", "South West Delhi", "South Delhi", "Ambala", "Panchkula", "Kurukshetra", "Karnal", "Panipat", "Sonipat", "Kaithal", "Jind", "Hisar", "Fatehabad", "Sirsa", "Rohtak", "Jhajjar", "Bhiwani", "Mahendragarh", "Rewari", "Faridabad", "Fatehgarh Sahib", "Ludhiana", "Bathinda", "Moga", "Sri Muktsar Sahib", "Faridkot", "Firozpur", "Amritsar", "Kapurthala", "Gurdaspur", "Jalandhar", "Shaheed Bhagat Singh Nagar", "Hoshiarpur", "Patiala", "New Delhi", "Shahdara", "Gurugram", "South East Delhi", "Yamunanagar", "Nainital", "Sahibzada Ajit Singh Nagar", "Rupnagar", "Fazilka", "Mansa", "Pathankot", "Tarn Taran", "Barnala", "Sangrur", "Nuh", "Palwal", "Charkhi Dadri", "Chandigarh", "Malerkotla"
    ],
    "JAIPUR": [
        "Barmer", "Jalore", "Pali", "Jaisalmer", "Bikaner", "Sri Ganganagar", "Nagaur", "Sirohi", "Churu", "Hanumangarh", "Jhunjhunu", "Sikar", "Ajmer", "Alwar", "Bharatpur", "Jaipur", "Dausa", "Dhaulpur", "Karauli", "Sawai Madhopur", "Tonk", "Baran", "Jhalawar", "Kota", "Banswara", "Bhilwara", "Bundi", "Dungarpur", "Rajsamand", "Udaipur", "Pratapgarh", "Chittorgarh", "Didwana-Kuchaman", "Deeg", "Phalodi", "Jodhpur", "Kotputli-Behror", "Khairthal-Tijara", "Beawar", "Salumbar", "Balotra"
    ],
    "SIKAR": [
        "Barmer", "Jalore", "Pali", "Jaisalmer", "Ambala", "Panchkula", "Kurukshetra", "Karnal", "Panipat", "Sonipat", "Kaithal", "Jind", "Hisar", "Fatehabad", "Sirsa", "Rohtak", "Jhajjar", "Bhiwani", "Mahendragarh", "Rewari", "Faridabad", "Bikaner", "Sri Ganganagar", "Nagaur", "Sirohi", "Churu", "Hanumangarh", "Jhunjhunu", "Sikar", "Ajmer", "Alwar", "Bharatpur", "Jaipur", "Dausa", "Dhaulpur", "Karauli", "Sawai Madhopur", "Tonk", "Baran", "Jhalawar", "Kota", "Banswara", "Bhilwara", "Bundi", "Dungarpur", "Rajsamand", "Udaipur", "Gurugram", "Yamunanagar", "Pratapgarh", "Chittorgarh", "Nuh", "Palwal", "Charkhi Dadri", "Didwana-Kuchaman", "Deeg", "Phalodi", "Jodhpur", "Kotputli-Behror", "Khairthal-Tijara", "Beawar", "Salumbar", "Balotra"
    ],
    "GUJARAT": [
        "Mahesana", "Patan", "Sabarkantha", "Dahod", "Gandhinagar", "Kheda", "Panchmahal", "Vadodara", "Narmada", "Surat", "Dang", "Valsad", "Surendranagar", "Ahmedabad", "Rajkot", "Anand", "Gir Somnath", "Junagadh", "Bhavnagar", "Devbhumi Dwaraka", "Porbandar", "Navsari", "Morbi", "Kutch", "Bharuch", "Chhota Udaipur", "Botad", "Amreli", "Aravalli", "Tapi", "Mahisagar", "Jamnagar", "Banaskantha", "Vav-Tharad"
    ]
};

let totalClicks = 0;
let districtData = {}; 
let startTime = null; 
let lastInteractionTime = null;
let idleTimer;

function startSession() {
    if (!startTime) startTime = Date.now();
    lastInteractionTime = Date.now();
    resetIdleTimer();
}

function sendData() {
    // Only send if there was actual interaction (clicks or prolonged viewing/scrolling)
    if (!startTime || (totalClicks === 0 && (Date.now() - startTime < 3000))) return;
    
    const payload = {
        location: KIOSK_LOCATION,
        clicks: totalClicks,
        duration: Math.floor((lastInteractionTime - startTime) / 1000),
        breakdown: JSON.stringify(districtData) 
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
    navigator.sendBeacon(scriptUrl, blob); 
    
    // Reset for next potential session before reload
    totalClicks = 0; districtData = {}; startTime = null; lastInteractionTime = null;
}

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (startTime) { 
            sendData(); 
            setTimeout(() => { window.location.reload(); }, 500);
        }
    }, 60000); 
}

// 1. Capture Clicks & Identify District by Index
document.addEventListener('click', function(e) {
    const target = e.target.closest('path, polygon, circle, rect');
    startSession(); 
    if (!target) return;

    totalClicks++;
    
    // Map identification logic
    const allShapes = Array.from(document.querySelectorAll('path, polygon, circle, rect'));
    const index = allShapes.indexOf(target);
    const currentMapNames = regionNames[KIOSK_LOCATION] || [];
    
    // Use manual list name based on order of paths in HTML
    let name = currentMapNames[index] || `Region-${index + 1}`;

    districtData[name] = (districtData[name] || 0) + 1;
});

// 2. Capture Zoom & Scroll into Duration
document.addEventListener('wheel', startSession, { passive: true });
document.addEventListener('touchmove', startSession, { passive: true });

// Ensure data is sent if tab is closed
window.addEventListener('pagehide', sendData);
