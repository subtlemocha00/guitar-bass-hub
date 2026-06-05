import { useState } from "react";
import Layout from "../../components/Layout";
import BackLink from "../../components/BackLink";
import { useUserBackingTracks } from "./useUserBackingTracks";
import AddBackingTrackModal from "./AddBackingTrackModal";
import BackingTrackList from "./BackingTrackList";
import "../../pages/bass/BassSongs.css";

const META = {
	bass: {
		backTo: "/bass",
		backLabel: "Back to Bass",
		eyebrow: "// MOD_03 · BASS · BACKING_TRACKS",
		title: "BASS:: BACKING_TRACKS",
	},
	guitar: {
		backTo: "/guitar",
		backLabel: "Back to Guitar",
		eyebrow: "// MOD_03 · GUITAR · BACKING_TRACKS",
		title: "GUITAR:: BACKING_TRACKS",
	},
};

function BackingTracksPage({ instrument }) {
	const [showAdd, setShowAdd] = useState(false);
	const [editing, setEditing] = useState(null);
	const { tracks, addTrack, removeTrack, updateTrack, signedIn } =
		useUserBackingTracks(instrument);

	const meta = META[instrument] || META.guitar;

	const subtitle = signedIn
		? `${tracks.length} track${tracks.length === 1 ? "" : "s"} on file. Open on YouTube to play along.`
		: `Showing ${tracks.length} sample track${tracks.length === 1 ? "" : "s"}. Sign in to save your own.`;

	return (
		<Layout theme={instrument}>
			<div className="page bass-songs-page">
				<BackLink to={meta.backTo} label={meta.backLabel} />

				<header className="songs-header hud">
					<span className="hud-corner-tr" />
					<span className="hud-corner-bl" />
					<span className="eyebrow">{meta.eyebrow}</span>
					<h1 className="songs-title">
						<span className="glitch" data-text={meta.title}>{meta.title}</span>
					</h1>
					<p className="songs-sub">{subtitle}</p>
				</header>

				<div className="songs-toolbar">
					<span
						className="eyebrow"
						style={{ color: "var(--text-mute)", letterSpacing: "0.22em" }}
					>
						// CATALOG · {String(tracks.length).padStart(2, "0")}
					</span>
					{signedIn && (
						<button
							type="button"
							className="songs-add-btn"
							onClick={() => setShowAdd(true)}
						>
							+ ADD TRACK
						</button>
					)}
				</div>

				{tracks.length === 0 ? (
					<p className="songs-empty">
						{signedIn
							? "NO TRACKS YET — ADD YOUR FIRST ONE."
							: "SIGN IN TO ADD AND SAVE YOUR OWN BACKING TRACKS."}
					</p>
				) : (
					<BackingTrackList
						tracks={tracks}
						onEdit={setEditing}
						onRemove={removeTrack}
					/>
				)}

				<AddBackingTrackModal
					open={showAdd}
					onClose={() => setShowAdd(false)}
					onSubmit={addTrack}
				/>

				<AddBackingTrackModal
					open={!!editing}
					mode="edit"
					initialValues={
						editing
							? {
								title: editing.title,
								artist: editing.artist,
								youtubeUrl: editing.youtubeUrl,
								genre: editing.genre,
								bpm: editing.bpm,
								trackKey: editing.trackKey,
								notes: editing.notes,
							}
							: undefined
					}
					onClose={() => setEditing(null)}
					onSubmit={(data) => updateTrack(editing.id, data)}
				/>
			</div>
		</Layout>
	);
}

export default BackingTracksPage;
