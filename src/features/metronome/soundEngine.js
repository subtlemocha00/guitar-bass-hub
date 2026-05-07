export const SOUND_OPTIONS = [
	"click",
	"beep",
	"hi-hat",
	"snare",
	"clap",
	"woodblock",
	"kick",
	"tom",
	"floor-tom",
	"cymbal",
	"cowbell",
	"claves",
	"rimshot",
	"shaker",
	"snap",
	"tambourine"
];

let cachedNoiseBuffer = null;

function getNoiseBuffer(ctx) {
	if (
		cachedNoiseBuffer &&
		cachedNoiseBuffer.sampleRate === ctx.sampleRate
	) {
		return cachedNoiseBuffer;
	}
	const buffer = ctx.createBuffer(
		1,
		Math.floor(ctx.sampleRate * 0.3),
		ctx.sampleRate
	);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < data.length; i++) {
		data[i] = Math.random() * 2 - 1;
	}
	cachedNoiseBuffer = buffer;
	return buffer;
}

// ---------------------------------------------------------
// Sound Generators
// ---------------------------------------------------------

function playClick(ctx, time, gain, accent) {
	// Modern DAW-style click: Sine wave with a rapid pitch drop (transient tick)
	const osc = ctx.createOscillator();
	osc.type = "sine";
	const startFreq = accent ? 2000 : 1200;
	const endFreq = accent ? 1000 : 600;

	osc.frequency.setValueAtTime(startFreq, time);
	osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.01);

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.001);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.05);
}

function playBeep(ctx, time, gain, accent) {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.value = accent ? 1200 : 800;

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.005);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.12);
}

function playHihat(ctx, time, gain, accent) {
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);

	const filter = ctx.createBiquadFilter();
	filter.type = "highpass";
	filter.frequency.value = accent ? 8000 : 9000;

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.002);
	env.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.04 : 0.02));

	noise.connect(filter).connect(env).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.05);
}

function playSnare(ctx, time, gain) {
	// Snare wires (Noise)
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const noiseFilter = ctx.createBiquadFilter();
	noiseFilter.type = "highpass";
	noiseFilter.frequency.value = 2000;
	const noiseEnv = ctx.createGain();
	noiseEnv.gain.setValueAtTime(0.0001, time);
	noiseEnv.gain.exponentialRampToValueAtTime(gain * 0.8, time + 0.002);
	noiseEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
	noise.connect(noiseFilter).connect(noiseEnv).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.2);

	// Drum Body (Oscillator with pitch punch)
	const osc = ctx.createOscillator();
	osc.type = "triangle";
	osc.frequency.setValueAtTime(300, time);
	osc.frequency.exponentialRampToValueAtTime(150, time + 0.05);
	const oscEnv = ctx.createGain();
	oscEnv.gain.setValueAtTime(0.0001, time);
	oscEnv.gain.exponentialRampToValueAtTime(gain * 0.9, time + 0.002);
	oscEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
	osc.connect(oscEnv).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.1);
}

function playClap(ctx, time, gain) {
	const offsets = [0, 0.01, 0.02];
	for (let i = 0; i < offsets.length; i++) {
		const startT = time + offsets[i];
		const noise = ctx.createBufferSource();
		noise.buffer = getNoiseBuffer(ctx);

		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = 1200;
		filter.Q.value = 1.2;

		const env = ctx.createGain();
		const peak = i === offsets.length - 1 ? gain * 1.2 : gain * 0.5;
		env.gain.setValueAtTime(0.0001, startT);
		env.gain.exponentialRampToValueAtTime(peak, startT + 0.002);
		env.gain.exponentialRampToValueAtTime(0.0001, startT + (i === 2 ? 0.15 : 0.03));

		noise.connect(filter).connect(env).connect(ctx.destination);
		noise.start(startT);
		noise.stop(startT + 0.2);
	}
}

function playWoodblock(ctx, time, gain, accent) {
	const freq = accent ? 1000 : 750;

	// Two slighty detuned oscillators for a woody, hollow timbre
	const osc1 = ctx.createOscillator();
	osc1.type = "sine";
	osc1.frequency.setValueAtTime(freq * 1.5, time); // Pitch bend attack
	osc1.frequency.exponentialRampToValueAtTime(freq, time + 0.02);

	const osc2 = ctx.createOscillator();
	osc2.type = "triangle";
	osc2.frequency.setValueAtTime(freq * 2.5, time);
	osc2.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.02);

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.002);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

	osc1.connect(env);
	osc2.connect(env);
	env.connect(ctx.destination);

	osc1.start(time);
	osc2.start(time);
	osc1.stop(time + 0.1);
	osc2.stop(time + 0.1);
}

function playKick(ctx, time, gain) {
	// Added a sharp "click" attack for modern punch
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(150, time);
	osc.frequency.exponentialRampToValueAtTime(40, time + 0.05);

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain * 1.5, time + 0.002); // Faster attack
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.25);
}

function playTom(ctx, time, gain, accent) {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	const startFreq = accent ? 300 : 200;
	const endFreq = accent ? 100 : 70;

	osc.frequency.setValueAtTime(startFreq, time);
	osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.1);

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain * 1.3, time + 0.005);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);

	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.3);
}

function playFloorTom(ctx, time, gain) {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(150, time);
	osc.frequency.exponentialRampToValueAtTime(50, time + 0.1);

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain * 1.5, time + 0.005);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.4);
}

