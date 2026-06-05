import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import { loadMetronomeSettings } from "../features/metronome/metronomeStorage";
import "./ControlCenter.css";

// Keyboard shortcuts reference. Data-driven so new entries are a one-line add.
const SHORTCUTS = [
	{ keys: ["Space"], action: "Start / Stop", scope: "Metronome" },
];

// Future modules — visually present, intentionally non-functional for now.
const FUTURE_MODULES = [
	{ label: "Practice Statistics", tag: "session tracking · streaks" },
	{ label: "Setlists", tag: "ordered song groups" },
	{ label: "Audio Diagnostics", tag: "latency · output device" },
];

function usePwaStatus() {
	const [online, setOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true
	);
	useEffect(() => {
		const on = () => setOnline(true);
		const off = () => setOnline(false);
		window.addEventListener("online", on);
		window.addEventListener("offline", off);
		return () => {
			window.removeEventListener("online", on);
			window.removeEventListener("offline", off);
		};
	}, []);

	const standalone =
		typeof window !== "undefined" &&
		(window.matchMedia?.("(display-mode: standalone)").matches ||
			window.navigator.standalone === true);

	const swActive =
		typeof navigator !== "undefined" &&
		"serviceWorker" in navigator &&
		!!navigator.serviceWorker.controller;

	return { online, standalone, swActive };
}

function Card({ label, count, accent, children }) {
	return (
		<section className="cc-card hud">
			<span className="hud-corner-tr" />
			<span className="hud-corner-bl" />
			<div className="cc-card-head">
				<span className="cc-card-label" style={accent ? { color: accent } : undefined}>
					// {label}
				</span>
				{count != null && <span className="cc-card-count">{count}</span>}
			</div>
			<div className="cc-card-body">{children}</div>
		</section>
	);
}

function Row({ k, v, accent }) {
	return (
		<div className="cc-kv">
			<span className="cc-kv-k">{k}</span>
			<span className="cc-kv-v" style={accent ? { color: accent } : undefined}>
				{v}
			</span>
		</div>
	);
}

function ControlCenter() {
	const { online, standalone, swActive } = usePwaStatus();
	// Read-only snapshot of the persisted metronome setup.
	const [settings] = useState(() => loadMetronomeSettings());

	return (
		<Layout>
			<div className="page">
				<BackLink to="/" label="Back to Hub" />
				<header style={{ marginBottom: "1.5rem" }}>
					<span className="eyebrow">// SYS · CONFIG · CONTROL CENTER</span>
					<h1
						className="hero-title flicker"
						style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
					>
						<span className="glitch" data-text="CONTROL CENTER">
							CONTROL CENTER
						</span>
					</h1>
					<p className="hero-subtitle">
						System panel for app configuration, keyboard controls and persisted
						preferences.
					</p>
				</header>

				<div className="cc-grid">
					{/* 1. SYSTEM STATUS */}
					<Card label="SYSTEM STATUS" accent="var(--neon-cyan)">
						<Row
							k="ENV"
							v={import.meta.env.PROD ? "PRODUCTION" : "DEVELOPMENT"}
						/>
						<Row
							k="DISPLAY"
							v={standalone ? "STANDALONE / PWA" : "BROWSER"}
							accent={standalone ? "var(--neon-lime)" : undefined}
						/>
						<Row
							k="NETWORK"
							v={online ? "ONLINE" : "OFFLINE"}
							accent={online ? "var(--neon-lime)" : "var(--neon-magenta)"}
						/>
						<Row
							k="SERVICE WORKER"
							v={swActive ? "ACTIVE" : "INACTIVE"}
							accent={swActive ? "var(--neon-lime)" : undefined}
						/>
					</Card>

					{/* 2. KEYBOARD CONTROLS */}
					<Card
						label="KEYBOARD CONTROLS"
						accent="var(--neon-violet)"
						count={`${SHORTCUTS.length} BIND${SHORTCUTS.length === 1 ? "" : "S"}`}
					>
						{SHORTCUTS.map((s) => (
							<div className="cc-shortcut" key={s.action + s.scope}>
								<span className="cc-shortcut-keys">
									{s.keys.map((key) => (
										<kbd className="cc-kbd" key={key}>
											{key}
										</kbd>
									))}
								</span>
								<span className="cc-shortcut-action">{s.action}</span>
								<span className="cc-shortcut-scope">{s.scope}</span>
							</div>
						))}
						<p className="cc-hint">More bindings reserved for future modules.</p>
					</Card>

					{/* 3. USER PREFERENCES (read-only) */}
					<Card label="USER PREFERENCES" count="READ-ONLY">
						<Row k="BPM (LAST USED)" v={settings.bpm} accent="var(--neon-cyan)" />
						<Row k="TIME SIGNATURE" v={`${settings.beats}/4`} />
						<Row k="SUBDIVISION" v={settings.subdivision} />
						<Row k="SWING" v={settings.swing} />
						<Row k="ACCENT 1 SOUND" v={settings.accentSound} accent="var(--neon-lime)" />
						<Row k="ACCENT 2 SOUND" v={settings.accentSound2} accent="var(--neon-amber)" />
						<Row k="BEAT SOUND" v={settings.beatSound} />
						<Row k="SUBDIV SOUND" v={settings.subSound} />
						<Row k="TEMPO RAMP" v={settings.rampEnabled ? "ENABLED" : "OFF"} />
						<Row k="GAP TRAINING" v={settings.gapEnabled ? "ENABLED" : "OFF"} />
						<Row k="RANDOM MUTE" v={settings.randomMuteLevel} />
					</Card>

					{/* 4. FUTURE MODULES (placeholders) */}
					<Card label="FUTURE MODULES" count="PLANNED">
						<ul className="cc-modules">
							{FUTURE_MODULES.map((m) => (
								<li className="cc-module cc-module--disabled" key={m.label}>
									<span className="cc-module-info">
										<span className="cc-module-name">{m.label}</span>
										<span className="cc-module-tag">{m.tag}</span>
									</span>
									<span className="cc-module-badge">SOON</span>
								</li>
							))}
						</ul>
					</Card>
				</div>
			</div>
		</Layout>
	);
}

export default ControlCenter;
