import { externalLinkProps } from "../../platform/links";
import { youtubeWatchUrl } from "./youtubeUtils";
import "./SongCard.css";
import "./YouTubeEmbed.css";

export function VideoToggleButton({ videoOpen, onToggleVideo }) {
	return (
		<button
			type="button"
			className="song-card-video-toggle"
			onClick={onToggleVideo}
			aria-expanded={videoOpen}
		>
			<span className="song-card-video-chevron" aria-hidden="true">
				{videoOpen ? "▾" : "▸"}
			</span>
			{videoOpen ? "Hide Video" : "Show Video"}
		</button>
	);
}

// The universal "Open on YouTube" fallback. Every embed surface must offer it,
// because a YouTube iframe's in-document failure ("Video unavailable", a
// bot-check, or a webview refusing to play a custom-scheme embed) is invisible
// to the parent frame — the iframe is cross-origin and `onError` does not fire
// for it, so an automatic fallback is impossible (youtube-native-compatibility.md).
//
// WHAT MUST NOT CHANGE is that the escape hatch exists on every surface; WHERE
// it sits is a layout decision. Song and backing-track cards moved it into
// their action sheet (see `showWatchLink` on VideoPlayer/YouTubeEmbed) so the
// card carries one control per row instead of two. Setlist and the blog keep it
// beside the player, which is why the prop defaults to showing it.
//
// It leaves the app through externalLinkProps, the platform/links seam: on web a
// plain target="_blank"; on Capacitor and Tauri the same anchor's click is routed
// through openExternal (in-app Browser / system opener). No feature component
// touches Browser.open or window.open directly.
export function WatchOnYouTube({ youtubeId, title }) {
	const url = youtubeWatchUrl(youtubeId);
	if (!url) return null;
	return (
		<a
			className="youtube-fallback-link"
			{...externalLinkProps(url)}
			aria-label={title ? `Open "${title}" on YouTube` : "Open on YouTube"}
		>
			<span aria-hidden="true">↗</span> Open on YouTube
		</a>
	);
}

// `showWatchLink` opts a surface out of the inline fallback link — for callers
// that offer "Open on YouTube" somewhere else, like the cards' action sheet. It
// defaults to true so no existing surface changes by omission: dropping the
// escape hatch has to be a deliberate act with somewhere else to put it.
export function VideoPlayer({ youtubeId, title, showWatchLink = true }) {
	return (
		<>
			<div className="song-card-video">
				<iframe
					src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
					title={title}
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					loading="lazy"
				/>
			</div>
			{showWatchLink && <WatchOnYouTube youtubeId={youtubeId} title={title} />}
		</>
	);
}

export default function YouTubeEmbed({
	youtubeId,
	title,
	videoOpen,
	onToggleVideo,
	showWatchLink = true,
}) {
	if (!youtubeId) return null;
	return (
		<>
			<VideoToggleButton videoOpen={videoOpen} onToggleVideo={onToggleVideo} />
			{videoOpen && (
				<VideoPlayer
					youtubeId={youtubeId}
					title={title}
					showWatchLink={showWatchLink}
				/>
			)}
		</>
	);
}
