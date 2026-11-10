import type { Preset } from "../data/presets";

/* -------------------------------------------------------------------------- */
/* PRESET TILE ARTWORK                                                        */
/* -------------------------------------------------------------------------- */

interface PresetTileArtworkProps {
  preset: Preset;
  index: number;
}

export function PresetTileArtwork({ preset, index }: PresetTileArtworkProps) {
  const cat = preset.category?.toLowerCase() ?? "";
  let variant = index % 6;
  if (cat.includes("reference") || cat.includes("measurement")) variant = 0;
  else if (cat.includes("music") || cat.includes("popular")) variant = 1;
  else if (cat.includes("voice") || cat.includes("tone")) variant = 2;
  else if (cat.includes("device") || cat.includes("kefine")) variant = 3;
  else if (cat.includes("my")) variant = 4;

  return (
    <div className={`preset-card-artwork variant-${variant}`} aria-hidden="true">
      {variant === 0 && (
        <svg viewBox="0 0 72 72" fill="none">
          <circle cx="36" cy="22" r="12" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
          <path d="M6 62 L26 32 L38 48 L50 24 L66 62 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M50 24 L50 62" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M26 32 L30 62" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M44 36 L50 24 L56 34 L50 32 Z" fill="currentColor" fillOpacity="0.2" />
        </svg>
      )}
      {variant === 1 && (
        <svg viewBox="0 0 72 72" fill="none">
          <path d="M14 62 C24 50 36 34 50 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M50 14 C42 16 34 26 40 36 C48 44 58 38 60 26 C62 16 54 12 50 14 Z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="50" cy="26" r="6" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="50" cy="26" r="2.5" fill="currentColor" />
          <path d="M38 32 C30 36 24 44 26 50" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M42 26 C36 28 30 34 32 40" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M54 28 C58 34 60 42 56 46" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
        </svg>
      )}
      {variant === 2 && (
        <svg viewBox="0 0 72 72" fill="none">
          <path d="M36 12 C30 26 28 40 36 54 C44 40 42 26 36 12 Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
          <path d="M32 26 C18 28 12 38 18 48 C26 50 32 46 34 40" stroke="currentColor" strokeWidth="1.4" />
          <path d="M40 26 C54 28 60 38 54 48 C46 50 40 46 38 40" stroke="currentColor" strokeWidth="1.4" />
          <path d="M18 42 C8 44 6 52 12 56 C20 56 26 52 30 48" stroke="currentColor" strokeWidth="1.2" />
          <path d="M54 42 C64 44 66 52 60 56 C52 56 46 52 42 48" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 60 Q36 66 64 60" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 3" />
        </svg>
      )}
      {variant === 3 && (
        <svg viewBox="0 0 72 72" fill="none">
          <path d="M16 58 L16 42 C16 34 20 28 28 26 C36 24 44 24 50 26 C58 28 62 34 62 42 L62 58 M30 58 L30 46 M50 58 L50 46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M50 26 C56 20 66 22 70 28 C74 34 74 42 70 46 C66 48 62 44 63 40 C64 34 60 32 56 33 L54 44 L54 58" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M28 29 Q40 35 52 29 L50 42 Q40 47 30 42 Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15" />
          <path d="M50 27 C56 27 58 35 54 41 C50 44 46 42 46 36 C46 30 48 27 50 27 Z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      )}
      {variant === 4 && (
        <svg viewBox="0 0 72 72" fill="none">
          <path d="M8 44 L22 56 L50 56 L64 44 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <path d="M22 44 L36 18 L50 44 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M36 18 L36 56" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
          <path d="M4 60 Q18 55 34 60 T68 58" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      )}
      {variant === 5 && (
        <svg viewBox="0 0 72 72" fill="none">
          <path d="M36 8 C32 20 12 28 12 44 C12 58 24 64 36 66 C48 64 60 58 60 44 C60 28 40 20 36 8 Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" />
          <path d="M36 12 L36 65" stroke="currentColor" strokeWidth="1.2" />
          <path d="M36 30 Q22 35 20 42" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M36 30 Q50 35 52 42" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M36 44 Q24 48 22 54" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
          <path d="M36 44 Q48 48 50 54" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
        </svg>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* BAND CARD ARTWORK (Classic vector stamps)                                  */
/* -------------------------------------------------------------------------- */

interface BandCardArtworkProps {
  bandIndex: number;
}

export function BandCardArtwork({ bandIndex }: BandCardArtworkProps) {
  return (
    <div className={`band-card-artwork band-${bandIndex + 1}`} aria-hidden="true">
      {bandIndex === 0 && (
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M24 6 C20 16 18 26 24 38 C30 26 28 16 24 6 Z" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.16" />
          <path d="M22 16 C12 18 8 26 12 32 C18 34 22 30 23 26" stroke="currentColor" strokeWidth="1.1" />
          <path d="M26 16 C36 18 40 26 36 32 C30 34 26 30 25 26" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      )}
      {bandIndex === 1 && (
        <svg viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2.5 3" />
          <circle cx="24" cy="24" r="11" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2.5" />
          <circle cx="24" cy="24" r="5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.2" />
        </svg>
      )}
      {bandIndex === 2 && (
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M24 6 C22 14 10 18 10 28 C10 38 18 42 24 43 C30 42 38 38 38 28 C38 18 26 14 24 6 Z" stroke="currentColor" strokeWidth="1.3" fill="currentColor" fillOpacity="0.14" />
          <path d="M24 8 L24 42" stroke="currentColor" strokeWidth="1" />
          <path d="M24 20 Q16 24 15 28" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 2" />
          <path d="M24 20 Q32 24 33 28" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2 2" />
        </svg>
      )}
      {bandIndex === 3 && (
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M12 40 C18 32 26 22 34 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M34 10 C28 12 22 18 26 26 C32 32 40 28 41 20 C42 12 36 10 34 10 Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15" />
          <circle cx="34" cy="18" r="4" stroke="currentColor" strokeWidth="1" />
          <circle cx="34" cy="18" r="1.8" fill="currentColor" />
        </svg>
      )}
      {bandIndex === 4 && (
        <svg viewBox="0 0 48 48" fill="none">
          <path d="M6 30 L16 38 L32 38 L42 30 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.14" />
          <path d="M16 30 L24 14 L32 30 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M24 14 L24 38" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="38" cy="12" r="3" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
        </svg>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DAC STAMP ARTWORK                                                          */
/* -------------------------------------------------------------------------- */

export function DacStampArtwork() {
  return (
    <div className="dac-stamp-artwork" aria-hidden="true">
      <svg viewBox="0 0 64 64" fill="none">
        <rect x="6" y="6" width="52" height="52" rx="4" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 2" />
        <circle cx="32" cy="32" r="18" stroke="currentColor" strokeWidth="1.2" />
        <path d="M18 42 L28 26 L36 36 L44 22 L50 42 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <circle cx="24" cy="22" r="3" fill="currentColor" fillOpacity="0.4" />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAPEIN ORNAMENTAL BRAND CARTOUCHE BADGE ("IZER")                           */
/* -------------------------------------------------------------------------- */

export function PapeinBrandBadge() {
  return (
    <div className="papein-brand-cartouche" aria-label="IZER brand mark">
      {/* Intricate Indian Scalloped Arch Frame */}
      <svg className="cartouche-svg" viewBox="0 0 200 58" preserveAspectRatio="none">
        <defs>
          <filter id="papein-badge-shadow" x="-10%" y="-15%" width="120%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#402719" floodOpacity="0.25" />
          </filter>
          <linearGradient id="papein-badge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbf3e4" />
            <stop offset="50%" stopColor="#f5e0be" />
            <stop offset="100%" stopColor="#edd0a4" />
          </linearGradient>
          <linearGradient id="papein-filigree-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#b94b35" />
            <stop offset="50%" stopColor="#d99425" />
            <stop offset="100%" stopColor="#b94b35" />
          </linearGradient>
        </defs>

        {/* Base Cartouche Paper Plate */}
        <path
          d="M 24 6 
             C 42 6, 60 2, 100 2 
             C 140 2, 158 6, 176 6 
             C 192 6, 196 16, 196 29 
             C 196 42, 192 52, 176 52 
             C 158 52, 140 56, 100 56 
             C 60 56, 42 52, 24 52 
             C 8 52, 4 42, 4 29 
             C 4 16, 8 6, 24 6 Z"
          fill="url(#papein-badge-grad)"
          stroke="#935b36"
          strokeWidth="1.6"
          filter="url(#papein-badge-shadow)"
        />

        {/* Decorative Scalloped Inner Arch & Filigree Border */}
        <path
          d="M 28 10 
             C 44 10, 62 7, 100 7 
             C 138 7, 156 10, 172 10 
             C 186 10, 190 18, 190 29 
             C 190 40, 186 48, 172 48 
             C 156 48, 138 51, 100 51 
             C 62 51, 44 48, 28 48 
             C 14 48, 10 40, 10 29 
             C 10 18, 14 10, 28 10 Z"
          fill="none"
          stroke="url(#papein-filigree-grad)"
          strokeWidth="1.2"
          strokeDasharray="4 2.5"
        />

        {/* Traditional Floral Corner Flourishes */}
        <g stroke="#b94b35" strokeWidth="1" fill="none" opacity="0.85">
          <circle cx="16" cy="29" r="2.5" fill="#b94b35" />
          <path d="M 12 24 Q 16 29 12 34" />
          <circle cx="184" cy="29" r="2.5" fill="#b94b35" />
          <path d="M 188 24 Q 184 29 188 34" />
          {/* Top & Bottom Crest Dots */}
          <circle cx="100" cy="5" r="1.8" fill="#d99425" />
          <circle cx="100" cy="53" r="1.8" fill="#d99425" />
        </g>
      </svg>

      {/* Cartouche Inner Contents: Audio Wave & Wordmark "IZER" */}
      <div className="cartouche-content">
        <svg className="cartouche-wave" viewBox="0 0 32 18" fill="none" aria-hidden="true">
          <path
            d="M 2 9 L 6 9 L 9 3 L 13 15 L 17 6 L 21 12 L 24 9 L 30 9"
            stroke="#402719"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="cartouche-title">IZER</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAPEIN BAND CARD ORNAMENTS (Indian motifs for the 5 EQ Band cards)         */
/* -------------------------------------------------------------------------- */

interface PapeinCardOrnamentProps {
  bandIndex: number;
}

export function PapeinCardOrnament({ bandIndex }: PapeinCardOrnamentProps) {
  return (
    <div className={`papein-band-ornament papein-ornament-band-${bandIndex + 1}`} aria-hidden="true">
      {bandIndex === 0 && (
        /* Band 1 (Rose): Intricate Scalloped Jali Arch & Floral Lace Trim */
        <div className="card-decor card-decor-jali">
          <svg className="decor-svg decor-jali-arch" viewBox="0 0 90 64" fill="none" opacity="0.35">
            <path
              d="M 10 58 L 10 36 C 10 24 24 16 45 16 C 66 16 80 24 80 36 L 80 58"
              stroke="#b94b35"
              strokeWidth="1.2"
            />
            <path
              d="M 18 58 L 18 38 C 18 28 30 22 45 22 C 60 22 72 28 72 38 L 72 58"
              stroke="#b94b35"
              strokeWidth="0.9"
              strokeDasharray="3 2"
            />
            <circle cx="45" cy="34" r="6" stroke="#b94b35" strokeWidth="0.9" />
            <circle cx="45" cy="34" r="2" fill="#b94b35" />
          </svg>
          <svg className="decor-trim" viewBox="0 0 160 28" fill="none">
            <path
              d="M 0 24 Q 20 8 40 24 T 80 24 T 120 24 T 160 24"
              stroke="rgba(185, 75, 53, 0.45)"
              strokeWidth="1.4"
            />
            <path
              d="M 10 24 Q 25 14 40 24 T 70 24 T 100 24 T 130 24 T 160 24"
              stroke="rgba(185, 75, 53, 0.25)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          </svg>
        </div>
      )}

      {bandIndex === 1 && (
        /* Band 2 (Saffron): South Indian Temple Gopuram / Chhatri Silhouette */
        <div className="card-decor card-decor-temple">
          <svg className="decor-svg decor-gopuram" viewBox="0 0 76 64" fill="none">
            {/* Temple Gopuram Silhouette */}
            <path
              d="M 18 58 L 22 42 L 20 42 L 24 30 L 22 30 L 26 20 L 25 20 L 29 12 L 29 6 L 31 6 L 31 3 L 33 3 L 33 6 L 35 6 L 35 12 L 39 20 L 38 20 L 42 30 L 40 30 L 44 42 L 42 42 L 46 58 Z"
              fill="rgba(217, 148, 37, 0.22)"
              stroke="rgba(217, 148, 37, 0.75)"
              strokeWidth="1.2"
            />
            <line x1="22" y1="42" x2="42" y2="42" stroke="rgba(217, 148, 37, 0.7)" strokeWidth="1" />
            <line x1="24" y1="30" x2="40" y2="30" stroke="rgba(217, 148, 37, 0.7)" strokeWidth="1" />
            <line x1="26" y1="20" x2="38" y2="20" stroke="rgba(217, 148, 37, 0.7)" strokeWidth="1" />
            <circle cx="32" cy="49" r="3.5" fill="none" stroke="rgba(217, 148, 37, 0.7)" strokeWidth="1" />
            {/* Small Palm Tree Silhouette */}
            <path d="M 54 58 Q 57 44 60 34" stroke="rgba(217, 148, 37, 0.65)" strokeWidth="1.5" />
            <path d="M 60 34 Q 50 30 46 36" stroke="rgba(217, 148, 37, 0.65)" strokeWidth="1.2" />
            <path d="M 60 34 Q 56 22 50 24" stroke="rgba(217, 148, 37, 0.65)" strokeWidth="1.2" />
            <path d="M 60 34 Q 66 22 72 26" stroke="rgba(217, 148, 37, 0.65)" strokeWidth="1.2" />
            <path d="M 60 34 Q 68 32 74 38" stroke="rgba(217, 148, 37, 0.65)" strokeWidth="1.2" />
          </svg>
          <svg className="decor-trim" viewBox="0 0 160 28" fill="none">
            <path
              d="M 0 24 Q 20 10 40 24 T 80 24 T 120 24 T 160 24"
              stroke="rgba(217, 148, 37, 0.45)"
              strokeWidth="1.4"
            />
          </svg>
        </div>
      )}

      {bandIndex === 2 && (
        /* Band 3 (Botanical Green): Papercut Jali Arch + Tropical Banana Fronds */
        <div className="card-decor card-decor-botanical">
          <svg className="decor-svg decor-banana-leaves" viewBox="0 0 80 64" fill="none">
            {/* Banana / Palm Fronds */}
            <path
              d="M 12 58 C 16 42 28 28 42 22 C 34 32 30 46 28 58"
              fill="rgba(71, 123, 77, 0.2)"
              stroke="rgba(71, 123, 77, 0.75)"
              strokeWidth="1.2"
            />
            <path
              d="M 28 58 C 34 38 48 24 64 18 C 54 30 50 46 48 58"
              fill="rgba(71, 123, 77, 0.15)"
              stroke="rgba(71, 123, 77, 0.65)"
              strokeWidth="1.2"
            />
            <path d="M 14 58 L 42 22" stroke="rgba(71, 123, 77, 0.75)" strokeWidth="1" strokeDasharray="3 3" />
            <path d="M 30 58 L 64 18" stroke="rgba(71, 123, 77, 0.65)" strokeWidth="1" strokeDasharray="3 3" />
          </svg>
          <svg className="decor-trim" viewBox="0 0 160 28" fill="none">
            <path
              d="M 0 24 C 20 12, 30 12, 40 24 C 60 12, 70 12, 80 24 C 100 12, 110 12, 120 24 C 140 12, 150 12, 160 24"
              stroke="rgba(71, 123, 77, 0.5)"
              strokeWidth="1.4"
            />
          </svg>
        </div>
      )}

      {bandIndex === 3 && (
        /* Band 4 (Godavari Teal / Coastal): Coastal Waves & Paper Boat */
        <div className="card-decor card-decor-waves">
          <svg className="decor-svg decor-waves-boat" viewBox="0 0 90 64" fill="none">
            {/* Paper Boat */}
            <path
              d="M 16 38 L 28 50 L 52 50 L 64 38 Z"
              fill="rgba(242, 222, 192, 0.85)"
              stroke="rgba(39, 139, 145, 0.75)"
              strokeWidth="1.2"
            />
            <path
              d="M 28 38 L 40 18 L 52 38 Z"
              fill="rgba(255, 247, 235, 0.9)"
              stroke="rgba(39, 139, 145, 0.75)"
              strokeWidth="1.2"
            />
            <line x1="40" y1="18" x2="40" y2="50" stroke="rgba(39, 139, 145, 0.65)" strokeWidth="1" strokeDasharray="2 2" />
            {/* Coastal Waves */}
            <path
              d="M 4 52 Q 22 46 40 52 T 76 52 T 90 50"
              stroke="rgba(39, 139, 145, 0.7)"
              strokeWidth="1.4"
            />
            <path
              d="M 10 58 Q 30 52 50 58 T 88 56"
              stroke="rgba(39, 139, 145, 0.45)"
              strokeWidth="1.1"
              strokeDasharray="4 2"
            />
          </svg>
          <svg className="decor-trim" viewBox="0 0 160 28" fill="none">
            <path
              d="M 0 24 Q 20 8 40 24 T 80 24 T 120 24 T 160 24"
              stroke="rgba(39, 139, 145, 0.45)"
              strokeWidth="1.4"
            />
          </svg>
        </div>
      )}

      {bandIndex === 4 && (
        /* Band 5 (Lotus Pink): Coastal Temple Tower / Chhatri & Lotus Watermark */
        <div className="card-decor card-decor-chhatri">
          <svg className="decor-svg decor-coastal-tower" viewBox="0 0 80 64" fill="none" opacity="0.32">
            {/* Chhatri Dome / Tower */}
            <path
              d="M 16 58 L 18 36 L 14 36 L 22 20 L 26 12 L 26 6 L 28 4 L 30 6 L 30 12 L 34 20 L 42 36 L 38 36 L 40 58 Z"
              fill="rgba(167, 123, 198, 0.16)"
              stroke="#8e5da6"
              strokeWidth="1.2"
            />
            <line x1="18" y1="36" x2="38" y2="36" stroke="#8e5da6" strokeWidth="1" />
            <circle cx="28" cy="46" r="3" fill="none" stroke="#8e5da6" strokeWidth="1" />
            {/* Lotus Blossom Silhouette */}
            <path
              d="M 52 58 C 48 50 48 44 54 40 C 60 44 60 50 56 58"
              fill="rgba(167, 123, 198, 0.22)"
              stroke="#8e5da6"
              strokeWidth="1.1"
            />
            <path
              d="M 54 40 C 58 34 66 38 64 48 C 60 54 58 58 56 58"
              fill="rgba(167, 123, 198, 0.15)"
              stroke="#8e5da6"
              strokeWidth="1"
            />
            <path
              d="M 54 40 C 50 34 42 38 44 48 C 48 54 50 58 52 58"
              fill="rgba(167, 123, 198, 0.15)"
              stroke="#8e5da6"
              strokeWidth="1"
            />
          </svg>
          <svg className="decor-trim" viewBox="0 0 160 28" fill="none">
            <path
              d="M 0 24 Q 20 10 40 24 T 80 24 T 120 24 T 160 24"
              stroke="rgba(167, 123, 198, 0.45)"
              strokeWidth="1.4"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PAPEIN ENVIRONMENTAL BACKGROUND SYSTEM                                     */
/* -------------------------------------------------------------------------- */

export function PapeinEnvironment() {
  const landscapeSrc = new URL("../assets/themes/papein/backgrounds/himalayan-to-godavari-landscape.webp", import.meta.url).href;
  const peacockSrc = new URL("../assets/themes/papein/illustrations/peacock.png", import.meta.url).href;
  const elephantSrc = new URL("../assets/themes/papein/illustrations/elephant.png", import.meta.url).href;
  const lotusSrc = new URL("../assets/themes/papein/illustrations/lotus.png", import.meta.url).href;
  const chinarSrc = new URL("../assets/themes/papein/illustrations/chinar-leaves.png", import.meta.url).href;

  return (
    <div className="papein-environment" aria-hidden="true">
      {/* Layer 0: Handcrafted Paper Texture Fiber Filter */}
      <svg className="papein-texture-sheet" width="100%" height="100%">
        <filter id="papein-paper-fiber" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.18  0.07 0.07 0.07 0 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#papein-paper-fiber)" />
      </svg>

      {/* Layer 1: Himalayan to Godavari Panoramic Landscape */}
      <div className="papein-landscape-backdrop">
        <img
          src={landscapeSrc}
          alt=""
          className="papein-landscape-img"
        />
      </div>

      {/* Layer 2: Independent Floating Illustrations & Indian Filigree Borders */}
      <div className="papein-floating-illustrations">
        {/* Left Ornate Indian Jharokha Filigree Border */}
        <div className="papein-side-border side-border-left">
          <svg viewBox="0 0 44 800" preserveAspectRatio="none" className="side-border-svg">
            <defs>
              <pattern id="jharokha-pattern-left" width="44" height="80" patternUnits="userSpaceOnUse">
                {/* Scalloped Arch & Rosette */}
                <path
                  d="M 0 0 L 12 0 C 12 12, 28 20, 28 40 C 28 60, 12 68, 12 80 L 0 80 Z"
                  fill="rgba(245, 224, 190, 0.88)"
                  stroke="#b94b35"
                  strokeWidth="1.2"
                />
                <path
                  d="M 0 10 L 8 10 C 8 20, 22 28, 22 40 C 22 52, 8 60, 8 70 L 0 70 Z"
                  fill="rgba(231, 199, 154, 0.7)"
                  stroke="#d99425"
                  strokeWidth="0.9"
                  strokeDasharray="3 2"
                />
                <circle cx="16" cy="40" r="3.5" fill="#b94b35" opacity="0.85" />
                <circle cx="16" cy="40" r="1.5" fill="#fdfaf3" />
                <circle cx="8" cy="24" r="1.8" fill="#d99425" />
                <circle cx="8" cy="56" r="1.8" fill="#d99425" />
              </pattern>
            </defs>
            <rect width="44" height="800" fill="url(#jharokha-pattern-left)" />
          </svg>
        </div>

        {/* Right Ornate Indian Jharokha Filigree Border */}
        <div className="papein-side-border side-border-right">
          <svg viewBox="0 0 44 800" preserveAspectRatio="none" className="side-border-svg">
            <defs>
              <pattern id="jharokha-pattern-right" width="44" height="80" patternUnits="userSpaceOnUse">
                {/* Scalloped Arch & Rosette (Flipped) */}
                <path
                  d="M 44 0 L 32 0 C 32 12, 16 20, 16 40 C 16 60, 32 68, 32 80 L 44 80 Z"
                  fill="rgba(245, 224, 190, 0.88)"
                  stroke="#b94b35"
                  strokeWidth="1.2"
                />
                <path
                  d="M 44 10 L 36 10 C 36 20, 22 28, 22 40 C 22 52, 36 60, 36 70 L 44 70 Z"
                  fill="rgba(231, 199, 154, 0.7)"
                  stroke="#d99425"
                  strokeWidth="0.9"
                  strokeDasharray="3 2"
                />
                <circle cx="28" cy="40" r="3.5" fill="#b94b35" opacity="0.85" />
                <circle cx="28" cy="40" r="1.5" fill="#fdfaf3" />
                <circle cx="36" cy="24" r="1.8" fill="#d99425" />
                <circle cx="36" cy="56" r="1.8" fill="#d99425" />
              </pattern>
            </defs>
            <rect width="44" height="800" fill="url(#jharokha-pattern-right)" />
          </svg>
        </div>

        {/* Autumn Chinar Leaves - Top Left */}
        <div className="floating-chinar-tl">
          <img src={chinarSrc} alt="" className="floating-img chinar-img" />
        </div>

        {/* Autumn Chinar Leaves - Top Right (Mirrored) */}
        <div className="floating-chinar-tr">
          <img src={chinarSrc} alt="" className="floating-img chinar-img chinar-flipped" />
        </div>

        {/* Royal Indian Elephant - Bottom Left */}
        <div className="floating-elephant-bl">
          <img src={elephantSrc} alt="" className="floating-img elephant-img" />
        </div>

        {/* Royal Indian Peacock - Bottom Right */}
        <div className="floating-peacock-br">
          <img src={peacockSrc} alt="" className="floating-img peacock-img" />
        </div>

        {/* Blooming Sacred Lotus - Bottom Center Waves */}
        <div className="floating-lotus-center">
          <img src={lotusSrc} alt="" className="floating-img lotus-img" />
        </div>
      </div>

      {/* Layer 3: Ambient Paper Sheen Overlay */}
      <div className="papein-ambient-sheen" />
    </div>
  );
}
