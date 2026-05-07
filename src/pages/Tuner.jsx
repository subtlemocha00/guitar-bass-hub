import { useState } from "react";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import CyberTuner from "../features/tuner/Tuner";

const INSTRUMENTS = [
	{ id: "guitar", label: "GUITAR", accent: "var(--neon-magenta)" },
	{ id: "bass", label: "BASS", accent: "var(--neon-amber)" },
];

function TunerPage() {
	const [instrument, setInstrument] = useState("guitar");
	const current = INSTRUMENTS.find((i) => i.id === instrument) || INSTRUMENTS[0];

	return (
		<Layout theme={instrument}>
			<div className="page">
				<BackLink to="/" label="Back to Hub" />
				<header style={{ marginBottom: "1.5rem" }}>
					<span className="eyebrow">// MOD_00 · UNIVERSAL · TUNER</span>
					<h1 className="hero-title flicker" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
						<span className="glitch" data-text="TUNER">TUNER</span>
					</h1>
					<p className="hero-subtitle">
						Live pitch detection via microphone. Pick your instrument and tuning,
						then strum a string and lock to the nearest target frequency.
					</p>
				</header>

				<div className="tuner-controls hud" style={{ marginBottom: "1.25rem" }}>
					<span className="hud-corner-tr" />
					<span className="hud-corner-bl" />
					<div className="tuner-control-group">
						<span className="tuner-control-label">// INSTRUMENT</span>
						<div className="tuner-mode-buttons">
							{INSTRUMENTS.map((opt) => (
								<button
									key={opt.id}
									type="button"
									className={
										"tuner-mode-btn" +
										(instrument === opt.id ? " tuner-mode-btn--active" : "")
									}
									style={
										instrument === opt.id
											? { background: opt.accent, color: "var(--bg-0)", boxShadow: `0 0 10px ${opt.accent}` }
											: undefined
									}
									onClick={() => setInstrument(opt.id)}
								>
									{opt.label}
								</button>
							))}
						</div>
					</div>
				</div>

				<CyberTuner key={instrument} instrument={instrument} accent={current.accent} />
			</div>
		</Layout>
	);
}

export default TunerPage;
