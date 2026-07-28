import CardActionModal from "../../components/CardActionModal";
import { externalLinkProps } from "../../platform/links";
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

	const watchUrl = youtubeWatchUrl(track.youtubeId);
	const watchLinkProps = watchUrl ? externalLinkProps(watchUrl) : null;

	return (
		<CardActionModal
			open={open}
			eyebrow="// BACKING TRACK"
			title={track.title}
			onClose={onClose}
		>
			<p className="card-modal-subtitle">{track.artist}</p>

			{watchLinkProps && (
				<a
					className="card-modal-action"
					{...watchLinkProps}
					onClick={(e) => {
						// See SongActionModal: spread order replaces the handler
						// externalLinkProps adds on the packaged shells.
						watchLinkProps.onClick?.(e);
						onClose();
					}}
				>
					<span aria-hidden="true">↗</span> Open on YouTube
				</a>
			)}

			<TrackPills track={track} className="card-modal-meta" />
		</CardActionModal>
	);
}

export default TrackActionModal;
