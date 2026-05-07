import "./BackingTrackCard.css";

function BackingTrackCard({ track, onEdit, onRemove }) {
	const handleRemove = () => {
		if (!onRemove) return;
		const ok = window.confirm(
			`Delete "${track.title}" by ${track.artist}? This cannot be undone.`
		);
		if (ok) onRemove();
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
				{track.youtubeUrl && (
					<a
						className="bt-card-btn bt-card-btn--open"
						href={track.youtubeUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						▶ OPEN ON YOUTUBE
					</a>
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
								onClick={handleRemove}
							>
								🗑 DELETE
							</button>
						)}
					</>
				)}
			</div>
		</article>
	);
}

export default BackingTrackCard;
