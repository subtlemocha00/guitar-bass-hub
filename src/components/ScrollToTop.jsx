import { useLayoutEffect } from "react";
import { useLocation } from "react-router";

// Resets scroll to the top whenever the route changes, so navigating to a new
// page never inherits the previous page's scroll position.
function ScrollToTop() {
	const { pathname } = useLocation();

	useLayoutEffect(() => {
		window.scrollTo(0, 0);
	}, [pathname]);

	return null;
}

export default ScrollToTop;
