import * as remote from "./firebaseSongStorage";

const STATUS_KEY = "practice-hub.song-status";
const NOTES_KEY = "practice-hub.song-notes";

export const STATUSES = ["planned", "learning", "completed"];
export const DEFAULT_STATUS = "planned";

function readMap(key) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function writeMap(key, map) {
	localStorage.setItem(key, JSON.stringify(map));
}

function writeStatusToCache(songId, status) {
	const map = readMap(STATUS_KEY);
	map[songId] = status;
	writeMap(STATUS_KEY, map);
}

function writeNoteToCache(songId, note) {
	const map = readMap(NOTES_KEY);
	if (note) {
		map[songId] = note;
	} else {
		delete map[songId];
	}
	writeMap(NOTES_KEY, map);
}

export function getCachedStatus(songId) {
	const map = readMap(STATUS_KEY);
	const value = map[songId];
	return STATUSES.includes(value) ? value : DEFAULT_STATUS;
}

export function getCachedNote(songId) {
	const map = readMap(NOTES_KEY);
	const value = map[songId];
	return typeof value === "string" ? value : "";
}

export async function getStatus(uid, songId) {
	if (!uid) return getCachedStatus(songId);
	try {
		const remoteValue = await remote.getStatus(uid, songId);
		if (remoteValue == null) {
			return getCachedStatus(songId);
		}
		writeStatusToCache(songId, remoteValue);
		return remoteValue;
	} catch (err) {
		console.warn(
			"[songStorage] Firebase getStatus failed, using local cache:",
			err
		);
		return getCachedStatus(songId);
	}
}

export async function setStatus(uid, songId, status) {
	if (!STATUSES.includes(status)) {
		throw new Error(`Invalid song status: ${status}`);
	}
	writeStatusToCache(songId, status);
	if (!uid) return;
	try {
		await remote.setStatus(uid, songId, status);
	} catch (err) {
		console.warn("[songStorage] Firebase setStatus failed:", err);
	}
}

export async function getNote(uid, songId) {
	if (!uid) return getCachedNote(songId);
	try {
		const remoteValue = await remote.getNote(uid, songId);
		if (remoteValue == null) {
			return getCachedNote(songId);
		}
		writeNoteToCache(songId, remoteValue);
		return remoteValue;
	} catch (err) {
		console.warn(
			"[songStorage] Firebase getNote failed, using local cache:",
			err
		);
		return getCachedNote(songId);
	}
}

export async function setNote(uid, songId, note) {
	writeNoteToCache(songId, note);
	if (!uid) return;
	try {
		await remote.setNote(uid, songId, note);
	} catch (err) {
		console.warn("[songStorage] Firebase setNote failed:", err);
	}
}
