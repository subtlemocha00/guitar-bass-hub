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
	onRemove,
	onEdit,
}) {
	const handleCycle = () => onStatusChange(nextStatus(status));
	const handleRemove = () => {
		if (!onRemove) return;
		const ok = window.confirm(
			`Delete "${song.title}" by ${song.artist}? This cannot be undone.`
		);
		if (ok) onRemove();
	};
	const handleEdit = () => {
		if (onEdit) onEdit();
	};

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

			{song.youtubeId ? (
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
			) : (
				<button
					type="button"
					className="song-card-video-toggle"
					style={{ visibility: "hidden" }}
					disabled
					aria-hidden="true"
				>
					<span className="song-card-video-chevron" aria-hidden="true">
						▸
					</span>
					Show Video
				</button>
			)}

			{(onRemove || onEdit) && (
				<div className="song-card-actions">
					{onEdit && (
						<button
							type="button"
							className="song-card-edit"
							onClick={handleEdit}
						>
							✎ EDIT
						</button>
					)}
					{onRemove && (
						<button
							type="button"
							className="song-card-remove"
							onClick={handleRemove}
						>
							🗑 DELETE
						</button>
					)}
				</div>
			)}
		</article>
	);
}

export default SongCard;