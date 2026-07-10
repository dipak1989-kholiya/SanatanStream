// MongoDB Atlas Database API Helper for SanatanStream
// Connects frontend with Next.js server-side API Routes proxying to MongoDB Atlas

export const GOOGLE_SHEETS_WEBAPP_URL_KEY = "sanatan_mongodb_status";

export function getGoogleSheetsUrl(): string {
  return "MongoDB Atlas (Online Cloud)";
}

export function setGoogleSheetsUrl(url: string) {
  // Placeholder to keep page.tsx compatible without crashes
}

export async function fetchSheetsData() {
  try {
    const res = await fetch("/api/db", {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching MongoDB data:", err);
    return { status: "error", error: err, videos: [], categories: [] };
  }
}

export async function postSheetsAction(action: string, data: any) {
  try {
    const res = await fetch("/api/db", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, data })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const resJson = await res.json();
    return resJson;
  } catch (err) {
    console.error(`Error posting ${action} to MongoDB:`, err);
    return { status: "error", error: err };
  }
}
