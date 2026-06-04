import { useState } from "react";
import BackingTrackCard from "./BackingTrackCard";

function BackingTrackList({ tracks, onEdit, onRemove }) {
	const [openTrackId, setOpenTrackId] = useState(null);

	if (!tracks || tracks.length === 0) return null;

	const toggleVideo = (id) =>
		setOpenTrackId((prev) => (prev === id ? null : id));

	return (
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
					onEdit={t.isUserCreated && onEdit ? () => onEdit(t) : undefined}
					onRemove={t.isUserCreated && onRemove ? () => onRemove(t.id) : undefined}
				/>
			))}
		</div>
	);
}

export default BackingTrackList;
