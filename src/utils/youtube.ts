export function extractYoutubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;

  try {
    const cleanedUrl = url.trim();

    // Specific Regex patterns for YouTube validation
    // 1. https://www.youtube.com/watch?v=VIDEO_ID (supports watch?v=VIDEO_ID, watch?v=VIDEO_ID&..., and watch?feature=...&v=VIDEO_ID)
    // 2. https://youtu.be/VIDEO_ID
    // 3. https://youtube.com/shorts/VIDEO_ID
    // 4. https://www.youtube.com/embed/VIDEO_ID

    const watchRegex = /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:[^&]*&)*v=([a-zA-Z0-9_-]{11})(?:&.*)?$/i;
    const shortRegex = /^(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/i;
    const shortsRegex = /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/i;
    const embedRegex = /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?.*)?$/i;

    let match = cleanedUrl.match(watchRegex);
    if (match) return match[1];

    match = cleanedUrl.match(shortRegex);
    if (match) return match[1];

    match = cleanedUrl.match(shortsRegex);
    if (match) return match[1];

    match = cleanedUrl.match(embedRegex);
    if (match) return match[1];
  } catch (e) {
    return null;
  }

  return null;
}
