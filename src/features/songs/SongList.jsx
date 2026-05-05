import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import SongCard from "./SongCard";
import {
	getCachedStatus,
	setStatus as persistStatus,
	STATUSES,
	subscribeToUserData,
} from "./songStorage";
import "./SongList.css";

const GROUPS = [
	{ key: "learning", label: "Learning" },
	{ key: "planned", label: "Planned" },
	{ key: "completed", label: "Completed" },
];

function buildCachedStatusMap(songs) {
	const map = {};
	for (const song of songs) {
		map[song.id] = getCachedStatus(song.id);
	}
	return map;
}

function SongList({ songs, filter = "all" }) {
	const { user } = useAuth();
	const uid = user?.uid;

	const [statuses, setStatuses] = useState(() => buildCachedStatusMap(songs));
	const [openSongId, setOpenSongId] = useState(null);

	useEffect(() => {
		if (!uid) return undefined;
		const unsubscribe = subscribeToUserData(
			uid,
			({ statuses: remoteStatuses }) => {
				setStatuses((prev) => {
					const next = { ...prev };
					for (const song of songs) {
						if (!(song.id in remoteStatuses)) continue;
						const value = remoteStatuses[song.id];
						if (STATUSES.includes(value)) {
							next[song.id] = value;
						}
					}
					return next;
				});
			}
		);
		return unsubscribe;
	}, [uid, songs]);

	const updateStatus = (songId, next) => {
		setStatuses((prev) => ({ ...prev, [songId]: next }));
		persistStatus(uid, songId, next);
	};

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
