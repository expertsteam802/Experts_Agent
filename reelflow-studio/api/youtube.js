export default async function handler(req, res) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(503).json({ error: "YouTube search is not configured. Add YOUTUBE_API_KEY in Vercel Environment Variables." });
  const q = String(req.query.q || "popular shorts").slice(0, 100);
  try {
    const params = new URLSearchParams({ part: "snippet", type: "video", maxResults: "24", q, order: "relevance", videoEmbeddable: "true", key });
    const response = await fetch("https://www.googleapis.com/youtube/v3/search?" + params);
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "YouTube API request failed." });
    return res.status(200).json({ items: (data.items || []).map(v => ({
      id: v.id.videoId, title: v.snippet.title, channel: v.snippet.channelTitle,
      thumbnail: v.snippet.thumbnails?.high?.url, platform: "youtube",
      url: "https://www.youtube.com/shorts/" + v.id.videoId
    })) });
  } catch { return res.status(502).json({ error: "Could not reach YouTube. Try again." }); }
}