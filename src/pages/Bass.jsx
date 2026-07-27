import { Link } from "react-router";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import { externalLinkProps, isExternalUrl } from "../platform/links";
import { useSongStatus } from "../features/songs/useSongStatus";
import { useUserSongs } from "../features/songs/useUserSongs";
import "./Bass.css";

const TOOLS = [
	{ to: "/bass/songs", code: "MOD_01", name: "Songs", tag: "REPERTOIRE", desc: "Track planned, learning and completed bass tracks. Notes per song.", live: true },
	{ to: "/bass/backing-tracks", code: "MOD_02", name: "Backing Tracks", tag: "JAM·LOOP", desc: "Save jam tracks with BPM, key and genre. Open on YouTube to play along.", live: true },
	{ to: "/bass/fretboard", code: "MOD_03", name: "Fretboard", tag: "SCALE·MAP", desc: "Visualize scales across the neck. 8 patterns × 12 roots.", live: true },
	{ to: "https://www.bassbuzz.com/lessons/the-ultimate-bass-setup-guide", code: "MOD_04", name: "Bass Setup", tag: "SETUP", desc: "A well-made guide for setting up your bass.", live: true },
];

function BassToolCard({ t, accent }) {
	if (!t.live) {
		return (
			<div className="tool-block tool-block--dim hud">
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />
				<div className="tool-block-head">
					<span className="tool-block-code">{t.code}</span>
					<span className="tool-block-tag">{t.tag}</span>
					<span className="tool-block-status">SOON</span>
				</div>
				<div className="tool-block-name">{t.name}</div>
				<p className="tool-block-desc">{t.desc}</p>
				<div className="tool-block-cta tool-block-cta--dim">— OFFLINE</div>
			</div>
		);
	}
	const body = (
		<>
			<span className="hud-corner-tr" />
			<span className="hud-corner-bl" />
			<div className="tool-block-head">
				<span className="tool-block-code">{t.code}</span>
				<span className="tool-block-tag">{t.tag}</span>
				<span className="tool-block-status tool-block-status--live"><span className="dot" /> LIVE</span>
			</div>
			<div className="tool-block-name">{t.name}</div>
			<p className="tool-block-desc">{t.desc}</p>
			<div className="tool-block-cta">{isExternalUrl(t.to) ? "OPEN ↗" : "ENGAGE → "}</div>
		</>
	);

	// External resources open in a separate tab/window. A router <Link> to an
	// absolute URL navigates the current document away from the app, which in a
	// packaged desktop/mobile webview would replace the app with no way back.
	if (isExternalUrl(t.to)) {
		return (
			<a
				{...externalLinkProps(t.to)}
				className="tool-block hud"
				style={{ "--tool-accent": accent }}
			>
				{body}
			</a>
		);
	}

	return (
		<Link to={t.to} className="tool-block hud" style={{ "--tool-accent": accent }}>
			{body}
		</Link>
	);
}

function Bass() {
	const { songs } = useUserSongs("bass");
	const { statuses } = useSongStatus(songs);
	const learning = songs.filter((s) => statuses[s.id] === "learning").length;
	const done = songs.filter((s) => statuses[s.id] === "completed").length;

	return (
		<Layout theme="bass">
			<div className="page bass-page">
				<BackLink to="/" label="Back to Hub" />

				<section className="instrument-hero hud instrument-hero--bass">
					<span className="hud-corner-tr" />
					<span className="hud-corner-bl" />
					<div className="instrument-hero-bg">
						<div className="instrument-hero-grid" />
						<div className="instrument-hero-sun instrument-hero-sun--bass" />
					</div>
					<div className="instrument-hero-inner">
						<span className="eyebrow">// NODE_01 · BASS_RIG</span>
						<h1 className="hero-title flicker">
							<span className="glitch" data-text="BASS">BASS</span>
						</h1>
						<p className="hero-subtitle">
							Low-end engine. Tune the four strings, drill the pocket, work
							the catalog. Routing signal through E·A·D·G.
						</p>
						<div className="hero-strip">
							<div className="strip-cell">
								<div className="k">Strings</div>
								<div className="v a">04</div>
								<div className="sub">E A D G</div>
							</div>
							<div className="strip-cell">
								<div className="k">Catalog</div>
								<div className="v">{songs.length}</div>
								<div className="sub">tracks</div>
							</div>
							<div className="strip-cell">
								<div className="k">Learning</div>
								<div className="v m">{learning}</div>
								<div className="sub">in flight</div>
							</div>
							<div className="strip-cell">
								<div className="k">Cleared</div>
								<div className="v a">{done}</div>
								<div className="sub">completed</div>
							</div>
						</div>
					</div>
				</section>

				<div className="section-stripe"><span className="label">// MODULES</span><span className="rule" /><span className="count">{String(TOOLS.length).padStart(2, "0")} LOADED</span></div>

				<section className="tool-grid">
					{TOOLS.map((t) => <BassToolCard key={t.code} t={t} accent="var(--neon-amber)" />)}
				</section>
			</div>
		</Layout>
	);
}

export default Bass;
