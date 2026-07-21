import { useEffect, useRef } from "react";
import { useDialogFocus } from "./useDialogFocus";
import "./ConfirmDialog.css";

// In-app replacement for window.confirm().
//
// window.confirm blocks the JS thread (it stalls the metronome's scheduler),
// renders as an OS chrome dialog that ignores the app's styling, and is either
// suppressed or inconsistent inside packaged webviews — so it cannot survive
// the move to a native shell.
//
// Controlled and presentational: the caller owns the open flag and both
// handlers, matching AddSongModal. That keeps it usable anywhere without a
// provider or global state.
function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel = "CONFIRM",
	cancelLabel = "CANCEL",
	tone = "danger",
	onConfirm,
	onCancel,
}) {
	const confirmRef = useRef(null);
	const dialogRef = useRef(null);

	useDialogFocus(open, dialogRef);

	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => {
			if (e.key === "Escape") onCancel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onCancel]);

	// Move focus onto the dialog so Enter/Escape act on it rather than on the
	// button that opened it — window.confirm did this for free.
	useEffect(() => {
		if (open) confirmRef.current?.focus();
	}, [open]);

	if (!open) return null;

	return (
		<div className="confirm-overlay" onClick={onCancel} role="presentation">
			<div
				className="confirm-dialog hud"
				ref={dialogRef}
				onClick={(e) => e.stopPropagation()}
				role="alertdialog"
				aria-modal="true"
				aria-label={title}
				aria-describedby="confirm-dialog-message"
			>
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />

				<span className="eyebrow confirm-eyebrow">// {title}</span>
				<p className="confirm-message" id="confirm-dialog-message">
					{message}
				</p>

				<div className="confirm-actions">
					<button type="button" className="confirm-btn" onClick={onCancel}>
						{cancelLabel}
					</button>
					<button
						type="button"
						ref={confirmRef}
						className={`confirm-btn confirm-btn--${tone}`}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

export default ConfirmDialog;
