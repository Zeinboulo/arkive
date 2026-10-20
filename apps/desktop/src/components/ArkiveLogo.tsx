import React from 'react';

interface ArkiveLogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  variant?: 'tile' | 'mark';
}

export const ArkiveLogo: React.FC<ArkiveLogoProps> = ({
  size = 28,
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
        className="shrink-0 select-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* App Icon Squircle Background */}
          <linearGradient id="ark-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#131b2e" />
            <stop offset="55%" stopColor="#0d1322" />
            <stop offset="100%" stopColor="#090d18" />
          </linearGradient>

          {/* Subtle Inner Border */}
          <linearGradient id="ark-border" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.6" />
          </linearGradient>

          {/* Left Origami Ribbon — Mint to Emerald Jade */}
          <linearGradient id="ark-left" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="45%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          {/* Right Origami Ribbon — Aqua Teal to Sky */}
          <linearGradient id="ark-right" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Bottom Interlocking Fold — Sky to Deep Indigo-Blue */}
          <linearGradient id="ark-base" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="45%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          {/* Center Core Prism */}
          <linearGradient id="ark-core" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#a7f3d0" />
          </linearGradient>
        </defs>

        {variant === 'tile' && (
          <>
            <rect width="512" height="512" rx="120" fill="url(#ark-bg)" />
            <rect
              x="4"
              y="4"
              width="504"
              height="504"
              rx="116"
              fill="none"
              stroke="url(#ark-border)"
              strokeWidth="6"
            />
          </>
        )}

        {/* Isometric Folded Origami Prism 'A' + Cube */}
        <g>
          {/* Left Folded Facet */}
          <path
            d="M 256 84 L 108 344 L 176 384 L 256 224 Z"
            fill="url(#ark-left)"
          />

          {/* Right Folded Facet */}
          <path
            d="M 256 84 L 404 344 L 336 384 L 256 224 Z"
            fill="url(#ark-right)"
          />

          {/* Bottom Interlocking Compression Ribbon */}
          <path
            d="M 108 344 L 256 428 L 404 344 L 336 304 L 256 350 L 176 304 Z"
            fill="url(#ark-base)"
          />

          {/* Floating Inner Cube Core */}
          <polygon
            points="256,216 310,248 256,280 202,248"
            fill="url(#ark-core)"
          />
          <polygon
            points="202,248 256,280 256,336 202,304"
            fill="#10b981"
            opacity="0.9"
          />
          <polygon
            points="310,248 256,280 256,336 310,304"
            fill="#0ea5e9"
            opacity="0.9"
          />
        </g>
      </svg>

      {withText && (
        <div className="flex flex-col leading-none select-none">
          <span className="text-[15px] font-semibold tracking-tight text-slate-50">
            Arkive
          </span>
        </div>
      )}
    </div>
  );
};
