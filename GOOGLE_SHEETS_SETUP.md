# Google Sheets Database Setup for SanatanStream

Follow these instructions to set up Google Sheets as your dynamic database and completely bypass Firebase.

---

## Step 1: Create a Google Sheet
1. Open [Google Sheets](https://sheets.google.com) and create a blank spreadsheet.
2. Name the sheet **SanatanStream DB**.
3. (Optional) You can rename your sheets or let the Apps Script create them automatically. The script will automatically create two sheets:
   - `videos` (stores all the devotional videos)
   - `categories` (stores all categories)

---

## Step 2: Open Google Apps Script
1. Inside your Google Sheet, click on **Extensions** in the top menu.
2. Select **Apps Script**. This will open a code editor tab.
3. Delete any default code inside the editor (usually a `myFunction` block).

---

## Step 3: Paste the Apps Script Code
Copy the entire block of code below and paste it into the Apps Script editor (`Code.gs`):

```javascript
/**
 * SanatanStream - Google Sheets Database Backend Script
 * Supports full GET/POST CRUD actions for videos and categories.
 */

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup 'videos' sheet
  let videoSheet = ss.getSheetByName("videos");
  if (!videoSheet) {
    videoSheet = ss.insertSheet("videos");
    videoSheet.appendRow(["id", "title", "url", "category", "description", "thumbnail", "type", "createdAt"]);
    videoSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#F3F4F6");
  }
  
  // 2. Setup 'categories' sheet
  let catSheet = ss.getSheetByName("categories");
  if (!catSheet) {
    catSheet = ss.insertSheet("categories");
    catSheet.appendRow(["name"]);
    catSheet.getRange(1, 1, 1, 1).setFontWeight("bold").setBackground("#F3F4F6");
  }
}

// Helper to return CORS-compliant JSON responses
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET Handler - Fetches all categories and videos
 */
function doGet(e) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Fetch videos
  const videoSheet = ss.getSheetByName("videos");
  const videoRows = videoSheet.getDataRange().getValues();
  const videos = [];
  const videoHeaders = videoRows[0];
  
  for (let i = 1; i < videoRows.length; i++) {
    const row = videoRows[i];
    const videoObj = {};
    for (let j = 0; j < videoHeaders.length; j++) {
      videoObj[videoHeaders[j]] = row[j];
    }
    videos.push(videoObj);
  }
  
  // Fetch categories
  const catSheet = ss.getSheetByName("categories");
  const catRows = catSheet.getDataRange().getValues();
  const categories = [];
  for (let i = 1; i < catRows.length; i++) {
    if (catRows[i][0]) {
      categories.push(catRows[i][0]);
    }
  }
  
  return jsonResponse({
    status: "success",
    videos: videos,
    categories: categories
  });
}

/**
 * POST Handler - Handles additions, updates, deletions, and seeding
 */
function doPost(e) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    let payload;
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ status: "error", message: "No payload received" });
    }
    
    const action = payload.action;
    const payloadData = payload.data;
    
    if (action === "addVideo") {
      const videoSheet = ss.getSheetByName("videos");
      const rows = videoSheet.getDataRange().getValues();
      const videoId = String(payloadData.id);
      let foundIndex = -1;
      
      // Look if video already exists to perform update
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === videoId) {
          foundIndex = i + 1; // row index is 1-based, headers are row 1
          break;
        }
      }
      
      const rowData = [
        payloadData.id,
        payloadData.title || "",
        payloadData.url || "",
        payloadData.category || "Meditation",
        payloadData.description || "",
        payloadData.thumbnail || "",
        payloadData.type || "hls",
        payloadData.createdAt || new Date().toISOString()
      ];
      
      if (foundIndex !== -1) {
        // Update existing row
        videoSheet.getRange(foundIndex, 1, 1, 8).setValues([rowData]);
      } else {
        // Append new row
        videoSheet.appendRow(rowData);
      }
      return jsonResponse({ status: "success", action: "addVideo", id: videoId });
    }
    
    if (action === "deleteVideo") {
      const videoSheet = ss.getSheetByName("videos");
      const rows = videoSheet.getDataRange().getValues();
      const videoId = String(payloadData.id);
      
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === videoId) {
          videoSheet.deleteRow(i + 1);
          return jsonResponse({ status: "success", action: "deleteVideo", id: videoId });
        }
      }
      return jsonResponse({ status: "error", message: "Video not found" });
    }
    
    if (action === "addCategory") {
      const catSheet = ss.getSheetByName("categories");
      const rows = catSheet.getDataRange().getValues();
      const catName = payloadData.name.trim();
      
      // Check if exists
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).toLowerCase() === catName.toLowerCase()) {
          return jsonResponse({ status: "success", message: "Category already exists" });
        }
      }
      
      catSheet.appendRow([catName]);
      return jsonResponse({ status: "success", action: "addCategory", name: catName });
    }
    
    if (action === "updateCategory") {
      const catSheet = ss.getSheetByName("categories");
      const catRows = catSheet.getDataRange().getValues();
      const oldName = payloadData.oldName.trim();
      const newName = payloadData.newName.trim();
      
      // 1. Update in categories sheet
      let catFound = false;
      for (let i = 1; i < catRows.length; i++) {
        if (String(catRows[i][0]).toLowerCase() === oldName.toLowerCase()) {
          catSheet.getRange(i + 1, 1).setValue(newName);
          catFound = true;
          break;
        }
      }
      
      // 2. Update category name inside all videos sheet
      const videoSheet = ss.getSheetByName("videos");
      const videoRows = videoSheet.getDataRange().getValues();
      for (let i = 1; i < videoRows.length; i++) {
        if (String(videoRows[i][3]).toLowerCase() === oldName.toLowerCase()) {
          videoSheet.getRange(i + 1, 4).setValue(newName);
        }
      }
      
      return jsonResponse({ status: "success", action: "updateCategory", oldName, newName });
    }
    
    if (action === "deleteCategory") {
      const catSheet = ss.getSheetByName("categories");
      const catRows = catSheet.getDataRange().getValues();
      const catToDelete = payloadData.name.trim();
      const fallbackCat = payloadData.fallback.trim();
      
      // 1. Delete from categories sheet
      for (let i = 1; i < catRows.length; i++) {
        if (String(catRows[i][0]).toLowerCase() === catToDelete.toLowerCase()) {
          catSheet.deleteRow(i + 1);
          break;
        }
      }
      
      // 2. Reassign videos of deleted category to fallback category
      const videoSheet = ss.getSheetByName("videos");
      const videoRows = videoSheet.getDataRange().getValues();
      for (let i = 1; i < videoRows.length; i++) {
        if (String(videoRows[i][3]).toLowerCase() === catToDelete.toLowerCase()) {
          videoSheet.getRange(i + 1, 4).setValue(fallbackCat);
        }
      }
      
      return jsonResponse({ status: "success", action: "deleteCategory", name: catToDelete, fallback: fallbackCat });
    }
    
    if (action === "seed") {
      const videoSheet = ss.getSheetByName("videos");
      const catSheet = ss.getSheetByName("categories");
      
      // Clear all
      videoSheet.clear();
      catSheet.clear();
      
      // Write headers
      videoSheet.appendRow(["id", "title", "url", "category", "description", "thumbnail", "type", "createdAt"]);
      videoSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#F3F4F6");
      
      catSheet.appendRow(["name"]);
      catSheet.getRange(1, 1, 1, 1).setFontWeight("bold").setBackground("#F3F4F6");
      
      // Write Categories
      const categories = payloadData.categories || [];
      for (let i = 0; i < categories.length; i++) {
        catSheet.appendRow([categories[i]]);
      }
      
      // Write Videos
      const videos = payloadData.videos || [];
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        videoSheet.appendRow([
          v.id,
          v.title || "",
          v.url || "",
          v.category || "",
          v.description || "",
          v.thumbnail || "",
          v.type || "hls",
          v.createdAt || new Date().toISOString()
        ]);
      }
      
      return jsonResponse({ status: "success", action: "seed", message: "Seeded successfully!" });
    }
    
    return jsonResponse({ status: "error", message: "Action not supported: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}
```

---

## Step 4: Deploy as Web App
1. Inside the Google Apps Script editor, click **Save** (disk icon).
2. Click the **Deploy** button on the top right.
3. Choose **New deployment**.
4. Click the gear icon (**Select type**) and choose **Web app**.
5. Fill in the fields:
   - **Description**: SanatanStream Database Web App
   - **Execute as**: Me (`your-email@gmail.com`)
   - **Who has access**: **Anyone** *(Crucial: This must be "Anyone" so the app can submit API requests securely)*.
6. Click **Deploy**.
7. Google will ask you to authorize access. Click **Authorize access**, log in with your Google account, click **Advanced**, and then select **Go to Untitled project (unsafe)** to approve the permissions.
8. Once successfully deployed, copy the **Web app URL** (starts with `https://script.google.com/macros/s/.../exec`).

---

## Step 5: Configure SanatanStream with your URL
1. Access the **SanatanStream** Web App.
2. Click **Admin Login** and log in using:
   - **Email**: `dipak.kholiya@gmail.com`
   - **Password**: `Dipak@3626`
3. Click the newly added **Sheets DB Config** button on the top header.
4. Paste your copied Google Web App URL.
5. Click **Save & Sync DB**. The app will automatically initialize and seed all default devotional categories and 16 master videos into your Google Sheets spreadsheet instantly!
