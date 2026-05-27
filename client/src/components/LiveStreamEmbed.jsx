/**
 * LiveStreamEmbed — Muestra un stream de Twitch/YouTube incrustado
 */
export default function LiveStreamEmbed({ platform, url, tournamentId, compact }) {
  if (!url || !platform) return null;

  const hostname = window.location.hostname;
  const height = compact ? 180 : 360;

  if (platform === 'twitch') {
    const channel = url.replace(/.*twitch\.tv\//, '').split('?')[0];
    return (
      <div className={`rounded-xl overflow-hidden ${compact ? '' : 'shadow-lg'}`}>
        <iframe src={`https://player.twitch.tv/?channel=${channel}&parent=${hostname}&autoplay=false`}
          height={height} className="w-full" allowFullScreen title="Twitch stream" />
      </div>
    );
  }

  if (platform === 'youtube') {
    let videoId = '';
    if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1]?.split('&')[0] || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
    } else if (url.includes('youtube.com/embed/')) {
      videoId = url.split('embed/')[1]?.split('?')[0] || '';
    } else {
      videoId = url; // Assume raw ID
    }
    if (!videoId) return null;
    return (
      <div className={`rounded-xl overflow-hidden ${compact ? '' : 'shadow-lg'}`}>
        <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`}
          height={height} className="w-full" allowFullScreen title="YouTube stream" />
      </div>
    );
  }

  // Custom URL — direct iframe
  return (
    <div className={`rounded-xl overflow-hidden ${compact ? '' : 'shadow-lg'}`}>
      <iframe src={url} height={height} className="w-full" allowFullScreen title="Live stream" />
    </div>
  );
}
