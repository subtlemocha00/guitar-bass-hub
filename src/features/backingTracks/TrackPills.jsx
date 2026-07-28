// GENRE / BPM / KEY badges. Shared by the card and its action sheet, which show
// the same three facts in two places — only the container's layout differs, so
// only the class name is a prop.
function TrackPills({ track, className }) {
	if (!track.genre && track.bpm == null && !track.trackKey) return null;
	return (
		<div className={className}>
			{track.genre && (
				<span className="bt-card-pill bt-card-pill--genre">{track.genre}</span>
			)}
			{track.bpm != null && (
				<span className="bt-card-pill bt-card-pill--bpm">{track.bpm} BPM</span>
			)}
			{track.trackKey && (
				<span className="bt-card-pill bt-card-pill--key">
					KEY · {track.trackKey}
				</span>
			)}
		</div>
	);
}

export default TrackPills;
