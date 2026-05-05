import { HashRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "./features/auth/useAuth";
import Home from "./pages/Home";
import Bass from "./pages/Bass";
import BassSongs from "./pages/bass/BassSongs";
import BassTuner from "./pages/bass/Tuner";
import BassScales from "./pages/bass/Scales";
import Guitar from "./pages/Guitar";
import GuitarSongs from "./pages/guitar/GuitarSongs";
import GuitarTuner from "./pages/guitar/Tuner";
import GuitarExercises from "./pages/guitar/Exercises";
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

				<Route path="/guitar" element={<Guitar />} />
				<Route path="/guitar/songs" element={<GuitarSongs />} />
				<Route path="/guitar/tuner" element={<GuitarTuner />} />
				<Route path="/guitar/exercises" element={<GuitarExercises />} />
			</Routes>
		</HashRouter>
	);
}

export default App;
