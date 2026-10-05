"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { TileLayer } from "react-leaflet";

export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

/** Madurai city centre, used when nothing better is known. */
export const DEFAULT_CENTER: [number, number] = [9.9252, 78.1198];

export function BaseTiles() {
  return <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Round photo (or initials) pin, built from HTML so no marker image files are needed. */
export function avatarIcon(opts: { photoUrl?: string | null; initials?: string; me?: boolean; size?: number }) {
  const size = opts.size ?? 40;
  const style = opts.photoUrl ? `background-image:url('${encodeURI(opts.photoUrl)}')` : "";
  const html = `<div class="member-pin${opts.me ? " is-me" : ""}" style="width:${size}px;height:${size}px;${style}">${
    opts.photoUrl ? "" : escapeHtml(opts.initials ?? "")
  }</div>`;
  return L.divIcon({ html, className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export function pinIcon(color = "#cf2030") {
  const html = `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="15" r="6" fill="#fff"/></svg>`;
  return L.divIcon({ html, className: "", iconSize: [30, 42], iconAnchor: [15, 42] });
}
