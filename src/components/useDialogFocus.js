import { useEffect, useRef } from "react";

// Keep keyboard focus inside an open dialog, and give it back when the dialog
// closes.
//
// WHY
// All three dialogs render over the page rather than replacing it, so without
// this, Tab walks straight out of the dialog and into the topbar behind the
// overlay — the focus ring disappears behind a dimmed backdrop and Enter
// activates something the user cannot see. Measured, not assumed: six Tabs from
// the Add Song modal landed on the brand link. Closing then left focus wherever
// it had wandered instead of on the control that opened the dialog.
//
// This is not desktop-specific. Keyboard users hit it on the web too — it is
// simply more obvious in a packaged app, where Tab has nowhere else to go
// because there is no browser chrome to escape into.
//
// SCOPE
// Trap and restore only. Initial focus stays with each dialog (autoFocus on the
// first field, or an explicit ref for a confirm button) because the right
// starting element differs per dialog and the existing choices are correct.

const FOCUSABLE = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled]):not([type=hidden])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	'[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableWithin(container) {
	return [...container.querySelectorAll(FOCUSABLE)].filter(
		(el) => el.offsetParent !== null || el === document.activeElement
	);
}

/**
 * @param {boolean} open         whether the dialog is rendered
 * @param {object} containerRef  ref to the dialog element (not the overlay)
 */
export function useDialogFocus(open, containerRef) {
	// The last two focused elements, newest first.
	//
	// Two slots rather than one because of React's commit order, which cost
	// three wrong fixes before it was measured. Reading document.activeElement
	// when the trap installs returns the dialog's own first field: autoFocus is
	// applied during commit, before any effect runs. Filtering focusin events by
	// containerRef does not help either — refs attach bottom-up, so a child's
	// autoFocus fires while the parent container ref is still null.
	//
	// By the time effects run, both are settled: whichever slot is not inside
	// the dialog is the control the user actually activated.
	const history = useRef({ current: null, previous: null });

	useEffect(() => {
		const onFocusIn = (e) => {
			const h = history.current;
			if (e.target === h.current) return;
			h.previous = h.current;
			h.current = e.target;
		};
		document.addEventListener("focusin", onFocusIn);
		return () => document.removeEventListener("focusin", onFocusIn);
	}, []);

	useEffect(() => {
		if (!open) return undefined;

		const container = containerRef.current;
		const { current, previous } = history.current;
		const outside = container?.contains(current) ? previous : current;

		function onKeyDown(e) {
			if (e.key !== "Tab") return;
			const el = containerRef.current;
			if (!el) return;

			const items = focusableWithin(el);
			if (items.length === 0) return;

			const first = items[0];
			const last = items[items.length - 1];

			// Focus outside the dialog entirely (browser chrome, or a stale
			// element) — pull it back rather than letting Tab continue.
			if (!el.contains(document.activeElement)) {
				e.preventDefault();
				first.focus();
				return;
			}
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			// Only restore if the element is still in the document — deleting a
			// song unmounts the button that opened the confirm dialog.
			if (outside?.isConnected && outside.focus) outside.focus();
		};
	}, [open, containerRef]);
}
