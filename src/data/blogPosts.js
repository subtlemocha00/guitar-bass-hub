import practiceRoutineImg from "../assets/blog/practice-routine.svg";
import toneShapingImg from "../assets/blog/tone-shaping.svg";

const blogPosts = [
	{
		id: "build-a-practice-routine",
		title: "Build a Practice Routine That Sticks",
		author: "Kev",
		dateCreated: "2026-04-22",
		lastEdited: "2026-05-02",
		excerpt:
			"Three short blocks beat one long session. Here is the structure I land on every week and why it works on the days motivation does not show up.",
		image: practiceRoutineImg,
		content: [
			{
				type: "paragraph",
				text: "Most of the players I know who actually improve are not the ones with the longest practice sessions. They are the ones who show up every day, even if it is only for fifteen minutes. The trick is to make the floor low enough that you cannot talk yourself out of it.",
			},
			{ type: "heading", text: "Why short blocks beat marathons" },
			{
				type: "paragraph",
				text: "Long practice sessions feel productive but most of the value lands in the first thirty to forty minutes. After that, your hands fatigue, your ear gets dull, and you mostly reinforce sloppy habits. Three focused blocks across the day will move you further than one long grind.",
			},
			{
				type: "paragraph",
				text: "The other reason: short sessions remove the activation cost. Fifteen minutes is too small a commitment to dread, and once you are warmed up you usually keep going.",
			},
			{ type: "heading", text: "The 20 / 20 / 20 split" },
			{
				type: "paragraph",
				text: "Twenty minutes of technique with the metronome. Twenty minutes of repertoire — usually a song from the catalog. Twenty minutes of free play, jamming over a backing track or just exploring the fretboard. That is it.",
			},
			{
				type: "paragraph",
				text: "Technique first because it is the part that tries hardest to get cut. Repertoire next because it gives you something to play for someone. Free play last because it locks the night down on a fun note and keeps you wanting to come back tomorrow.",
			},
			{ type: "heading", text: "Track it or lose it" },
			{
				type: "paragraph",
				text: "Use the songs catalog or a paper notebook — whatever you will actually open. Mark planned, learning, and completed. The tracking is not about discipline. It is about being able to see your week and notice when a song has been stuck for too long.",
			},
		],
	},
	{
		id: "tone-shaping-basics",
		title: "Tone Shaping Without Spending a Dime",
		author: "Kev",
		dateCreated: "2026-05-04",
		excerpt:
			"EQ, gain staging, and pick technique go further than any pedalboard upgrade. The free fixes most players never bother to try.",
		image: toneShapingImg,
		content: [
			{
				type: "paragraph",
				text: "Tone is mostly in the hands. That sounds like a cliche but it lines up with reality: the same rig sounds different in different hands, and the same hands sound similar across different rigs. Before you spend money on gear, spend a week on the three things below.",
			},
			{ type: "heading", text: "Gain staging" },
			{
				type: "paragraph",
				text: "Most muddy tones come from too much gain on a pickup that already wants to break up. Roll the gain back until the note speaks cleanly when you pick softly, then let your right hand do the dynamics. Compression and overdrive should be the seasoning, not the base of the dish.",
			},
			{ type: "heading", text: "EQ as a sculpting tool" },
			{
				type: "paragraph",
				text: "Cut before you boost. If your tone is harsh, pull a little 2k to 4k. If it is woolly, pull 250Hz, not boost the highs. Boosts add noise; cuts almost never do. Sweep one band at a time and listen for the frequency that is fighting you.",
			},
			{ type: "heading", text: "Pick attack and contact point" },
			{
				type: "paragraph",
				text: "Where you pick changes everything. Closer to the bridge: tighter, more articulate, brighter. Closer to the neck: rounder, warmer, slower attack. Practice the same lick at three different contact points and you will hear three different guitars without changing a knob.",
			},
		],
	},
];

export default blogPosts;

export function getPostById(id) {
	return blogPosts.find((p) => p.id === id);
}
