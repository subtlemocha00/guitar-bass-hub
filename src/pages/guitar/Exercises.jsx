import BackLink from "../../components/BackLink";
import Layout from "../../components/Layout";

function Exercises() {
	return (
		<Layout theme="guitar">
			<div className="page">
				<BackLink to="/guitar" label="Back to Guitar" />
				<div className="empty-msg">
					GUITAR · EXERCISES · COMING SOON
				</div>
			</div>
		</Layout>
	);
}

export default Exercises;
