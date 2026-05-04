import { Link } from "react-router-dom";
import "./Layout.css";

function Layout({ children, theme }) {
	const className = theme ? `layout theme-${theme}` : "layout";
	return (
		<div className={className}>
			<header className="layout-header">
				<Link to="/" className="layout-brand">
					Home
				</Link>
			</header>
			<main className="layout-main">{children}</main>
		</div>
	);
}

export default Layout;
