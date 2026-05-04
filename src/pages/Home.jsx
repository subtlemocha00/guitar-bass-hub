import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import "./Home.css";

function Home() {
	return (
		<Layout>
			<section className="home">
				<h1 className="home-title">Practice Hub</h1>
				<p className="home-subtitle">
					Your personal space for organizing guitar and bass practice.
				</p>

				<div className="home-cards">
					<Link to="/bass" className="home-card">
						<h2>Bass</h2>
						<p>Scales, grooves, and bass-focused exercises.</p>
					</Link>

					<Link to="/guitar" className="home-card theme-guitar">
						<h2>Guitar</h2>
						<p>Chords, riffs, and guitar-focused exercises.</p>
					</Link>
				</div>
			</section>
		</Layout>
	);
}

export default Home;
