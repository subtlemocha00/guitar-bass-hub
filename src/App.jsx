import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./features/auth/useAuth";
import Home from "./pages/Home";
import Tuner from "./pages/Tuner";
import Metronome from "./pages/Metronome";
import Bass from "./pages/Bass";
import BassSongs from "./pages/bass/BassSongs";
import BassScales from "./pages/bass/Scales";
import BassFretboard from "./pages/bass/Fretboard";
import Guitar from "./pages/Guitar";
import GuitarSongs from "./pages/guitar/GuitarSongs";
import GuitarExercises from "./pages/guitar/Exercises";
import GuitarFretboard from "./pages/guitar/Fretboard";
import "./App.css";

function App() {
	const { loading } = useAuth();

	if (loading) return null;

	return (
		<HashRouter>
			<Routes>
				<Route path="/" element={<Home />} />

				<Route path="/tuner" element={<Tuner />} />
				<Route path="/metronome" element={<Metronome />} />

				<Route path="/bass" element={<Bass />} />
				<Route path="/bass/songs" element={<BassSongs />} />
				<Route path="/bass/tuner" element={<Navigate to="/tuner" replace />} />
				<Route path="/bass/scales" element={<BassScales />} />
				<Route path="/bass/fretboard" element={<BassFretboard />} />
				<Route path="/bass/metronome" element={<Navigate to="/metronome" replace />} />

				<Route path="/guitar" element={<Guitar />} />
				<Route path="/guitar/songs" element={<GuitarSongs />} />
				<Route path="/guitar/tuner" element={<Navigate to="/tuner" replace />} />
				<Route path="/guitar/exercises" element={<GuitarExercises />} />
				<Route path="/guitar/fretboard" element={<GuitarFretboard />} />
				<Route path="/guitar/metronome" element={<Navigate to="/metronome" replace />} />
			</Routes>
		</HashRouter>
	);
}

export default App;
