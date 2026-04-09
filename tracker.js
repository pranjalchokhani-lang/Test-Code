// =========================================================================
// 1. THE DATA CATCHER (Master Data Vault Version)
// =========================================================================
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dataSheet = ss.getSheetByName("All Data");
    
    var payload = JSON.parse(e.postData.contents);
    var formattedDate = Utilities.formatDate(new Date(), "GMT+5:30", "dd-MMM-yy HH:mm:ss");
    var rowNum = dataSheet.getLastRow() + 1;
    
    // Column G: Mapped Districts
    // Uses the parsed Location (Column B) + Raw IDs (Column F) to query the Marriage tab
    var mapFormula = '=IF(F' + rowNum + '="","", IFERROR(JOIN(", ", MAP(SPLIT(REGEXREPLACE(F' + rowNum + ', "[{}"&CHAR(34)&" ]", ""), ","), LAMBDA(pair, IFERROR(VLOOKUP(B' + rowNum + '&INDEX(SPLIT(pair, ":"), 1), {ARRAYFORMULA(Marriage!$A:$A&Marriage!$B:$B), Marriage!$C:$C}, 2, FALSE), "Unknown ("&INDEX(SPLIT(pair, ":"), 1)&")") & " (" & INDEX(SPLIT(pair, ":"), 2) & ")"))), ""))';

    dataSheet.appendRow([
      formattedDate,            // A: Date
      payload.location,         // B: Location (From detectKioskLocation)
      "",                       // C: Reserved for File Name splits if needed
      Number(payload.clicks),   // D: Total Clicks
      Number(payload.duration), // E: Session Duration
      payload.breakdown,        // F: Raw JSON IDs
      mapFormula,               // G: Mapped District Names
      "",                       // H: Notes
      payload.location          // I: Full Raw Path Backup
    ]);
    
    return ContentService.createTextOutput("Success");
  } catch (err) { 
    return ContentService.createTextOutput("Error: " + err.toString()); 
  }
}

// =========================================================================
// 2. THE EMAIL REPORTER
// =========================================================================
function sendUnifiedReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reportSheet = ss.getSheetByName("Report");
  var todayStr = Utilities.formatDate(new Date(), "GMT+5:30", "dd-MMM-yy");
  var data = reportSheet.getDataRange().getDisplayValues(); 
  
  var html = "<div style='font-family: Arial, sans-serif; max-width: 950px;'>";
  html += "<h2 style='color: #1155cc; margin-bottom: 5px;'>Kiosk Performance Report</h2>";
  html += "<p style='color: #555; margin-top: 0px; margin-bottom: 20px;'>Automated snapshot for <strong>" + todayStr + "</strong></p>";
  html += "<table border='1' cellpadding='8' style='border-collapse: collapse; width: 100%; text-align: center; font-size: 13px;'>";

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    if (row.join("").trim() === "") {
      html += "<tr><td colspan='" + row.length + "' style='border: none; height: 15px;'></td></tr>";
      continue;
    }
    var trStyle = (i === 1) ? "background-color: #f0f0f0; font-weight: bold; color: #202124;" : "";
    html += "<tr style='" + trStyle + "'>";
    for (var j = 0; j < 7; j++) { 
      var cellStyle = (j === 0) ? "text-align: left; font-weight: bold; color: #202124; " : "";
      if (j === 1) cellStyle += "background-color: #e0e0e0; font-weight: bold; ";
      var cellText = row[j] !== "" ? row[j] : "-";
      if ((i === 2 || i === 9) && j === 0) {
        html += "<td colspan='7' style='text-align: left; padding-left: 10px; font-size: 14px; background-color: #f8f9fa; font-weight: bold; color: #1155cc; border-bottom: 2px solid #ccc;'>" + cellText + "</td>";
        break; 
      } else {
        html += "<td style='" + cellStyle + "'>" + cellText + "</td>";
      }
    }
    html += "</tr>";
  }
  html += "</table><p style='font-size: 11px; color: #888; margin-top: 20px;'>*Data captured via automated telemetry.</p></div>";

  MailApp.sendEmail({to: "pranjal.chokhani@allen.in", subject: "Kiosk Daily Summary - " + todayStr, htmlBody: html});
}
