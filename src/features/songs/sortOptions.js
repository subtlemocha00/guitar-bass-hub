// Sort options for song lists. Kept in their own module so both the menu
// component and the useSortPreference hook can import them without tripping
// React Fast Refresh, which warns when a component file also exports values.
export const SORT_OPTIONS = [
	{ value: "recent", label: "Recently Added" },
	{ value: "alphabetical", label: "Alphabetical" },
	{ value: "artist", label: "Artist" },
];

export const DEFAULT_SORT = "recent";
