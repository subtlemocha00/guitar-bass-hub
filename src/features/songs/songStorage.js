// Shared status constants — imported by SongCard and useSongStatus.
// All storage operations go through firebaseSongs.js directly; this module
// deliberately re-exports nothing so there is only one import path for them.
export const STATUSES = ["planned", "learning", "completed"];
