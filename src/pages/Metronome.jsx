import { useState } from "react";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import { MetronomeView } from "../features/metronome/Metronome";

const INSTRUMENTS = [
	{ id: "guitar", label: "GUITAR", btnClass: "btn btn--magenta" },
	{ id: "bass", label: "BASS", btnClass: "btn btn--amber" },
];

function MetronomePage() {
	const [instrument, setInstrument] = useState("guitar");

	return (
		<Layout theme={instrument}>
			<div className="page">
				<BackLink to="/" label="Back to Hub" />
				<header style={{ marginBottom: "1.5rem" }}>
					<span className="eyebrow">// MOD_00 · UNIVERSAL · METRONOME</span>
					<h1 className="hero-title flicker" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
						<span className="glitch" data-text="METRONOME">METRONOME</span>
					</h1>
					<p className="hero-subtitle">
						Lock the pocket. Web Audio click with accented downbeat, tap-tempo
						calibration and 40–300 BPM range.
					</p>
				</header>

				<div
					className="hud"
					style={{
						display: "flex",
						alignItems: "center",
						gap: "1rem",
						padding: "0.85rem 1rem",
						marginBottom: "1.25rem",
						fontFamily: "var(--font-mono)",
					}}
				>
					<span className="hud-corner-tr" />
					<span className="hud-corner-bl" />
					<span
						style={{
							fontSize: "0.68rem",
							letterSpacing: "0.22em",
							textTransform: "uppercase",
							color: "var(--text-mute)",
						}}
					>
						// INSTRUMENT
					</span>
					<div style={{ display: "inline-flex", gap: "0.5rem" }}>
						{INSTRUMENTS.map((opt) => (
							<button
								key={opt.id}
								type="button"
								className={instrument === opt.id ? opt.btnClass : "btn"}
								onClick={() => setInstrument(opt.id)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>

				<MetronomeView instrument={instrument} />
			</div>
		</Layout>
	);
}

export default MetronomePage;
