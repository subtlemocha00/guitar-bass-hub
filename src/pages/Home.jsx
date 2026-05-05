import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { bassSongs } from "../data/bassSongs";
import { guitarSongs } from "../data/guitarSongs";
import { useSongStatus } from "../features/songs/useSongStatus";
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

function Home() {
	const bass = useSongStatus(bassSongs);
	const guitar = useSongStatus(guitarSongs);

	const stat = (statuses, value) =>
		Object.values(statuses).filter((s) => s === value).length;

	const bassLearning = stat(bass.statuses, "learning");
	const bassDone = stat(bass.statuses, "completed");
	const gtrLearning = stat(guitar.statuses, "learning");
	const gtrDone = stat(guitar.statuses, "completed");

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

				{/* <HomeTools
					bassCount={bassSongs.length}
					guitarCount={guitarSongs.length}
				/> */}
			</div>
		</Layout>
	);
}

export default Home;
