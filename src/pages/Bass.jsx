import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import { bassSongs } from "../data/bassSongs";
import { useSongStatus } from "../features/songs/useSongStatus";
import "./Bass.css";

const TOOLS = [
	{ to: "/bass/tuner", code: "MOD_01", name: "Tuner", tag: "PITCH·LOCK", desc: "4-string EADG via mic input. Median-smoothed pitch detect.", live: true },
	{ to: "/bass/songs", code: "MOD_02", name: "Songs", tag: "REPERTOIRE", desc: "Track planned, learning and completed bass tracks. Notes per song.", live: true },
	{ to: "/bass/fretboard", code: "MOD_03", name: "Fretboard", tag: "SCALE·MAP", desc: "Visualize scales across the neck. 8 patterns × 12 roots.", live: true },
	{ to: "/bass/metronome", code: "MOD_04", name: "Metronome", tag: "TEMPO·LOCK", desc: "Web Audio click. 40–240 BPM, accented downbeat, tap tempo.", live: true },
	{ to: "/bass/scales", code: "MOD_05", name: "Scales", tag: "DRILLS", desc: "Coming soon — guided scale drills with audio playback.", live: false },
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
	return (
		<Link to={t.to} className="tool-block hud" style={{ "--tool-accent": accent }}>
			<span className="hud-corner-tr" />
			<span className="hud-corner-bl" />
			<div className="tool-block-head">
				<span className="tool-block-code">{t.code}</span>
				<span className="tool-block-tag">{t.tag}</span>
				<span className="tool-block-status tool-block-status--live"><span className="dot" /> LIVE</span>
			</div>
			<div className="tool-block-name">{t.name}</div>
			<p className="tool-block-desc">{t.desc}</p>
			<div className="tool-block-cta">ENGAGE → </div>
		</Link>
	);
}

function Bass() {
	const { statuses } = useSongStatus(bassSongs);
	const learning = Object.values(statuses).filter((s) => s === "learning").length;
	const done = Object.values(statuses).filter((s) => s === "completed").length;

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
								<div className="v">{bassSongs.length}</div>
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
