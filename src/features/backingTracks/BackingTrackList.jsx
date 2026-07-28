import { useState } from "react";
import { useCardActionSheet } from "../../components/useCardActionSheet";
import BackingTrackCard from "./BackingTrackCard";
import TrackActionModal from "./TrackActionModal";

function BackingTrackList({ tracks, onEdit, onRemove }) {
	const [openTrackId, setOpenTrackId] = useState(null);
	const sheet = useCardActionSheet();

	if (!tracks || tracks.length === 0) return null;

	const toggleVideo = (id) =>
		setOpenTrackId((prev) => (prev === id ? null : id));

	// Re-read from the live list so an edit made while the sheet is open shows
	// in it; the captured copy is the fallback that keeps the sheet's content
	// intact through its exit transition. Matches SongList.
	const sheetTrack = sheet.item
		? tracks.find((t) => t.id === sheet.item.id) ?? sheet.item
		: null;

	return (
		<>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
					gap: "0.75rem",
				}}
			>
				{tracks.map((t) => (
					<BackingTrackCard
						key={t.id}
						track={t}
						videoOpen={openTrackId === t.id}
						onToggleVideo={() => toggleVideo(t.id)}
						onSelect={() => sheet.openFor(t)}
						onEdit={t.isUserCreated && onEdit ? () => onEdit(t) : undefined}
						onRemove={t.isUserCreated && onRemove ? () => onRemove(t.id) : undefined}
					/>
				))}
			</div>

			{/* One sheet for the whole list — see SongList and useCardActionSheet. */}
			<TrackActionModal
				open={sheet.open}
				track={sheetTrack}
				onClose={sheet.close}
			/>
		</>
	);
}

export default BackingTrackList;
