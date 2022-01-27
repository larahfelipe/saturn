import {
  SpotifyRequestType,
  SpotifyPlaylistRawResponse,
  SpotifyPlaylist
} from '@/types';

export function parseSpotifyRequest(
  type: SpotifyRequestType,
  responseData: string
) {
  if (type === 'TRACK') {
    const spotifyTrackTitle = responseData.substring(
      responseData.indexOf('<ti') + 7,
      responseData.indexOf('|') - 1
    );
    return spotifyTrackTitle;
  } else if (type === 'PLAYLIST') {
    let playlistDuration = 0;
    const startTargetStr =
      '<script type="application/json" id="initial-state">';
    const endTargetStr = '"available_markets"';

    const contextSelector =
      responseData.substring(
        responseData.indexOf(startTargetStr) + startTargetStr.length,
        responseData.indexOf(endTargetStr) - 1
      ) + '}}}}';
    const spotifyPlaylist: SpotifyPlaylistRawResponse =
      JSON.parse(contextSelector);

    const spotifyPlaylistId = Object.keys(spotifyPlaylist.entities.items)[0];
    const playlist = spotifyPlaylist.entities.items[spotifyPlaylistId];

    const playlistTracks = playlist.tracks.items.map((item) => {
      playlistDuration += item.track.duration_ms;
      return `${item.track.name} - ${item.track.artists[0].name}`;
    });

    return {
      name: playlist.name,
      owner: playlist.owner.display_name,
      cover: playlist.images[0].url,
      tracks: playlistTracks,
      duration: playlistDuration
    } as SpotifyPlaylist;
  } else return;
}
