import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import { MetronomeView } from "../features/metronome/Metronome";

function MetronomePage() {
	return (
		<Layout>
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

				<MetronomeView />
			</div>
		</Layout>
	);
}

export default MetronomePage;
