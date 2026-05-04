import { useState } from "react";
import BackLink from "../../components/BackLink";
import Layout from "../../components/Layout";
import { guitarSongs } from "../../data/guitarSongs";
import SongFilterTabs from "../../features/songs/SongFilterTabs";
import SongList from "../../features/songs/SongList";
import "./GuitarSongs.css";

function GuitarSongs() {
	const [filter, setFilter] = useState("all");

	return (
		<Layout theme="guitar">
			<section className="guitar-songs-page">
				<BackLink to="/guitar" label="Back to Guitar" />
				<header className="guitar-songs-header">
					<h1 className="guitar-songs-title">Guitar Songs</h1>
					<p className="guitar-songs-subtitle">
						{guitarSongs.length} songs in your practice list. Click a status
						badge to cycle through planned → learning → completed.
					</p>
				</header>

				<SongFilterTabs filter={filter} onChange={setFilter} />
				<SongList songs={guitarSongs} filter={filter} />
			</section>
		</Layout>
	);
}

export default GuitarSongs;
