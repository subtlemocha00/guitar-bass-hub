import Layout from "../../components/Layout";
import BackLink from "../../components/BackLink";
import { useState } from "react";
import AddSongModal from "../../features/songs/AddSongModal";
import SongFilterTabs from "../../features/songs/SongFilterTabs";
import SongSortMenu from "../../features/songs/SongSortMenu";
import SongList from "../../features/songs/SongList";
import { useSongStatus } from "../../features/songs/useSongStatus";
import { useUserSongs } from "../../features/songs/useUserSongs";
import { useSortPreference } from "../../features/songs/useSortPreference";
import "../bass/BassSongs.css";

function GuitarSongs() {
	const [filter, setFilter] = useState("all");
	const [sort, setSort] = useSortPreference("guitar");
	const [showAdd, setShowAdd] = useState(false);
	const [editingSong, setEditingSong] = useState(null);

	const { songs, addSong, removeSong, updateSong } = useUserSongs("guitar");
	const { statuses } = useSongStatus(songs);

	const learning = songs.filter((s) => statuses[s.id] === "learning").length;
	const done = songs.filter((s) => statuses[s.id] === "completed").length;
	const planned = songs.filter((s) => statuses[s.id] === "planned").length;

	return (
		<Layout theme="guitar">
			<div className="page bass-songs-page">
				<BackLink to="/guitar" label="Back to Guitar" />

				<header className="songs-header hud">
					<span className="hud-corner-tr" />
					<span className="hud-corner-bl" />
					<span className="eyebrow">// MOD_02 · GUITAR · REPERTOIRE</span>
					<h1 className="songs-title">
						<span className="glitch" data-text="GUITAR::SONGS">GUITAR::SONGS</span>
					</h1>
					<p className="songs-sub">
						{songs.length} tracks tracked. Select a song to open its tab or
						set its status. Notes auto-save.
					</p>
					<div className="songs-counters">
						<span className="cnt cnt--c"><span className="dot" /> PLANNED · {planned}</span>
						<span className="cnt cnt--m"><span className="dot" /> LEARNING · {learning}</span>
						<span className="cnt cnt--l"><span className="dot" /> COMPLETED · {done}</span>
					</div>
				</header>

				<div className="songs-toolbar">
					<div className="songs-toolbar-controls">
						<SongFilterTabs filter={filter} onChange={setFilter} />
						<SongSortMenu sort={sort} onChange={setSort} />
					</div>
					<button
						type="button"
						className="songs-add-btn"
						onClick={() => setShowAdd(true)}
					>
						+ ADD SONG
					</button>
				</div>

				{songs.length === 0 ? (
					<p className="songs-empty">
						NO SONGS YET — ADD YOUR FIRST ONE.
					</p>
				) : (
					<SongList
						songs={songs}
						filter={filter}
						sort={sort}
						onRemove={removeSong}
						onEdit={setEditingSong}
					/>
				)}

				<AddSongModal
					open={showAdd}
					onClose={() => setShowAdd(false)}
					onSubmit={addSong}
				/>

				<AddSongModal
					open={!!editingSong}
					mode="edit"
					initialValues={
						editingSong
							? {
									title: editingSong.title,
									artist: editingSong.artist,
									tabUrl: editingSong.tabUrl,
									youtubeUrl: editingSong.youtubeUrl ?? "",
								}
							: undefined
					}
					onClose={() => setEditingSong(null)}
					onSubmit={(data) => updateSong(editingSong.id, data)}
				/>
			</div>
		</Layout>
	);
}

export default GuitarSongs;
