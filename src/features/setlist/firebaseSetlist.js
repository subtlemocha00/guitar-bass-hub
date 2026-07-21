import { subscribeToPrefs, setPref } from "../../firebase/userPrefs";

export function subscribeToSetlistOrder(uid, callback) {
	return subscribeToPrefs(uid, (prefs) => {
		const order = prefs?.setlistOrder;
		callback(Array.isArray(order) ? order : null);
	});
}

export async function saveSetlistOrder(uid, songIds) {
	return setPref(uid, "setlistOrder", songIds);
}
