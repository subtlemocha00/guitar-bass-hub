import { useState } from "react";
import { isSelfHandledClick } from "../../components/cardClick";
import CollapsibleNotes from "../../components/CollapsibleNotes";
import ConfirmDialog from "../../components/ConfirmDialog";
import YouTubeEmbed from "../songs/YouTubeEmbed";
import TrackPills from "./TrackPills";
import "./BackingTrackCard.css";

function BackingTrackCard({
	track,
	videoOpen,
	onToggleVideo,
	onEdit,
	onRemove,
	onSelect,
}) {
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	const confirmRemove = () => {
		setConfirmingRemove(false);
		if (onRemove) onRemove();
	};

	// Matches SongCard: anywhere on the card selects it, the title is also a
	// real button so the card works from the keyboard, and the action sheet is
	// owned by the list.
	const handleCardClick = (e) => {
		if (isSelfHandledClick(e)) return;
		onSelect();
	};

	return (
		<article className="bt-card" onClick={handleCardClick}>
			<h3 className="bt-card-title">
				<button
					type="button"
					className="bt-card-open"
					onClick={onSelect}
					aria-haspopup="dialog"
				>
					{track.title}
				</button>
			</h3>
			<p className="bt-card-artist">{track.artist}</p>

			<TrackPills track={track} className="bt-card-pills" />

			{(onEdit || onRemove) && (
				<div className="bt-card-actions">
					{onEdit && (
						<button type="button" className="bt-card-btn" onClick={onEdit}>
							✎ EDIT
						</button>
					)}
					{onRemove && (
						<button
							type="button"
							className="bt-card-btn bt-card-btn--remove"
							onClick={() => setConfirmingRemove(true)}
						>
							🗑 DELETE
						</button>
					)}
				</div>
			)}

			{/* Was a hand-rolled toggle + iframe + fallback link, duplicating what
			    YouTubeEmbed already does for song cards. Same component now, so
			    both card types get identical embed behaviour and chrome. */}
			<YouTubeEmbed
				youtubeId={track.youtubeId}
				title={`${track.title} — ${track.artist}`}
				videoOpen={videoOpen}
				onToggleVideo={onToggleVideo}
			/>

			{/* Read-only here — backing-track notes are edited in the add/edit
			    modal, so a track with none has nothing to reveal. */}
			{track.notes && (
				<CollapsibleNotes>
					<p className="bt-card-notes">{track.notes}</p>
				</CollapsibleNotes>
			)}

			<ConfirmDialog
				open={confirmingRemove}
				title="DELETE · BACKING TRACK"
				message={`Delete "${track.title}" by ${track.artist}? This cannot be undone.`}
				confirmLabel="DELETE"
				onConfirm={confirmRemove}
				onCancel={() => setConfirmingRemove(false)}
			/>
		</article>
	);
}

export default BackingTrackCard;
