import CardActionModal, {
	CardActionLink,
} from "../../components/CardActionModal";
import { STATUSES } from "./songStorage";
import { youtubeWatchUrl } from "./youtubeUtils";

const STATUS_LABELS = {
	planned: "Planned",
	learning: "Learning",
	completed: "Completed",
};

// What a song's action sheet contains: where to go, and what state the song is
// in. The sheet chrome, dismissal and transition all come from CardActionModal;
// this is only the body.
//
// Rendered by SongList, not SongCard — see useCardActionSheet for why.
function SongActionModal({ song, status, onStatusChange, open, onClose }) {
	if (!song) return null;

	// A <select> whose value is not among its options goes uncontrolled. The
	// cycle button this replaced normalised an unknown status the same way.
	const selected = STATUSES.includes(status) ? status : STATUSES[0];

	return (
		<CardActionModal
			open={open}
			eyebrow="// SONG"
			title={song.title}
			onClose={onClose}
		>
			<p className="card-modal-subtitle">{song.artist}</p>

			<CardActionLink url={song.tabUrl} onClose={onClose}>
				<span aria-hidden="true">↗</span> Go to Tab
			</CardActionLink>

			{/* The escape hatch for an embed that fails silently on the card —
			    see WatchOnYouTube. Secondary, because the tab is what a song in
			    this list is for. */}
			<CardActionLink
				url={youtubeWatchUrl(song.youtubeId)}
				onClose={onClose}
				variant="secondary"
			>
				<span aria-hidden="true">↗</span> Open on YouTube
			</CardActionLink>

			<label className="card-modal-field">
				<span className="card-modal-label">STATUS</span>
				<select
					className={`card-modal-select card-modal-select--${selected}`}
					value={selected}
					onChange={(e) => onStatusChange(e.target.value)}
				>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{STATUS_LABELS[s]}
						</option>
					))}
				</select>
			</label>
		</CardActionModal>
	);
}

export default SongActionModal;
