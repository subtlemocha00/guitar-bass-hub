import "./SongSortMenu.css";

export const SORT_OPTIONS = [
	{ value: "recent", label: "Recently Added" },
	{ value: "alphabetical", label: "Alphabetical" },
	{ value: "artist", label: "Artist" },
];

export const DEFAULT_SORT = "recent";

function SongSortMenu({ sort, onChange }) {
	return (
		<label className="song-sort">
			<span className="song-sort-label">SORT</span>
			<select
				className="song-sort-select"
				value={sort}
				onChange={(e) => onChange(e.target.value)}
			>
				{SORT_OPTIONS.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</label>
	);
}

export default SongSortMenu;
