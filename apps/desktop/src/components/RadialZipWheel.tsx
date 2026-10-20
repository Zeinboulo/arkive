import React, { useState, useEffect, useCallback } from 'react';
import { Folder, File as FileIcon, Sliders, Zap, Shield, Package, Layers, Archive, Cpu } from 'lucide-react';
import { ArchiveFormat } from '../types';

export interface RadialZipChoice {
  id: string;
  code: string;
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
    code: '01',
    label: 'ZIP',
    extLabel: '.zip',
    subtitle: 'Deflate · Universal OS',
    format: 'zip',
    level: 6,
    zipMethod: 'deflate',
  },
  {
    id: '7z',
    code: '02',
    label: '7-ZIP',
    extLabel: '.7z',
    subtitle: 'LZMA2 · Ultra Ratio',
    format: '7z',
    level: 7,
    zipMethod: 'deflate',
  },
  {
    id: 'tar.zst',
    code: '03',
    label: 'TAR.ZST',
    extLabel: '.tar.zst',
    subtitle: 'Zstd · 500+ MB/s Fast',
    format: 'tar.zst',
    level: 6,
    zipMethod: 'zstd',
  },
  {
    id: 'tar.gz',
    code: '04',
    label: 'TAR.GZ',
    extLabel: '.tar.gz',
    subtitle: 'Gzip · POSIX Standard',
    format: 'tar.gz',
    level: 6,
    zipMethod: 'deflate',
  },
  {
    id: 'tar.xz',
    code: '05',
    label: 'TAR.XZ',
    extLabel: '.tar.xz',
    subtitle: 'LZMA2 · Cold Archival',
    format: 'tar.xz',
    level: 6,
    zipMethod: 'deflate',
  },
  {
    id: 'zip-zstd',
    code: '06',
    label: 'ZIP-ZSTD',
    extLabel: '.zip',
    subtitle: 'Zstandard inside ZIP',
    format: 'zip',
    level: 6,
    zipMethod: 'zstd',
  },
  {
    id: 'custom',
    code: '07',
    label: 'CONFIG…',
    extLabel: 'Dialog',
    subtitle: 'AES-256 & Threads',
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
  const [cursorOffset, setCursorOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const wheelSize = 316;
  const half = wheelSize / 2;
  const innerR = 54;
  const outerR = 140;
  const count = RADIAL_ZIP_CHOICES.length;
  const sliceDeg = 360 / count;

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 720;
  const clampedX = Math.max(half + 16, Math.min(viewportW - half - 16, x));
  const clampedY = Math.max(half + 16, Math.min(viewportH - half - 16, y));

  const getSliceFromPoint = useCallback(
    (clientX: number, clientY: number): { index: number | null; dist: number; dx: number; dy: number } => {
      const dx = clientX - clampedX;
      const dy = clientY - clampedY;
      const dist = Math.hypot(dx, dy);
      if (dist < innerR - 14 || dist > outerR + 70) {
        return { index: null, dist, dx, dy };
      }
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (angle < 0) angle += 360;
      const shifted = (angle + sliceDeg / 2) % 360;
      const idx = Math.floor(shifted / sliceDeg);
      return { index: idx >= 0 && idx < count ? idx : null, dist, dx, dy };
    },
    [clampedX, clampedY, innerR, outerR, sliceDeg, count]
  );

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(null);
    setIsHoldingRight(true);
    setCursorOffset({ dx: 0, dy: 0 });

    const handlePointerMove = (e: MouseEvent) => {
      const { index, dx, dy } = getSliceFromPoint(e.clientX, e.clientY);
      setActiveIndex(index);
      setCursorOffset({ dx, dy });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const { index, dist } = getSliceFromPoint(e.clientX, e.clientY);
      const elapsed = Date.now() - openedAt;

      if (e.button === 2) {
        setIsHoldingRight(false);
        // If user dragged onto any format sector while holding right-click, execute immediately!
        if (index !== null) {
          onSelectChoice(RADIAL_ZIP_CHOICES[index], targetPath);
          onClose();
          return;
        }
        // If held for > 650ms inside center deadzone and released, cancel
        if (elapsed > 650 && dist < innerR - 8) {
          onClose();
        }
        // Otherwise keep wheel pinned open so user can click any sector
        return;
      }

      if (e.button === 0) {
        if (index !== null) {
          onSelectChoice(RADIAL_ZIP_CHOICES[index], targetPath);
          onClose();
        } else if (dist > outerR + 12 || dist < innerR - 10) {
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

    window.addEventListener('mousemove', handlePointerMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, openedAt, getSliceFromPoint, onSelectChoice, onClose, targetPath, innerR, outerR]);

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
        return <Cpu className={cls} />;
      default:
        return <Sliders className={cls} />;
    }
  };

  // Vector indicator endpoint clamped inside wheel
  const vecDist = Math.min(innerR - 6, Math.hypot(cursorOffset.dx, cursorOffset.dy));
  const vecAngle = Math.atan2(cursorOffset.dy, cursorOffset.dx);
  const vecX = half + vecDist * Math.cos(vecAngle);
  const vecY = half + vecDist * Math.sin(vecAngle);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 z-50 bg-black/45 select-none"
    >
      {/* Hardware Dial Container */}
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
          {/* Outer mechanical bezel */}
          <circle
            cx={half}
            cy={half}
            r={outerR + 8}
            className="fill-slate-950/95 stroke-slate-700"
            strokeWidth="1.5"
          />
          <circle
            cx={half}
            cy={half}
            r={outerR + 4}
            className="fill-none stroke-slate-800"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* 7 Annular Sectors */}
          {RADIAL_ZIP_CHOICES.map((choice, idx) => {
            const centerAngle = idx * sliceDeg;
            const gap = 1.8;
            const startAngle = centerAngle - sliceDeg / 2 + gap;
            const endAngle = centerAngle + sliceDeg / 2 - gap;
            const isActive = activeIndex === idx;
            const currentOuter = isActive ? outerR + 6 : outerR;
            const d = createSectorPath(half, half, innerR, currentOuter, startAngle, endAngle);

            return (
              <g
                key={choice.id}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectChoice(choice, targetPath);
                  onClose();
                }}
              >
                <path
                  d={d}
                  className={`transition-all duration-75 ${
                    isActive
                      ? 'fill-sky-600 stroke-sky-300'
                      : choice.isCustomModal
                      ? 'fill-slate-900 stroke-slate-700 hover:fill-slate-800'
                      : 'fill-slate-850 stroke-slate-750 hover:fill-slate-800'
                  }`}
                  strokeWidth={isActive ? '1.75' : '1'}
                />
              </g>
            );
          })}

          {/* Center Hub Ring */}
          <circle
            cx={half}
            cy={half}
            r={innerR - 4}
            className="fill-slate-950 stroke-slate-700"
            strokeWidth="1.5"
          />

          {/* Live Vector Line when dragging */}
          {activeIndex !== null && (
            <>
              <line
                x1={half}
                y1={half}
                x2={vecX}
                y2={vecY}
                className="stroke-sky-400"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={vecX} cy={vecY} r="3" className="fill-sky-300" />
            </>
          )}
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
              <div className="flex items-center gap-1 mb-0.5">
                <span
                  className={`text-[8.5px] font-mono ${
                    isActive ? 'text-sky-100' : 'text-slate-500'
                  }`}
                >
                  {choice.code}
                </span>
                {getChoiceIcon(choice.id, isActive)}
              </div>
              <span
                className={`text-[11px] font-mono font-bold tracking-wider leading-tight ${
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

        {/* Center Hub Readout */}
        <div
          style={{
            width: `${(innerR - 6) * 2}px`,
            height: `${(innerR - 6) * 2}px`,
          }}
          className="pointer-events-none absolute flex flex-col items-center justify-center rounded-full px-1.5 text-center"
        >
          <div className="flex items-center gap-1 max-w-full mb-0.5">
            {isDir ? (
              <Folder className="w-3 h-3 text-sky-400 shrink-0" />
            ) : (
              <FileIcon className="w-3 h-3 text-slate-400 shrink-0" />
            )}
            <span className="text-[9px] font-mono truncate max-w-[68px] text-slate-300">
              {targetName}
            </span>
          </div>

          {activeChoice ? (
            <>
              <span className="text-[11px] font-mono font-bold text-sky-400 leading-tight">
                {activeChoice.extLabel}
              </span>
              <span className="text-[8px] font-mono text-slate-400 leading-tight mt-0.5 line-clamp-2">
                {activeChoice.subtitle}
              </span>
            </>
          ) : (
            <>
              <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-slate-200 leading-tight">
                PACK DIAL
              </span>
              <span className="text-[8px] font-mono text-slate-400 leading-tight mt-0.5">
                {isHoldingRight ? 'Drag & release' : 'Click 01–07'}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
