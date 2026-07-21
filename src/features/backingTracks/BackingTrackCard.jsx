import { useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import "./BackingTrackCard.css";

function BackingTrackCard({ track, videoOpen, onToggleVideo, onEdit, onRemove }) {
	const [confirmingRemove, setConfirmingRemove] = useState(false);

	const confirmRemove = () => {
		setConfirmingRemove(false);
		if (onRemove) onRemove();
	};

	const showActions = onEdit || onRemove;

	return (
		<article className="bt-card">
			<div className="bt-card-head">
				<div className="bt-card-info">
					<h3 className="bt-card-title">{track.title}</h3>
					<p className="bt-card-artist">{track.artist}</p>
				</div>
			</div>

			{(track.genre || track.bpm != null || track.trackKey) && (
				<div className="bt-card-pills">
					{track.genre && (
						<span className="bt-card-pill bt-card-pill--genre">{track.genre}</span>
					)}
					{track.bpm != null && (
						<span className="bt-card-pill bt-card-pill--bpm">{track.bpm} BPM</span>
					)}
					{track.trackKey && (
						<span className="bt-card-pill bt-card-pill--key">KEY · {track.trackKey}</span>
					)}
				</div>
			)}

			{track.notes && <p className="bt-card-notes">{track.notes}</p>}

			<div className="bt-card-actions">
				{track.youtubeId && onToggleVideo && (
					<button
						type="button"
						className="bt-card-btn bt-card-btn--open"
						onClick={onToggleVideo}
						aria-expanded={!!videoOpen}
					>
						<span aria-hidden="true">{videoOpen ? "▾" : "▸"}</span>
						{videoOpen ? "HIDE VIDEO" : "SHOW VIDEO"}
					</button>
				)}
				{showActions && (
					<>
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
					</>
				)}
			</div>

			{track.youtubeId && videoOpen && (
				<div className="bt-card-video">
					<iframe
						src={`https://www.youtube-nocookie.com/embed/${track.youtubeId}`}
						title={`${track.title} — ${track.artist}`}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowFullScreen
						loading="lazy"
					/>
				</div>
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
