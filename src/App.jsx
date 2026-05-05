import { HashRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./features/auth/useAuth";
import Home from "./pages/Home";
import Bass from "./pages/Bass";
import BassSongs from "./pages/bass/BassSongs";
import BassTuner from "./pages/bass/Tuner";
import BassScales from "./pages/bass/Scales";
import BassFretboard from "./pages/bass/Fretboard";
import BassMetronome from "./pages/bass/Metronome";
import Guitar from "./pages/Guitar";
import GuitarSongs from "./pages/guitar/GuitarSongs";
import GuitarTuner from "./pages/guitar/Tuner";
import GuitarExercises from "./pages/guitar/Exercises";
import GuitarFretboard from "./pages/guitar/Fretboard";
import GuitarMetronome from "./pages/guitar/Metronome";
import "./App.css";

function App() {
	const { loading } = useAuth();

	if (loading) return null;

	return (
		<HashRouter>
			<Routes>
				<Route path="/" element={<Home />} />

				<Route path="/bass" element={<Bass />} />
				<Route path="/bass/songs" element={<BassSongs />} />
				<Route path="/bass/tuner" element={<BassTuner />} />
				<Route path="/bass/scales" element={<BassScales />} />
				<Route path="/bass/fretboard" element={<BassFretboard />} />
				<Route path="/bass/metronome" element={<BassMetronome />} />

				<Route path="/guitar" element={<Guitar />} />
				<Route path="/guitar/songs" element={<GuitarSongs />} />
				<Route path="/guitar/tuner" element={<GuitarTuner />} />
				<Route path="/guitar/exercises" element={<GuitarExercises />} />
				<Route path="/guitar/fretboard" element={<GuitarFretboard />} />
				<Route path="/guitar/metronome" element={<GuitarMetronome />} />
			</Routes>
		</HashRouter>
	);
}

export default App;
