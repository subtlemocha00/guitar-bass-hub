import { useState } from "react";
import {
	listPresets,
	savePreset,
	deletePreset,
	DEFAULT_SETTINGS,
} from "./metronomeStorage";
import "./MetronomePresets.css";

function summarize(s) {
	return `${s.bpm} BPM · ${s.beats}/4 · ${s.subdivision}`;
}

// Save / view / apply / delete metronome presets, plus a reset-to-defaults
// action. Applying a preset (or resetting) calls onApply, which updates the
// live metronome state directly — so it takes effect immediately.
export default function MetronomePresets({ currentSettings, onApply }) {
	const [presets, setPresets] = useState(() => listPresets());
	const [name, setName] = useState("");

	const handleSave = () => {
		savePreset(name, currentSettings);
		setName("");
		setPresets(listPresets());
	};

	const handleDelete = (id) => {
		deletePreset(id);
		setPresets(listPresets());
	};

	const handleReset = () => {
		if (!window.confirm("Reset the metronome to default settings?")) return;
		onApply(DEFAULT_SETTINGS);
	};

	return (
		<div className="mp">
			<div className="mp-save">
				<input
					className="mp-input"
					type="text"
					value={name}
					maxLength={32}
					placeholder="Preset name"
					aria-label="New preset name"
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSave();
					}}
				/>
				<button type="button" className="btn btn--amber" onClick={handleSave}>
					SAVE CURRENT
				</button>
			</div>

			{presets.length === 0 ? (
				<p className="mp-empty">
					No presets yet. Dial in the metronome, then save the current
					configuration.
				</p>
			) : (
				<ul className="mp-list">
					{presets.map((p) => (
						<li className="mp-item" key={p.id}>
							<div className="mp-item-info">
								<span className="mp-item-name">{p.name}</span>
								<span className="mp-item-sum">{summarize(p.settings)}</span>
							</div>
							<div className="mp-item-actions">
								<button
									type="button"
									className="mp-mini"
									onClick={() => onApply(p.settings)}
								>
									APPLY
								</button>
								<button
									type="button"
									className="mp-mini mp-mini--danger"
									onClick={() => handleDelete(p.id)}
									aria-label={`Delete preset ${p.name}`}
								>
									DEL
								</button>
							</div>
						</li>
					))}
				</ul>
			)}

			<div className="mp-reset">
				<button type="button" className="btn btn--magenta" onClick={handleReset}>
					RESET METRONOME
				</button>
			</div>
		</div>
	);
}
