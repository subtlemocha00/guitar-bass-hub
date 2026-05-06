import { useEffect, useState } from "react";
import "./AddSongModal.css";

function AddSongModal({ open, onClose, onSubmit }) {
	const [title, setTitle] = useState("");
	const [artist, setArtist] = useState("");
	const [tabUrl, setTabUrl] = useState("");
	const [youtubeUrl, setYoutubeUrl] = useState("");
	const [errors, setErrors] = useState({});
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	function reset() {
		setTitle("");
		setArtist("");
		setTabUrl("");
		setYoutubeUrl("");
		setErrors({});
	}

	function handleClose() {
		if (submitting) return;
		reset();
		onClose();
	}

	function handleSubmit(e) {
		e.preventDefault();
		const errs = {};
		if (!title.trim()) errs.title = "Title is required";
		if (!artist.trim()) errs.artist = "Artist is required";
		if (!tabUrl.trim()) errs.tabUrl = "Tab URL is required";
		setErrors(errs);
		if (Object.keys(errs).length > 0) return;

		setSubmitting(true);
		Promise.resolve(
			onSubmit({
				title: title.trim(),
				artist: artist.trim(),
				tabUrl: tabUrl.trim(),
				youtubeUrl: youtubeUrl.trim() || null,
			})
		)
			.then(() => {
				reset();
				onClose();
			})
			.finally(() => {
				setSubmitting(false);
			});
	}

	return (
		<div
			className="add-song-overlay"
			onClick={handleClose}
			role="presentation"
		>
			<form
				className="add-song-modal hud"
				onClick={(e) => e.stopPropagation()}
				onSubmit={handleSubmit}
				aria-label="Add Song"
			>
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />

				<header className="add-song-header">
					<span className="eyebrow">// ADD · SONG</span>
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
					{errors.title && (
						<span className="add-song-error">{errors.title}</span>
					)}
				</label>

				<label className="add-song-field">
					<span className="add-song-label">ARTIST *</span>
					<input
						className="add-song-input"
						type="text"
						value={artist}
						onChange={(e) => setArtist(e.target.value)}
					/>
					{errors.artist && (
						<span className="add-song-error">{errors.artist}</span>
					)}
				</label>

				<label className="add-song-field">
					<span className="add-song-label">TAB URL *</span>
					<input
						className="add-song-input"
						type="url"
						value={tabUrl}
						onChange={(e) => setTabUrl(e.target.value)}
						placeholder="https://…"
					/>
					{errors.tabUrl && (
						<span className="add-song-error">{errors.tabUrl}</span>
					)}
				</label>

				<label className="add-song-field">
					<span className="add-song-label">YOUTUBE URL</span>
					<input
						className="add-song-input"
						type="url"
						value={youtubeUrl}
						onChange={(e) => setYoutubeUrl(e.target.value)}
						placeholder="optional"
					/>
				</label>

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
						{submitting ? "SAVING…" : "SAVE"}
					</button>
				</div>
			</form>
		</div>
	);
}

export default AddSongModal;
