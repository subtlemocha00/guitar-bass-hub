import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { useSongStatus } from "../features/songs/useSongStatus";
import { useUserSongs } from "../features/songs/useUserSongs";
import blogPosts from "../data/blogPosts";
import "./Home.css";
import "./Blog.css";

function Stat({ k, v, c, sub }) {
	return (
		<div className="strip-cell">
			<div className="k">{k}</div>
			<div className={"v " + (c || "")}>{v}</div>
			{sub && <div className="sub">{sub}</div>}
		</div>
	);
}

function InstrumentDeck({ instrument, count, learning, completed, sunHue }) {
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

const SHARED_TOOLS = [
	{ label: "Tuner", tag: "guitar + bass · pitch ref", path: "/tuner" },
	{ label: "Metronome", tag: "guitar + bass · tempo lock", path: "/metronome" },
	{ label: "Setlist", tag: "completed songs · reorderable", path: "/setlist" },
	{ label: "Control Center", tag: "system · settings + utils", path: "/control-center" },
];

const BASS_TOOLS = [
	{ label: "Songs", tag: "bass catalog", path: "/bass/songs" },
	{ label: "Fretboard", tag: "fretboard map", path: "/bass/fretboard" },
];

const GUITAR_TOOLS = [
	{ label: "Songs", tag: "guitar catalog", path: "/guitar/songs" },
	{ label: "Fretboard", tag: "fretboard map", path: "/guitar/fretboard" },
];

function withKeys(tools, startIdx) {
	return tools.map((t, i) => ({
		...t,
		key: String(startIdx + i).padStart(2, "0"),
	}));
}

const SHARED_KEYED = withKeys(SHARED_TOOLS, 0);
const BASS_KEYED = withKeys(BASS_TOOLS, SHARED_TOOLS.length);
const GUITAR_KEYED = withKeys(GUITAR_TOOLS, SHARED_TOOLS.length + BASS_TOOLS.length);
const TOTAL_TOOLS = SHARED_TOOLS.length + BASS_TOOLS.length + GUITAR_TOOLS.length;

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
	const [open, setOpen] = useState(true);
	const routeCount = String(TOTAL_TOOLS).padStart(2, "0");
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
					<span className="tools-toggle-count">{routeCount} ROUTES</span>
					<span className="tools-toggle-chevron">{open ? "▲" : "▼"}</span>
				</span>
			</button>
			{open && (
				<div className="tools-dropdown hud">
					<div className="tools-col tools-col--shared">
						<div className="tools-col-head">SHARED</div>
						{SHARED_KEYED.map((t) => (
							<ToolCard key={t.path} keyLabel={t.key} label={t.label} tag={t.tag} path={t.path} side="shared" />
						))}
					</div>
					<div className="tools-col tools-col--bass">
						<div className="tools-col-head">BASS</div>
						{BASS_KEYED.map((t) => (
							<ToolCard key={t.path} keyLabel={t.key} label={t.label} tag={t.tag} path={t.path} side="bass" />
						))}
					</div>
					<div className="tools-col tools-col--guitar">
						<div className="tools-col-head">GUITAR</div>
						{GUITAR_KEYED.map((t) => (
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
							<span data-text="GUITAR + BASS" className="glitch">GUITAR + BASS</span>
							<br />
							<span className="accent">/</span><span className="accent-m">/ </span><span data-text="HUB" className="glitch">HUB</span>
						</h1>
						<p className="hero-subtitle">
							Your low-latency rig for learning songs, locking into tempo, and
							mapping the fretboard. Tune up, map the neck, and drill until automatic.
						</p>
						<div className="hero-strip">
							<Stat k="Catalog" v={totalSongs} c="" sub="songs ready" />
							<Stat k="In Flight" v={totalLearning} c="m" sub="learning" />
							<Stat k="Cleared" v={totalDone} c="a" sub="completed" />
							<Stat k="Tools" v={String(TOTAL_TOOLS).padStart(2, "0")} c="v" sub="modules online" />
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
						count={bassSongs.length}
						learning={bassLearning}
						completed={bassDone}
						sunHue={{ a: "#ffb84d", b: "#ff6b35", c: "#ff2a6d" }}
					/>
					<InstrumentDeck
						instrument="guitar"
						count={guitarSongs.length}
						learning={gtrLearning}
						completed={gtrDone}
						sunHue={{ a: "#ff2a6d", b: "#b14bff", c: "#05d9e8" }}
					/>
				</section>

				<HomeTools />

				<div className="home-blog-section">
					<div className="section-stripe">
						<span className="label">// JOURNAL</span>
						<span className="rule" />
						<span className="count">{String(blogPosts.length).padStart(2, "0")} ENTRIES</span>
					</div>
					<Link to="/blog" className="home-blog-cta hud">
						<span className="hud-corner-tr" />
						<span className="hud-corner-bl" />
						<div className="home-blog-cta-main">
							<span className="home-blog-cta-key">// FIELD_NOTES</span>
							<span className="home-blog-cta-title">Blog</span>
							<span className="home-blog-cta-tag">tone · technique · practice notes</span>
						</div>
						<span className="home-blog-cta-arrow">READ →</span>
					</Link>
				</div>
			</div>
		</Layout>
	);
}

export default Home;
