"use client";

import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import type { RegionStat } from "@/lib/api";
import { MADAGASCAR_REGIONS, type MadagascarRegion } from "@/data/madagascarRegions";
import { MADAGASCAR_CITIES } from "@/data/madagascarCities";

const REGIONS_GEO_URL = "/data/madagascar-regions.geojson";

// Le fichier de frontières date d'avant la scission Vatovavy-Fitovinany (2021) :
// un seul polygone "Vatovavy-Fitovinany" couvre nos deux régions actuelles.
// On l'associe à "Vatovavy" pour le filtre, en additionnant les deux compteurs
// pour l'affichage. "Ambatosoa" (créée en 2025) n'a pas encore de polygone
// dans les sources publiques disponibles : seul son marqueur s'affiche.
const LEGACY_SHAPE_TO_REGION: Record<string, string> = {
  "Vatovavy-Fitovinany": "Vatovavy",
};

interface MadagascarMapProps {
  stats: RegionStat[];
  selectedRegion: string | null;
  onSelectRegion: (region: string | null) => void;
}

export default function MadagascarMap({ stats, selectedRegion, onSelectRegion }: MadagascarMapProps) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([46.85, -18.775]);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const countFor = (region: string) => stats.find((s) => s.region === region)?.count ?? 0;

  function regionByName(name: string): MadagascarRegion | undefined {
    return MADAGASCAR_REGIONS.find((r) => r.name === name);
  }

  function countForShape(shapeName: string) {
    if (shapeName === "Vatovavy-Fitovinany") {
      return countFor("Vatovavy") + countFor("Fitovinany");
    }
    return countFor(shapeName);
  }

  function radiusFor(count: number, maxCount: number) {
    if (count === 0) return 4;
    const ratio = count / maxCount;
    return 6 + ratio * 8;
  }

  const maxCount = Math.max(1, ...stats.map((s) => s.count));

  function handleMoveEnd(pos: { coordinates: [number, number]; zoom: number }) {
    setCenter(pos.coordinates);
    setZoom(pos.zoom);
  }

  function resetView() {
    setCenter([46.85, -18.775]);
    setZoom(1);
    onSelectRegion(null);
  }

  function focusRegion(name: string, lat: number, lng: number) {
    setCenter([lng, lat]);
    setZoom(4);
    onSelectRegion(selectedRegion === name ? null : name);
  }

  const showCities = zoom >= 2.5;

  return (
    <div className="bg-[#13131F] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white text-sm font-semibold">Événements par région</h3>
        {(selectedRegion || zoom !== 1) && (
          <button onClick={resetView} className="text-xs text-purple-400 hover:text-purple-300">
            Réinitialiser
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-1">
        Clique une région, zoom/déplace pour explorer{showCities ? " · villes visibles" : ""}
      </p>
      {hoveredRegion && (
        <p className="text-xs text-purple-300 mb-2 h-4">{hoveredRegion}</p>
      )}
      {!hoveredRegion && <div className="h-4 mb-2" />}

      <div className="relative bg-black/20 rounded-xl overflow-hidden">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [46.85, -18.775], scale: 1413 }}
          width={220}
          height={480}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup
            center={center}
            zoom={zoom}
            minZoom={1}
            maxZoom={12}
            onMoveEnd={handleMoveEnd}
          >
            <Geographies geography={REGIONS_GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const shapeName = geo.properties.name as string;
                  const regionName = LEGACY_SHAPE_TO_REGION[shapeName] ?? shapeName;
                  const regionData = regionByName(regionName);
                  const isSelected = selectedRegion === regionName;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => {
                        if (regionData) focusRegion(regionName, regionData.lat, regionData.lng);
                      }}
                      onMouseEnter={() => setHoveredRegion(shapeName)}
                      onMouseLeave={() => setHoveredRegion(null)}
                      fill={regionData ? regionData.color : "rgba(255,255,255,0.08)"}
                      fillOpacity={isSelected ? 0.55 : 0.25}
                      stroke={isSelected ? "#fff" : "rgba(255,255,255,0.4)"}
                      strokeWidth={(isSelected ? 1 : 0.4) / zoom}
                      style={{
                        default: { outline: "none", cursor: "pointer" },
                        hover: { outline: "none", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {showCities &&
              MADAGASCAR_CITIES.map((city) => (
                <Marker key={city.name} coordinates={[city.lng, city.lat]}>
                  <circle
                    r={1.2 / zoom}
                    fill="rgba(255,255,255,0.6)"
                    stroke="none"
                    onMouseEnter={() => setHoveredCity(city.name)}
                    onMouseLeave={() => setHoveredCity(null)}
                  />
                  {hoveredCity === city.name && (
                    <text
                      textAnchor="middle"
                      y={-4 / zoom}
                      fontSize={4 / zoom}
                      fill="#fff"
                      style={{ pointerEvents: "none" }}
                    >
                      {city.name}
                    </text>
                  )}
                </Marker>
              ))}

            {MADAGASCAR_REGIONS.map((region) => {
              const count = countFor(region.name);
              const isSelected = selectedRegion === region.name;
              const r = radiusFor(count, maxCount) / Math.sqrt(zoom);

              return (
                <Marker
                  key={region.name}
                  coordinates={[region.lng, region.lat]}
                  onClick={() => focusRegion(region.name, region.lat, region.lng)}
                  className="cursor-pointer"
                >
                  <circle
                    r={r}
                    fill={isSelected ? "url(#mmSelected)" : "rgba(15,15,25,0.85)"}
                    stroke={isSelected ? "#fff" : region.color}
                    strokeWidth={(isSelected ? 1.5 : 1) / zoom}
                  />
                  {zoom < 3 && (
                    <text
                      textAnchor="middle"
                      y={r + 5 / zoom}
                      fontSize={5 / zoom}
                      fill="#e5e7eb"
                      style={{ pointerEvents: "none" }}
                    >
                      {count}
                    </text>
                  )}
                </Marker>
              );
            })}

            <defs>
              <linearGradient id="mmSelected" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-4 max-h-40 overflow-y-auto pr-1">
        {MADAGASCAR_REGIONS.map((region) => {
          const count = countFor(region.name);
          const isSelected = selectedRegion === region.name;
          return (
            <button
              key={region.name}
              onClick={() => focusRegion(region.name, region.lat, region.lng)}
              className={`text-left text-xs px-2 py-1 rounded-lg transition truncate flex items-center gap-1.5 ${
                isSelected
                  ? "bg-gradient-to-r from-purple-600/30 to-orange-500/30 text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
              title={region.name}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: region.color }}
              />
              <span className="truncate">
                {region.name} <span className="text-gray-500">({count})</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}