import { useState } from "react";
import Layout from "../../components/Layout";
import BackLink from "../../components/BackLink";
import "./Fretboard.css";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALE_PATTERNS = {
	major:        [0, 2, 4, 5, 7, 9, 11],
	minor:        [0, 2, 3, 5, 7, 8, 10],
	pentatonic:   [0, 2, 4, 7, 9],
	"minor pent": [0, 3, 5, 7, 10],
	blues:        [0, 3, 5, 6, 7, 10],
	dorian:       [0, 2, 3, 5, 7, 9, 10],
	phrygian:     [0, 1, 3, 5, 7, 8, 10],
	mixolydian:   [0, 2, 4, 5, 7, 9, 10],
};

function noteIdx(name) { return NOTES.indexOf(name); }

function FretboardView({ instrument }) {
	const isBass = instrument === "bass";
	const accentColor = isBass ? "var(--neon-amber)" : "var(--neon-magenta)";
	const accentGlow = isBass ? "var(--neon-amber-glow)" : "var(--neon-magenta-glow)";

	const tuningSemitones = isBass
		? [noteIdx("E"), noteIdx("A"), noteIdx("D"), noteIdx("G")]
		: [noteIdx("E"), noteIdx("A"), noteIdx("D"), noteIdx("G"), noteIdx("B"), noteIdx("E")];

	const [root, setRoot] = useState("A");
	const [scale, setScale] = useState("minor pent");
	const [highlightRoot, setHighlightRoot] = useState(true);
	const numFrets = 17;

	const rootI = noteIdx(root);
	const scaleSet = new Set(SCALE_PATTERNS[scale].map((i) => (rootI + i) % 12));
	const scaleNotes = SCALE_PATTERNS[scale].map((i) => NOTES[(rootI + i) % 12]);

	const stringCount = tuningSemitones.length;
	const fretW = 64;
	const stringSpacing = 36;
	const padX = 56;
	const padY = 30;
	const W = padX + (numFrets + 1) * fretW + 20;
	const H = padY * 2 + (stringCount - 1) * stringSpacing;

	const noteAtFret = (stringIdx, fret) => (tuningSemitones[stringIdx] + fret) % 12;

	return (
		<div className="fb-grid">
			<div className="hud fb-controls">
				<span className="hud-corner-tr" /><span className="hud-corner-bl" />
				<div className="eyebrow" style={{ marginBottom: "1rem" }}>SCALE.CONFIG</div>

				<div className="fb-section">
					<div className="fb-section-label">// ROOT</div>
					<div className="fb-roots">
						{NOTES.map((n) => (
							<button
								key={n}
								onClick={() => setRoot(n)}
								className={"fb-btn" + (root === n ? " fb-btn--active-accent" : "")}
								style={root === n ? { background: accentColor, borderColor: accentColor, color: "var(--bg-0)", fontWeight: 700 } : undefined}
							>
								{n}
							</button>
						))}
					</div>
				</div>

				<div className="fb-section">
					<div className="fb-section-label">// SCALE</div>
					<div className="fb-scales">
						{Object.keys(SCALE_PATTERNS).map((s) => (
							<button
								key={s}
								onClick={() => setScale(s)}
								className={"fb-btn fb-btn--scale" + (scale === s ? " fb-btn--active" : "")}
							>
								{s}
							</button>
						))}
					</div>
				</div>

				<label className="fb-toggle">
					<input
						type="checkbox"
						checked={highlightRoot}
						onChange={(e) => setHighlightRoot(e.target.checked)}
					/>
					HIGHLIGHT ROOT NOTES
				</label>

				<div className="fb-summary">
					<div style={{ color: accentColor, letterSpacing: "0.18em", marginBottom: "0.4rem" }}>
						// {root.toUpperCase()} {scale.toUpperCase()}
					</div>
					<div className="muted">{scaleNotes.join(" — ")}</div>
					<div className="muted" style={{ marginTop: "0.4rem" }}>
						{scaleNotes.length} notes / {stringCount} strings
					</div>
				</div>
			</div>

			<div className="hud fb-board">
				<span className="hud-corner-tr" /><span className="hud-corner-bl" />
				<div className="eyebrow" style={{ marginBottom: "1rem" }}>NECK.MAP</div>

				<div className="fb-svg-wrap">
					<svg viewBox={`0 0 ${W} ${H}`} className="fb-svg">
						<rect
							x={padX} y={padY - 14}
							width={(numFrets + 1) * fretW}
							height={(stringCount - 1) * stringSpacing + 28}
							fill="rgba(0,0,0,0.4)" stroke="var(--line-mid)"
						/>
						{[3, 5, 7, 9, 15, 17].map((f) => (
							<circle
								key={"inlay" + f}
								cx={padX + (f - 0.5) * fretW}
								cy={padY + ((stringCount - 1) * stringSpacing) / 2}
								r="5" fill="rgba(177, 75, 255, 0.25)"
							/>
						))}
						<circle cx={padX + (12 - 0.5) * fretW} cy={padY + ((stringCount - 1) * stringSpacing) / 2 - stringSpacing * 0.7} r="5" fill="rgba(177, 75, 255, 0.25)" />
						<circle cx={padX + (12 - 0.5) * fretW} cy={padY + ((stringCount - 1) * stringSpacing) / 2 + stringSpacing * 0.7} r="5" fill="rgba(177, 75, 255, 0.25)" />

						{Array.from({ length: numFrets + 1 }).map((_, f) => (
							<line
								key={"fret" + f}
								x1={padX + f * fretW} y1={padY - 14}
								x2={padX + f * fretW} y2={padY + (stringCount - 1) * stringSpacing + 14}
								stroke={f === 0 ? "var(--text)" : "rgba(5,217,232,0.35)"}
								strokeWidth={f === 0 ? 4 : 1}
							/>
						))}

						{Array.from({ length: numFrets + 1 }).map((_, f) => (
							<text
								key={"fnum" + f}
								x={padX + (f - 0.5) * fretW} y={H - 4}
								textAnchor="middle"
								fill="rgba(214,246,255,0.45)"
								fontFamily="var(--font-mono)" fontSize="11"
							>
								{f === 0 ? "" : f}
							</text>
						))}

						{tuningSemitones.slice().reverse().map((openIdx, visIdx) => {
							const y = padY + visIdx * stringSpacing;
							const thickness = 1 + (stringCount - 1 - visIdx) * 0.4;
							return (
								<g key={"str" + visIdx}>
									<line x1={padX - 24} y1={y} x2={padX + (numFrets + 1) * fretW} y2={y}
										stroke="rgba(214,246,255,0.55)" strokeWidth={thickness} />
									<text x={padX - 30} y={y + 4} textAnchor="end"
										fill="var(--text-dim)" fontFamily="var(--font-display)"
										fontWeight="700" fontSize="14">
										{NOTES[openIdx]}
									</text>
								</g>
							);
						})}

						{tuningSemitones.slice().reverse().map((_, visIdx) => {
							const stringIdx = stringCount - 1 - visIdx;
							const y = padY + visIdx * stringSpacing;
							return Array.from({ length: numFrets + 1 }).map((_, f) => {
								const note = noteAtFret(stringIdx, f);
								if (!scaleSet.has(note)) return null;
								const isRoot = note === rootI;
								const x = padX + (f === 0 ? -12 : (f - 0.5) * fretW);
								return (
									<g key={`n${visIdx}-${f}`}>
										<circle cx={x} cy={y} r="11"
											fill={isRoot && highlightRoot ? accentColor : "rgba(5,217,232,0.15)"}
											stroke={isRoot && highlightRoot ? accentColor : "var(--neon-cyan)"}
											strokeWidth="1.5"
											style={{ filter: isRoot && highlightRoot ? `drop-shadow(0 0 6px ${accentGlow})` : "drop-shadow(0 0 4px rgba(5,217,232,0.45))" }} />
										<text x={x} y={y + 4} textAnchor="middle"
											fill={isRoot && highlightRoot ? "var(--bg-0)" : "var(--text)"}
											fontFamily="var(--font-mono)" fontSize="10" fontWeight="700">
											{NOTES[note]}
										</text>
									</g>
								);
							});
						})}
					</svg>
				</div>

				<div className="fb-legend">
					<span><span className="dot" style={{ background: accentColor, boxShadow: `0 0 6px ${accentGlow}` }} /> ROOT</span>
					<span><span className="dot" style={{ background: "rgba(5,217,232,0.15)", border: "1.5px solid var(--neon-cyan)" }} /> SCALE NOTE</span>
					<span><span className="dot" style={{ background: "rgba(177,75,255,0.4)" }} /> FRET MARKER</span>
				</div>
			</div>
		</div>
	);
}

export default function FretboardPage({ instrument }) {
	const theme = instrument;
	const back = instrument === "bass" ? "/bass" : "/guitar";
	const label = instrument === "bass" ? "Back to Bass" : "Back to Guitar";
	return (
		<Layout theme={theme}>
			<div className="page">
				<BackLink to={back} label={label} />
				<header style={{ marginBottom: "1.5rem" }}>
					<span className="eyebrow">// MOD_03 · {instrument.toUpperCase()} · FRETBOARD</span>
					<h1 className="hero-title flicker" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
						<span className="glitch" data-text="FRETBOARD">FRETBOARD</span>
					</h1>
					<p className="hero-subtitle">
						Scale visualizer. Pick a root and pattern — see every note on the
						neck, with roots flagged.
					</p>
				</header>
				<FretboardView instrument={instrument} />
			</div>
		</Layout>
	);
}
