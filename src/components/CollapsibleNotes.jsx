import { useId, useState } from "react";
import "./CollapsibleNotes.css";

// The NOTES drawer at the foot of a card.
//
// WHY
// Notes were a permanently-expanded textarea in the middle of every song card,
// which is what made the list feel crowded: most cards have no note, and the
// empty field still cost a row of vertical space on every one of them. Folding
// it away puts the card's identity (title, artist) and its controls back within
// one screen, at the cost of a single tap for the cards that do have a note.
//
// STATE IS DELIBERATELY LOCAL AND NOT PERSISTED
// Expansion is a per-glance decision, not a preference. Persisting it would
// mean a Firestore read/write per card for something the user re-decides every
// time they open the page.
//
// Shared between songs (an editable, auto-saving textarea) and backing tracks
// (a read-only note), so the drawer takes children rather than a value: the
// chrome and the animation are the reusable part, the content is not.
function CollapsibleNotes({ children, label = "NOTES" }) {
	const [open, setOpen] = useState(false);
	const panelId = useId();

	return (
		<div className={`card-notes${open ? " card-notes--open" : ""}`}>
			<button
				type="button"
				className="card-notes-toggle"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
				aria-controls={panelId}
			>
				<span className="card-notes-label">{label}</span>
				<span className="card-notes-chevron" aria-hidden="true">
					▾
				</span>
			</button>

			{/* Height is animated with grid-template-rows 0fr -> 1fr, so the
			    drawer transitions to its natural height with no JS measurement
			    and no hard-coded max-height that would clip a long note.
			    `visibility` is transitioned alongside it so the collapsed
			    content leaves the tab order once the animation finishes. */}
			<div className="card-notes-panel" id={panelId}>
				<div className="card-notes-panel-inner">
					<div className="card-notes-content">{children}</div>
				</div>
			</div>
		</div>
	);
}

export default CollapsibleNotes;
