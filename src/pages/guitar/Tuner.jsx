import BackLink from "../../components/BackLink";
import Layout from "../../components/Layout";
import TunerFeature from "../../features/tuner/Tuner";

function Tuner() {
	return (
		<Layout theme="guitar">
			<BackLink to="/guitar" label="Back to Guitar" />
			<TunerFeature instrument="guitar" />
		</Layout>
	);
}

export default Tuner;