function playCymbal(ctx, time, gain) {
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = "highpass";
	filter.frequency.value = 6000;

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain * 0.8, time + 0.01);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.4);

	noise.connect(filter).connect(env).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.45);

	// Inharmonic metallic tones
	const osc1 = ctx.createOscillator();
	osc1.type = "square";
	osc1.frequency.value = 2500;
	const oscEnv = ctx.createGain();
	oscEnv.gain.setValueAtTime(0.0001, time);
	oscEnv.gain.exponentialRampToValueAtTime(gain * 0.15, time + 0.005);
	oscEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

	osc1.connect(oscEnv).connect(ctx.destination);
	osc1.start(time);
	osc1.stop(time + 0.25);
}

function playCowbell(ctx, time, gain, accent) {
	// Standard 808 cowbell requires a bandpass filter to fix harshness
	const osc1 = ctx.createOscillator();
	osc1.type = "square";
	osc1.frequency.value = accent ? 850 : 800;
	const osc2 = ctx.createOscillator();
	osc2.type = "square";
	osc2.frequency.value = accent ? 580 : 540;

	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = 800;
	filter.Q.value = 1.5;

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain * 1.2, time + 0.005);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

	osc1.connect(filter);
	osc2.connect(filter);
	filter.connect(env);
	env.connect(ctx.destination);

	osc1.start(time);
	osc2.start(time);
	osc1.stop(time + 0.25);
	osc2.stop(time + 0.25);
}

function playClaves(ctx, time, gain, accent) {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	const freq = accent ? 2800 : 2200;
	osc.frequency.setValueAtTime(freq * 1.5, time); // Fast pitch drop creates strike transient
	osc.frequency.exponentialRampToValueAtTime(freq, time + 0.01);

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.002);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.08);
}

// ---------------------------------------------------------
// New Professional Sounds
// ---------------------------------------------------------

function playRimshot(ctx, time, gain, accent) {
	// Sharp wooden transient
	const freq = accent ? 900 : 700;
	const osc = ctx.createOscillator();
	osc.type = "triangle";
	osc.frequency.setValueAtTime(freq * 2, time);
	osc.frequency.exponentialRampToValueAtTime(freq, time + 0.02);

	const oscEnv = ctx.createGain();
	oscEnv.gain.setValueAtTime(0.0001, time);
	oscEnv.gain.exponentialRampToValueAtTime(gain, time + 0.002);
	oscEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

	// High impact noise body
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = 1500;
	const noiseEnv = ctx.createGain();
	noiseEnv.gain.setValueAtTime(0.0001, time);
	noiseEnv.gain.exponentialRampToValueAtTime(gain * 0.8, time + 0.002);
	noiseEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

	osc.connect(oscEnv).connect(ctx.destination);
	noise.connect(filter).connect(noiseEnv).connect(ctx.destination);

	osc.start(time);
	noise.start(time);
	osc.stop(time + 0.08);
	noise.stop(time + 0.08);
}

function playShaker(ctx, time, gain, accent) {
	// Soft noise attack
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = accent ? 6000 : 5000;
	filter.Q.value = 0.8;

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain * 0.6, time + 0.015); // Slower attack
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

	noise.connect(filter).connect(env).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.15);
}

function playSnap(ctx, time, gain, accent) {
	// Tight high-freq pop
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = "bandpass";
	filter.frequency.value = accent ? 2500 : 2000;
	filter.Q.value = 1.2;

	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.002);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

	noise.connect(filter).connect(env).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.06);
}

function playTambourine(ctx, time, gain, accent) {
	// Multiple square waves to emulate jingles
	const jingles = [3000, 4500, 6000];
	const jingleEnv = ctx.createGain();
	jingleEnv.gain.setValueAtTime(0.0001, time);
	jingleEnv.gain.exponentialRampToValueAtTime(gain * 0.4, time + 0.01);
	jingleEnv.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.2 : 0.15));

	jingles.forEach(freq => {
		const osc = ctx.createOscillator();
		osc.type = "square";
		osc.frequency.value = freq;
		osc.connect(jingleEnv);
		osc.start(time);
		osc.stop(time + 0.25);
	});
	jingleEnv.connect(ctx.destination);

	// Strike impact
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = "highpass";
	filter.frequency.value = 4000;

	const noiseEnv = ctx.createGain();
	noiseEnv.gain.setValueAtTime(0.0001, time);
	noiseEnv.gain.exponentialRampToValueAtTime(gain * 0.7, time + 0.002);
	noiseEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

	noise.connect(filter).connect(noiseEnv).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.1);
}

const PLAYERS = {
	click: playClick,
	beep: playBeep,
	"hi-hat": playHihat,
	snare: playSnare,
	clap: playClap,
	woodblock: playWoodblock,
	kick: playKick,
	tom: playTom,
	"floor-tom": playFloorTom,
	cymbal: playCymbal,
	cowbell: playCowbell,
	claves: playClaves,
	rimshot: playRimshot,
	shaker: playShaker,
	snap: playSnap,
	tambourine: playTambourine
};

export function playSound(type, ctx, time, accent = false) {
	if (!ctx) return;
	const player = PLAYERS[type] || PLAYERS.click;
	const gain = accent ? 0.22 : 0.12;

	// Pass the accent boolean down to the player so they can adjust pitch/tone
	player(ctx, time, gain, accent);
}