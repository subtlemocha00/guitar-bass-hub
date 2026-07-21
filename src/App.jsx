import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthContext } from "./features/auth/useAuthContext";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

// Home is lazy like every other route. It reads the song catalog for its
// counters, so keeping it eager pulled the Firestore SDK — the single largest
// dependency in the app — onto the critical path for every route, including
// ones that never touch Firestore. Home now loads in parallel with Firestore
// instead of behind it.
const Home = lazy(() => import("./pages/Home"));
const Tuner = lazy(() => import("./pages/Tuner"));
const Metronome = lazy(() => import("./pages/Metronome"));
const ControlCenter = lazy(() => import("./pages/ControlCenter"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Bass = lazy(() => import("./pages/Bass"));
const BassSongs = lazy(() => import("./pages/bass/BassSongs"));
const BassBackingTracks = lazy(() => import("./pages/bass/BassBackingTracks"));
const BassScales = lazy(() => import("./pages/bass/Scales"));
const BassFretboard = lazy(() => import("./pages/bass/Fretboard"));
const Guitar = lazy(() => import("./pages/Guitar"));
const GuitarSongs = lazy(() => import("./pages/guitar/GuitarSongs"));
const GuitarBackingTracks = lazy(() => import("./pages/guitar/GuitarBackingTracks"));
const GuitarExercises = lazy(() => import("./pages/guitar/Exercises"));
const GuitarFretboard = lazy(() => import("./pages/guitar/Fretboard"));
const Setlist = lazy(() => import("./pages/Setlist"));

function RouteFallback() {
	return (
		<div
			style={{
				minHeight: "60vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "var(--font-mono)",
				fontSize: "0.78rem",
				letterSpacing: "0.28em",
				textTransform: "uppercase",
				color: "var(--text-mute)",
			}}
		>
			<span
				style={{
					display: "inline-flex",
					alignItems: "center",
					gap: "0.6rem",
				}}
			>
				<span
					style={{
						width: 8,
						height: 8,
						borderRadius: "50%",
						background: "var(--neon-cyan)",
						boxShadow: "0 0 10px var(--neon-cyan-glow)",
					}}
				/>
				LOADING MODULE
			</span>
		</div>
	);
}

function App() {
	const { loading } = useAuthContext();

	if (loading) return null;

	return (
		<HashRouter>
			<ScrollToTop />
			<ErrorBoundary>
				<Suspense fallback={<RouteFallback />}>
					<Routes>
						<Route path="/" element={<Home />} />

						<Route path="/setlist" element={<Setlist />} />
						<Route path="/tuner" element={<Tuner />} />
						<Route path="/metronome" element={<Metronome />} />
						<Route path="/control-center" element={<ControlCenter />} />

						<Route path="/blog" element={<Blog />} />
						<Route path="/blog/:id" element={<BlogPost />} />

						<Route path="/bass" element={<Bass />} />
						<Route path="/bass/songs" element={<BassSongs />} />
						<Route path="/bass/backing-tracks" element={<BassBackingTracks />} />
						<Route path="/bass/tuner" element={<Navigate to="/tuner" replace />} />
						<Route path="/bass/scales" element={<BassScales />} />
						<Route path="/bass/fretboard" element={<BassFretboard />} />
						<Route path="/bass/metronome" element={<Navigate to="/metronome" replace />} />

						<Route path="/guitar" element={<Guitar />} />
						<Route path="/guitar/songs" element={<GuitarSongs />} />
						<Route path="/guitar/backing-tracks" element={<GuitarBackingTracks />} />
						<Route path="/guitar/tuner" element={<Navigate to="/tuner" replace />} />
						<Route path="/guitar/exercises" element={<GuitarExercises />} />
						<Route path="/guitar/fretboard" element={<GuitarFretboard />} />
						<Route path="/guitar/metronome" element={<Navigate to="/metronome" replace />} />
					</Routes>
				</Suspense>
			</ErrorBoundary>
		</HashRouter>
	);
}

export default App;
