import "./SongFilterTabs.css";

const FILTERS = [
	{ key: "all", label: "All" },
	{ key: "learning", label: "Learning" },
	{ key: "planned", label: "Planned" },
	{ key: "completed", label: "Completed" },
];

function SongFilterTabs({ filter, onChange }) {
	return (
		<div className="song-filter-tabs" role="tablist">
			{FILTERS.map((f) => {
				const active = filter === f.key;
				return (
					<button
						key={f.key}
						type="button"
						role="tab"
						aria-selected={active}
						className={`song-filter-tab${
							active ? " song-filter-tab--active" : ""
						}`}
						onClick={() => onChange(f.key)}
					>
						{f.label}
					</button>
				);
			})}
		</div>
	);
}

export default SongFilterTabs;
