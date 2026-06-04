// Sample data for development / signed-out preview.
// These are surfaced read-only when no user is authenticated. Once a user
// signs in, only their own backing tracks (from Firestore) are shown.

const sampleBackingTracks = [
	{
		id: "sample-bass-funk-1",
		instrument: "bass",
		title: "Funk Groove in E Dorian",
		artist: "Backing Track Channel",
		youtubeUrl: "https://www.youtube.com/watch?v=oRRr4PLEEX0",
		genre: "Funk",
		bpm: 105,
		trackKey: "Em",
		notes: "Slap-friendly. Tight 16th-note pocket — work the rests.",
	},
	{
		id: "sample-bass-blues-1",
		instrument: "bass",
		title: "Slow 12-Bar Blues",
		artist: "Quist",
		youtubeUrl: "https://www.youtube.com/watch?v=YsNQ0fUbVNk",
		genre: "Blues",
		bpm: 72,
		trackKey: "A",
		notes: "Classic walking-bass shed. Outline the changes, then phrase.",
	},
	{
		id: "sample-guitar-rock-1",
		instrument: "guitar",
		title: "Rock Jam in A Minor",
		artist: "Elevated Jam Tracks",
		youtubeUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
		genre: "Rock",
		bpm: 120,
		trackKey: "Am",
		notes: "Pentatonic + Aeolian. Push the bends past pitch on the b3.",
	},
	{
		id: "sample-guitar-jazz-1",
		instrument: "guitar",
		title: "Jazz Comp Loop — ii V I",
		artist: "Daniel Jam Tracks",
		youtubeUrl: "https://www.youtube.com/watch?v=lTRiuFIWV54",
		genre: "Jazz",
		bpm: 140,
		trackKey: "Bb",
		notes: "Drop-2 voicings. Chase the guide tones across the changes.",
	},
	{
		id: "sample-guitar-metal-1",
		instrument: "guitar",
		title: "Metal Rhythm Track in Drop D",
		artist: "Riffotronic",
		youtubeUrl: "https://www.youtube.com/watch?v=hG4dfHs9pfk",
		genre: "Metal",
		bpm: 160,
		trackKey: "D",
		notes: "Palm-mute discipline. Lock the picking hand to the kick.",
	},
];

export default sampleBackingTracks;
