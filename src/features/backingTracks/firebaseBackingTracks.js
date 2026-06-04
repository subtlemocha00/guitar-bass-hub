import { createUserCollection } from "../../firebase/userCollection";

const trackCollection = createUserCollection({
	name: "backingTracks",
	allowedFields: [
		"title",
		"artist",
		"youtubeUrl",
		"genre",
		"bpm",
		"trackKey",
		"notes",
	],
	mapDoc: (d) => {
		const data = d.data();
		return {
			id: d.id,
			title: data.title ?? "",
			artist: data.artist ?? "",
			youtubeUrl: data.youtubeUrl ?? "",
			genre: data.genre ?? "",
			bpm: typeof data.bpm === "number" ? data.bpm : null,
			trackKey: data.trackKey ?? "",
			notes: data.notes ?? "",
			instrument: data.instrument ?? null,
			isUserCreated: !!data.createdAt,
		};
	},
});

export function addBackingTrack(uid, data) {
	return trackCollection.add(uid, {
		title: data.title,
		artist: data.artist,
		youtubeUrl: data.youtubeUrl,
		genre: data.genre || "",
		bpm: typeof data.bpm === "number" ? data.bpm : null,
		trackKey: data.trackKey || "",
		notes: data.notes || "",
		instrument: data.instrument ?? null,
	});
}

export const removeBackingTrack = trackCollection.remove;
export const updateBackingTrack = trackCollection.update;
export const subscribeToBackingTracks = trackCollection.subscribe;
