import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuthContext } from "../features/auth/useAuthContext";
import "./Layout.css";

function useClock() {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	return now;
}

function fmtClock(d) {
	return d.toTimeString().slice(0, 8);
}

function Layout({ children, theme }) {
	const { user, signIn, signOut } = useAuthContext();
	const { pathname } = useLocation();
	const now = useClock();

	const parts = pathname.split("/").filter(Boolean);
	const crumbs = [{ label: "HOME", path: "/" }];
	let acc = "";
	for (const p of parts) {
		acc += "/" + p;
		crumbs.push({ label: p.toUpperCase(), path: acc });
	}

	const themeClass = theme ? `shell theme-${theme}` : "shell";

	return (
		<>
			<div className="bg-stage"><div className="vignette" /></div>
			<div className={themeClass}>
				<header className="topbar">
					<Link to="/" className="topbar-brand">
						<span className="dot" />
						GUITAR + BASS // HUB
					</Link>
					<span className="topbar-bread">
						{crumbs.map((c, i) => (
							<span key={c.path}>
								{i > 0 && <span className="sep">/</span>}
								<Link
									to={c.path}
									style={{
										color: i === crumbs.length - 1 ? "var(--neon-cyan)" : "inherit",
										textDecoration: "none",
									}}
								>
									{c.label}
								</Link>
							</span>
						))}
					</span>
					<span className="topbar-spacer" />
					<span className="topbar-clock">
						<span className="blip" />
						<span>SESSION {fmtClock(now)}</span>
					</span>
					<div className="layout-auth">
						{user ? (
							<>
								<span className="auth-name">
									{user.displayName || user.email}
								</span>
								<button className="auth-btn" onClick={signOut}>
									SIGN OUT
								</button>
							</>
						) : (
							<button className="auth-btn" onClick={signIn}>
								SIGN IN
							</button>
						)}
					</div>
				</header>
				<main className="layout-main">{children}</main>
				<footer className="layout-footer">
					<span>// PRACTICE_HUB · NEON_BUILD</span>
					<span>STATUS · <span className="cyan">ALL_SYS_GO</span></span>
					<span>EOF</span>
				</footer>
			</div>
		</>
	);
}

export default Layout;
