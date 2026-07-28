// "Did this click already belong to something else?" — the guard a selectable
// card needs before treating a click as a selection.
//
// Shared by SongCard and BackingTrackCard, which are card-shaped for the same
// reason and would otherwise carry the same selector twice. Its own module
// rather than an export from CardActionModal.jsx so that file exports only a
// component (react-refresh/only-export-components).

// The dialog roles matter as much as the controls: a card renders its delete
// confirmation *inside itself*, so cancelling it by clicking the backdrop
// bubbles the click up to the card — which would then treat the dismissal as a
// selection and open the action sheet. `role="presentation"` is the backdrop,
// the dialog roles the panel; both are matched so any dialog a card gains later
// is covered without editing this list.
const SELF_HANDLED = [
	"a",
	"button",
	"input",
	"textarea",
	"select",
	"iframe",
	"label",
	'[role="presentation"]',
	'[role="dialog"]',
	'[role="alertdialog"]',
].join(",");

/**
 * True when a click on a card originated in something that already handles it —
 * a control, or a dialog the card renders — so the card should not also treat
 * it as a selection.
 */
export function isSelfHandledClick(event) {
	return !!event.target.closest(SELF_HANDLED);
}
