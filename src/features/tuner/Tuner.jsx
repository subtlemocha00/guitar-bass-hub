import { STRINGS_BY_INSTRUMENT } from "./strings";
import { useTuner } from "./useTuner";
import "./Tuner.css";

const STATUS_LABELS = {
	flat: "Flat",
	"in-tune": "In Tune",
	sharp: "Sharp",
};

const METER_RANGE = 50;

function formatCents(cents) {
	if (cents == null) return "—";
	const sign = cents > 0 ? "+" : "";
	return `${sign}${cents.toFixed(0)} cents`;
}

function formatFrequency(frequency) {
	if (frequency == null) return "—";
	return `${frequency.toFixed(1)} Hz`;
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function Meter({ cents, status }) {
	const hasReading = cents != null;
	const clamped = hasReading ? clamp(cents, -METER_RANGE, METER_RANGE) : 0;
	const positionPct = ((clamped + METER_RANGE) / (METER_RANGE * 2)) * 100;

	return (
		<div className="tuner-meter" aria-hidden={!hasReading}>
			<div className="tuner-meter-track" />
			<div className="tuner-meter-zero" />
			{hasReading && (
				<div
					className={`tuner-meter-needle tuner-meter-needle--${status}`}
					style={{ left: `${positionPct}%` }}
				/>
			)}
			<div className="tuner-meter-labels">
				<span>−50</span>
				<span>0</span>
				<span>+50</span>
			</div>
		</div>
	);
}

function Tuner({ instrument }) {
	const strings = STRINGS_BY_INSTRUMENT[instrument] ?? [];
	const { frequency, note, cents, status, targetString, listening, error } =
		useTuner({ strings });

	if (error) {
		return (
			<div className="tuner tuner--error">
				<p>Microphone unavailable.</p>
				<p className="tuner-error-detail">{error}</p>
				<p className="tuner-error-hint">
					Allow microphone access in your browser and reload the page.
				</p>
			</div>
		);
	}

	if (!listening) {
		return (
			<div className="tuner tuner--idle">
				<p>Starting microphone…</p>
			</div>
		);
	}

	return (
		<div className="tuner">
			<div className="tuner-note">{note ?? "—"}</div>

			<div className="tuner-target">
				{targetString
					? `${targetString.letter} string (${targetString.name})`
					: "Play any string"}
			</div>

			<Meter cents={cents} status={status} />

			<div
				className={`tuner-status${
					status ? ` tuner-status--${status}` : ""
				}`}
			>
				{status ? STATUS_LABELS[status] : "Listening…"}
			</div>

			<div className="tuner-meta">
				<span className="tuner-meta-item">{formatFrequency(frequency)}</span>
				<span className="tuner-meta-item">{formatCents(cents)}</span>
			</div>
		</div>
	);
}

export default Tuner;
