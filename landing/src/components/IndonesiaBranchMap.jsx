import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  INDONESIA_KANWIL_CAMERAS,
  INDONESIA_MAP_VIEWBOX,
  INDONESIA_PROVINCES,
  INDONESIA_SERVICE_CITIES
} from "../config/indonesia-map-data.js";

/**
 * PETA JARINGAN CABANG — GAYA GARIS (LINE-ART) MENYATU DENGAN HALAMAN
 * - Tanpa kotak, border, panel gelap, graticule, atau legenda berlebihan.
 * - Daratan digambar dengan garis ungu tipis (#351080) di atas latar halaman.
 * - Wilayah aktif diisi ungu brand; satu garis koordinasi ungu dari Pusat Jakarta.
 * - Ukuran pin & label konstan dalam piksel (ResizeObserver) agar tajam di semua layar.
 */

const BRAND = "#351080";
const INK = "#17223B";
const GREEN = "#078D67";

const KANWIL_SHORT_NAMES = {
  "WIL-1": "Sumatera Utara & Aceh",
  "WIL-2": "Sumatera Tengah & Selatan",
  "WIL-3": "Jabodetabek & Banten",
  "WIL-4": "Jawa Barat",
  "WIL-5": "Jawa Tengah & DIY",
  "WIL-6": "Jatim, Bali & Nusra",
  "WIL-7": "Kalimantan, Sulawesi & Timur"
};

// Kota koordinator tiap wilayah sebagai ujung garis koordinasi dari Pusat Jakarta
const KANWIL_PRIMARY_CITY = {
  "WIL-1": "MEDAN",
  "WIL-2": "PALEMBANG",
  "WIL-4": "BANDUNG",
  "WIL-5": "SEMARANG",
  "WIL-6": "SURABAYA",
  "WIL-7": "MAKASSAR"
};

const MIN_LABEL_GAP_PX = 13;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function buildCurvedArc(from, to, bendRatio = 0.2) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;
  const lift = Math.min(60, Math.max(6, dist * bendRatio));
  const cx = (from.x + to.x) / 2;
  const cy = (from.y + to.y) / 2 - lift;
  return `M ${from.x} ${from.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${to.x} ${to.y}`;
}

