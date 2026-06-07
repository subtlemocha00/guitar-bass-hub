import { Component } from "react";

/**
 * App-level error boundary. Catches render-time errors anywhere below it —
 * including failed lazy-route chunk loads after a redeploy — and shows a small
 * recovery panel instead of a blank white screen.
 */
class ErrorBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error, info) {
		// Surface for debugging; no remote logging dependency is pulled in.
		console.error("[ErrorBoundary] caught render error:", error, info);
	}

	render() {
		if (!this.state.hasError) return this.props.children;

		return (
			<div
				role="alert"
				style={{
					minHeight: "70vh",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: "1.2rem",
					padding: "1.5rem",
					textAlign: "center",
					fontFamily: "var(--font-mono)",
					color: "var(--text)",
				}}
			>
				<div
					style={{
						fontSize: "0.78rem",
						letterSpacing: "0.28em",
						textTransform: "uppercase",
						color: "var(--neon-magenta)",
					}}
				>
					// MODULE CRASHED
				</div>
				<p style={{ maxWidth: "34ch", lineHeight: 1.5, color: "var(--text-mute)" }}>
					Something went wrong loading this view. Reloading usually fixes it —
					often it just means a new version shipped.
				</p>
				<button
					type="button"
					className="btn btn--solid"
					onClick={() => window.location.reload()}
				>
					RELOAD
				</button>
			</div>
		);
	}
}

export default ErrorBoundary;
