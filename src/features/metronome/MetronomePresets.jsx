import { useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
	listPresets,
	savePreset as lsSavePreset,
	deletePreset as lsDeletePreset,
	DEFAULT_SETTINGS,
} from "./metronomeStorage";
import { useMetronomePresets } from "./useMetronomePresets";
import "./MetronomePresets.css";

function summarize(s) {
	return `${s.bpm} BPM · ${s.beats}/4 · ${s.subdivision}`;
}

// Normalize a preset to a plain settings object that applySettings can consume.
// Cloud presets are flat (all fields at top level).
// localStorage presets nest settings under a .settings key.
function extractSettings(p) {
	return p.settings ?? p;
}

export default function MetronomePresets({ currentSettings, onApply }) {
	const {
		presets: cloudPresets,
		savePreset: cloudSave,
		deletePreset: cloudDelete,
		signedIn,
	} = useMetronomePresets();

	const [localPresets, setLocalPresets] = useState(() => listPresets());
	const [name, setName] = useState("");
	const [confirmingReset, setConfirmingReset] = useState(false);

	const presets = signedIn ? cloudPresets : localPresets;

	const handleSave = () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		if (signedIn) {
			cloudSave(trimmed, currentSettings);
		} else {
			lsSavePreset(trimmed, currentSettings);
			setLocalPresets(listPresets());
		}
		setName("");
	};

	const handleDelete = (id) => {
		if (signedIn) {
			cloudDelete(id);
		} else {
			lsDeletePreset(id);
			setLocalPresets(listPresets());
		}
	};

	const handleReset = () => {
		setConfirmingReset(false);
		onApply(DEFAULT_SETTINGS);
	};

	return (
		<div className="mp">
			{!signedIn && (
				<p className="mp-empty" style={{ marginBottom: "0.35rem" }}>
					Sign in to sync presets across devices.
				</p>
			)}

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
								<span className="mp-item-sum">
									{summarize(extractSettings(p))}
								</span>
							</div>
							<div className="mp-item-actions">
								<button
									type="button"
									className="mp-mini"
									onClick={() => onApply(extractSettings(p))}
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
				<button
					type="button"
					className="btn btn--magenta"
					onClick={() => setConfirmingReset(true)}
				>
					RESET METRONOME
				</button>
			</div>

			<ConfirmDialog
				open={confirmingReset}
				title="RESET · METRONOME"
				message="Reset the metronome to default settings? Saved presets are not affected."
				confirmLabel="RESET"
				onConfirm={handleReset}
				onCancel={() => setConfirmingReset(false)}
			/>
		</div>
	);
}
