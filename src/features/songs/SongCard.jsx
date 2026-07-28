import { useState } from "react";
import { isSelfHandledClick } from "../../components/cardClick";
import CollapsibleNotes from "../../components/CollapsibleNotes";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useSongNotes } from "./useSongNotes";
import YouTubeEmbed from "./YouTubeEmbed";
import "./SongCard.css";

function NotesField({ songId }) {
	const { note, setNote } = useSongNotes(songId);
	return (
		<textarea
			className="song-card-notes"
			value={note}
			onChange={(e) => setNote(e.target.value)}
			placeholder="Notes…"
			rows={3}
		/>
	);
}

function SongCard({
	song,
	status,
	videoOpen,
	onToggleVideo,
	onRemove,
	onEdit,
	onSelect,
}) {
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	const confirmRemove = () => {
		setConfirmingRemove(false);
		if (onRemove) onRemove();
	};

	// Anywhere on the card selects it; the title is also a real button so the
	// card is reachable and operable from the keyboard, not only by pointer.
	// Selecting opens the action sheet, which SongList owns.
	const handleCardClick = (e) => {
		if (isSelfHandledClick(e)) return;
		onSelect();
	};

	return (
		<article
			className={`song-card song-card--${status}`}
			onClick={handleCardClick}
		>
			<h3 className="song-card-title">
				<button
					type="button"
					className="song-card-open"
					onClick={onSelect}
					aria-haspopup="dialog"
				>
					{song.title}
				</button>
			</h3>
			<p className="song-card-artist">{song.artist}</p>

			{(onEdit || onRemove) && (
				<div className="song-card-actions">
					{onEdit && (
						<button type="button" className="song-card-btn" onClick={onEdit}>
							✎ EDIT
						</button>
					)}
					{onRemove && (
						<button
							type="button"
							className="song-card-btn song-card-btn--remove"
							onClick={() => setConfirmingRemove(true)}
						>
							🗑 DELETE
						</button>
					)}
				</div>
			)}

			{/* The toggle stays on the card: the embed is already an
			    expand/collapse region, so routing it through the sheet would only
			    add a tap between the user and the video. The "Open on YouTube"
			    escape hatch does live in the sheet, which is why the player here
			    renders without its own copy. */}
			{song.youtubeId && (
				<YouTubeEmbed
					youtubeId={song.youtubeId}
					title={`${song.title} — ${song.artist}`}
					videoOpen={videoOpen}
					onToggleVideo={onToggleVideo}
					showWatchLink={false}
				/>
			)}

			<CollapsibleNotes>
				<NotesField songId={song.id} />
			</CollapsibleNotes>

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
