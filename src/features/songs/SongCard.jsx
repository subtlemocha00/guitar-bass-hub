import { useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { externalLinkProps } from "../../platform/openExternal";
import { STATUSES } from "./songStorage";
import { useSongNotes } from "./useSongNotes";
import YouTubeEmbed from "./YouTubeEmbed";
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
			{...externalLinkProps(song.tabUrl)}
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
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	const handleCycle = () => onStatusChange(nextStatus(status));
	const handleEdit = () => {
		if (onEdit) onEdit();
	};
	const confirmRemove = () => {
		setConfirmingRemove(false);
		if (onRemove) onRemove();
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
				<YouTubeEmbed
					youtubeId={song.youtubeId}
					title={`${song.title} — ${song.artist}`}
					videoOpen={videoOpen}
					onToggleVideo={onToggleVideo}
				/>
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
							onClick={() => setConfirmingRemove(true)}
						>
							🗑 DELETE
						</button>
					)}
				</div>
			)}

			<ConfirmDialog
				open={confirmingRemove}
				title="DELETE · SONG"
				message={`Delete "${song.title}" by ${song.artist}? This cannot be undone.`}
				confirmLabel="DELETE"
				onConfirm={confirmRemove}
				onCancel={() => setConfirmingRemove(false)}
			/>
		</article>
	);
}

export default SongCard;