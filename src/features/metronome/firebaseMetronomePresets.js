import { serverTimestamp } from "firebase/firestore";
import { createUserCollection } from "../../firebase/userCollection";

const ALLOWED_FIELDS = [
	"name",
	"bpm",
	"beats",
	"subdivision",
	"swing",
	"accentPattern",
	"accentSound",
	"accentSound2",
	"beatSound",
	"subSound",
	"gapEnabled",
	"gapAudibleBars",
	"gapSilentBars",
	"randomMuteLevel",
	"rampEnabled",
	"startBpm",
	"endBpm",
	"rampDuration",
	"updatedAt",
];

function tsToMs(ts) {
	if (!ts) return null;
	if (typeof ts.toMillis === "function") return ts.toMillis();
	if (typeof ts === "number") return ts;
	return null;
}

// Normalize accentPattern to an array of 0/1/2 values.
function normalizeAccentPattern(v, beats) {
	if (
		Array.isArray(v) &&
		v.length === beats &&
		v.every((x) => x === 0 || x === 1 || x === 2)
	) {
		return v.slice();
	}
	const arr = new Array(beats).fill(0);
	arr[0] = 1;
	return arr;
}

const presetCollection = createUserCollection({
	name: "metronomePresets",
	allowedFields: ALLOWED_FIELDS,
	mapDoc: (d) => {
		const data = d.data();
		const beats = typeof data.beats === "number" ? data.beats : 4;
		return {
			id: d.id,
			name: data.name ?? "Untitled",
			bpm: typeof data.bpm === "number" ? data.bpm : 120,
			beats,
			subdivision: data.subdivision ?? "quarter",
			swing: data.swing ?? "straight",
			accentPattern: normalizeAccentPattern(data.accentPattern, beats),
			accentSound: data.accentSound ?? "hi_hat_1",
			accentSound2: data.accentSound2 ?? "cowbell",
			beatSound: data.beatSound ?? "hi_hat_1",
			subSound: data.subSound ?? "hi_hat_1",
			gapEnabled: !!data.gapEnabled,
			gapAudibleBars: typeof data.gapAudibleBars === "number" ? data.gapAudibleBars : 3,
			gapSilentBars: typeof data.gapSilentBars === "number" ? data.gapSilentBars : 1,
			randomMuteLevel: data.randomMuteLevel ?? "off",
			rampEnabled: !!data.rampEnabled,
			startBpm: typeof data.startBpm === "number" ? data.startBpm : 60,
			endBpm: typeof data.endBpm === "number" ? data.endBpm : 120,
			rampDuration: typeof data.rampDuration === "number" ? data.rampDuration : 120,
			createdAt: tsToMs(data.createdAt),
			updatedAt: tsToMs(data.updatedAt),
		};
	},
});

export function addMetronomePreset(uid, settings) {
	return presetCollection.add(uid, {
		...settings,
		updatedAt: serverTimestamp(),
	});
}

export function removeMetronomePreset(uid, id) {
	return presetCollection.remove(uid, id);
}

export const subscribeToMetronomePresets = presetCollection.subscribe;
