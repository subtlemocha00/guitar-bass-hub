import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";

// Per-user preferences live on the user document (users/{uid}) under a
// `prefs` map, so they sync across devices when signed in.
function userDoc(uid) {
	return doc(db, "users", uid);
}

export function subscribeToPrefs(uid, callback) {
	try {
		return onSnapshot(
			userDoc(uid),
			(snap) => {
				const data = snap.exists() ? snap.data() : {};
				callback(data?.prefs ?? {});
			},
			(err) => console.warn("[userPrefs] subscribe error:", err)
		);
	} catch (err) {
		console.warn("[userPrefs] subscribe error:", err);
		return () => {};
	}
}

export async function setPref(uid, key, value) {
	try {
		await setDoc(userDoc(uid), { prefs: { [key]: value } }, { merge: true });
	} catch (err) {
		console.warn("[userPrefs] set error:", err);
	}
}
