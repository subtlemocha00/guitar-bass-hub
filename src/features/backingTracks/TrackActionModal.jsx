import CardActionModal, {
	CardActionLink,
} from "../../components/CardActionModal";
import { youtubeWatchUrl } from "../songs/youtubeUtils";
import TrackPills from "./TrackPills";

// A backing track's action sheet.
//
// Same chrome and dismissal as a song's (CardActionModal), with the two
// differences the data actually has: YouTube is the destination rather than a
// tab URL, and there is no status — statuses live on songs, and inventing one
// here would mean a new Firestore field.
//
// Rendered by BackingTrackList, matching SongList, so both catalogues behave
// identically. See useCardActionSheet.
function TrackActionModal({ track, open, onClose }) {
	if (!track) return null;

	return (
		<CardActionModal
			open={open}
			eyebrow="// BACKING TRACK"
			title={track.title}
			onClose={onClose}
		>
			<p className="card-modal-subtitle">{track.artist}</p>

			{/* Primary here, unlike on a song sheet: a backing track has no tab,
			    so YouTube is the destination rather than the fallback. */}
			<CardActionLink url={youtubeWatchUrl(track.youtubeId)} onClose={onClose}>
				<span aria-hidden="true">↗</span> Open on YouTube
			</CardActionLink>

			<TrackPills track={track} className="card-modal-meta" />
		</CardActionModal>
	);
}

export default TrackActionModal;
