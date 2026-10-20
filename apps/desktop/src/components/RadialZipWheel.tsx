import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File as FileIcon, Sparkles, Sliders, Zap, Shield, Package, Layers, Archive } from 'lucide-react';
import { ArchiveFormat } from '../types';

export interface RadialZipChoice {
  id: string;
  label: string;
  extLabel: string;
  subtitle: string;
  format: ArchiveFormat;
  level: number;
  zipMethod: string;
  isCustomModal?: boolean;
}

export const RADIAL_ZIP_CHOICES: RadialZipChoice[] = [
  {
    id: 'zip',
    label: 'ZIP',
    extLabel: '.zip',
    subtitle: 'Standard · Universal',
    format: 'zip',
    level: 6,
    zipMethod: 'deflate',
  },
  {
    id: '7z',
    label: '7-Zip',
    extLabel: '.7z',
    subtitle: 'LZMA2 · Max Ratio',
    format: '7z',
    level: 7,
    zipMethod: 'deflate',
  },
  {
    id: 'tar.zst',
    label: 'TAR.ZST',
    extLabel: '.tar.zst',
    subtitle: 'Zstandard · Ultra Fast',
    format: 'tar.zst',
    level: 6,
    zipMethod: 'zstd',
  },
  {
    id: 'tar.gz',
    label: 'TAR.GZ',
    extLabel: '.tar.gz',
    subtitle: 'Gzip · Linux / POSIX',
    format: 'tar.gz',
    level: 6,
    zipMethod: 'deflate',
  },
  {
    id: 'tar.xz',
    label: 'TAR.XZ',
    extLabel: '.tar.xz',
    subtitle: 'XZ · Deep Archival',
    format: 'tar.xz',
    level: 6,
    zipMethod: 'deflate',
  },
  {
    id: 'zip-zstd',
    label: 'ZIP (Zstd)',
    extLabel: '.zip',
    subtitle: 'High-Speed Zstd ZIP',
    format: 'zip',
    level: 6,
    zipMethod: 'zstd',
  },
  {
    id: 'custom',
    label: 'Options…',
    extLabel: 'Custom',
    subtitle: 'Password & Threads',
    format: 'zip',
    level: 6,
    zipMethod: 'deflate',
    isCustomModal: true,
  },
];

interface RadialZipWheelProps {
  isOpen: boolean;
  x: number;
  y: number;
  targetPath: string;
  targetName: string;
  isDir: boolean;
  openedAt: number;
  onSelectChoice: (choice: RadialZipChoice, targetPath: string) => void;
  onClose: () => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
) {
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, endAngle);
  const endInner = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M',
    startOuter.x.toFixed(2),
    startOuter.y.toFixed(2),
    'A',
    outerR,
    outerR,
    0,
    largeArc,
    0,
    endOuter.x.toFixed(2),
    endOuter.y.toFixed(2),
    'L',
    endInner.x.toFixed(2),
    endInner.y.toFixed(2),
    'A',
    innerR,
    innerR,
    0,
    largeArc,
    1,
    startInner.x.toFixed(2),
    startInner.y.toFixed(2),
    'Z',
  ].join(' ');
}

