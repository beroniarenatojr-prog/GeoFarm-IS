import { useMemo } from 'react';
import { TUMAUINI_CENTER } from '@/config/tumauiniMap';

const TILE_SIZE = 256;
const FALLBACK_ZOOM = 13;
const TILE_RANGE = [-3, -2, -1, 0, 1, 2, 3];

function lonLatToTile(lng, lat, zoom) {
  const scale = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;

  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale,
  };
}

export default function TumauiniMapFallback({ className = '', showNotice = true }) {
  const tiles = useMemo(() => {
    const centerTile = lonLatToTile(TUMAUINI_CENTER[0], TUMAUINI_CENTER[1], FALLBACK_ZOOM);
    const baseX = Math.floor(centerTile.x);
    const baseY = Math.floor(centerTile.y);
    const offsetX = (centerTile.x - baseX) * TILE_SIZE;
    const offsetY = (centerTile.y - baseY) * TILE_SIZE;

    return TILE_RANGE.flatMap((dx) => TILE_RANGE.map((dy) => ({
      key: `${dx}:${dy}`,
      x: dx * TILE_SIZE - offsetX,
      y: dy * TILE_SIZE - offsetY,
      url: `https://tile.openstreetmap.org/${FALLBACK_ZOOM}/${baseX + dx}/${baseY + dy}.png`,
    })));
  }, []);

  return (
    <div className={`relative h-full min-h-[320px] w-full overflow-hidden bg-slate-100 ${className}`}>
      <div className="absolute left-1/2 top-1/2 h-[1792px] w-[1792px] -translate-x-1/2 -translate-y-1/2">
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            alt=""
            className="absolute h-64 w-64 select-none"
            draggable="false"
            style={{
              left: `${896 + tile.x}px`,
              top: `${896 + tile.y}px`,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-[18%] rounded-sm border-2 border-dashed border-emerald-800/80 bg-emerald-500/10" />

      <div className="absolute bottom-3 left-3 rounded-md bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow">
        Tumauini, Isabela
      </div>

      {showNotice && (
        <div className="absolute left-4 top-4 max-w-sm rounded-lg border border-amber-200 bg-amber-50/95 p-3 text-sm text-amber-900 shadow">
          <div className="font-semibold">Basic map fallback active</div>
          <div className="mt-1">
            This browser cannot start WebGL, so MapLibre drawing is paused. Enable hardware acceleration or use a WebGL-capable browser for full GIS editing.
          </div>
        </div>
      )}
    </div>
  );
}
