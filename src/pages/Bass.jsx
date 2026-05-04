import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import "./Bass.css";

const features = [
	{
		to: "/bass/songs",
		title: "Song List",
		description: "Track songs and update practice status.",
	},
	{
		to: "/bass/tuner",
		title: "Tuner",
		description: "Tune your bass.",
	},
	{
		to: "/bass/scales",
		title: "Scales",
		description: "Browse scales and patterns.",
	},
];

function Bass() {
	return (
		<Layout>
			<section className="bass-page">
				<header className="bass-header">
					<h1 className="bass-title">Bass</h1>
					<p className="bass-subtitle">Pick a tool to practice with.</p>
				</header>

				<div className="bass-cards">
					{features.map((f) => (
						<Link key={f.to} to={f.to} className="bass-card">
							<h2>{f.title}</h2>
							<p>{f.description}</p>
						</Link>
					))}
				</div>
			</section>
		</Layout>
	);
}

export default Bass;
