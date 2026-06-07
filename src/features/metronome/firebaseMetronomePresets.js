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

const presetCollection = createUserCollection({
	name: "metronomePresets",
	allowedFields: ALLOWED_FIELDS,
	mapDoc: (d) => {
		const data = d.data();
		return {
			id: d.id,
			name: data.name ?? "Untitled",
			bpm: typeof data.bpm === "number" ? data.bpm : 120,
			beats: typeof data.beats === "number" ? data.beats : 4,
			subdivision: data.subdivision ?? "quarter",
			swing: data.swing ?? "straight",
			accentPattern: Array.isArray(data.accentPattern)
				? data.accentPattern.map(Boolean)
				: [true, false, false, false],
			accentSound: data.accentSound ?? "click",
			beatSound: data.beatSound ?? "hi-hat",
			subSound: data.subSound ?? "click",
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

export function updateMetronomePreset(uid, id, settings) {
	return presetCollection.update(uid, id, {
		...settings,
		updatedAt: serverTimestamp(),
	});
}

export const subscribeToMetronomePresets = presetCollection.subscribe;
