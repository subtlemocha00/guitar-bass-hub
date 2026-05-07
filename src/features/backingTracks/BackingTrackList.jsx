import BackingTrackCard from "./BackingTrackCard";

function BackingTrackList({ tracks, onEdit, onRemove }) {
	if (!tracks || tracks.length === 0) return null;

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
					onEdit={t.isUserCreated && onEdit ? () => onEdit(t) : undefined}
					onRemove={t.isUserCreated && onRemove ? () => onRemove(t.id) : undefined}
				/>
			))}
		</div>
	);
}

export default BackingTrackList;
