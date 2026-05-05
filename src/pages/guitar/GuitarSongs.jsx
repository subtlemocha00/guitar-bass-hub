import Layout from "../../components/Layout";
import BackLink from "../../components/BackLink";
import { useState } from "react";
import { guitarSongs } from "../../data/guitarSongs";
import SongFilterTabs from "../../features/songs/SongFilterTabs";
import SongList from "../../features/songs/SongList";
import { useSongStatus } from "../../features/songs/useSongStatus";
import "../bass/BassSongs.css";

function GuitarSongs() {
	const [filter, setFilter] = useState("all");
	const { statuses } = useSongStatus(guitarSongs);
	const learning = Object.values(statuses).filter((s) => s === "learning").length;
	const done = Object.values(statuses).filter((s) => s === "completed").length;
	const planned = Object.values(statuses).filter((s) => s === "planned").length;

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
						{guitarSongs.length} tracks tracked. Click a status badge to cycle
						planned → learning → completed. Notes auto-save.
					</p>
					<div className="songs-counters">
						<span className="cnt cnt--c"><span className="dot" /> PLANNED · {planned}</span>
						<span className="cnt cnt--m"><span className="dot" /> LEARNING · {learning}</span>
						<span className="cnt cnt--l"><span className="dot" /> COMPLETED · {done}</span>
					</div>
				</header>

				<SongFilterTabs filter={filter} onChange={setFilter} />
				<SongList songs={guitarSongs} filter={filter} />
			</div>
		</Layout>
	);
}

export default GuitarSongs;
