// Google Sheets Database API Helper for SanatanStream
// Replaces Firebase entirely with Google Sheets via Google Apps Script Web App

export const GOOGLE_SHEETS_WEBAPP_URL_KEY = "sanatan_sheets_url";

export function getGoogleSheetsUrl(): string {
  if (typeof window !== "undefined") {
    // Check localStorage first so the user can paste/edit it directly in the UI!
    const localUrl = localStorage.getItem(GOOGLE_SHEETS_WEBAPP_URL_KEY);
    if (localUrl) return localUrl.trim();
  }
  return (process.env.NEXT_PUBLIC_GOOGLE_SHEETS_WEBAPP_URL || "").trim();
}

export function setGoogleSheetsUrl(url: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(GOOGLE_SHEETS_WEBAPP_URL_KEY, url.trim());
  }
}

export async function fetchSheetsData() {
  const url = getGoogleSheetsUrl();
  if (!url) {
    return { status: "missing_url", videos: [], categories: [] };
  }
  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: {
        "Accept": "application/json",
      },
      // Avoid browser caching of sheets data
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching Google Sheets data:", err);
    return { status: "error", error: err, videos: [], categories: [] };
  }
}

export async function postSheetsAction(action: string, data: any) {
  const url = getGoogleSheetsUrl();
  if (!url) {
    return { status: "missing_url" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8", // text/plain bypasses CORS preflight perfectly for Apps Script Web Apps!
      },
      body: JSON.stringify({ action, data })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const resJson = await res.json();
    return resJson;
  } catch (err) {
    console.error(`Error posting ${action} to Google Sheets:`, err);
    return { status: "error", error: err };
  }
}
