import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/useAuth";
import "./Layout.css";

function Layout({ children, theme }) {
	const { user, signIn, signOut } = useAuth();
	const className = theme ? `layout theme-${theme}` : "layout";
	return (
		<div className={className}>
			<header className="layout-header">
				<Link to="/" className="layout-brand">
					Home
				</Link>
				<div className="layout-auth">
					{user ? (
						<>
							<span className="auth-name">
								{user.displayName || user.email}
							</span>
							<button className="auth-btn" onClick={signOut}>
								Sign Out
							</button>
						</>
					) : (
						<button className="auth-btn" onClick={signIn}>
							Sign In with Google
						</button>
					)}
				</div>
			</header>
			<main className="layout-main">{children}</main>
		</div>
	);
}

export default Layout;
