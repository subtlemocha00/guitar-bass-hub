import { createUserCollection } from "../../firebase/userCollection";

const songCollection = createUserCollection({
	name: "songs",
	allowedFields: ["title", "artist", "tabUrl", "youtubeUrl", "status", "note"],
	mapDoc: (d) => {
		const data = d.data();
		return {
			id: d.id,
			title: data.title ?? "",
			artist: data.artist ?? "",
			tabUrl: data.tabUrl ?? "",
			youtubeUrl: data.youtubeUrl ?? null,
			instrument: data.instrument ?? null,
			status: data.status ?? "planned",
			note: data.note ?? "",
			isUserCreated: !!data.createdAt,
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
