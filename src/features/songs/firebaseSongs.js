import { createUserCollection } from "../../firebase/userCollection";

const songCollection = createUserCollection({
	name: "songs",
	allowedFields: ["title", "artist", "tabUrl", "youtubeUrl", "status", "note"],
	mapDoc: (d) => {
		const data = d.data();
		const raw = data.createdAt;
		let createdAt = null;
		if (raw && typeof raw.toMillis === "function") {
			createdAt = raw.toMillis();
		} else if (typeof raw === "number") {
			createdAt = raw;
		}
		return {
			id: d.id,
			title: data.title ?? "",
			artist: data.artist ?? "",
			tabUrl: data.tabUrl ?? "",
			youtubeUrl: data.youtubeUrl ?? null,
			instrument: data.instrument ?? null,
			status: data.status ?? "planned",
			note: data.note ?? "",
			createdAt,
			isUserCreated: createdAt != null,
		};
	},
});

export function addSong(uid, songData) {
	return songCollection.add(uid, {
		title: songData.title,
		artist: songData.artist,
		tabUrl: songData.tabUrl,
		youtubeUrl: songData.youtubeUrl ?? null,
		instrument: songData.instrument ?? null,
		status: "planned",
		note: "",
	});
}

export const removeSong = songCollection.remove;
export const updateSong = songCollection.update;
export const subscribeToSongs = songCollection.subscribe;
