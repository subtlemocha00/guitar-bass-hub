import { useEffect, useRef, useState } from "react";
import { playSound, preloadSamples, SOUND_OPTIONS } from "./soundEngine";
import "./Metronome.css";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

const SUBDIVISIONS = [
	{ id: "quarter", label: "1/4", pulses: 1 },
	{ id: "eighth", label: "1/8", pulses: 2 },
	{ id: "triplet", label: "TRIPLET", pulses: 3 },
	{ id: "sixteenth", label: "1/16", pulses: 4 },
];

const SWING_OPTIONS = [
	{ id: "straight", label: "STRAIGHT", first: 0.5 },
	{ id: "light", label: "LIGHT", first: 0.6 },
	{ id: "medium", label: "MEDIUM", first: 2 / 3 },
	{ id: "heavy", label: "HEAVY", first: 0.75 },
];

const RANDOM_MUTE_OPTIONS = [
	{ id: "off", label: "OFF", probability: 0 },
	{ id: "low", label: "LOW", probability: 0.15 },
	{ id: "medium", label: "MEDIUM", probability: 0.3 },
	{ id: "high", label: "HIGH", probability: 0.5 },
];

const SUB_GAIN_SCALE = 0.55;

function pulsesForSubdivision(id) {
	const found = SUBDIVISIONS.find((s) => s.id === id);
	return found ? found.pulses : 1;
}

function swingFirstFraction(id) {
	const found = SWING_OPTIONS.find((s) => s.id === id);
	return found ? found.first : 0.5;
}

function randomMuteProbability(id) {
	const found = RANDOM_MUTE_OPTIONS.find((s) => s.id === id);
	return found ? found.probability : 0;
}

// Returns the offset (as a fraction of the beat duration) for the start of
// `pulseIdx` within a beat. Swing only modifies eighth-note placement.
function pulseOffsetFraction(pulseIdx, pulsesPerBeat, swingFirst) {
	if (pulsesPerBeat <= 1) return 0;
	if (pulsesPerBeat === 2) {
		return pulseIdx === 0 ? 0 : swingFirst;
	}
	return pulseIdx / pulsesPerBeat;
}

function CollapsibleSection({ title, defaultOpen = false, isFirst = false, children }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div className={isFirst ? "fb-section" : "metro-section"}>
			<button
				type="button"
				className="metro-collapse-header"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
			>
				<span className="fb-section-label metro-collapse-label">// {title}</span>
				<span className="metro-collapse-chevron" aria-hidden="true">
					{open ? "▾" : "▸"}
				</span>
			</button>
			{open && <div className="metro-collapse-body">{children}</div>}
		</div>
	);
}

