import { useCallback, useState } from "react";

// Which card's action sheet is open, owned by the LIST rather than the card.
//
// WHY THE LIST AND NOT THE CARD
// The song list groups by status, so each group is its own <section>. Changing
// a song's status therefore moves its card between parents — a React unmount
// and remount, not a reorder. A sheet owned by the card would be destroyed by
// the very action it exists to offer: pick "Completed", and the sheet vanishes
// mid-interaction with no transition, because its owner no longer exists.
//
// Hoisting the state one level makes the sheet outlive the card. It also means
// one sheet instance per list instead of one per card.
//
// `item` is deliberately NOT cleared on close: the sheet stays mounted for its
// exit transition, and it still needs something to render while it fades. It is
// simply the last-selected item, which is harmless once `open` is false.
export function useCardActionSheet() {
	const [item, setItem] = useState(null);
	const [open, setOpen] = useState(false);

	const openFor = useCallback((next) => {
		setItem(next);
		setOpen(true);
	}, []);

	const close = useCallback(() => setOpen(false), []);

	return { item, open, openFor, close };
}
