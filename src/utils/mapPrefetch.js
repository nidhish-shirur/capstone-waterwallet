/**
 * Map Tile Prefetcher for Thane Region
 * Computes the tiles for a bounding box around Thane center [19.2183, 72.9781]
 * at zoom levels 15 to 19, and fetches them to trigger Service Worker caching.
 */

const THANE_LAT = 19.2183;
const THANE_LNG = 72.9781;
const ESRI_TILE_URL_TEMPLATE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/**
 * Converts latitude and longitude to Slippy Map tile coordinates (x, y) for a given zoom level.
 */
function latLngToTile(lat, lng, zoom) {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  return { x, y };
}

/**
 * Generates and prefetches tiles around the Thane center.
 */
export function prefetchThaneMapTiles() {
  const zooms = [15, 16, 17, 18, 19];
  const urls = [];

  zooms.forEach((z) => {
    const { x, y } = latLngToTile(THANE_LAT, THANE_LNG, z);
    
    // Define prefetch grid radius:
    // Zoom 18: 5x5 grid (24 tiles around center) since it's the primary interactive zoom level
    // Others: 3x3 grid (8 tiles around center)
    const radius = z === 18 ? 2 : 1;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const tx = x + dx;
        const ty = y + dy;
        const url = ESRI_TILE_URL_TEMPLATE
          .replace('{z}', z.toString())
          .replace('{y}', ty.toString())
          .replace('{x}', tx.toString());
        urls.push(url);
      }
    }
  });

  // Prefetch with low priority when CPU is idle
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      triggerPrefetch(urls);
    });
  } else {
    setTimeout(() => {
      triggerPrefetch(urls);
    }, 2000);
  }
}

/**
 * Fetches urls with a concurrency limit to prevent network bottleneck.
 */
function triggerPrefetch(urls) {
  const limit = 4; // Fetch 4 tiles concurrently
  let index = 0;

  function next() {
    if (index >= urls.length) {
      console.log(`[Prefetch] Successfully prefetched all ${urls.length} Thane map tiles.`);
      return;
    }
    const url = urls[index++];
    fetch(url, { mode: 'cors' })
      .then(() => next())
      .catch((err) => {
        console.warn(`[Prefetch] Failed to prefetch tile: ${url}`, err);
        next();
      });
  }

  for (let i = 0; i < limit; i++) {
    next();
  }
}
