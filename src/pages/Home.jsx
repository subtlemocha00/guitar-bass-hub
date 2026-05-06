import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { useSongStatus } from "../features/songs/useSongStatus";
import { useUserSongs } from "../features/songs/useUserSongs";
import "./Home.css";

function Stat({ k, v, c, sub }) {
	return (
		<div className="strip-cell">
			<div className="k">{k}</div>
			<div className={"v " + (c || "")}>{v}</div>
			{sub && <div className="sub">{sub}</div>}
		</div>
	);
}

function InstrumentDeck({ instrument, accent, accentVar, glowVar, count, learning, completed, sunHue }) {
	const to = "/" + instrument;
	const sunStyle = {
		"--sun-1": sunHue.a,
		"--sun-2": sunHue.b,
		"--sun-3": sunHue.c,
	};

	return (
		<Link to={to} className={"deck deck--" + instrument} style={sunStyle}>
			<div className="deck-bg">
				<div className="deck-grid" />
				<div className="deck-sun" />
				<div className="deck-haze" />
			</div>
			<span className="hud-corner-tr" />
			<span className="hud-corner-bl" />

			<div className="deck-meta">
				<span className="deck-id">// 0{instrument === "bass" ? "1" : "2"}</span>
				<span className="deck-status">
					<span className="dot" /> ONLINE
				</span>
			</div>

			<div className="deck-name" data-text={instrument.toUpperCase()}>
				{instrument.toUpperCase()}
			</div>
			<div className="deck-tag">
				{instrument === "bass" ? "LOW · END · ENGINE" : "SIX · STRING · CIRCUIT"}
			</div>

			<div className="deck-stats">
				<div>
					<div className="num">{count}</div>
					<div className="lbl">Songs</div>
				</div>
				<div>
					<div className="num">{learning}</div>
					<div className="lbl">Learning</div>
				</div>
				<div>
					<div className="num">{completed}</div>
					<div className="lbl">Done</div>
				</div>
			</div>

			<div className="deck-cta">
				<span>ENTER {instrument.toUpperCase()}</span>
				<span className="arrow">→</span>
			</div>
		</Link>
	);
}

const BASS_TOOLS = [
	{ key: "01", label: "Songs", tag: "bass catalog", path: "/bass/songs" },
	{ key: "02", label: "Metronome", tag: "metronome", path: "/bass/metronome" },
	{ key: "03", label: "Tuner", tag: "pitch ref", path: "/bass/tuner" },
	{ key: "04", label: "Fretboard", tag: "fretboard map", path: "/bass/fretboard" },
];

const GUITAR_TOOLS = [
	{ key: "05", label: "Songs", tag: "guitar catalog", path: "/guitar/songs" },
	{ key: "06", label: "Metronome", tag: "metronome", path: "/guitar/metronome" },
	{ key: "07", label: "Tuner", tag: "pitch ref", path: "/guitar/tuner" },
	{ key: "08", label: "Fretboard", tag: "fretboard map", path: "/guitar/fretboard" },
];

function ToolCard({ keyLabel, label, tag, path, side }) {
	return (
		<Link to={path} className={`tool-card tool-card--${side} hud`}>
			<span className="tool-key">{keyLabel}</span>
			<span className="tool-label">{label}</span>
			<span className="tool-tag">{tag}</span>
			<span className="tool-arrow">→</span>
		</Link>
	);
}

function HomeTools() {
	const [open, setOpen] = useState(false);
	return (
		<div className="home-tools-section">
			<button
				className="tools-toggle"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
			>
				<span className="tools-toggle-label">// QUICK ACCESS</span>
				<span className="tools-toggle-rule" />
				<span className="tools-toggle-right">
					<span className="tools-toggle-count">06 ROUTES</span>
					<span className="tools-toggle-chevron">{open ? "▲" : "▼"}</span>
				</span>
			</button>
			{open && (
				<div className="tools-dropdown hud">
					<div className="tools-col tools-col--bass">
						<div className="tools-col-head">BASS</div>
						{BASS_TOOLS.map((t) => (
							<ToolCard key={t.path} keyLabel={t.key} label={t.label} tag={t.tag} path={t.path} side="bass" />
						))}
					</div>
					<div className="tools-col tools-col--guitar">
						<div className="tools-col-head">GUITAR</div>
						{GUITAR_TOOLS.map((t) => (
							<ToolCard key={t.path} keyLabel={t.key} label={t.label} tag={t.tag} path={t.path} side="guitar" />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function Home() {
	const { songs: bassSongs } = useUserSongs("bass");
	const { songs: guitarSongs } = useUserSongs("guitar");
	const { statuses } = useSongStatus([...bassSongs, ...guitarSongs]);

	const countBy = (list, value) =>
		list.filter((s) => statuses[s.id] === value).length;

	const bassLearning = countBy(bassSongs, "learning");
	const bassDone = countBy(bassSongs, "completed");
	const gtrLearning = countBy(guitarSongs, "learning");
	const gtrDone = countBy(guitarSongs, "completed");

	const totalSongs = bassSongs.length + guitarSongs.length;
	const totalLearning = bassLearning + gtrLearning;
	const totalDone = bassDone + gtrDone;

	return (
		<Layout>
			<div className="page home-page">
				<section className="home-hero hud">
					<span className="hud-corner-tr" />
					<span className="hud-corner-bl" />
					<div className="home-hero-inner">
						<div className="hero-line">
							<span className="seg"><span className="dot" /> SYS_BOOT · OK</span>
							<span className="seg">NODE / PRACTICE_HUB</span>
							<span className="seg"><span className="dot dot--m" /> SIGNAL_LOCK</span>
						</div>
						<h1 className="hero-title flicker">
							<span data-text="PRACTICE" className="glitch">PRACTICE</span>
							<br />
							<span className="accent">/</span><span className="accent-m">/</span> HUB
						</h1>
						<p className="hero-subtitle">
							Your low-latency rig for learning songs, locking into tempo, and
							mapping the fretboard. Plug in, tune up, route signal, run reps.
						</p>
						<div className="hero-strip">
							<Stat k="Catalog" v={totalSongs} c="" sub="songs ready" />
							<Stat k="In Flight" v={totalLearning} c="m" sub="learning" />
							<Stat k="Cleared" v={totalDone} c="a" sub="completed" />
							<Stat k="Tools" v="08" c="v" sub="modules online" />
						</div>
					</div>
				</section>

				<div className="section-stripe">
					<span className="label">// SELECT // INSTRUMENT</span>
					<span className="rule" />
					<span className="count">02 NODES</span>
				</div>

				<section className="home-decks">
					<InstrumentDeck
						instrument="bass"
						accent="amber"
						count={bassSongs.length}
						learning={bassLearning}
						completed={bassDone}
						sunHue={{ a: "#ffb84d", b: "#ff6b35", c: "#ff2a6d" }}
					/>
					<InstrumentDeck
						instrument="guitar"
						accent="magenta"
						count={guitarSongs.length}
						learning={gtrLearning}
						completed={gtrDone}
						sunHue={{ a: "#ff2a6d", b: "#b14bff", c: "#05d9e8" }}
					/>
				</section>

				<HomeTools />
			</div>
		</Layout>
	);
}

export default Home;
