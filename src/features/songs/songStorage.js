// Shared status constants — imported by SongCard and useSongStatus.
// All storage operations go through firebaseSongs.js directly.
export const STATUSES = ["planned", "learning", "completed"];
export const DEFAULT_STATUS = "planned";

export { addSong, removeSong, updateSong, subscribeToSongs } from "./firebaseSongs";
