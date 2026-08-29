const axios = require('axios');

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

async function resolveUploadsPlaylistId(channelId) {
  const { data } = await axios.get(`${YT_API_BASE}/channels`, {
    params: {
      part: 'contentDetails',
      id: channelId,
      key: process.env.YOUTUBE_API_KEY,
    },
  });

  const items = data.items;
  if (!items || items.length === 0) throw new Error(`Channel not found: ${channelId}`);
  return items[0].contentDetails.relatedPlaylists.uploads;
}

// Returns videos published strictly after `since` (a Date), newest-first.
// Stops paging once it hits a video at or before `since`.
async function listNewVideos(uploadsPlaylistId, since) {
  const sinceTime = since instanceof Date ? since : new Date(since);
  const videos = [];
  let pageToken = undefined;

  while (true) {
    const params = {
      part: 'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      key: process.env.YOUTUBE_API_KEY,
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await axios.get(`${YT_API_BASE}/playlistItems`, { params });

    let reachedCutoff = false;
    for (const item of data.items || []) {
      const publishedAt = new Date(item.snippet.publishedAt);
      if (publishedAt <= sinceTime) {
        reachedCutoff = true;
        break;
      }
      videos.push({
        youtubeVideoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        publishedAt,
      });
    }

    if (reachedCutoff || !data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return videos;
}

module.exports = { resolveUploadsPlaylistId, listNewVideos };
