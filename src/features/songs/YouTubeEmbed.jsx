import "./SongCard.css";

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

export function VideoPlayer({ youtubeId, title }) {
	return (
		<div className="song-card-video">
			<iframe
				src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
				title={title}
				allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
				allowFullScreen
				loading="lazy"
			/>
		</div>
	);
}

export default function YouTubeEmbed({ youtubeId, title, videoOpen, onToggleVideo }) {
	if (!youtubeId) return null;
	return (
		<>
			<VideoToggleButton videoOpen={videoOpen} onToggleVideo={onToggleVideo} />
			{videoOpen && <VideoPlayer youtubeId={youtubeId} title={title} />}
		</>
	);
}
