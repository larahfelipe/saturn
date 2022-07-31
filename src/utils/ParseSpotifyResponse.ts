import type {
  SpotifyPlaylist,
  SpotifyPlaylistRawResponse,
  SpotifyRequestType
} from '@/types';

export const parseSpotifyResponse = (
  type: SpotifyRequestType,
  data: string
) => {
  if (type === 'TRACK') {
    const trackTitle = data.substring(
      data.indexOf('<ti') + 7,
      data.indexOf('|') - 1
    );
    return trackTitle;
  } else if (type === 'PLAYLIST') {
    let playlistDuration = 0;
    const startTargetStr =
      '<script type="application/json" id="initial-state">';
    const endTargetStr = '"available_markets"';

    const contextSelector =
      data.substring(
        data.indexOf(startTargetStr) + startTargetStr.length,
        data.indexOf(endTargetStr) - 1
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
};
