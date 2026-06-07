import "./SongSortMenu.css";
import { SORT_OPTIONS } from "./sortOptions";

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
