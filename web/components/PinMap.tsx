"use client";

import React from "react";

// Real coordinates for the ten pinned cities. The map is a plain lat/lon grid
// (no country outline), so pins sit where they belong without depicting borders.
export const MAP_PINS: Array<{ id: string; lat: number; lon: number; label: "left" | "right" }> = [
  { id: "srinagar", lat: 34.0837, lon: 74.7973, label: "left" },
  { id: "ladakh", lat: 34.1526, lon: 77.5771, label: "right" },
  { id: "delhi", lat: 28.6139, lon: 77.209, label: "right" },
  { id: "varanasi", lat: 25.3176, lon: 82.9739, label: "right" },
  { id: "agra", lat: 27.1767, lon: 78.0081, label: "right" },
  { id: "jaipur", lat: 26.9124, lon: 75.7873, label: "left" },
  { id: "udaipur", lat: 24.5854, lon: 73.7125, label: "left" },
  { id: "goa", lat: 15.2993, lon: 74.124, label: "left" },
  { id: "mysuru", lat: 12.2958, lon: 76.6394, label: "right" },
  { id: "kerala", lat: 9.9312, lon: 76.2673, label: "right" },
];

const LON_MIN = 68;
const LON_MAX = 88;
const LAT_MIN = 6;
const LAT_MAX = 37;

const toX = (lon: number) => ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * 100;
const toY = (lat: number) => ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 100;

export function formatCoord(lat: number, lon: number) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
}

interface PinMapProps {
  names: Record<string, string>;
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function PinMap({ names, selectedId, onSelect }: PinMapProps) {
  const lonLines = [70, 75, 80, 85];
  const latLines = [10, 15, 20, 25, 30, 35];
  const route = MAP_PINS.map(p => `${toX(p.lon)},${toY(p.lat)}`).join(" ");

  return (
    <div className="pinmap">
      <svg className="pinmap-grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {lonLines.map(lon => (
          <line key={`lon-${lon}`} x1={toX(lon)} y1={0} x2={toX(lon)} y2={100} />
        ))}
        {latLines.map(lat => (
          <line key={`lat-${lat}`} x1={0} y1={toY(lat)} x2={100} y2={toY(lat)} />
        ))}
        <polyline className="pinmap-route" points={route} />
      </svg>

      {lonLines.map(lon => (
        <span key={`lonl-${lon}`} className="pinmap-axis pinmap-axis-x" style={{ left: `${toX(lon)}%` }}>{lon}°E</span>
      ))}
      {latLines.map(lat => (
        <span key={`latl-${lat}`} className="pinmap-axis pinmap-axis-y" style={{ top: `${toY(lat)}%` }}>{lat}°N</span>
      ))}

      <div className="pinmap-compass" aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="29" />
          <path d="M32 6 L37 32 L32 58 L27 32 Z" className="pinmap-compass-needle" />
          <path d="M32 6 L37 32 L27 32 Z" className="pinmap-compass-north" />
          <text x="32" y="4.5">N</text>
        </svg>
      </div>

      {MAP_PINS.map(pin => {
        const active = pin.id === selectedId;
        return (
          <button
            key={pin.id}
            type="button"
            className={`pinmap-pin ${active ? "active" : ""} label-${pin.label}`}
            style={{ left: `${toX(pin.lon)}%`, top: `${toY(pin.lat)}%` }}
            onClick={() => onSelect(pin.id)}
            aria-pressed={active}
            aria-label={`${names[pin.id] ?? pin.id}, ${formatCoord(pin.lat, pin.lon)}`}
          >
            <span className="pinmap-dot" />
            <span className="pinmap-label">{names[pin.id] ?? pin.id}</span>
          </button>
        );
      })}
    </div>
  );
}
