import { useState } from "react";
import { useTuner } from "./useTuner";
import { INSTRUMENT_CONFIGS } from "./strings";
import "./Tuner.css";

const W = 600;
const H = 220;
const CENT_RANGE = 50;

function formatTuningName(key) {
	const [count, ...rest] = key.split("_");
	const name = rest
		.map((w) =>
			w.length === 1
				? w.toUpperCase()
				: w[0].toUpperCase() + w.slice(1)
		)
		.join(" ");
	return `${count}-string ${name}`;
}

function pickDefaultTuning(instrument, keys) {
	const preferred = instrument === "bass" ? "4_standard" : "6_standard";
	if (keys.includes(preferred)) return preferred;
	return keys[0];
}

function CyberTuner({ instrument, accent }) {
	const tuningOptions = INSTRUMENT_CONFIGS[instrument] || {};
	const tuningKeys = Object.keys(tuningOptions);

	const [tuningKey, setTuningKey] = useState(() =>
		pickDefaultTuning(instrument, tuningKeys)
	);
	const [mode, setMode] = useState("auto");
	const [lockedString, setLockedString] = useState(null);

	const strings = tuningOptions[tuningKey] || [];

	const { frequency, note, cents, status, targetString, listening, error } =
		useTuner({ strings, mode, lockedString });

	function handleTuningChange(e) {
		setTuningKey(e.target.value);
		setMode("auto");
		setLockedString(null);
	}

	function handleSetAuto() {
		setMode("auto");
		setLockedString(null);
	}

	function handleSetLock() {
		if (!strings.length) return;
		setMode("lock");
		setLockedString((prev) => prev || strings[0]);
	}

	function handleStringClick(s) {
		setMode("lock");
		setLockedString(s);
	}

	const clampedCents = cents == null ? 0 : Math.max(-CENT_RANGE, Math.min(CENT_RANGE, cents));
	const needleX = ((clampedCents + CENT_RANGE) / (CENT_RANGE * 2)) * W;
	const statusColor =
		status === "in-tune" ? "var(--neon-lime)" :
		status === "flat" ? "var(--neon-cyan)" :
		status === "sharp" ? "var(--neon-magenta)" : "var(--text-mute)";
	const statusLabel =
		status === "in-tune" ? "LOCKED" :
		status === "flat" ? "FLAT // ↑" :
		status === "sharp" ? "SHARP // ↓" : "— LISTENING";

	const ticks = [];
	for (let c = -CENT_RANGE; c <= CENT_RANGE; c += 5) {
		const x = ((c + CENT_RANGE) / (CENT_RANGE * 2)) * W;
		const major = c % 25 === 0;
		ticks.push({ x, c, major });
	}

	const modeLabel =
		mode === "lock" && lockedString
			? `LOCKED · ${lockedString.name}`
			: "AUTO MODE";

	return (
		<div className="cyber-tuner" style={{ "--tuner-accent": accent }}>
			<div className="tuner-controls hud">
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />

				<div className="tuner-control-group">
					<span className="tuner-control-label">// TUNING</span>
					<select
						className="tuner-tuning-select"
						value={tuningKey}
						onChange={handleTuningChange}
					>
						{tuningKeys.map((k) => (
							<option key={k} value={k}>
								{formatTuningName(k)}
							</option>
						))}
					</select>
				</div>

				<div className="tuner-control-group">
					<span className="tuner-control-label">// MODE</span>
					<div className="tuner-mode-buttons">
						<button
							type="button"
							className={
								"tuner-mode-btn" +
								(mode === "auto" ? " tuner-mode-btn--active" : "")
							}
							onClick={handleSetAuto}
						>
							Auto
						</button>
						<button
							type="button"
							className={
								"tuner-mode-btn tuner-mode-btn--lock" +
								(mode === "lock" ? " tuner-mode-btn--active" : "")
							}
							onClick={handleSetLock}
						>
							Lock
						</button>
					</div>
				</div>

				<div className="tuner-mode-indicator">{modeLabel}</div>
			</div>

			<div className="tuner-status-bar hud">
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />
				<div className="tsb-cell">
					<div className="k">SIGNAL</div>
					<div className="v" style={{ color: error ? "var(--neon-magenta)" : listening ? "var(--neon-lime)" : "var(--text-mute)" }}>
						{error ? "ERR" : listening ? "LIVE" : "STANDBY"}
					</div>
				</div>
				<div className="tsb-cell">
					<div className="k">FREQUENCY</div>
					<div className="v cyan">{frequency ? frequency.toFixed(1) + " Hz" : "—"}</div>
				</div>
				<div className="tsb-cell">
					<div className="k">DETECTED</div>
					<div className="v">{note || "—"}</div>
				</div>
				<div className="tsb-cell">
					<div className="k">TARGET</div>
					<div className="v amber">{targetString ? targetString.name : "—"}</div>
				</div>
				<div className="tsb-cell">
					<div className="k">DEVIATION</div>
					<div className="v" style={{ color: statusColor }}>
						{cents != null ? (cents > 0 ? "+" : "") + cents.toFixed(1) + "¢" : "—"}
					</div>
				</div>
			</div>

			{error && <div className="tuner-error">!! MIC ACCESS // {error}</div>}

			<div className="tuner-meter hud">
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />

				<div className="tuner-meter-readout">
					<div className="readout-status" style={{ color: statusColor }}>
						{statusLabel}
					</div>
					<div className="readout-note">{note || "--"}</div>
				</div>

				<svg className="tuner-meter-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
					<defs>
						<linearGradient id="meterBgGrad" x1="0" x2="1">
							<stop offset="0%" stopColor="rgba(5, 217, 232, 0.18)" />
							<stop offset="50%" stopColor="rgba(163, 255, 94, 0.18)" />
							<stop offset="100%" stopColor="rgba(255, 42, 109, 0.18)" />
						</linearGradient>
						<linearGradient id="meterTopGrad" x1="0" x2="1">
							<stop offset="0%" stopColor="#05d9e8" />
							<stop offset="50%" stopColor="#a3ff5e" />
							<stop offset="100%" stopColor="#ff2a6d" />
						</linearGradient>
					</defs>

					<rect
						x={((-5 + CENT_RANGE) / (CENT_RANGE * 2)) * W}
						y={H * 0.22}
						width={(10 / (CENT_RANGE * 2)) * W}
						height={H * 0.56}
						fill="rgba(163, 255, 94, 0.08)"
						stroke="rgba(163, 255, 94, 0.4)"
						strokeWidth="1"
					/>

					<rect x="0" y={H * 0.4} width={W} height={H * 0.2} fill="url(#meterBgGrad)" />

					{ticks.map((t) => (
						<g key={t.c}>
							<line
								x1={t.x} x2={t.x}
								y1={t.major ? H * 0.18 : H * 0.32}
								y2={t.major ? H * 0.82 : H * 0.68}
								stroke="rgba(214, 246, 255, 0.35)"
								strokeWidth={t.major ? 1.5 : 1}
							/>
							{t.major && (
								<text
									x={t.x} y={H * 0.95}
									textAnchor="middle"
									fill="rgba(214, 246, 255, 0.55)"
									fontSize="11"
									fontFamily="var(--font-mono)"
									letterSpacing="2"
								>
									{t.c > 0 ? "+" + t.c : t.c}
								</text>
							)}
						</g>
					))}

					<line x1={W / 2} x2={W / 2} y1={H * 0.08} y2={H * 0.78} stroke="rgba(163, 255, 94, 0.7)" strokeWidth="1.5" strokeDasharray="3 3" />

					<line x1="0" x2={W} y1={H * 0.78} y2={H * 0.78} stroke="url(#meterTopGrad)" strokeWidth="1" />

					{cents != null && listening && (
						<g style={{ transition: "transform 0.12s ease-out" }}>
							<line
								x1={needleX} x2={needleX}
								y1={H * 0.05} y2={H * 0.78}
								stroke={statusColor}
								strokeWidth="2.5"
								style={{ filter: `drop-shadow(0 0 6px ${statusColor})` }}
							/>
							<polygon
								points={`${needleX - 8},${H * 0.05} ${needleX + 8},${H * 0.05} ${needleX},${H * 0.18}`}
								fill={statusColor}
								style={{ filter: `drop-shadow(0 0 6px ${statusColor})` }}
							/>
							<circle cx={needleX} cy={H * 0.78} r="6" fill={statusColor} style={{ filter: `drop-shadow(0 0 8px ${statusColor})` }} />
						</g>
					)}
				</svg>

				<div className="tuner-meter-axis">
					<span>FLAT</span>
					<span>·</span>
					<span style={{ color: "var(--neon-lime)" }}>IN-TUNE</span>
					<span>·</span>
					<span>SHARP</span>
				</div>
			</div>

			<div className="tuner-strings hud">
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />
				<div className="tuner-strings-head">
					<span className="eyebrow" style={{ color: "var(--tuner-accent)" }}>
						// STRINGS // {strings.length} · {formatTuningName(tuningKey).toUpperCase()}
					</span>
					<span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", letterSpacing: "0.18em" }}>
						{mode === "lock" ? "CLICK TO RE-LOCK" : "CLICK TO LOCK · AUTO-DETECT NEAREST"}
					</span>
				</div>
				<div className="tuner-strings-row">
					{strings.map((s, i) => {
						const isTarget = targetString === s;
						const isLockTarget = mode === "lock" && lockedString === s;
						const isInTune = isTarget && status === "in-tune";
						return (
							<button
								type="button"
								key={`${i}-${s.name}`}
								onClick={() => handleStringClick(s)}
								className={
									"tuner-string" +
									(isTarget ? " tuner-string--target" : "") +
									(isLockTarget ? " tuner-string--locked" : "") +
									(isInTune ? " tuner-string--in-tune" : "")
								}
							>
								<div className="tstr-letter">{s.letter}</div>
								<div className="tstr-octave">{s.name}</div>
								<div className="tstr-freq">{s.freq.toFixed(2)} Hz</div>
								{isLockTarget && <div className="tstr-marker">▲ LOCKED</div>}
								{!isLockTarget && isTarget && <div className="tstr-marker">▲ TARGET</div>}
							</button>
						);
					})}
				</div>
			</div>

			{!listening && !error && (
				<div className="tuner-hint">
					<span className="dot" /> WAITING FOR MICROPHONE PERMISSION
				</div>
			)}
		</div>
	);
}

export default CyberTuner;