function formatBranchTitle(branchName) {
  if (branchName === "PUSAT JAKARTA") return "Pusat Jakarta";
  return String(branchName || "")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getLabelOffset(pos, u) {
  const pad = 9 * u;
  switch (pos) {
    case "left":
      return { dx: -pad, dy: 4 * u, anchor: "end" };
    case "top":
      return { dx: 0, dy: -pad, anchor: "middle" };
    case "bottom":
      return { dx: 0, dy: pad + 9 * u, anchor: "middle" };
    case "top-right":
      return { dx: pad * 0.8, dy: -pad * 0.55, anchor: "start" };
    case "bottom-right":
      return { dx: pad * 0.8, dy: pad + 4 * u, anchor: "start" };
    case "bottom-left":
      return { dx: -pad * 0.8, dy: pad + 4 * u, anchor: "end" };
    case "right":
    default:
      return { dx: pad, dy: 4 * u, anchor: "start" };
  }
}

export default function IndonesiaBranchMap({
  kanwilList,
  activeKanwilCode,
  onSelectKanwil,
  onSelectCity,
  operationalHours,
  onStartSimulation
}) {
  // Di layar sempit, peta seluruh Indonesia terlalu kecil untuk dibaca: mulai dari tampilan perbesar wilayah
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? "focus" : "all"
  ); // "all" | "focus"
  const [hoveredKanwil, setHoveredKanwil] = useState(null);
  const [hoveredCityName, setHoveredCityName] = useState(null);
  const [hoveredProvince, setHoveredProvince] = useState(null);

  const [camera, setCamera] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640
      ? INDONESIA_KANWIL_CAMERAS[activeKanwilCode] || INDONESIA_KANWIL_CAMERAS.ALL
      : INDONESIA_KANWIL_CAMERAS.ALL
  );
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Lebar render aktual peta (px) untuk ukuran pin/label yang konstan di semua layar
  const mapWrapRef = useRef(null);
  const [renderW, setRenderW] = useState(1000);

  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return undefined;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setRenderW(w);
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeKanwil = useMemo(
    () => kanwilList.find((k) => k.code === activeKanwilCode) || kanwilList[0],
    [kanwilList, activeKanwilCode]
  );

  const targetCamera = useMemo(() => {
    if (viewMode === "focus") {
      return INDONESIA_KANWIL_CAMERAS[activeKanwil.code] || INDONESIA_KANWIL_CAMERAS.ALL;
    }
    return INDONESIA_KANWIL_CAMERAS.ALL;
  }, [viewMode, activeKanwil.code]);

  // Perpindahan kamera halus (easeOutCubic 620ms)
  useEffect(() => {
    const start = cameraRef.current;
    const end = targetCamera;
    if (
      Math.abs(start.x - end.x) < 0.2 &&
      Math.abs(start.y - end.y) < 0.2 &&
      Math.abs(start.w - end.w) < 0.2
    ) {
      return undefined;
    }
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reducedMotion) {
      setCamera(end);
      return undefined;
    }
    let rafId = 0;
    const duration = 620;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = easeOutCubic(p);
      setCamera({
        x: start.x + (end.x - start.x) * e,
        y: start.y + (end.y - start.y) * e,
        w: start.w + (end.w - start.w) * e,
        h: start.h + (end.h - start.h) * e
      });
      if (p < 1) rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [targetCamera]);

  // Satuan SVG per 1 piksel layar
  const u = camera.w / Math.max(200, renderW);
  const pxPerUnit = 1 / u;

  const jakartaHub = useMemo(
    () => INDONESIA_SERVICE_CITIES.find((c) => c.name === "PUSAT JAKARTA"),
    []
  );

  const activeCities = useMemo(
    () => INDONESIA_SERVICE_CITIES.filter((c) => c.kanwil === activeKanwil.code),
    [activeKanwil.code]
  );

  const inactiveCities = useMemo(
    () => INDONESIA_SERVICE_CITIES.filter((c) => c.kanwil !== activeKanwil.code),
    [activeKanwil.code]
  );

  const activeCentroid = useMemo(() => {
    if (!activeCities.length) return { x: 500, top: 192, bottom: 192 };
    return {
      x: activeCities.reduce((a, c) => a + c.x, 0) / activeCities.length,
      top: Math.min(...activeCities.map((c) => c.y)),
      bottom: Math.max(...activeCities.map((c) => c.y))
    };
  }, [activeCities]);

  // Jarak terdekat antar kota aktif (unit SVG) — menentukan apakah label individual muat
  const minActiveGapUnits = useMemo(() => {
    let min = Infinity;
    for (let i = 0; i < activeCities.length; i++) {
      for (let j = i + 1; j < activeCities.length; j++) {
        const d = Math.hypot(
          activeCities[i].x - activeCities[j].x,
          activeCities[i].y - activeCities[j].y
        );
        if (d < min) min = d;
      }
    }
    return min;
  }, [activeCities]);

  const showIndividualLabels = minActiveGapUnits * pxPerUnit >= MIN_LABEL_GAP_PX;

  // Label ringkas di atas klaster; pindah ke bawah bila akan terpotong tepi atas peta
  const groupLabelY = (() => {
    const above = activeCentroid.top - 14 * u;
    if (above - 12 * u >= camera.y) return above;
    return activeCentroid.bottom + 24 * u;
  })();

  // Garis koordinasi tipis dari Pusat Jakarta ke seluruh wilayah (latar) + garis wilayah aktif
  const backboneArcs = useMemo(() => {
    if (!jakartaHub) return [];
    return Object.entries(KANWIL_PRIMARY_CITY)
      .map(([code, name]) => {
        const city = INDONESIA_SERVICE_CITIES.find((c) => c.name === name);
        if (!city) return null;
        return { code, d: buildCurvedArc(jakartaHub, city, 0.18) };
      })
      .filter((a) => a && a.d);
  }, [jakartaHub]);

  const activeArc = backboneArcs.find((a) => a.code === activeKanwil.code) || null;

  const hoveredCityObj = useMemo(
    () => INDONESIA_SERVICE_CITIES.find((c) => c.name === hoveredCityName) || null,
    [hoveredCityName]
  );

  const handleSelectKanwil = (code) => {
    onSelectKanwil(code);
    setHoveredCityName(null);
    setHoveredProvince(null);
    setHoveredKanwil(null);
  };

  const handleCityPinClick = (city) => {
    if (city.kanwil !== activeKanwil.code) {
      onSelectKanwil(city.kanwil);
      return;
    }
    onSelectCity(city.name);
  };

  const hintText = hoveredCityObj
    ? `${formatBranchTitle(hoveredCityObj.name)} · ${
        hoveredCityObj.kanwil === activeKanwil.code
          ? "ketuk untuk konsultasi di cabang ini"
          : `ketuk untuk membuka ${hoveredCityObj.kanwil}`
      }`
    : hoveredProvince
      ? `${hoveredProvince} · ketuk untuk menampilkan cabang`
      : "Ketuk pulau atau titik kota pada peta untuk melihat cabang resmi.";

  return (
    <div data-testid="corp-branch-explorer" className="mt-8">
      {/* PILIHAN 7 KANTOR WILAYAH — TAB TEKS BERGARIS BAWAH (SERAGAM DENGAN NAVIGASI HEADER) */}
      <div
        role="tablist"
        aria-label="Pilih Kantor Wilayah"
        className="grid grid-cols-2 gap-x-5 sm:grid-cols-4 lg:grid-cols-7 lg:gap-x-4"
      >
        {kanwilList.map((kw, idx) => {
          const isActive = kw.code === activeKanwil.code;
          const isHover = hoveredKanwil === kw.code && !isActive;
          const isLastOdd = idx === kanwilList.length - 1 && kanwilList.length % 2 === 1;
          return (
            <button
              key={kw.code}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`corp-kanwil-btn-${kw.code}`}
              onClick={() => handleSelectKanwil(kw.code)}
              onMouseEnter={() => setHoveredKanwil(kw.code)}
              onMouseLeave={() => setHoveredKanwil(null)}
              className={`border-b-2 py-3 text-left transition-colors ${
                isLastOdd ? "col-span-2 sm:col-span-1" : ""
              } ${
                isActive
                  ? "border-[#351080]"
                  : isHover
                    ? "border-[#351080]/35"
                    : "border-[#17223B]/10 hover:border-[#351080]/35"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
                    isActive ? "text-[#078D67]" : "text-[#475569]"
                  }`}
                >
                  {kw.code}
                </span>
                <span
                  className={`text-[11.5px] font-semibold tabular-nums ${
                    isActive ? "text-[#351080]" : "text-[#475569]"
                  }`}
                >
                  {kw.branches.length} kota
                </span>
              </div>
              <div
                className={`mt-0.5 font-display text-[13.5px] font-bold leading-snug ${
                  isActive ? "text-[#351080]" : "text-[#17223B]/80"
                }`}
              >
                {KANWIL_SHORT_NAMES[kw.code] || kw.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* BARIS STATUS + PILIHAN SKALA PETA (TEKS SEDERHANA, TANPA KOTAK) */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#17223B]/65">
          <span className="font-semibold text-[#17223B]">{activeKanwil.name}</span>
          <span className="mx-2 text-[#17223B]/25">/</span>
          {activeKanwil.branches.length} titik layanan
        </p>
        <div className="flex items-center gap-5 text-[13px] font-semibold">
          <button
            type="button"
            data-testid="map-view-all-btn"
            aria-pressed={viewMode === "all"}
            onClick={() => setViewMode("all")}
            className={`border-b-2 pb-0.5 transition-colors ${
              viewMode === "all"
                ? "border-[#351080] text-[#351080]"
                : "border-transparent text-[#475569] hover:text-[#17223B]"
            }`}
          >
            Seluruh Indonesia
          </button>
          <button
            type="button"
            data-testid="map-view-focus-btn"
            aria-pressed={viewMode === "focus"}
            onClick={() => setViewMode("focus")}
            className={`border-b-2 pb-0.5 transition-colors ${
              viewMode === "focus"
                ? "border-[#351080] text-[#351080]"
                : "border-transparent text-[#475569] hover:text-[#17223B]"
            }`}
          >
            Perbesar Wilayah
          </button>
        </div>
      </div>

      {/* PETA GARIS INDONESIA — LANGSUNG DI ATAS LATAR HALAMAN */}
      <div
        ref={mapWrapRef}
        data-testid="indonesia-map-stage"
        className="relative mt-3"
      >
        <svg
          viewBox={`${camera.x.toFixed(2)} ${camera.y.toFixed(2)} ${camera.w.toFixed(2)} ${camera.h.toFixed(2)}`}
          role="img"
          aria-label={`Peta jaringan Layanan Pensiunan di Indonesia. Wilayah aktif: ${activeKanwil.code} ${activeKanwil.name}`}
          data-testid="indonesia-map-svg"
          className="block aspect-[1000/385] w-full select-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Daratan: garis ungu tipis, wilayah aktif diisi ungu brand */}
          <g>
            {INDONESIA_PROVINCES.map((prov) => {
              const isActive = prov.kanwil === activeKanwil.code;
              const isHover = !isActive && prov.kanwil === hoveredKanwil;
              return (
                <path
                  key={prov.id}
                  d={prov.d}
                  data-kanwil={prov.kanwil}
                  className="lp-map-province"
                  style={{
                    fill: isActive ? BRAND : isHover ? "#E6DFF6" : "#F4F1FA",
                    stroke: isActive ? "rgba(255,255,255,0.45)" : "rgba(53,16,128,0.42)",
                    strokeWidth: (isActive ? 0.7 : 0.75) * u
                  }}
                  strokeLinejoin="round"
                  onMouseEnter={() => {
                    setHoveredKanwil(prov.kanwil);
                    setHoveredProvince(prov.name);
                  }}
                  onMouseLeave={() => {
                    setHoveredKanwil(null);
                    setHoveredProvince(null);
                  }}
                  onClick={() => handleSelectKanwil(prov.kanwil)}
                >
                  <title>{`${prov.name} — ${prov.kanwil}`}</title>
                </path>
              );
            })}
          </g>

          {/* Garis koordinasi: tipis putus-putus ke semua wilayah, tegas ke wilayah aktif */}
          <g pointerEvents="none" fill="none" strokeLinecap="round">
            {viewMode === "all" &&
              backboneArcs
                .filter((a) => a.code !== activeKanwil.code)
                .map((arc) => (
                <path
                  key={arc.code}
                  d={arc.d}
                  stroke={BRAND}
                  strokeOpacity={0.22}
                  strokeWidth={1 * u}
                  strokeDasharray={`${2 * u} ${4 * u}`}
                />
              ))}
            {activeArc && (
              <path
                key={`active-arc-${activeKanwil.code}`}
                d={activeArc.d}
                pathLength="1"
                stroke={BRAND}
                strokeWidth={1.6 * u}
                className="lp-map-arc-draw"
              />
            )}
          </g>

          {/* Titik kota di wilayah lain: noktah ungu kecil */}
          <g>
            {inactiveCities.map((city) => {
              const isHovered = hoveredCityName === city.name;
              return (
                <g
                  key={city.name}
                  className="cursor-pointer"
                  onMouseEnter={() => {
                    setHoveredCityName(city.name);
                    setHoveredKanwil(city.kanwil);
                  }}
                  onMouseLeave={() => {
                    setHoveredCityName(null);
                    setHoveredKanwil(null);
                  }}
                  onClick={() => handleCityPinClick(city)}
                >
                  <circle cx={city.x} cy={city.y} r={9 * u} fill="transparent" />
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={(isHovered ? 4 : 2.6) * u}
                    fill={BRAND}
                    fillOpacity={isHovered ? 0.9 : 0.55}
                  />
                </g>
              );
            })}
          </g>

          {/* Titik kota wilayah aktif: penanda putih-hijau dengan gelombang tenang */}
          <g key={`pins-${activeKanwil.code}`}>
            {activeCities.map((city, idx) => {
              const isHovered = hoveredCityName === city.name;
              const offset = getLabelOffset(city.labelPos, u);
              return (
                <g
                  key={city.name}
                  data-testid={`map-pin-${city.name.toLowerCase().replace(/\s+/g, "-")}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredCityName(city.name)}
                  onMouseLeave={() => setHoveredCityName(null)}
                  onClick={() => handleCityPinClick(city)}
                >
                  <circle cx={city.x} cy={city.y} r={12 * u} fill="transparent" />
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={5 * u}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeOpacity={0.9}
                    strokeWidth={1.2 * u}
                    className="lp-map-ripple"
                    style={{ animationDelay: `${idx * 420}ms` }}
                  />
                  <g className="lp-map-pin-pop" style={{ animationDelay: `${idx * 70}ms` }}>
                    <circle
                      cx={city.x}
                      cy={city.y}
                      r={(isHovered ? 6.5 : 5.2) * u}
                      fill="#FFFFFF"
                      stroke={BRAND}
                      strokeWidth={1 * u}
                    />
                    <circle cx={city.x} cy={city.y} r={2.4 * u} fill={GREEN} />
                  </g>
                  {(showIndividualLabels || isHovered) && (
                    <text
                      x={city.x + offset.dx}
                      y={city.y + offset.dy}
                      textAnchor={offset.anchor}
                      fill={INK}
                      stroke="#FFFFFF"
                      strokeWidth={3.5 * u}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      fontSize={12 * u}
                      fontWeight="600"
                      className="pointer-events-none"
                    >
                      {city.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Label ringkas bila kota terlalu rapat untuk diberi nama satu per satu */}
            {!showIndividualLabels && !hoveredCityObj && (
              <text
                x={activeCentroid.x}
                y={groupLabelY}
                textAnchor="middle"
                fill={BRAND}
                stroke="#FFFFFF"
                strokeWidth={3.5 * u}
                strokeLinejoin="round"
                paintOrder="stroke"
                fontSize={12.5 * u}
                fontWeight="700"
                pointerEvents="none"
              >
                {`${KANWIL_SHORT_NAMES[activeKanwil.code] || activeKanwil.name} · ${activeCities.length} kota`}
              </text>
            )}
          </g>
        </svg>
      </div>

      <p className="mt-2 min-h-[20px] text-[12.5px] text-[#475569]" aria-live="polite">
        {hintText}
      </p>

      {/* DAFTAR KOTA WILAYAH AKTIF — BARIS BERGARIS TIPIS (SERAGAM DENGAN FAQ & NILAI PRIMA) */}
      <div
        className={`mt-6 grid grid-cols-1 gap-x-8 sm:grid-cols-2 ${
          activeKanwil.branches.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"
        }`}
      >
        {activeKanwil.branches.map((branchName) => {
          const isHighlighted = hoveredCityName === branchName;
          const isCenter = branchName === "PUSAT JAKARTA";
          const isKenOffice = branchName === "PEMATANGSIANTAR";
          return (
            <button
              key={branchName}
              type="button"
              onMouseEnter={() => setHoveredCityName(branchName)}
              onMouseLeave={() => setHoveredCityName(null)}
              onClick={() => onSelectCity(branchName)}
              className={`group flex items-center justify-between gap-3 border-t-2 py-3.5 text-left transition-colors ${
                isHighlighted ? "border-[#351080]" : "border-[#17223B]/10 hover:border-[#351080]"
              }`}
            >
              <div className="min-w-0">
                <div
                  className={`font-display text-[15.5px] font-bold leading-snug transition-colors ${
                    isHighlighted ? "text-[#351080]" : "text-[#17223B] group-hover:text-[#351080]"
                  }`}
                >
                  {formatBranchTitle(branchName)}
                </div>
                <div className="mt-0.5 text-[12.5px] text-[#475569]">
                  {isKenOffice
                    ? "Kantor PT KEN & cabang"
                    : isCenter
                      ? "Koordinator pusat"
                      : "Konsultasi tatap muka"}
                </div>
              </div>
              <ArrowRight
                className={`h-4 w-4 shrink-0 text-[#351080] transition-all ${
                  isHighlighted
                    ? "translate-x-0.5 opacity-100"
                    : "opacity-40 group-hover:translate-x-0.5 group-hover:opacity-100"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#17223B]/10 pt-4 text-[13px] text-[#17223B]/65">
        <span>
          Jam layanan: <strong className="text-[#17223B]">{operationalHours}</strong>
        </span>
        <button
          type="button"
          onClick={onStartSimulation}
          className="font-bold text-[#078D67] hover:underline"
        >
          Atau hitung simulasi dana dulu →
        </button>
      </div>
    </div>
  );
}
