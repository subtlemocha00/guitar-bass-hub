/**
 * Hand a URL to the browser. Resolves to false if the window was blocked.
 *
 * noopener keeps the opened page from reaching back through window.opener;
 * noreferrer also strips the Referer header.
 */
export async function open(url) {
	return !!window.open(url, "_blank", "noopener,noreferrer");
}
