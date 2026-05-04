import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import "./Guitar.css";

const features = [
	{
		to: "/guitar/songs",
		title: "Song List",
		description: "Track songs and update practice status.",
	},
	{
		to: "/guitar/tuner",
		title: "Tuner",
		description: "Tune your guitar.",
	},
	{
		to: "/guitar/exercises",
		title: "Exercises",
		description: "Drills, scales, and warm-ups.",
	},
];

function Guitar() {
	return (
		<Layout theme="guitar">
			<section className="guitar-page">
				<header className="guitar-header">
					<h1 className="guitar-title">Guitar</h1>
					<p className="guitar-subtitle">Pick a tool to practice with.</p>
				</header>

				<div className="guitar-cards">
					{features.map((f) => (
						<Link key={f.to} to={f.to} className="guitar-card">
							<h2>{f.title}</h2>
							<p>{f.description}</p>
						</Link>
					))}
				</div>
			</section>
		</Layout>
	);
}

export default Guitar;
