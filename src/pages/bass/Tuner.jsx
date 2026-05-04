import BackLink from "../../components/BackLink";
import Layout from "../../components/Layout";
import TunerFeature from "../../features/tuner/Tuner";

function Tuner() {
	return (
		<Layout>
			<BackLink to="/bass" label="Back to Bass" />
			<TunerFeature instrument="bass" />
		</Layout>
	);
}

export default Tuner;
