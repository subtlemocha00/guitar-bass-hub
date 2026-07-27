import { Link, useLocation } from "react-router";
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

// Inline, currentColor line icons so the tool buttons read at a glance when they
// collapse to icon-only on narrow screens. Kept in-file (not an icon library) to
// match the app's existing hand-rolled glyph aesthetic. aria-hidden because the
// accessible name comes from the link's aria-label, which is present in both the
// icon+text and icon-only states.
function TunerIcon() {
	return (
		<svg
			className="topbar-tool-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{/* tuning fork: two prongs, a U-bend, and a stem */}
			<path d="M8 3 L8 10 A4 4 0 0 0 16 10 L16 3" />
			<path d="M12 14 L12 21" />
		</svg>
	);
}

function MetronomeIcon() {
	return (
		<svg
			className="topbar-tool-icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			{/* trapezoid body with a pendulum rod */}
			<path d="M9 3 L15 3 L19 21 L5 21 Z" />
			<path d="M12 20 L15 8" />
		</svg>
	);
}

function Layout({ children, theme }) {
	const { user, signIn, signOut } = useAuthContext();
	const { pathname } = useLocation();
	const now = useClock();

	// The tool buttons are global EXCEPT on their own page — there is no point
	// offering "Tuner" while already on the tuner. /bass/tuner and /guitar/tuner
	// redirect to /tuner (see App.jsx), so an exact match is sufficient.
	const onTuner = pathname === "/tuner";
	const onMetronome = pathname === "/metronome";

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
						{/* Full identity on wide screens; a compressed wordmark on narrow
						    ones, so the brand yields the width the tool buttons need
						    without wrapping. This is a layout affordance only — the
						    application name is "Guitar + Bass // Hub" everywhere it is
						    declared (title, manifest, Android label, Tauri window). */}
						<span className="topbar-brand-full">GUITAR + BASS // HUB</span>
						<span className="topbar-brand-short">GB//HUB</span>
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
					{/* Permanent tool controls — same place on every page for muscle
					    memory. Each is hidden on its own page. aria-label carries the
					    accessible name so the button is still named when the text label
					    collapses to icon-only on narrow screens. */}
					<nav className="topbar-tools" aria-label="Tools">
						{!onTuner && (
							<Link to="/tuner" className="topbar-tool" aria-label="Tuner">
								<TunerIcon />
								<span className="topbar-tool-text">Tuner</span>
							</Link>
						)}
						{!onMetronome && (
							<Link to="/metronome" className="topbar-tool" aria-label="Metronome">
								<MetronomeIcon />
								<span className="topbar-tool-text">Metronome</span>
							</Link>
						)}
					</nav>
					<div className="layout-auth">
						{/* Username removed deliberately: it carried no navigational value
						    and its width is reclaimed for the tool controls above.
						    Authentication itself is unchanged. */}
						{user ? (
							<button className="auth-btn" onClick={signOut}>
								SIGN OUT
							</button>
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
