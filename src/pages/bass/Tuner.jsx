import Layout from "../../components/Layout";
import BackLink from "../../components/BackLink";
import CyberTuner from "../../features/tuner/Tuner";

function Tuner() {
	return (
		<Layout theme="bass">
			<div className="page">
				<BackLink to="/bass" label="Back to Bass" />
				<header style={{ marginBottom: "1.5rem" }}>
					<span className="eyebrow">// MOD_01 · BASS · TUNER</span>
					<h1 className="hero-title flicker" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
						<span className="glitch" data-text="TUNER">TUNER</span>
					</h1>
					<p className="hero-subtitle">
						Live pitch detection via microphone. Strum a string and lock to
						the nearest target frequency.
					</p>
				</header>
				<CyberTuner instrument="bass" accent="var(--neon-amber)" />
			</div>
		</Layout>
	);
}

export default Tuner;
