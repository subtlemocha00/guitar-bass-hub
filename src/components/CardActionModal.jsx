import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { externalLinkProps } from "../platform/links";
import { subscribeToHardwareBack } from "../platform/platform";
import "./CardActionModal.css";

/**
 * A destination inside an action sheet — "Go to Tab", "Open on YouTube".
 * Renders nothing for a missing or unusable URL, so callers can pass a
 * possibly-null URL without guarding.
 *
 * `variant="secondary"` outlines it instead of filling it, for a sheet that
 * offers two destinations and needs one of them to read as primary.
 */
export function CardActionLink({ url, onClose, variant, children }) {
	if (!url) return null;

	const linkProps = externalLinkProps(url);

	return (
		<a
			className={`card-modal-action${
				variant ? ` card-modal-action--${variant}` : ""
			}`}
			{...linkProps}
			onClick={(e) => {
				// Spread order means this handler REPLACES the one
				// externalLinkProps adds on the packaged shells (where a webview's
				// target="_blank" is dead and the click has to be handed to the
				// shell), so call it explicitly before dismissing.
				linkProps.onClick?.(e);
				onClose();
			}}
		>
			{children}
		</a>
	);
}

// The action sheet a list card opens when it is selected.
//
// WHY IT EXISTS
// A card carries more actions than fit comfortably beside its title on a phone.
// Previously the primary action (open the tab URL) was bound to tapping the
// card itself, which made it impossible to select a card without leaving the
// app — and left the secondary control (status) crowding the card. Selecting a
// card now opens this sheet instead, and the card keeps only the controls that
// act in place (edit, delete, show video, notes).
//
// WHY IT IS SHARED RATHER THAN PER-FEATURE
// Songs and backing tracks need identical dismissal behaviour on four pages
// across three shells. Only the body differs, so only the body is a prop:
// everything below — the transition, Escape, backdrop click, the Android back
// button, the focus trap and the scroll lock — is written once here.
//
// Controlled and presentational, matching AddSongModal and ConfirmDialog: the
// caller owns `open` and `onClose`, so this needs no provider or global state.

// Kept in sync with the transition duration in CardActionModal.css. The sheet
// stays mounted for this long after `open` goes false so the exit transition
// has something to run on; unmounting immediately would make it vanish.
const EXIT_MS = 220;

function CardActionModal({ open, title, eyebrow, onClose, children }) {
	// `exiting` is true only for the window between open going false and the
	// transition finishing. Rendering is derived from `open || exiting` during
	// render — not from a state flag set in an effect — so the dialog element
	// exists in the same commit that `open` becomes true and the focus effects
	// below find it attached.
	const [exiting, setExiting] = useState(false);
	// Drives the CSS in/out state. Flipped a frame after mount so the browser
	// has a start value to interpolate from.
	const [entered, setEntered] = useState(false);

	const dialogRef = useRef(null);
	const exitTimer = useRef(null);
	const wasOpen = useRef(open);

	// Handlers are read through a ref so the effects below depend on `open`
	// alone. That matters most for the hardware-back subscription: registering
	// with @capacitor/app is asynchronous, so re-subscribing on every parent
	// render would churn listener handles for no reason.
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	});
	const close = () => onCloseRef.current?.();

	useDialogFocus(open, dialogRef);

	useEffect(() => {
		const hadBeenOpen = wasOpen.current;
		wasOpen.current = open;

		if (open) {
			if (exitTimer.current) {
				clearTimeout(exitTimer.current);
				exitTimer.current = null;
			}
			setExiting(false);
			// Two frames, not one: the first commits the closed state to the
			// newly inserted element, the second flips to open. With a single
			// frame the browser can coalesce both into the same style
			// recalculation and skip the transition entirely.
			let id = requestAnimationFrame(() => {
				id = requestAnimationFrame(() => setEntered(true));
			});
			return () => cancelAnimationFrame(id);
		}

		// Nothing to animate out on the initial render, or on a re-render while
		// already closed.
		if (!hadBeenOpen) return undefined;

		setEntered(false);
		setExiting(true);
		exitTimer.current = setTimeout(() => {
			exitTimer.current = null;
			setExiting(false);
		}, EXIT_MS);
		return undefined;
	}, [open]);

	useEffect(
		() => () => {
			if (exitTimer.current) clearTimeout(exitTimer.current);
		},
		[]
	);

	// Focus the sheet itself rather than a control inside it. Which control
	// should lead differs per caller, and landing on the container keeps
	// Escape working while leaving Tab to reach the body in source order.
	useEffect(() => {
		if (open) dialogRef.current?.focus();
	}, [open]);

	// Desktop dismissal.
	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => {
			if (e.key === "Escape") close();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	// Android dismissal. Subscribed only while open — on Capacitor a registered
	// back listener replaces the app's default back handling, so holding one
	// permanently would break ordinary back navigation (see
	// platform/hardwareBack/capacitorHardwareBack.js).
	useEffect(() => {
		if (!open) return undefined;
		return subscribeToHardwareBack(() => close());
	}, [open]);

	// Stop the page behind the overlay from scrolling under a stray touch.
	// Held for the exit transition too, so the page cannot lurch while the
	// sheet is still visible.
	useEffect(() => {
		if (!open && !exiting) return undefined;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previous;
		};
	}, [open, exiting]);

	if (!open && !exiting) return null;

	return (
		<div
			className={`card-modal-overlay${entered ? " card-modal-overlay--in" : ""}`}
			// stopPropagation so a backdrop click cannot also register on
			// whatever the caller renders this inside — a selectable card would
			// otherwise dismiss and immediately re-open.
			onClick={(e) => {
				e.stopPropagation();
				close();
			}}
			role="presentation"
		>
			<div
				className={`card-modal hud${entered ? " card-modal--in" : ""}`}
				ref={dialogRef}
				tabIndex={-1}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-label={title}
			>
				<span className="hud-corner-tr" />
				<span className="hud-corner-bl" />

				<header className="card-modal-header">
					<span className="eyebrow card-modal-eyebrow">{eyebrow}</span>
					<button
						type="button"
						className="card-modal-close"
						onClick={close}
						aria-label="Close"
					>
						×
					</button>
				</header>

				<h2 className="card-modal-title">{title}</h2>

				<div className="card-modal-body">{children}</div>
			</div>
		</div>
	);
}

export default CardActionModal;
