export function getHostedSongs(songs, manifest) {
  return songs.filter(song => Boolean(manifest[song.id]?.audio));
}
