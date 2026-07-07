import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Helper to extract YouTube Video ID
    const getYouTubeId = (rawUrl: string): string | null => {
      if (!rawUrl) return null;
      const patterns = [
        /youtu\.be\/([^#\&\?]{11})/,
        /youtube\.com\/watch\?v=([^#\&\?]{11})/,
        /youtube\.com\/embed\/([^#\&\?]{11})/,
        /youtube\.com\/v\/([^#\&\?]{11})/,
        /youtube\.com\/live\/([^#\&\?]{11})/,
        /youtube\.com\/shorts\/([^#\&\?]{11})/,
        /youtube\.com\/.*[?&]v=([^#\&\?]{11})/
      ];
      for (const pattern of patterns) {
        const match = rawUrl.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/|shorts\/)([^#\&\?]{11})/;
      const match = rawUrl.match(regExp);
      if (match && match[2] && match[2].length === 11) {
        return match[2];
      }
      return null;
    };

    const videoId = getYouTubeId(url);

    if (!videoId) {
      return NextResponse.json({ error: "Not a valid YouTube URL" }, { status: 400 });
    }

    // Fetch details from YouTube oEmbed
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;

    const response = await fetch(oembedUrl);
    if (!response.ok) {
      // Return basic fallback details using video ID if oembed fails
      return NextResponse.json({
        title: `YouTube Video (${videoId})`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        description: "Devotional YouTube stream.",
        author: "YouTube Creator"
      });
    }

    const data = await response.json();

    // Use maxresdefault.jpg as primary high-quality thumbnail, fallback to oembed thumbnail
    const highResThumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    const hqThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    // Verify if maxresdefault exists or use hqdefault/oembed thumbnail
    // Since we are server-side, we can quickly check if maxresdefault exists
    let selectedThumbnail = highResThumbnail;
    try {
      const imgCheck = await fetch(highResThumbnail, { method: "HEAD" });
      if (!imgCheck.ok) {
        selectedThumbnail = hqThumbnail;
      }
    } catch {
      selectedThumbnail = data.thumbnail_url || hqThumbnail;
    }

    return NextResponse.json({
      title: data.title || `YouTube Video (${videoId})`,
      thumbnail: selectedThumbnail,
      description: `Spiritual stream by ${data.author_name || "YouTube Creator"}.`,
      author: data.author_name || "YouTube Creator",
      embedUrl: `https://www.youtube.com/embed/${videoId}`
    });
  } catch (error: any) {
    console.error("Error fetching YouTube details:", error);
    return NextResponse.json({ error: "Failed to fetch YouTube details" }, { status: 500 });
  }
}
