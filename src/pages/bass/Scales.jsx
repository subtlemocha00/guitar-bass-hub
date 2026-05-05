import BackLink from "../../components/BackLink";
import Layout from "../../components/Layout";

function Scales() {
	return (
		<Layout theme="bass">
			<div className="page">
				<BackLink to="/bass" label="Back to Bass" />
				<div className="empty-msg">
					BASS · SCALES · COMING SOON
				</div>
			</div>
		</Layout>
	);
}

export default Scales;
