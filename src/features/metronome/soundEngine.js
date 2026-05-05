export const SOUND_OPTIONS = [
	"click",
	"beep",
	"hi-hat",
	"snare",
	"clap",
	"woodblock",
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

function playClick(ctx, time, gain) {
	const osc = ctx.createOscillator();
	osc.type = "square";
	osc.frequency.value = 1000;
	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.001);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.06);
}

function playBeep(ctx, time, gain) {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.value = 800;
	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.005);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.12);
}

function playHihat(ctx, time, gain) {
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const filter = ctx.createBiquadFilter();
	filter.type = "highpass";
	filter.frequency.value = 7000;
	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.002);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
	noise.connect(filter).connect(env).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.04);
}

function playSnare(ctx, time, gain) {
	const noise = ctx.createBufferSource();
	noise.buffer = getNoiseBuffer(ctx);
	const noiseFilter = ctx.createBiquadFilter();
	noiseFilter.type = "highpass";
	noiseFilter.frequency.value = 1000;
	const noiseEnv = ctx.createGain();
	noiseEnv.gain.setValueAtTime(0.0001, time);
	noiseEnv.gain.exponentialRampToValueAtTime(gain * 0.7, time + 0.002);
	noiseEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
	noise.connect(noiseFilter).connect(noiseEnv).connect(ctx.destination);
	noise.start(time);
	noise.stop(time + 0.09);

	const osc = ctx.createOscillator();
	osc.type = "triangle";
	osc.frequency.setValueAtTime(180, time);
	osc.frequency.exponentialRampToValueAtTime(100, time + 0.06);
	const oscEnv = ctx.createGain();
	oscEnv.gain.setValueAtTime(0.0001, time);
	oscEnv.gain.exponentialRampToValueAtTime(gain * 0.5, time + 0.002);
	oscEnv.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
	osc.connect(oscEnv).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.08);
}

function playClap(ctx, time, gain) {
	const offsets = [0, 0.012, 0.024];
	for (let i = 0; i < offsets.length; i++) {
		const startT = time + offsets[i];
		const noise = ctx.createBufferSource();
		noise.buffer = getNoiseBuffer(ctx);
		const filter = ctx.createBiquadFilter();
		filter.type = "bandpass";
		filter.frequency.value = 1500;
		filter.Q.value = 0.8;
		const env = ctx.createGain();
		const peak = i === offsets.length - 1 ? gain * 0.95 : gain * 0.6;
		env.gain.setValueAtTime(0.0001, startT);
		env.gain.exponentialRampToValueAtTime(peak, startT + 0.002);
		env.gain.exponentialRampToValueAtTime(0.0001, startT + 0.05);
		noise.connect(filter).connect(env).connect(ctx.destination);
		noise.start(startT);
		noise.stop(startT + 0.06);
	}
}

function playWoodblock(ctx, time, gain) {
	const osc = ctx.createOscillator();
	osc.type = "sine";
	osc.frequency.setValueAtTime(1300, time);
	osc.frequency.exponentialRampToValueAtTime(900, time + 0.04);
	const env = ctx.createGain();
	env.gain.setValueAtTime(0.0001, time);
	env.gain.exponentialRampToValueAtTime(gain, time + 0.001);
	env.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
	osc.connect(env).connect(ctx.destination);
	osc.start(time);
	osc.stop(time + 0.05);
}

const PLAYERS = {
	click: playClick,
	beep: playBeep,
	"hi-hat": playHihat,
	snare: playSnare,
	clap: playClap,
	woodblock: playWoodblock,
};

export function playSound(type, ctx, time, accent = false) {
	if (!ctx) return;
	const player = PLAYERS[type] || PLAYERS.click;
	const gain = accent ? 0.22 : 0.12;
	player(ctx, time, gain);
}
