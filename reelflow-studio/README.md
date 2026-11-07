# ReelFlow Studio

Standalone combined YouTube Shorts + Instagram Reels discovery app.

## Deploy to Vercel
1. Import this repository/branch into Vercel.
2. Set **Root Directory** to `reelflow-studio`.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add `YOUTUBE_API_KEY` as a Vercel environment variable.

## YouTube API
Enable YouTube Data API v3 in Google Cloud, create an API key, and restrict it to your production domain and the YouTube Data API. Search uses the Vercel serverless route `/api/youtube`. Results are embeddable videos; the API does not guarantee that every result is a Short.

## Instagram
Paste a public Instagram Reel URL to embed it when Instagram allows embedding. Meta's official APIs do not provide unrestricted search over all public Reels. The Instagram connection panel is a setup placeholder; complete Meta app review, approved login permissions, and OAuth callback handling before enabling account login.

## Notes
Saved items currently live in browser memory only. Add a database and authenticated user sessions for cross-device persistence. Never put provider secrets in frontend code.