export const RadialZipWheel: React.FC<RadialZipWheelProps> = ({
  isOpen,
  x,
  y,
  targetPath,
  targetName,
  isDir,
  openedAt,
  onSelectChoice,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isHoldingRight, setIsHoldingRight] = useState(true);

  const wheelSize = 296;
  const half = wheelSize / 2;
  const innerR = 50;
  const outerR = 132;
  const count = RADIAL_ZIP_CHOICES.length;
  const sliceDeg = 360 / count;

  // Clamp wheel center so it always stays fully inside viewport
  const clampedX = Math.max(half + 16, Math.min(window.innerWidth - half - 16, x));
  const clampedY = Math.max(half + 16, Math.min(window.innerHeight - half - 16, y));

  const getSliceFromPoint = useCallback(
    (clientX: number, clientY: number): { index: number | null; dist: number } => {
      const dx = clientX - clampedX;
      const dy = clientY - clampedY;
      const dist = Math.hypot(dx, dy);
      if (dist < innerR - 6 || dist > outerR + 48) {
        return { index: null, dist };
      }
      // Angle where 0 deg is 12 o'clock (top), increasing clockwise
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;
      // Offset by half a slice so Slice 0 is centered at 0 deg (12 o'clock)
      const shifted = (angle + sliceDeg / 2) % 360;
      const idx = Math.floor(shifted / sliceDeg);
      return { index: idx >= 0 && idx < count ? idx : null, dist };
    },
    [clampedX, clampedY, innerR, outerR, sliceDeg, count]
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(null);
    setIsHoldingRight(true);

    const handleMouseMove = (e: MouseEvent) => {
      const { index } = getSliceFromPoint(e.clientX, e.clientY);
      setActiveIndex(index);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const { index, dist } = getSliceFromPoint(e.clientX, e.clientY);
      const elapsed = Date.now() - openedAt;

      if (e.button === 2) {
        setIsHoldingRight(false);
        // If user held right-click and dragged onto a slice, trigger immediately on release!
        if (index !== null) {
          onSelectChoice(RADIAL_ZIP_CHOICES[index], targetPath);
          onClose();
          return;
        }
        // If user held right-click for a long time in the center cancel zone (> 600ms) and released, close
        if (elapsed > 600 && dist < innerR) {
          onClose();
        }
        // Otherwise keep the wheel pinned open so the user can move and click a slice
        return;
      }

      if (e.button === 0) {
        if (index !== null) {
          onSelectChoice(RADIAL_ZIP_CHOICES[index], targetPath);
          onClose();
        } else {
          onClose();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key >= '1' && e.key <= '7') {
        const idx = parseInt(e.key, 10) - 1;
        if (RADIAL_ZIP_CHOICES[idx]) {
          onSelectChoice(RADIAL_ZIP_CHOICES[idx], targetPath);
          onClose();
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, openedAt, getSliceFromPoint, onSelectChoice, onClose, targetPath, innerR]);

  if (!isOpen) return null;

  const activeChoice = activeIndex !== null ? RADIAL_ZIP_CHOICES[activeIndex] : null;

  const getChoiceIcon = (id: string, isActive: boolean) => {
    const cls = `w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-sky-400'}`;
    switch (id) {
      case 'zip':
        return <Archive className={cls} />;
      case '7z':
        return <Shield className={cls} />;
      case 'tar.zst':
        return <Zap className={cls} />;
      case 'tar.gz':
        return <Package className={cls} />;
      case 'tar.xz':
        return <Layers className={cls} />;
      case 'zip-zstd':
        return <Sparkles className={cls} />;
      default:
        return <Sliders className={cls} />;
    }
  };

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 bg-slate-950/35 select-none"
    >
      {/* Floating Radial Wheel Container */}
      <div
        style={{
          left: `${clampedX - half}px`,
          top: `${clampedY - half}px`,
          width: `${wheelSize}px`,
          height: `${wheelSize}px`,
        }}
        className="fixed flex items-center justify-center"
      >
        <svg
          width={wheelSize}
          height={wheelSize}
          viewBox={`0 0 ${wheelSize} ${wheelSize}`}
          className="overflow-visible drop-shadow-2xl"
        >
          {/* Subtle outer halo ring */}
          <circle
            cx={half}
            cy={half}
            r={outerR + 6}
            className="fill-slate-900/90 stroke-slate-700/70"
            strokeWidth="1.5"
          />

          {/* Radial Sectors */}
          {RADIAL_ZIP_CHOICES.map((choice, idx) => {
            const centerAngle = idx * sliceDeg;
            const gap = 2.2;
            const startAngle = centerAngle - sliceDeg / 2 + gap;
            const endAngle = centerAngle + sliceDeg / 2 - gap;
            const isActive = activeIndex === idx;
            const currentOuter = isActive ? outerR + 7 : outerR;
            const d = createSectorPath(half, half, innerR, currentOuter, startAngle, endAngle);

            return (
              <g key={choice.id} className="cursor-pointer">
                <path
                  d={d}
                  className={`transition-all duration-100 ${
                    isActive
                      ? 'fill-sky-500 stroke-sky-300'
                      : choice.isCustomModal
                      ? 'fill-slate-800/95 stroke-slate-700/80 hover:fill-slate-750'
                      : 'fill-slate-850/95 stroke-slate-700/70 hover:fill-slate-800'
                  }`}
                  strokeWidth={isActive ? '1.8' : '1'}
                />
              </g>
            );
          })}

          {/* Inner Center Hub Ring */}
          <circle
            cx={half}
            cy={half}
            r={innerR - 4}
            className="fill-slate-900 stroke-slate-700"
            strokeWidth="1.5"
          />
        </svg>

        {/* Sector Labels Overlay */}
        {RADIAL_ZIP_CHOICES.map((choice, idx) => {
          const centerAngle = idx * sliceDeg;
          const isActive = activeIndex === idx;
          const labelR = (innerR + outerR) / 2 + (isActive ? 3 : 0);
          const pos = polarToCartesian(half, half, labelR, centerAngle);

          return (
            <div
              key={choice.id}
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center"
            >
              <div className="mb-0.5 flex items-center justify-center">
                {getChoiceIcon(choice.id, isActive)}
              </div>
              <span
                className={`text-[11px] font-bold tracking-tight leading-tight ${
                  isActive ? 'text-white' : 'text-slate-100'
                }`}
              >
                {choice.label}
              </span>
              <span
                className={`text-[9px] font-mono leading-tight ${
                  isActive ? 'text-sky-100' : 'text-slate-400'
                }`}
              >
                {choice.extLabel}
              </span>
            </div>
          );
        })}

        {/* Center Hub Information */}
        <div
          style={{
            width: `${(innerR - 6) * 2}px`,
            height: `${(innerR - 6) * 2}px`,
          }}
          className="pointer-events-none absolute flex flex-col items-center justify-center rounded-full px-2 text-center"
        >
          <div className="flex items-center gap-1 max-w-full text-slate-400 mb-0.5">
            {isDir ? (
              <Folder className="w-3 h-3 text-amber-400 shrink-0" />
            ) : (
              <FileIcon className="w-3 h-3 text-sky-400 shrink-0" />
            )}
            <span className="text-[9px] font-medium truncate max-w-[62px] text-slate-300">
              {targetName}
            </span>
          </div>

          {activeChoice ? (
            <>
              <span className="text-[11px] font-bold text-sky-400 leading-tight">
                {activeChoice.extLabel}
              </span>
              <span className="text-[8.5px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                {activeChoice.subtitle}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] font-semibold text-slate-200 leading-tight">
                Quick Pack
              </span>
              <span className="text-[8.5px] text-slate-400 leading-tight mt-0.5">
                {isHoldingRight ? 'Drag & release' : 'Click format'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
