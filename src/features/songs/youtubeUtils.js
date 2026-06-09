export function extractYoutubeId(url) {
	if (!url) return null;
	let m = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
	if (m) return m[1];
	if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
	return null;
}
