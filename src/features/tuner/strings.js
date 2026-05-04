export const BASS_STRINGS = [
	{ name: "E1", letter: "E", freq: 41.2 },
	{ name: "A1", letter: "A", freq: 55.0 },
	{ name: "D2", letter: "D", freq: 73.42 },
	{ name: "G2", letter: "G", freq: 98.0 },
];

export const GUITAR_STRINGS = [
	{ name: "E2", letter: "E", freq: 82.41 },
	{ name: "A2", letter: "A", freq: 110.0 },
	{ name: "D3", letter: "D", freq: 146.83 },
	{ name: "G3", letter: "G", freq: 196.0 },
	{ name: "B3", letter: "B", freq: 246.94 },
	{ name: "E4", letter: "E", freq: 329.63 },
];

export const STRINGS_BY_INSTRUMENT = {
	bass: BASS_STRINGS,
	guitar: GUITAR_STRINGS,
};
