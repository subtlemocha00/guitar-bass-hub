import { STATUSES } from "./songStorage";
import { useSongNotes } from "./useSongNotes";
import "./SongCard.css";

function nextStatus(current) {
	const idx = STATUSES.indexOf(current);
	return STATUSES[(idx + 1) % STATUSES.length];
}

function NotesField({ songId }) {
	const { note, setNote } = useSongNotes(songId);
	return (
		<textarea
			className="song-card-notes"
			value={note}
			onChange={(e) => setNote(e.target.value)}
			placeholder="Notes…"
			rows={2}
		/>
	);
}

function SongInfo({ song }) {
	const content = (
		<>
			<h3 className="song-card-title">{song.title}</h3>
			<p className="song-card-artist">{song.artist}</p>
		</>
	);

	if (!song.tabUrl) {
		return <div className="song-card-info">{content}</div>;
	}

	return (
		<a
			className="song-card-info song-card-info--link"
			href={song.tabUrl}
			target="_blank"
			rel="noopener noreferrer"
			title="Open tab in new tab"
		>
			{content}
		</a>
	);
}

function SongCard({
	song,
	status,
	onStatusChange,
	videoOpen,
	onToggleVideo,
}) {
	const handleCycle = () => onStatusChange(nextStatus(status));

	return (
		<article className={`song-card song-card--${status}`}>
			<div className="song-card-head">
				<SongInfo song={song} />
				<button
					type="button"
					className="song-card-status"
					onClick={handleCycle}
					aria-label={`Status: ${status}. Click to change.`}
				>
					{status}
				</button>
			</div>

			<NotesField songId={song.id} />

			{song.youtubeId && (
				<>
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

					{videoOpen && (
						<div className="song-card-video">
							<iframe
								src={`https://www.youtube-nocookie.com/embed/${song.youtubeId}`}
								title={`${song.title} — ${song.artist}`}
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowFullScreen
								loading="lazy"
							/>
						</div>
					)}
				</>
			)}
		</article>
	);
}

export default SongCard;
