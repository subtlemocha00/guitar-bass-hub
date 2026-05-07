import { useEffect, useRef, useState } from "react";
import { playSound, SOUND_OPTIONS } from "./soundEngine";
import "./Metronome.css";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

export function MetronomeView({ instrument }) {
	const isBass = instrument === "bass";
	const accentColor = isBass ? "var(--neon-amber)" : "var(--neon-magenta)";
	const accentGlow = isBass ? "var(--neon-amber-glow)" : "var(--neon-magenta-glow)";

	const [bpm, setBpm] = useState(120);
	const [beats, setBeats] = useState(4);
	const [running, setRunning] = useState(false);
	const [tick, setTick] = useState(-1);
	const [displayBpm, setDisplayBpm] = useState(120);

	const [accentPattern, setAccentPattern] = useState([true, false, false, false]);
	const [accentSound, setAccentSound] = useState("click");
	const [beatSound, setBeatSound] = useState("hi-hat");

	const [rampEnabled, setRampEnabled] = useState(false);
	const [startBpm, setStartBpm] = useState(60);
	const [endBpm, setEndBpm] = useState(120);
	const [rampDuration, setRampDuration] = useState(120);

	const ctxRef = useRef(null);
	const schedulerIdRef = useRef(null);
	const rafIdRef = useRef(null);
	const visualQueueRef = useRef([]);
	const nextNoteTimeRef = useRef(0);
	const currentBeatRef = useRef(0);
	const rampStartTimeRef = useRef(null);

	// Single config ref kept in sync each render so the scheduler closure
	// always sees the latest values without restarting the scheduler.
	const configRef = useRef({});
	configRef.current = {
		bpm,
		beats,
		accentPattern,
		accentSound,
		beatSound,
		rampEnabled,
		startBpm,
		endBpm,
		rampDuration,
	};

	// Keep the visible BPM in sync with the slider when not actively ramping.
	useEffect(() => {
		if (!running || !rampEnabled) {
			setDisplayBpm(bpm);
		}
	}, [bpm, running, rampEnabled]);

	// Reset accent pattern whenever the time signature changes.
	useEffect(() => {
		const arr = new Array(beats).fill(false);
		arr[0] = true;
		setAccentPattern(arr);
	}, [beats]);

	// Scheduler lifecycle — only restarts when running flips.
	useEffect(() => {
		if (!running) {
			setTick(-1);
			return undefined;
		}

		if (!ctxRef.current) {
			try {
				ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
			} catch {
				return undefined;
			}
		}
		const ctx = ctxRef.current;
		if (ctx.state === "suspended") ctx.resume();

		visualQueueRef.current = [];
		currentBeatRef.current = 0;
		nextNoteTimeRef.current = ctx.currentTime + 0.1;
		rampStartTimeRef.current = configRef.current.rampEnabled
			? performance.now()
			: null;

		function effectiveBpm() {
			const cfg = configRef.current;
			if (!cfg.rampEnabled || rampStartTimeRef.current == null) {
				return cfg.bpm;
			}
			const elapsed = (performance.now() - rampStartTimeRef.current) / 1000;
			const progress = Math.min(elapsed / Math.max(0.1, cfg.rampDuration), 1);
			return cfg.startBpm + (cfg.endBpm - cfg.startBpm) * progress;
		}

		function scheduler() {
			const cfg = configRef.current;
			const beatsCount = Math.max(1, cfg.beats);
			while (
				nextNoteTimeRef.current <
				ctx.currentTime + SCHEDULE_AHEAD_S
			) {
				const beatIdx = currentBeatRef.current % beatsCount;
				const accent = !!cfg.accentPattern[beatIdx];
				const sound = accent ? cfg.accentSound : cfg.beatSound;
				playSound(sound, ctx, nextNoteTimeRef.current, accent);

				const liveBpm = effectiveBpm();
				visualQueueRef.current.push({
					time: nextNoteTimeRef.current,
					beat: beatIdx,
					bpm: liveBpm,
				});
				nextNoteTimeRef.current += 60 / liveBpm;
				currentBeatRef.current = (currentBeatRef.current + 1) % beatsCount;
			}
		}

		function visualTick() {
			const queue = visualQueueRef.current;
			while (queue.length && queue[0].time <= ctx.currentTime) {
				const item = queue.shift();
				setTick(item.beat);
				if (configRef.current.rampEnabled) {
					setDisplayBpm(Math.round(item.bpm));
				}
			}
			rafIdRef.current = requestAnimationFrame(visualTick);
		}

		scheduler();
		schedulerIdRef.current = setInterval(scheduler, LOOKAHEAD_MS);
		rafIdRef.current = requestAnimationFrame(visualTick);

		return () => {
			if (schedulerIdRef.current) {
				clearInterval(schedulerIdRef.current);
				schedulerIdRef.current = null;
			}
			if (rafIdRef.current) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			visualQueueRef.current = [];
			rampStartTimeRef.current = null;
		};
	}, [running]);

	const togglePlayback = () => setRunning((r) => !r);

	useEffect(() => {
		function onKeyDown(e) {
			if (e.code !== "Space" && e.key !== " ") return;
			const t = e.target;
			if (t && (
				t.tagName === "INPUT" ||
				t.tagName === "TEXTAREA" ||
				t.tagName === "SELECT" ||
				t.isContentEditable
			)) {
				return;
			}
			e.preventDefault();
			togglePlayback();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const tapTimes = useRef([]);
	const tap = () => {
		const now = performance.now();
		tapTimes.current.push(now);
		tapTimes.current = tapTimes.current.filter((t) => now - t < 2000);
		if (tapTimes.current.length >= 2) {
			const intervals = [];
			for (let i = 1; i < tapTimes.current.length; i++) {
				intervals.push(tapTimes.current[i] - tapTimes.current[i - 1]);
			}
			const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
			const newBpm = Math.round(60000 / avg);
			if (newBpm >= 40 && newBpm <= 300) setBpm(newBpm);
		}
	};

	function toggleAccent(i) {
		setAccentPattern((prev) => {
			const next = prev.slice();
			next[i] = !next[i];
			return next;
		});
	}

	const presets = [40, 60, 80, 100, 120, 140, 160, 180, 220, 260, 300];
	const accentLabel =
		accentPattern
			.map((a, i) => (a ? i + 1 : null))
			.filter((v) => v !== null)
			.join(", ") || "NONE";

	return (
		<div className="metro-grid">
			<div className="hud metro-main">
				<span className="hud-corner-tr" /><span className="hud-corner-bl" />

				<div
					className="metro-bpm"
					style={{
						color: running ? accentColor : "var(--text)",
						textShadow: running
							? `0 0 30px ${accentGlow}, 0 0 60px ${accentGlow}`
							: "0 0 16px rgba(5,217,232,0.35)",
					}}
				>
					{displayBpm}
				</div>
				<div className="metro-bpm-label">
					BEATS PER MINUTE
					{running && rampEnabled ? " · RAMPING" : ""}
				</div>

				<div className="metro-dots">
					{accentPattern.map((isAccent, i) => {
						const active = running && i === tick;
						return (
							<button
								type="button"
								key={i}
								onClick={() => toggleAccent(i)}
								aria-label={`Beat ${i + 1} ${isAccent ? "accent" : "normal"}`}
								aria-pressed={isAccent}
								className="metro-dot"
								style={{
									borderColor: isAccent ? accentColor : "var(--line-mid)",
									background: active
										? isAccent ? accentColor : "var(--neon-cyan)"
										: "transparent",
									boxShadow: active
										? `0 0 18px ${isAccent ? accentGlow : "var(--neon-cyan-glow)"}`
										: isAccent
											? `0 0 10px ${accentGlow}`
											: "none",
									transform: active ? "scale(1.15)" : "scale(1)",
								}}
							/>
						);
					})}
				</div>

				<div className="metro-slider-wrap">
					<input
						type="range" min="40" max="300" step="1" value={bpm}
						onChange={(e) => setBpm(Number(e.target.value))}
						className="metro-slider"
					/>
					<div className="metro-slider-axis"><span>40</span><span>170</span><span>300</span></div>
				</div>

				<div className="metro-presets">
					{presets.map((p) => (
						<button
							key={p}
							onClick={() => setBpm(p)}
							className={"metro-preset" + (bpm === p ? " metro-preset--active" : "")}
						>
							{p}
						</button>
					))}
				</div>

				<div className="metro-controls">
					<button
						className={running ? "btn btn--magenta" : "btn btn--solid"}
						style={{ minWidth: "140px", justifyContent: "center" }}
						onClick={togglePlayback}
					>
						{running ? "■ STOP" : "▶ START"}
					</button>
					<button className="btn" onClick={tap}>TAP TEMPO</button>
					<button className="btn" onClick={() => setBpm((b) => Math.max(40, b - 5))}>−5</button>
					<button className="btn" onClick={() => setBpm((b) => Math.min(300, b + 5))}>+5</button>
				</div>
			</div>

			<div className="hud metro-config">
				<span className="hud-corner-tr" /><span className="hud-corner-bl" />
				<div className="eyebrow" style={{ marginBottom: "1rem" }}>METER.CONFIG</div>

				<div className="fb-section">
					<div className="fb-section-label">// TIME SIGNATURE</div>
					<div className="metro-meter-grid">
						{[2, 3, 4, 5, 6, 7, 8, 9].map((b) => (
							<button
								key={b}
								onClick={() => setBeats(b)}
								className="fb-btn"
								style={beats === b ? { background: accentColor, borderColor: accentColor, color: "var(--bg-0)", fontWeight: 700 } : undefined}
							>
								{b}/4
							</button>
						))}
					</div>
				</div>

				<div className="metro-section">
					<div className="fb-section-label">// ACCENTS</div>
					<div className="metro-accent-hint">
						Click any beat dot above to toggle its accent.
					</div>
					<div className="metro-accent-row">
						<span className="metro-accent-label">PATTERN</span>
						<span className="metro-accent-value" style={{ color: accentColor }}>
							{accentLabel}
						</span>
					</div>
				</div>

				<div className="metro-section">
					<div className="fb-section-label">// SOUNDS</div>
					<label className="metro-field">
						<span className="metro-field-label">ACCENT</span>
						<select
							className="metro-select"
							value={accentSound}
							onChange={(e) => setAccentSound(e.target.value)}
						>
							{SOUND_OPTIONS.map((s) => (
								<option key={s} value={s}>{s}</option>
							))}
						</select>
					</label>
					<label className="metro-field">
						<span className="metro-field-label">BEAT</span>
						<select
							className="metro-select"
							value={beatSound}
							onChange={(e) => setBeatSound(e.target.value)}
						>
							{SOUND_OPTIONS.map((s) => (
								<option key={s} value={s}>{s}</option>
							))}
						</select>
					</label>
				</div>

				<div className="metro-section">
					<div className="fb-section-label">// TEMPO RAMP</div>
					<label className="metro-toggle-row">
						<input
							type="checkbox"
							checked={rampEnabled}
							onChange={(e) => setRampEnabled(e.target.checked)}
						/>
						<span>{rampEnabled ? "ENABLED" : "DISABLED"}</span>
					</label>
					<div className="metro-ramp-grid">
						<label className="metro-field">
							<span className="metro-field-label">START BPM</span>
							<input
								type="number" min="40" max="300"
								value={startBpm}
								disabled={!rampEnabled}
								onChange={(e) => setStartBpm(Number(e.target.value))}
								className="metro-input"
							/>
						</label>
						<label className="metro-field">
							<span className="metro-field-label">END BPM</span>
							<input
								type="number" min="40" max="300"
								value={endBpm}
								disabled={!rampEnabled}
								onChange={(e) => setEndBpm(Number(e.target.value))}
								className="metro-input"
							/>
						</label>
						<label className="metro-field">
							<span className="metro-field-label">DURATION (s)</span>
							<input
								type="number" min="1" max="3600"
								value={rampDuration}
								disabled={!rampEnabled}
								onChange={(e) => setRampDuration(Number(e.target.value))}
								className="metro-input"
							/>
						</label>
					</div>
				</div>

				<div className="metro-feel">
					<div className="fb-section-label">// FEEL</div>
					<div className="metro-feel-rows">
						<div>STATUS &nbsp;&nbsp;<span style={{ color: running ? "var(--neon-lime)" : "var(--text-mute)" }}>{running ? "● RUNNING" : "○ STOPPED"}</span></div>
						<div>INTERVAL &nbsp;<span style={{ color: "var(--neon-cyan)" }}>{(60000 / displayBpm).toFixed(0)}ms</span></div>
						<div>METER &nbsp;&nbsp;&nbsp;<span style={{ color: "var(--neon-cyan)" }}>{beats}/4</span></div>
						<div>ACCENT &nbsp;&nbsp;<span style={{ color: accentColor }}>{accentLabel}</span></div>
					</div>
				</div>

				<div className="metro-notes">
					// LOOKAHEAD SCHEDULER · {LOOKAHEAD_MS}MS<br />
					// AUDIOCONTEXT.CURRENTTIME DRIVEN<br />
					// CLICK [TAP TEMPO] WITH RHYTHM TO CALIBRATE
				</div>
			</div>
		</div>
	);
}

