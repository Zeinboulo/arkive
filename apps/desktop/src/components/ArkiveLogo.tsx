import React from 'react';

interface ArkiveLogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  variant?: 'tile' | 'mark';
}

export const ArkiveLogo: React.FC<ArkiveLogoProps> = ({
  size = 24,
  className = '',
  withText = false,
  variant = 'tile',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className="shrink-0 drop-shadow-sm select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="arkive-bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#181615" />
            <stop offset="50%" stopColor="#100f0e" />
            <stop offset="100%" stopColor="#080706" />
          </linearGradient>

          <linearGradient id="arkive-rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff7a3d" stopOpacity="0.85" />
            <stop offset="25%" stopColor="#443e3a" stopOpacity="0.4" />
            <stop offset="75%" stopColor="#211e1b" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff5500" stopOpacity="0.5" />
          </linearGradient>

          <radialGradient id="arkive-emberGlow" cx="50%" cy="50%" r="52%">
            <stop offset="0%" stopColor="#ff6a20" stopOpacity="0.35" />
            <stop offset="45%" stopColor="#ff4400" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ff4400" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="arkive-leftPillar" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2c2825" />
            <stop offset="40%" stopColor="#1d1a17" />
            <stop offset="100%" stopColor="#13110f" />
          </linearGradient>

          <linearGradient id="arkive-leftRim" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff9955" />
            <stop offset="50%" stopColor="#ff6611" />
            <stop offset="100%" stopColor="#662200" />
          </linearGradient>

          <linearGradient id="arkive-rightPillar" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffba66" />
            <stop offset="30%" stopColor="#ff7a29" />
            <stop offset="75%" stopColor="#ea4405" />
            <stop offset="100%" stopColor="#ba2b00" />
          </linearGradient>

          <linearGradient id="arkive-crossbarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff8c3a" />
            <stop offset="30%" stopColor="#ffd5aa" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#ffd5aa" />
            <stop offset="100%" stopColor="#ff8c3a" />
          </linearGradient>

          <linearGradient id="arkive-diamondGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ffe0b2" />
            <stop offset="100%" stopColor="#ff6600" />
          </linearGradient>

          <radialGradient id="arkive-diamondGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff9944" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff6600" stopOpacity="0" />
          </radialGradient>
        </defs>

        {variant === 'tile' && (
          <>
            <rect width="512" height="512" rx="116" fill="url(#arkive-bgGrad)" />
            <rect
              x="2"
              y="2"
              width="508"
              height="508"
              rx="114"
              fill="none"
              stroke="url(#arkive-rimGrad)"
              strokeWidth="3.5"
            />
            <circle cx="256" cy="265" r="215" fill="url(#arkive-emberGlow)" />
            <path
              d="M 96 3 A 116 116 0 0 1 416 3"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              opacity="0.22"
            />
          </>
        )}

        {/* Monogram A Glyph */}
        <g>
          {/* Left Arm & Apex Half */}
          <path
            d="M 256 72 L 256 100 L 272 100 L 272 122 L 256 122 L 256 142 L 272 142 L 272 164 L 256 164 L 256 182 L 218 274 L 256 274 L 256 324 L 194 324 L 148 432 L 94 432 C 86 432 81 423 85 416 L 243 79 C 246 74 251 72 256 72 Z"
            fill="url(#arkive-leftPillar)"
            stroke="url(#arkive-leftRim)"
            strokeWidth="2.5"
          />

          {/* Right Arm & Apex Half */}
          <path
            d="M 256 72 L 256 80 L 240 80 L 240 102 L 256 102 L 256 124 L 240 124 L 240 146 L 256 146 L 256 166 L 240 166 L 240 182 L 256 182 L 294 274 L 256 274 L 256 324 L 318 324 L 364 432 L 418 432 C 426 432 431 423 427 416 L 269 79 C 266 74 261 72 256 72 Z"
            fill="url(#arkive-rightPillar)"
          />

          {/* Inner Apex Counter Hole */}
          <path d="M 256 182 L 294 274 L 218 274 Z" fill="#0d0c0b" />

          {/* Vault Core Glowing Diamond */}
          <g transform="translate(256, 236)">
            <circle cx="0" cy="0" r="28" fill="url(#arkive-diamondGlow)" />
            <polygon points="0,-16 13,0 0,16 -13,0" fill="url(#arkive-diamondGrad)" />
            <polygon points="0,-10 8,0 0,10 -8,0" fill="#ffffff" />
          </g>

          {/* Integrated Hydraulic Compression Crossbar */}
          <g>
            <polygon points="218,274 294,274 318,324 194,324" fill="url(#arkive-crossbarGrad)" />

            <g fill="#14110f">
              <polygon points="214,284 228,284 224,314 200,314" />
              <polygon points="234,284 246,284 243,314 231,314" />
              <rect x="251" y="278" width="10" height="42" rx="2" />
              <polygon points="266,284 278,284 281,314 269,314" />
              <polygon points="284,284 298,284 312,314 288,314" />
            </g>

            <circle cx="256" cy="299" r="3.5" fill="#ffffff" />
            <polygon points="256,288 260,299 256,310 252,299" fill="#ff7a3d" opacity="0.8" />
          </g>

          {/* Apex Chamfer */}
          <polygon points="256,72 268,90 244,90" fill="#ffffff" opacity="0.95" />

          {/* Base Feet Chamfers */}
          <polygon points="94,432 148,432 142,422 102,422" fill="#ff7a3d" opacity="0.5" />
          <polygon points="418,432 364,432 370,422 410,422" fill="#ffaa55" opacity="0.7" />
        </g>
      </svg>

      {withText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-bold tracking-tight text-slate-50 font-mono lowercase">
              arkive
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-sky-400 bg-sky-500/15 px-1.5 py-0.5 rounded-full border border-sky-500/25">
              v0.1
            </span>
          </div>
          <span className="text-[9.5px] text-slate-400 font-medium tracking-wide mt-0.5">
            Archive Studio
          </span>
        </div>
      )}
    </div>
  );
};
