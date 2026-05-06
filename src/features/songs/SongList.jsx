import { useState } from "react";
import SongCard from "./SongCard";
import { useSongStatus } from "./useSongStatus";
import "./SongList.css";

const GROUPS = [
	{ key: "learning", label: "Learning" },
	{ key: "planned", label: "Planned" },
	{ key: "completed", label: "Completed" },
];

function SongList({ songs, filter = "all", onRemove, onEdit }) {
	const { statuses, updateStatus } = useSongStatus(songs);
	const [openSongId, setOpenSongId] = useState(null);

	const toggleVideo = (songId) => {
		setOpenSongId((prev) => (prev === songId ? null : songId));
	};

	const grouped = GROUPS.map((group) => ({
		...group,
		songs: songs.filter((s) => statuses[s.id] === group.key),
	}));

	const visible =
		filter === "all" ? grouped : grouped.filter((g) => g.key === filter);

	return (
		<div className="song-list">
			{visible.length === 0 || visible.every((g) => g.songs.length === 0) ? (
				<p className="song-list-empty">No songs in this view.</p>
			) : null}
			{visible.map(
				(group) =>
					group.songs.length > 0 && (
						<section key={group.key} className="song-list-group">
							<h2
								className={`song-list-group-title song-list-group-title--${group.key}`}
							>
								<span>{group.label}</span>
								<span className="song-list-group-count">
									{group.songs.length}
								</span>
							</h2>
							<div className="song-list-group-items">
								{group.songs.map((song) => (
									<SongCard
										key={song.id}
										song={song}
										status={statuses[song.id]}
										onStatusChange={(next) => updateStatus(song.id, next)}
										videoOpen={openSongId === song.id}
										onToggleVideo={() => toggleVideo(song.id)}
										onRemove={
											song.isUserCreated && onRemove
												? () => onRemove(song.id)
												: undefined
										}
										onEdit={
											song.isUserCreated && onEdit
												? () => onEdit(song)
												: undefined
										}
									/>
								))}
							</div>
						</section>
					)
			)}
		</div>
	);
}

export default SongList;
