import { Link } from "react-router";
import "./BackLink.css";

function BackLink({ to, label = "Back" }) {
	return (
		<Link to={to} className="back-link">
			<span aria-hidden="true">←</span> {label.toUpperCase()}
		</Link>
	);
}

export default BackLink;
