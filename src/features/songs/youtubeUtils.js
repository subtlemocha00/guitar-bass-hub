// Single source of truth for YouTube ID parsing. Shared by songs, backing
// tracks and the setlist — accepts a full watch URL, a youtu.be short URL, or
// a bare 11-character ID. Returns null when nothing usable is found.
export function extractYoutubeId(url) {
	if (!url) return null;
	let m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
	return null;
}

// Inverse of extractYoutubeId: a bare 11-character ID -> a canonical watch URL.
// Used by the "Open on YouTube" fallback that every embed surface shows, because
// an embed's in-document failure (YouTube's own "Video unavailable" screen)
// cannot be detected from the parent frame — see youtube-native-compatibility.md.
// The blog stores only an ID, so a shared ID -> URL helper is the one piece of
// URL logic the fallback needs and must not be duplicated per surface. Returns
// null for anything that is not a valid ID, so callers render no dead link.
export function youtubeWatchUrl(id) {
	if (typeof id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
	return `https://www.youtube.com/watch?v=${id}`;
}