export function MetronomeView() {
	const accentColor = "var(--neon-lime)";
	const accentGlow = "rgba(163, 255, 94, 0.7)";
	const accent2Color = "var(--neon-amber)";
	const accent2Glow = "rgba(255, 184, 77, 0.7)";

	const [bpm, setBpm] = useState(120);
	const [beats, setBeats] = useState(4);
	const [running, setRunning] = useState(false);
	const [tick, setTick] = useState(-1);
	const [subTick, setSubTick] = useState(-1);
	const [displayBpm, setDisplayBpm] = useState(120);
	const [barAudible, setBarAudible] = useState(true);
	const [muteReason, setMuteReason] = useState(null);

	// Per-beat accent level: 0 = none, 1 = accent 1, 2 = accent 2.
	const [accentPattern, setAccentPattern] = useState([1, 0, 0, 0]);
	const [accentSound, setAccentSound] = useState("Hi-Hat 1");
	const [accentSound2, setAccentSound2] = useState("Cowbell");
	const [beatSound, setBeatSound] = useState("Hi-Hat 1");
	const [subSound, setSubSound] = useState("Hi-Hat 1");

	const [rampEnabled, setRampEnabled] = useState(false);
	const [startBpm, setStartBpm] = useState(60);
	const [endBpm, setEndBpm] = useState(120);
	const [rampDuration, setRampDuration] = useState(120);

	const [subdivision, setSubdivision] = useState("quarter");
	const [swing, setSwing] = useState("straight");

	const [gapEnabled, setGapEnabled] = useState(false);
	const [gapAudibleBars, setGapAudibleBars] = useState(3);
	const [gapSilentBars, setGapSilentBars] = useState(1);
	const [randomMuteLevel, setRandomMuteLevel] = useState("off");

	const ctxRef = useRef(null);
	const samplesPreloadedRef = useRef(false);
	const schedulerIdRef = useRef(null);
	const rafIdRef = useRef(null);
	const visualQueueRef = useRef([]);
	const nextNoteTimeRef = useRef(0);
	const rampStartTimeRef = useRef(null);

	// Pulse-based scheduling state.
	const currentBeatRef = useRef(0);
	const currentPulseRef = useRef(0);
	const currentBarRef = useRef(0);
	const currentBeatDurationRef = useRef(0.5);
	const barAudibleRef = useRef(true);
	const barMuteReasonRef = useRef(null);
	const consecutiveRandomMutedRef = useRef(0);

	const configRef = useRef({});
	configRef.current = {
		bpm,
		beats,
		accentPattern,
		accentSound,
		accentSound2,
		beatSound,
		subSound,
		rampEnabled,
		startBpm,
		endBpm,
		rampDuration,
		subdivision,
		swing,
		gapEnabled,
		gapAudibleBars,
		gapSilentBars,
		randomMuteLevel,
	};

	useEffect(() => {
		if (!running || !rampEnabled) {
			setDisplayBpm(bpm);
		}
	}, [bpm, running, rampEnabled]);

	useEffect(() => {
		const arr = new Array(beats).fill(0);
		arr[0] = 1;
		setAccentPattern(arr);
	}, [beats]);

	useEffect(() => {
		if (!running) {
			setTick(-1);
			setSubTick(-1);
			setBarAudible(true);
			setMuteReason(null);
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

		// Preload WAV samples once, right after the AudioContext exists. Runs
		// outside the scheduler and never blocks playback (fire-and-forget).
		if (!samplesPreloadedRef.current) {
			preloadSamples(ctx);
			samplesPreloadedRef.current = true;
		}

		visualQueueRef.current = [];
		currentBeatRef.current = 0;
		currentPulseRef.current = 0;
		currentBarRef.current = 0;
		barAudibleRef.current = true;
		barMuteReasonRef.current = null;
		consecutiveRandomMutedRef.current = 0;
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

		// Decide whether the upcoming bar is audible. Called once per bar at the
		// start (beatIdx === 0 && pulse === 0). Honors gap training first; random
		// mute is layered on top with the "no more than two consecutive random
		// mutes" anti-frustration rule.
		function decideBarAudible(cfg, barIdx) {
			if (cfg.gapEnabled) {
				const period = Math.max(1, cfg.gapAudibleBars + cfg.gapSilentBars);
				const inAudibleHalf = barIdx % period < cfg.gapAudibleBars;
				if (!inAudibleHalf) {
					return { audible: false, reason: "gap" };
				}
			}
			if (cfg.randomMuteLevel !== "off") {
				if (consecutiveRandomMutedRef.current >= 2) {
					consecutiveRandomMutedRef.current = 0;
				} else {
					const p = randomMuteProbability(cfg.randomMuteLevel);
					if (Math.random() < p) {
						consecutiveRandomMutedRef.current += 1;
						return { audible: false, reason: "random" };
					}
				}
			}
			consecutiveRandomMutedRef.current = 0;
			return { audible: true, reason: null };
		}

		function scheduler() {
			const cfg = configRef.current;
			const beatsCount = Math.max(1, cfg.beats);
			const pulsesPerBeat = pulsesForSubdivision(cfg.subdivision);
			const swingFirst =
				pulsesPerBeat === 2 ? swingFirstFraction(cfg.swing) : 0.5;

			while (
				nextNoteTimeRef.current <
				ctx.currentTime + SCHEDULE_AHEAD_S
			) {
				const beatIdx = currentBeatRef.current;
				const pulse = currentPulseRef.current;

				// Lock beat duration at the start of each beat so within-beat
				// sub-pulses can't drift if a tempo ramp is active.
				if (pulse === 0) {
					currentBeatDurationRef.current = 60 / effectiveBpm();
					if (beatIdx === 0) {
						const decision = decideBarAudible(cfg, currentBarRef.current);
						barAudibleRef.current = decision.audible;
						barMuteReasonRef.current = decision.reason;
					}
				}
				const beatDuration = currentBeatDurationRef.current;

				const accentLevel = cfg.accentPattern[beatIdx] || 0;
				const accent = accentLevel > 0;
				const isMainBeat = pulse === 0;
				const sound = isMainBeat
					? accentLevel === 2
						? cfg.accentSound2
						: accentLevel === 1
							? cfg.accentSound
							: cfg.beatSound
					: cfg.subSound;
				const gainScale = isMainBeat ? 1 : SUB_GAIN_SCALE;

				if (barAudibleRef.current) {
					playSound(
						sound,
						ctx,
						nextNoteTimeRef.current,
						isMainBeat && accent,
						gainScale
					);
				}

				visualQueueRef.current.push({
					time: nextNoteTimeRef.current,
					beat: beatIdx,
					pulse,
					pulsesPerBeat,
					audible: barAudibleRef.current,
					muteReason: barMuteReasonRef.current,
					bpm: effectiveBpm(),
				});

				// Advance to next pulse using actual pulse offsets so swing
				// changes the audible spacing, not just the label.
				const currentOffset =
					pulseOffsetFraction(pulse, pulsesPerBeat, swingFirst) * beatDuration;
				const nextPulse = pulse + 1;
				const nextOffset =
					nextPulse < pulsesPerBeat
						? pulseOffsetFraction(nextPulse, pulsesPerBeat, swingFirst) *
							beatDuration
						: beatDuration;
				nextNoteTimeRef.current += nextOffset - currentOffset;

				if (nextPulse < pulsesPerBeat) {
					currentPulseRef.current = nextPulse;
				} else {
					currentPulseRef.current = 0;
					const nextBeat = beatIdx + 1;
					if (nextBeat < beatsCount) {
						currentBeatRef.current = nextBeat;
					} else {
						currentBeatRef.current = 0;
						currentBarRef.current += 1;
					}
				}
			}
		}

		function visualTick() {
			const queue = visualQueueRef.current;
			while (queue.length && queue[0].time <= ctx.currentTime) {
				const item = queue.shift();
				setTick(item.beat);
				setSubTick(item.pulse);
				setBarAudible(item.audible);
				setMuteReason(item.muteReason);
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
			if (
				t &&
				(t.tagName === "INPUT" ||
					t.tagName === "TEXTAREA" ||
					t.tagName === "SELECT" ||
					t.isContentEditable)
			) {
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

	// Cycle a beat through off -> accent 1 -> accent 2 -> off.
	function cycleAccent(i) {
		setAccentPattern((prev) => {
			const next = prev.slice();
			next[i] = ((next[i] || 0) + 1) % 3;
			return next;
		});
	}

	const presets = [40, 60, 80, 100, 120, 140, 160, 180, 220, 260, 300];
	const accentLabel =
		accentPattern
			.map((a, i) => (a ? i + 1 : null))
			.filter((v) => v !== null)
			.join(", ") || "NONE";

	const pulsesPerBeat = pulsesForSubdivision(subdivision);
	const showSubStrip = pulsesPerBeat > 1;
	const swingActive = subdivision === "eighth" && swing !== "straight";
	const subdivisionLabel =
		SUBDIVISIONS.find((s) => s.id === subdivision)?.label || "1/4";
	const swingLabel =
		SWING_OPTIONS.find((s) => s.id === swing)?.label || "STRAIGHT";
	const randomMuteLabel =
		RANDOM_MUTE_OPTIONS.find((s) => s.id === randomMuteLevel)?.label || "OFF";
	const gapActive = gapEnabled;
	const randomActive = randomMuteLevel !== "off";
	const trainingActive = gapActive || randomActive;
	const currentlyMuted = running && !barAudible;
	const barOptions = [1, 2, 3, 4, 5, 6, 7, 8];

	return (
		<div className="metro-grid">
			<div className="hud metro-main">
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />

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

				{trainingActive && (
					<div className="metro-train-banner">
						{gapActive && (
							<span className="metro-train-chip metro-train-chip--gap">
								<span className="dot" /> GAP TRAINING ACTIVE
							</span>
						)}
						{randomActive && (
							<span className="metro-train-chip metro-train-chip--random">
								<span className="dot" /> RANDOM MUTE ACTIVE
							</span>
						)}
						{currentlyMuted && (
							<span className="metro-train-chip metro-train-chip--muted">
								● {muteReason === "random" ? "RANDOM SILENCE" : "MUTED MEASURE"}
							</span>
						)}
					</div>
				)}

				<div className="metro-dots">
					{accentPattern.map((level, i) => {
						const active = running && i === tick && barAudible;
						const dimMuted = running && i === tick && !barAudible;
						const isAccent = level > 0;
						const dotColor =
							level === 2 ? accent2Color : level === 1 ? accentColor : null;
						const dotGlow = level === 2 ? accent2Glow : accentGlow;
						return (
							<button
								type="button"
								key={i}
								onClick={() => cycleAccent(i)}
								aria-label={`Beat ${i + 1} ${
										level === 2 ? "accent 2" : level === 1 ? "accent 1" : "normal"
									}`}
								aria-pressed={isAccent}
								className={
									"metro-dot" + (dimMuted ? " metro-dot--muted" : "")
								}
								style={{
									borderColor: dotColor || "var(--line-mid)",
									background: active
										? dotColor || "var(--neon-cyan)"
										: "transparent",
									boxShadow: active
										? `0 0 18px ${
												isAccent ? dotGlow : "var(--neon-cyan-glow)"
											}`
										: isAccent
											? `0 0 10px ${dotGlow}`
											: "none",
									transform: active || dimMuted ? "scale(1.15)" : "scale(1)",
									opacity: dimMuted ? 0.55 : 1,
								}}
							/>
						);
					})}
				</div>

				{showSubStrip && (
					<div className="metro-subrow" aria-label="Subdivision pulses">
						{accentPattern.map((_, beatIdx) => (
							<div className="metro-subgroup" key={beatIdx}>
								{Array.from({ length: pulsesPerBeat }).map((__, p) => {
									const isActive =
										running &&
										beatIdx === tick &&
										p === subTick &&
										barAudible;
									return (
										<span
											key={p}
											className={
												"metro-subdot" +
												(isActive ? " metro-subdot--active" : "") +
												(p === 0 ? " metro-subdot--main" : "")
											}
										/>
									);
								})}
							</div>
						))}
					</div>
				)}

				<div className="metro-slider-wrap">
					<input
						type="range"
						min="40"
						max="300"
						step="1"
						value={bpm}
						onChange={(e) => setBpm(Number(e.target.value))}
						className="metro-slider"
					/>
					<div className="metro-slider-axis">
						<span>40</span>
						<span>170</span>
						<span>300</span>
					</div>
				</div>

				<div className="metro-presets">
					{presets.map((p) => (
						<button
							key={p}
							onClick={() => setBpm(p)}
							className={
								"metro-preset" + (bpm === p ? " metro-preset--active" : "")
							}
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
					<button className="btn" onClick={tap}>
						TAP TEMPO
					</button>
					<button
						className="btn"
						onClick={() => setBpm((b) => Math.max(40, b - 5))}
					>
						−5
					</button>
					<button
						className="btn"
						onClick={() => setBpm((b) => Math.min(300, b + 5))}
					>
						+5
					</button>
				</div>

				<div className="metro-main-aux">
					<CollapsibleSection title="ACCENTS">
						<div className="metro-accent-hint">
							Click a beat dot to cycle: off → accent 1 → accent 2 → off.
						</div>
						<div className="metro-accent-row">
							<span className="metro-accent-label">PATTERN</span>
							<span className="metro-accent-value" style={{ color: accentColor }}>
								{accentLabel}
							</span>
						</div>
					</CollapsibleSection>

					<CollapsibleSection title="FEEL">
						<div className="metro-feel-rows">
							<div>
								STATUS &nbsp;&nbsp;
								<span
									style={{
										color: running ? "var(--neon-lime)" : "var(--text-mute)",
									}}
								>
									{running ? "● RUNNING" : "○ STOPPED"}
								</span>
							</div>
							<div>
								INTERVAL &nbsp;
								<span style={{ color: "var(--neon-cyan)" }}>
									{(60000 / displayBpm).toFixed(0)}ms
								</span>
							</div>
							<div>
								METER &nbsp;&nbsp;&nbsp;
								<span style={{ color: "var(--neon-cyan)" }}>{beats}/4</span>
							</div>
							<div>
								SUBDIV &nbsp;
								<span style={{ color: "var(--neon-cyan)" }}>
									{subdivisionLabel}
								</span>
							</div>
							<div>
								SWING &nbsp;&nbsp;
								<span style={{ color: swingActive ? "var(--neon-lime)" : "var(--text-mute)" }}>
									{swingLabel}
								</span>
							</div>
							<div>
								GAP &nbsp;&nbsp;&nbsp;&nbsp;
								<span style={{ color: gapActive ? "var(--neon-amber)" : "var(--text-mute)" }}>
									{gapEnabled
										? `${gapAudibleBars}A · ${gapSilentBars}S`
										: "OFF"}
								</span>
							</div>
							<div>
								RANDOM &nbsp;
								<span style={{ color: randomActive ? "var(--neon-magenta)" : "var(--text-mute)" }}>
									{randomMuteLabel}
								</span>
							</div>
							<div>
								ACCENT &nbsp;&nbsp;
								<span style={{ color: accentColor }}>{accentLabel}</span>
							</div>
						</div>
					</CollapsibleSection>
				</div>
			</div>

			<div className="hud metro-config">
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />
				<div className="eyebrow" style={{ marginBottom: "1rem" }}>
					METER.CONFIG
				</div>

				<CollapsibleSection title="TIME SIGNATURE" defaultOpen isFirst>
					<div className="metro-meter-grid">
						{[2, 3, 4, 5, 6, 7, 8, 9].map((b) => (
							<button
								key={b}
								onClick={() => setBeats(b)}
								className="fb-btn"
								style={
									beats === b
										? {
												background: accentColor,
												borderColor: accentColor,
												color: "var(--bg-0)",
												fontWeight: 700,
											}
										: undefined
								}
							>
								{b}/4
							</button>
						))}
					</div>
				</CollapsibleSection>

				<CollapsibleSection title="SUBDIVISION" defaultOpen>
					<div className="metro-meter-grid">
						{SUBDIVISIONS.map((s) => (
							<button
								key={s.id}
								onClick={() => setSubdivision(s.id)}
								className="fb-btn"
								style={
									subdivision === s.id
										? {
												background: "var(--neon-cyan)",
												borderColor: "var(--neon-cyan)",
												color: "var(--bg-0)",
												fontWeight: 700,
											}
										: undefined
								}
							>
								{s.label}
							</button>
						))}
					</div>
				</CollapsibleSection>

				<CollapsibleSection title="SWING">
					<div className="metro-meter-grid">
						{SWING_OPTIONS.map((s) => {
							const disabled = subdivision !== "eighth";
							return (
								<button
									key={s.id}
									onClick={() => setSwing(s.id)}
									className="fb-btn"
									disabled={disabled}
									style={{
										...(swing === s.id && !disabled
											? {
													background: "var(--neon-lime)",
													borderColor: "var(--neon-lime)",
													color: "var(--bg-0)",
													fontWeight: 700,
												}
											: undefined),
										opacity: disabled ? 0.45 : 1,
										cursor: disabled ? "not-allowed" : "pointer",
									}}
								>
									{s.label}
								</button>
							);
						})}
					</div>
					<div className="metro-accent-hint" style={{ marginTop: "0.5rem" }}>
						Swing only affects 1/8 subdivisions.
					</div>
				</CollapsibleSection>

				<CollapsibleSection title="SOUNDS">
					<label className="metro-field">
						<span className="metro-field-label">ACCENT 1</span>
						<select
							className="metro-select"
							value={accentSound}
							onChange={(e) => setAccentSound(e.target.value)}
						>
							{SOUND_OPTIONS.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
					<label className="metro-field">
						<span className="metro-field-label">ACCENT 2</span>
						<select
							className="metro-select"
							value={accentSound2}
							onChange={(e) => setAccentSound2(e.target.value)}
						>
							{SOUND_OPTIONS.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
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
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
					<label className="metro-field">
						<span className="metro-field-label">SUBDIV</span>
						<select
							className="metro-select"
							value={subSound}
							onChange={(e) => setSubSound(e.target.value)}
						>
							{SOUND_OPTIONS.map((s) => (
								<option key={s} value={s}>
									{s}
								</option>
							))}
						</select>
					</label>
				</CollapsibleSection>

				<CollapsibleSection title="RHYTHM TRAINING">
					<label className="metro-toggle-row">
						<input
							type="checkbox"
							checked={gapEnabled}
							onChange={(e) => setGapEnabled(e.target.checked)}
						/>
						<span>GAP MODE · {gapEnabled ? "ON" : "OFF"}</span>
					</label>

					<div className="metro-train-grid">
						<label className="metro-field">
							<span className="metro-field-label">AUDIBLE</span>
							<select
								className="metro-select"
								value={gapAudibleBars}
								disabled={!gapEnabled}
								onChange={(e) => setGapAudibleBars(Number(e.target.value))}
							>
								{barOptions.map((n) => (
									<option key={n} value={n}>
										{n} BAR{n === 1 ? "" : "S"}
									</option>
								))}
							</select>
						</label>
						<label className="metro-field">
							<span className="metro-field-label">SILENT</span>
							<select
								className="metro-select"
								value={gapSilentBars}
								disabled={!gapEnabled}
								onChange={(e) => setGapSilentBars(Number(e.target.value))}
							>
								{barOptions.map((n) => (
									<option key={n} value={n}>
										{n} BAR{n === 1 ? "" : "S"}
									</option>
								))}
							</select>
						</label>
					</div>
				</CollapsibleSection>

				<CollapsibleSection title="RANDOM MUTE">
					<div className="metro-meter-grid">
						{RANDOM_MUTE_OPTIONS.map((opt) => (
							<button
								key={opt.id}
								onClick={() => setRandomMuteLevel(opt.id)}
								className="fb-btn"
								style={
									randomMuteLevel === opt.id
										? {
												background: "var(--neon-magenta)",
												borderColor: "var(--neon-magenta)",
												color: "var(--bg-0)",
												fontWeight: 700,
											}
										: undefined
								}
							>
								{opt.label}
							</button>
						))}
					</div>
					<div className="metro-accent-hint" style={{ marginTop: "0.5rem" }}>
						Whole-bar silences. Capped at 2 random mutes in a row.
					</div>
				</CollapsibleSection>

				<CollapsibleSection title="TEMPO RAMP">
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
								type="number"
								min="40"
								max="300"
								value={startBpm}
								disabled={!rampEnabled}
								onChange={(e) => setStartBpm(Number(e.target.value))}
								className="metro-input"
							/>
						</label>
						<label className="metro-field">
							<span className="metro-field-label">END BPM</span>
							<input
								type="number"
								min="40"
								max="300"
								value={endBpm}
								disabled={!rampEnabled}
								onChange={(e) => setEndBpm(Number(e.target.value))}
								className="metro-input"
							/>
						</label>
						<label className="metro-field">
							<span className="metro-field-label">DURATION (s)</span>
							<input
								type="number"
								min="1"
								max="3600"
								value={rampDuration}
								disabled={!rampEnabled}
								onChange={(e) => setRampDuration(Number(e.target.value))}
								className="metro-input"
							/>
						</label>
					</div>
				</CollapsibleSection>

				<div className="metro-notes">
					// LOOKAHEAD SCHEDULER · {LOOKAHEAD_MS}MS<br />
					// AUDIOCONTEXT.CURRENTTIME DRIVEN<br />
					// CLICK [TAP TEMPO] WITH RHYTHM TO CALIBRATE
				</div>
			</div>
		</div>
	);
}
