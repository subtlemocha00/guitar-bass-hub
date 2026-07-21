import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "../../components/useDialogFocus";
import "../songs/AddSongModal.css";

function AddBackingTrackModal({ open, onClose, onSubmit, mode = "add", initialValues }) {
	const [title, setTitle] = useState("");
	const [artist, setArtist] = useState("");
	const [youtubeUrl, setYoutubeUrl] = useState("");
	const [genre, setGenre] = useState("");
	const [bpm, setBpm] = useState("");
	const [trackKey, setTrackKey] = useState("");
	const [notes, setNotes] = useState("");
	const [errors, setErrors] = useState({});
	const [submitting, setSubmitting] = useState(false);
	const formRef = useRef(null);
	const submittingRef = useRef(false);

	useDialogFocus(open, formRef);

	// Mirrored so the Escape listener can read it without re-subscribing on
	// every keystroke-driven render.
	useEffect(() => {
		submittingRef.current = submitting;
	}, [submitting]);

	useEffect(() => {
		if (!open) return;
		setTitle(initialValues?.title ?? "");
		setArtist(initialValues?.artist ?? "");
		setYoutubeUrl(initialValues?.youtubeUrl ?? "");
		setGenre(initialValues?.genre ?? "");
		setBpm(
			typeof initialValues?.bpm === "number" ? String(initialValues.bpm) : ""
		);
		setTrackKey(initialValues?.trackKey ?? "");
		setNotes(initialValues?.notes ?? "");
		setErrors({});
	}, [open, initialValues]);

	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => {
			// Guarded like the close button: Escape mid-save would discard the
			// entered values while the write is still in flight.
			if (e.key === "Escape" && !submittingRef.current) onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	function handleClose() {
		if (submitting) return;
		onClose();
	}

	function handleSubmit(e) {
		e.preventDefault();
		const errs = {};
		if (!title.trim()) errs.title = "Title is required";
		if (!artist.trim()) errs.artist = "Artist is required";
		if (!youtubeUrl.trim()) errs.youtubeUrl = "YouTube URL is required";
		if (bpm.trim() && Number.isNaN(Number(bpm))) errs.bpm = "BPM must be a number";
		setErrors(errs);
		if (Object.keys(errs).length > 0) return;

		const bpmNum = bpm.trim() ? Math.round(Number(bpm)) : null;

		setSubmitting(true);
		Promise.resolve(
			onSubmit({
				title: title.trim(),
				artist: artist.trim(),
				youtubeUrl: youtubeUrl.trim(),
				genre: genre.trim(),
				bpm: bpmNum,
				trackKey: trackKey.trim(),
				notes: notes.trim(),
			})
		)
			.then((result) => {
				// The write layer reports { ok, message }. Keep the modal open on
				// failure so the entered values aren't lost — previously it closed
				// regardless and the track silently never saved.
				if (result && result.ok === false) {
					setErrors({ form: result.message });
					return;
				}
				onClose();
			})
			.finally(() => setSubmitting(false));
	}

	const isEdit = mode === "edit";
	const eyebrowText = isEdit ? "// EDIT · BACKING TRACK" : "// ADD · BACKING TRACK";
	const ariaLabel = isEdit ? "Edit Backing Track" : "Add Backing Track";
	const submitLabel = submitting ? "SAVING…" : isEdit ? "UPDATE" : "SAVE";

	return (
		<div className="add-song-overlay" onClick={handleClose} role="presentation">
			<form
				className="add-song-modal hud"
				ref={formRef}
				onClick={(e) => e.stopPropagation()}
				onSubmit={handleSubmit}
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
			>
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />

				<header className="add-song-header">
					<span className="eyebrow">{eyebrowText}</span>
					<button
						type="button"
						className="add-song-close"
						onClick={handleClose}
						aria-label="Close"
					>
						×
					</button>
				</header>

				<label className="add-song-field">
					<span className="add-song-label">TITLE *</span>
					<input
						className="add-song-input"
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						autoFocus
					/>
					{errors.title && <span className="add-song-error">{errors.title}</span>}
				</label>

				<label className="add-song-field">
					<span className="add-song-label">ARTIST *</span>
					<input
						className="add-song-input"
						type="text"
						value={artist}
						onChange={(e) => setArtist(e.target.value)}
					/>
					{errors.artist && <span className="add-song-error">{errors.artist}</span>}
				</label>

				<label className="add-song-field">
					<span className="add-song-label">YOUTUBE URL *</span>
					<input
						className="add-song-input"
						type="url"
						value={youtubeUrl}
						onChange={(e) => setYoutubeUrl(e.target.value)}
						placeholder="https://youtube.com/…"
					/>
					{errors.youtubeUrl && (
						<span className="add-song-error">{errors.youtubeUrl}</span>
					)}
				</label>

				<div className="add-song-grid">
					<label className="add-song-field add-song-field--genre">
						<span className="add-song-label">GENRE</span>
						<input
							className="add-song-input"
							type="text"
							value={genre}
							onChange={(e) => setGenre(e.target.value)}
							placeholder="optional"
						/>
					</label>

					<label className="add-song-field">
						<span className="add-song-label">BPM</span>
						<input
							className="add-song-input"
							type="number"
							inputMode="numeric"
							min="20"
							max="400"
							value={bpm}
							onChange={(e) => setBpm(e.target.value)}
							placeholder="optional"
						/>
						{errors.bpm && <span className="add-song-error">{errors.bpm}</span>}
					</label>

					<label className="add-song-field">
						<span className="add-song-label">KEY</span>
						<input
							className="add-song-input"
							type="text"
							value={trackKey}
							onChange={(e) => setTrackKey(e.target.value)}
							placeholder="e.g. Em"
						/>
					</label>
				</div>

				<label className="add-song-field">
					<span className="add-song-label">NOTES</span>
					<textarea
						className="add-song-input"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="optional"
						rows={3}
						style={{ resize: "vertical", fontFamily: "inherit" }}
					/>
				</label>

				{errors.form && (
					<span className="add-song-error" role="alert">
						{errors.form}
					</span>
				)}

				<div className="add-song-actions">
					<button
						type="button"
						className="add-song-btn"
						onClick={handleClose}
						disabled={submitting}
					>
						CANCEL
					</button>
					<button
						type="submit"
						className="add-song-btn add-song-btn--solid"
						disabled={submitting}
					>
						{submitLabel}
					</button>
				</div>
			</form>
		</div>
	);
}

export default AddBackingTrackModal;
