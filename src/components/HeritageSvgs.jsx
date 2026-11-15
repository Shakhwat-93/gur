import React from 'react';

/**
 * 1. Hero Saffron Sunburst
 * Radiating sun rays SVG in --accent / --accent-soft
 */
export function HeroSunburst({ className = '' }) {
  const rays = 24;
  const angleStep = 360 / rays;
  return (
    <svg
      viewBox="0 0 400 400"
      className={`hero-sunburst-svg ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="200" cy="200" r="160" fill="url(#sunGlow)" opacity="0.45" />
      <g stroke="#E9A23B" strokeWidth="2.5" strokeOpacity="0.45" strokeLinecap="round">
        {Array.from({ length: rays }).map((_, i) => {
          const angle = (i * angleStep * Math.PI) / 180;
          const x1 = 200 + Math.cos(angle) * 70;
          const y1 = 200 + Math.sin(angle) * 70;
          const x2 = 200 + Math.cos(angle) * (i % 2 === 0 ? 175 : 145);
          const y2 = 200 + Math.sin(angle) * (i % 2 === 0 ? 175 : 145);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <circle cx="200" cy="200" r="65" fill="#F6D9A8" fillOpacity="0.3" stroke="#E9A23B" strokeWidth="1.5" strokeDasharray="3 3" />
      <defs>
        <radialGradient id="sunGlow" cx="200" cy="200" r="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9A23B" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#F6D9A8" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#FBF5EC" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/**
 * 2. Menu Heritage Illustration ("আজকের মেনু")
 * Rural Bengal date-palm scene in deep red line art (#B8231C)
 * - Date-palm tree with hanging clay pot (হাঁড়ি)
 * - Tree trunk climb notches (গাছির খাঁজ)
 * - Traditional clay pots (রস ও গুড়ের কলস)
 * - Traditional balance scale (দাঁড়িপাল্লা)
 * - Flying birds, rural horizon & morning sun
 */
export function MenuHeritageIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 440 320"
      className={`heritage-illustration-svg ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background Soft Sun */}
      <circle cx="290" cy="90" r="42" fill="#F6D9A8" fillOpacity="0.45" stroke="#E9A23B" strokeWidth="1.2" strokeDasharray="4 3" />
      
      {/* Flying Birds */}
      <path d="M120 50 Q130 42 140 50 Q150 42 160 50" stroke="#B8231C" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M150 65 Q158 58 166 65 Q174 58 182 65" stroke="#B8231C" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M190 45 Q196 40 202 45 Q208 40 214 45" stroke="#B8231C" strokeWidth="1.2" strokeLinecap="round" />

      {/* Gentle Distant Rural Landscape / Rice Bunds */}
      <path d="M10 260 Q110 245 220 255 T430 250" stroke="#B8231C" strokeWidth="1.2" strokeOpacity="0.6" strokeDasharray="6 4" />
      <path d="M0 280 C80 270 170 282 260 272 C340 265 390 275 440 270" stroke="#B8231C" strokeWidth="1.5" strokeLinecap="round" />

      {/* Date Palm Tree (Left foreground) */}
      {/* Trunk with bark pattern & climber notches */}
      <path d="M85 285 Q75 180 82 110 Q85 95 90 90" stroke="#B8231C" strokeWidth="3" strokeLinecap="round" />
      <path d="M98 285 Q88 180 92 110 Q94 95 97 90" stroke="#B8231C" strokeWidth="2" strokeLinecap="round" />
      
      {/* Bark notches */}
      {[130, 150, 170, 190, 210, 230, 250, 270].map((y, i) => (
        <line
          key={i}
          x1={78 + (i % 2) * 2}
          y1={y}
          x2={94 - (i % 2) * 2}
          y2={y - 3}
          stroke="#B8231C"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}

      {/* Palm Fronds (পাতার ঝিলমিল) */}
      <g stroke="#B8231C" strokeWidth="1.8" strokeLinecap="round">
        <path d="M88 90 Q60 60 25 70" />
        <path d="M88 90 Q70 40 45 35" />
        <path d="M88 90 Q90 30 95 20" />
        <path d="M88 90 Q115 35 135 38" />
        <path d="M88 90 Q130 55 155 65" />
        <path d="M88 90 Q110 80 145 95" />
        <path d="M88 90 Q75 85 40 100" />
      </g>
      {/* Frond leaves fringe */}
      <g stroke="#B8231C" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.8">
        <path d="M30 68 L28 78 M42 64 L40 76 M56 64 L54 75 M70 70 L68 80" />
        <path d="M50 36 L44 45 M62 38 L58 48 M76 48 L74 58" />
        <path d="M102 24 L108 32 M114 36 L122 45 M125 50 L135 60" />
        <path d="M138 62 L148 72 M148 70 L156 80" />
      </g>

      {/* Hanging Clay Pot on Palm Tree (রসের হাঁড়ি) */}
      <path d="M82 112 Q82 124 88 126" stroke="#B8231C" strokeWidth="1.5" />
      {/* Hanging Rope */}
      <line x1="84" y1="106" x2="74" y2="124" stroke="#B8231C" strokeWidth="1.2" strokeDasharray="2 2" />
      {/* Clay Pot */}
      <path
        d="M66 126 C64 124 84 124 82 126 C85 134 85 142 74 144 C63 142 63 134 66 126 Z"
        fill="#FFFDF9"
        stroke="#B8231C"
        strokeWidth="1.6"
      />
      <ellipse cx="74" cy="126" rx="8" ry="2.2" fill="#E9A23B" fillOpacity="0.4" stroke="#B8231C" strokeWidth="1" />

      {/* Traditional Earthen Pots (মাটির কলস ও হাঁড়ি) on ground */}
      <g transform="translate(195, 230)">
        {/* Big Clay Kolosh */}
        <path
          d="M20 22 C12 20 6 36 10 46 C15 54 35 54 40 46 C44 36 38 20 30 22 Z"
          fill="#FFFDF9"
          stroke="#B8231C"
          strokeWidth="1.8"
        />
        <ellipse cx="25" cy="20" rx="9" ry="2.5" fill="#E9A23B" fillOpacity="0.3" stroke="#B8231C" strokeWidth="1.5" />
        <path d="M12 36 Q25 40 38 36" stroke="#B8231C" strokeWidth="1" strokeDasharray="2 2" />
        {/* Small Jhola Gur Pot next to it */}
        <path
          d="M48 30 C43 28 40 40 43 47 C46 52 58 52 61 47 C64 40 61 28 56 30 Z"
          fill="#FFFDF9"
          stroke="#B8231C"
          strokeWidth="1.6"
        />
        <ellipse cx="52" cy="29" rx="6.5" ry="2" fill="#E9A23B" fillOpacity="0.4" stroke="#B8231C" strokeWidth="1.3" />
      </g>

      {/* Traditional Weighing Scale (দাঁড়িপাল্লা - heritage symbol of fair trading) */}
      <g transform="translate(315, 175)">
        {/* Scale beam */}
        <line x1="10" y1="35" x2="80" y2="35" stroke="#B8231C" strokeWidth="2" strokeLinecap="round" />
        {/* Center handle */}
        <line x1="45" y1="20" x2="45" y2="35" stroke="#B8231C" strokeWidth="1.8" />
        <circle cx="45" cy="18" r="3.5" stroke="#B8231C" strokeWidth="1.5" />
        {/* Left pan ropes & pan */}
        <line x1="12" y1="35" x2="5" y2="60" stroke="#B8231C" strokeWidth="1" strokeDasharray="3 2" />
        <line x1="12" y1="35" x2="25" y2="60" stroke="#B8231C" strokeWidth="1" strokeDasharray="3 2" />
        <path d="M2 60 Q15 68 28 60 Z" fill="#F5ECDD" stroke="#B8231C" strokeWidth="1.5" />
        {/* Right pan ropes & pan with patali block */}
        <line x1="78" y1="35" x2="70" y2="60" stroke="#B8231C" strokeWidth="1" strokeDasharray="3 2" />
        <line x1="78" y1="35" x2="90" y2="60" stroke="#B8231C" strokeWidth="1" strokeDasharray="3 2" />
        <path d="M68 60 Q80 68 92 60 Z" fill="#F5ECDD" stroke="#B8231C" strokeWidth="1.5" />
        {/* Gur block inside pan */}
        <rect x="75" y="52" width="10" height="7" rx="1.5" fill="#B8231C" fillOpacity="0.8" />
      </g>

      {/* Wooden Table/Plank at the Bottom where real products sit */}
      <g transform="translate(30, 275)">
        <rect x="0" y="0" width="380" height="12" rx="2" fill="#F5ECDD" stroke="#B8231C" strokeWidth="1.8" />
        <line x1="10" y1="6" x2="370" y2="6" stroke="#B8231C" strokeWidth="0.8" strokeDasharray="8 6" />
        {/* Legs */}
        <line x1="45" y1="12" x2="40" y2="35" stroke="#B8231C" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="335" y1="12" x2="340" y2="35" stroke="#B8231C" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/**
 * 3. Delivery Heritage Illustration ("...আপনার ঘরে")
 * Village scene with cottage hut, palm trees, clay stove, and courier delivery van
 */
export function DeliveryHeritageIllustration({ className = '' }) {
  return (
    <svg
      viewBox="0 0 440 220"
      className={`delivery-illustration-svg ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Horizon line */}
      <path d="M0 185 C100 180 200 188 320 182 C380 180 410 185 440 184" stroke="#B8231C" strokeWidth="1.4" strokeLinecap="round" />

      {/* Rural Cottage Hut (কুঁড়েঘর) on left */}
      <g transform="translate(35, 100)">
        {/* Thatched roof (ছনের চালা) */}
        <path d="M-8 40 L45 8 L98 40 Z" fill="#F5ECDD" stroke="#B8231C" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M45 8 L45 40" stroke="#B8231C" strokeWidth="1" strokeDasharray="3 3" />
        {/* Thatch texture lines */}
        <line x1="12" y1="36" x2="25" y2="22" stroke="#B8231C" strokeWidth="1" />
        <line x1="78" y1="36" x2="65" y2="22" stroke="#B8231C" strokeWidth="1" />
        {/* Hut wall */}
        <rect x="5" y="40" width="80" height="42" fill="#FFFDF9" stroke="#B8231C" strokeWidth="1.8" />
        {/* Wooden door */}
        <path d="M35 48 Q45 44 55 48 L55 82 L35 82 Z" fill="#F5ECDD" stroke="#B8231C" strokeWidth="1.5" />
        <circle cx="51" cy="65" r="1.5" fill="#B8231C" />
      </g>

      {/* Clay Oven / Chula (চুলা) with gentle smoke */}
      <g className="oven-smoke-group" transform="translate(145, 142)">
        <path d="M5 38 Q18 20 30 38 Z" fill="#F5ECDD" stroke="#B8231C" strokeWidth="1.6" />
        {/* Smoke wisps */}
        <path className="smoke-path" d="M18 18 Q12 10 22 2 Q28 -4 20 -12" stroke="#B8231C" strokeWidth="1.2" strokeLinecap="round" strokeDasharray="4 3" strokeOpacity="0.7" />
      </g>

      {/* Distant palm tree behind cottage */}
      <g transform="translate(125, 60)">
        <path d="M12 90 Q8 40 10 0" stroke="#B8231C" strokeWidth="1.5" />
        <path d="M10 0 Q-15 -18 -30 -10 M10 0 Q-8 -26 0 -35 M10 0 Q18 -26 25 -28 M10 0 Q30 -12 40 2" stroke="#B8231C" strokeWidth="1.3" strokeLinecap="round" />
      </g>

      {/* Delivery Vehicle (Van / Parcel Runner) on right */}
      <g className="delivery-van-group" transform="translate(245, 120)">
        {/* Van Body */}
        <rect x="15" y="24" width="95" height="42" rx="4" fill="#FFFDF9" stroke="#B8231C" strokeWidth="1.8" />
        {/* Van Cab Front */}
        <path d="M110 38 L128 42 L132 66 L110 66 Z" fill="#FFFDF9" stroke="#B8231C" strokeWidth="1.8" strokeLinejoin="round" />
        {/* Cab Window */}
        <path d="M112 42 L124 45 L124 55 L112 55 Z" fill="#F6D9A8" stroke="#B8231C" strokeWidth="1.3" />
        {/* Wheels */}
        <circle cx="40" cy="66" r="11" fill="#FFFDF9" stroke="#B8231C" strokeWidth="2.2" />
        <circle cx="40" cy="66" r="4.5" fill="#B8231C" />
        <circle cx="106" cy="66" r="11" fill="#FFFDF9" stroke="#B8231C" strokeWidth="2.2" />
        <circle cx="106" cy="66" r="4.5" fill="#B8231C" />
        {/* Speed lines */}
        <line x1="0" y1="52" x2="10" y2="52" stroke="#B8231C" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="-8" y1="42" x2="6" y2="42" stroke="#B8231C" strokeWidth="1.2" strokeLinecap="round" />
        {/* Parcel box stamp on van */}
        <rect x="42" y="32" width="26" height="20" rx="2" fill="#F5ECDD" stroke="#B8231C" strokeWidth="1.2" />
        <line x1="55" y1="32" x2="55" y2="52" stroke="#B8231C" strokeWidth="1" />
        <line x1="42" y1="42" x2="68" y2="42" stroke="#B8231C" strokeWidth="1" />
        <circle cx="55" cy="42" r="2.5" fill="#E9A23B" />
      </g>
    </svg>
  );
}

/**
 * 4. Season Stamp Badge (".stamp")
 * Rotated -8°, red filled rounded rectangle with dashed inner border (white, 1px, 4px inset)
 */
export function SeasonStampBadge({ line1 = 'নতুন মৌসুমে', line2 = 'শীত ১৪৩১', className = '' }) {
  return (
    <div className={`stamp-badge ${className}`}>
      <span className="stamp-inner-border" />
      <span className="stamp-line1">{line1}</span>
      <span className="stamp-line2">{line2}</span>
    </div>
  );
}

/**
 * 5. Floral / Alpona Diamond Section Divider
 */
export function SectionDivider() {
  return (
    <div className="section-divider" aria-hidden="true">
      <span className="divider-line" />
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="divider-ornament">
        <path
          d="M14 2 L17 11 L26 14 L17 17 L14 26 L11 17 L2 14 L11 11 Z"
          fill="#FFFDF9"
          stroke="#B8231C"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="14" r="3" fill="#E9A23B" />
      </svg>
      <span className="divider-line" />
    </div>
  );
}

/**
 * 6. Circular Heritage Shop Seal / Stamp
 */
export function HeritageShopSeal({ brand = 'ম্যাংগো গার্ডেন', sub = 'খাঁটি খেজুর গুড়' }) {
  return (
    <div className="memo-shop-seal" aria-hidden="true">
      <svg width="96" height="96" viewBox="0 0 96 96" fill="none">
        <circle cx="48" cy="48" r="44" stroke="#B8231C" strokeWidth="2" strokeDasharray="4 2.5" />
        <circle cx="48" cy="48" r="38" stroke="#B8231C" strokeWidth="1" />
        {/* Curvature text paths */}
        <path id="sealCurveTop" d="M 16 48 A 32 32 0 0 1 80 48" fill="none" />
        <path id="sealCurveBottom" d="M 80 48 A 32 32 0 0 1 16 48" fill="none" />
        <text fill="#B8231C" fontSize="9" fontWeight="700" letterSpacing="0.8">
          <textPath href="#sealCurveTop" startOffset="50%" textAnchor="middle">
            {brand}
          </textPath>
        </text>
        <text fill="#B8231C" fontSize="7.5" fontWeight="600" letterSpacing="0.5">
          <textPath href="#sealCurveBottom" startOffset="50%" textAnchor="middle">
            ★ {sub} ★
          </textPath>
        </text>
        {/* Center Star / Leaf Emblem */}
        <circle cx="48" cy="48" r="14" fill="#FFFDF9" stroke="#B8231C" strokeWidth="1.2" />
        <path
          d="M48 40 L49.5 45.5 L55 46 L50.5 49.5 L52 55 L48 51.5 L44 55 L45.5 49.5 L41 46 L46.5 45.5 Z"
          fill="#B8231C"
        />
      </svg>
    </div>
  );
}

/**
 * 7. Scalloped / Wavy Top Edge for Heritage Footer
 */
export function WavyTopEdge() {
  return (
    <div className="wavy-footer-edge" aria-hidden="true">
      <svg viewBox="0 0 1200 24" preserveAspectRatio="none" fill="#B8231C">
        <path d="M0 24 C150 0 350 0 600 16 C850 32 1050 8 1200 24 L1200 24 L0 24 Z" />
      </svg>
    </div>
  );
}
