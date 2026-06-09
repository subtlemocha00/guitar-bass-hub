import { useState } from "react";
import {
	DndContext,
	PointerSensor,
	KeyboardSensor,
	closestCenter,
	useSensor,
	useSensors,
	DragOverlay,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
	arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Layout from "../components/Layout";
import BackLink from "../components/BackLink";
import { useSetlist } from "../features/setlist/useSetlist";
import { VideoToggleButton, VideoPlayer } from "../features/songs/YouTubeEmbed";
import "./Setlist.css";

const FILTERS = ["all", "guitar", "bass"];

function InstrumentBadge({ instrument }) {
	return (
		<span className={`setlist-badge setlist-badge--${instrument}`}>
			{instrument}
		</span>
	);
}

function SongItem({ song, globalIndex, isDragMode, isOverlay }) {
	const [videoOpen, setVideoOpen] = useState(false);

	const {
		setNodeRef,
		attributes,
		listeners,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: song.id, disabled: !isDragMode });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	const classes = [
		"setlist-item",
		isDragging ? "setlist-item--dragging" : "",
		isOverlay ? "setlist-item--overlay" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div ref={setNodeRef} style={style} className={classes}>
			<div className="setlist-item-row">
				{isDragMode && (
					<span
						className="setlist-handle"
						aria-label="Drag to reorder"
						{...attributes}
						{...listeners}
					>
						⠿
					</span>
				)}
				<span className="setlist-pos">
					#{String(globalIndex + 1).padStart(2, "0")}
				</span>
				<div className="setlist-song-info">
					<span className="setlist-song-title">{song.title}</span>
					<span className="setlist-song-artist">{song.artist}</span>
				</div>
				<InstrumentBadge instrument={song.instrument} />
				{!isOverlay && song.youtubeId && (
					<VideoToggleButton
						videoOpen={videoOpen}
						onToggleVideo={() => setVideoOpen((v) => !v)}
					/>
				)}
			</div>
			{!isOverlay && song.youtubeId && videoOpen && (
				<VideoPlayer
					youtubeId={song.youtubeId}
					title={`${song.title} — ${song.artist}`}
				/>
			)}
		</div>
	);
}

export default function Setlist() {
	const { orderedList, reorder, loading, signedIn } = useSetlist();
	const [filter, setFilter] = useState("all");
	const [activeId, setActiveId] = useState(null);

	const isDragMode = filter === "all";

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	function handleDragStart({ active }) {
		setActiveId(active.id);
	}

	function handleDragEnd({ active, over }) {
		setActiveId(null);
		if (!over || active.id === over.id) return;
		const oldIndex = orderedList.findIndex((s) => s.id === active.id);
		const newIndex = orderedList.findIndex((s) => s.id === over.id);
		if (oldIndex < 0 || newIndex < 0) return;
		reorder(arrayMove(orderedList, oldIndex, newIndex));
	}

	const visibleList =
		filter === "all" ? orderedList : orderedList.filter((s) => s.instrument === filter);

	const activeSong = activeId ? orderedList.find((s) => s.id === activeId) : null;
	const activeGlobalIndex = activeId
		? orderedList.findIndex((s) => s.id === activeId)
		: -1;

	const routeCount = String(FILTERS.length).padStart(2, "0");

	return (
		<Layout>
			<div className="page setlist-page">
				<BackLink to="/" label="Back to Hub" />

				<div className="setlist-header hud">
					<span className="hud-corner-tr" />
					<span className="hud-corner-bl" />
					<span className="eyebrow">// MOD · SETLIST</span>
					<h1 className="hero-title flicker">
						<span className="glitch" data-text="SETLIST">
							SETLIST
						</span>
					</h1>
					<p>Completed songs in performance order. Drag to reorder.</p>
					<div className="setlist-filters">
						{FILTERS.map((f) => (
							<button
								key={f}
								type="button"
								className={`setlist-filter-btn${filter === f ? " setlist-filter-btn--active" : ""}`}
								onClick={() => setFilter(f)}
							>
								{f.toUpperCase()}
							</button>
						))}
					</div>
				</div>

				{!signedIn ? (
					<div className="setlist-state hud">
						<span>SIGN IN REQUIRED</span>
						<p>Sign in to view your setlist.</p>
					</div>
				) : loading ? (
					<div className="setlist-state hud">
						<span>LOADING</span>
					</div>
				) : orderedList.length === 0 ? (
					<div className="setlist-state hud">
						<span>NO COMPLETED SONGS</span>
						<p>
							Mark songs as completed in your Bass or Guitar catalog and
							they&apos;ll appear here.
						</p>
					</div>
				) : visibleList.length === 0 ? (
					<div className="setlist-state hud">
						<span>NO {filter.toUpperCase()} SONGS COMPLETED</span>
						<p>Switch to ALL to see your full setlist.</p>
					</div>
				) : (
					<div className="setlist-list-panel hud">
						{!isDragMode && (
							<div className="setlist-reorder-hint">
								SWITCH TO ALL TO REORDER
							</div>
						)}
						<DndContext
							sensors={sensors}
							collisionDetection={closestCenter}
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
						>
							<SortableContext
								items={orderedList.map((s) => s.id)}
								strategy={verticalListSortingStrategy}
							>
								{visibleList.map((song) => {
									const globalIndex = orderedList.findIndex(
										(s) => s.id === song.id
									);
									return (
										<SongItem
											key={song.id}
											song={song}
											globalIndex={globalIndex}
											isDragMode={isDragMode}
										/>
									);
								})}
							</SortableContext>
							<DragOverlay>
								{activeSong ? (
									<SongItem
										song={activeSong}
										globalIndex={activeGlobalIndex}
										isDragMode={false}
										isOverlay
									/>
								) : null}
							</DragOverlay>
						</DndContext>
					</div>
				)}
			</div>
		</Layout>
	);
}
