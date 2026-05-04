import { useState } from "react";
import BackLink from "../../components/BackLink";
import Layout from "../../components/Layout";
import { bassSongs } from "../../data/bassSongs";
import SongFilterTabs from "../../features/songs/SongFilterTabs";
import SongList from "../../features/songs/SongList";
import "./BassSongs.css";

function BassSongs() {
	const [filter, setFilter] = useState("all");

	return (
		<Layout>
			<section className="bass-songs-page">
				<BackLink to="/bass" label="Back to Bass" />
				<header className="bass-songs-header">
					<h1 className="bass-songs-title">Bass Songs</h1>
					<p className="bass-songs-subtitle">
						{bassSongs.length} songs in your practice list. Click a status
						badge to cycle through planned → learning → completed.
					</p>
				</header>

				<SongFilterTabs filter={filter} onChange={setFilter} />
				<SongList songs={bassSongs} filter={filter} />
			</section>
		</Layout>
	);
}

export default BassSongs;
