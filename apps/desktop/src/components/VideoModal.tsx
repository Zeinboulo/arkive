import React, { useState, useEffect } from 'react';
import {
  X,
  Video,
  Film,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  ArrowRight,
  RefreshCw,
  Gauge,
  Layers,
  StopCircle,
} from 'lucide-react';
import {
  VideoCodecType,
  VideoCompressOptions,
  VideoCompressStats,
  VideoMetadata,
  VideoPresetType,
  VideoProgressUpdate,
  VideoResolutionType,
} from '../types';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialVideoPath?: string | null;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  initialVideoPath,
}) => {
  const [inputPath, setInputPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [meta, setMeta] = useState<VideoMetadata | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  const [preset, setPreset] = useState<VideoPresetType>('balanced');
  const [codec, setCodec] = useState<VideoCodecType>('h264');
  const [resolution, setResolution] = useState<VideoResolutionType>('original');
  const [targetMb, setTargetMb] = useState<string>('');
  const [crf, setCrf] = useState<number>(28);
  const [audioBitrate, setAudioBitrate] = useState<number>(128);

  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState<VideoProgressUpdate | null>(null);
  const [stats, setStats] = useState<VideoCompressStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialVideoPath && isOpen) {
      loadVideo(initialVideoPath);
    }
  }, [initialVideoPath, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close if completed
      if (stats || error) {
        setStats(null);
        setError(null);
        setProgress(null);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!window.arkive?.onVideoProgress) return;
    const unsub = window.arkive.onVideoProgress((prog) => {
      setProgress(prog);
    });
    return () => unsub();
  }, []);

  const loadVideo = async (filePath: string) => {
    setInputPath(filePath);
    setIsProbing(true);
    setError(null);
    setStats(null);
    setProgress(null);

    // Suggest output path
    const clean = filePath.replace(/\\/g, '/');
    const idx = clean.lastIndexOf('.');
    const suggested = idx > 0 ? `${clean.slice(0, idx)}.compressed.mp4` : `${clean}.compressed.mp4`;
    setOutputPath(suggested);

    try {
      if (window.arkive?.probeVideo) {
        const probed = await window.arkive.probeVideo(filePath);
        setMeta(probed);
      }
    } catch (err: any) {
      setError(`Failed to probe video: ${err?.message || err}`);
    } finally {
      setIsProbing(false);
    }
  };

  const handleSelectFile = async () => {
    if (!window.arkive?.openVideoDialog) return;
    const selected = await window.arkive.openVideoDialog();
    if (selected) {
      loadVideo(selected);
    }
  };

  const handleSelectOutput = async () => {
    if (!window.arkive?.saveVideoDialog) return;
    const selected = await window.arkive.saveVideoDialog(outputPath);
    if (selected) {
      setOutputPath(selected);
    }
  };

  const handlePresetSelect = (p: VideoPresetType) => {
    setPreset(p);
    if (p === 'discord') {
      setCodec('h264');
      setTargetMb('24');
      setResolution(meta && meta.height > 1080 ? '1080p' : 'original');
    } else if (p === 'balanced') {
      setCodec('h264');
      setCrf(28);
      setTargetMb('');
      setResolution('original');
    } else if (p === 'high') {
      setCodec('hevc');
      setCrf(28);
      setTargetMb('');
      setResolution('original');
    } else if (p === '720p') {
      setCodec('h264');
      setCrf(28);
      setTargetMb('');
      setResolution('720p');
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPath || !outputPath || isCompressing) return;

    setIsCompressing(true);
    setError(null);
    setStats(null);
    setProgress({
      percent: 0,
      currentTime: 0,
      totalDuration: meta?.duration_seconds || 1,
      fps: 0,
      speed: '0x',
      currentSizeKb: 0,
    });

    const options: VideoCompressOptions = {
      input: inputPath,
      output: outputPath,
      preset,
      codec,
      resolution,
      audioBitrate,
    };

    if (preset === 'custom') {
      if (targetMb && parseFloat(targetMb) > 0) {
        options.targetMb = parseFloat(targetMb);
      } else {
        options.crf = crf;
      }
    } else if (preset === 'discord') {
      options.targetMb = 24.0;
    } else {
      options.crf = crf;
    }

    try {
      if (window.arkive?.compressVideo) {
        const result = await window.arkive.compressVideo(options);
        setStats(result);
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancelled')) {
        setError(err?.message || 'Video compression failed');
      }
    } finally {
      setIsCompressing(false);
    }
  };

  const handleCancel = async () => {
    if (window.arkive?.cancelVideoCompression) {
      await window.arkive.cancelVideoCompression();
      setIsCompressing(false);
      setProgress(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-850 border border-slate-700/80 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between bg-slate-800/80 shrink-0">
          <div className="flex items-center space-x-2">
            <Video className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Video Compressor & Transcoder
            </h3>
            <span className="text-[10px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded border border-violet-500/30 font-medium">
              FFmpeg 6.1
            </span>
          </div>
          <button
            onClick={() => {
              if (isCompressing) handleCancel();
              onClose();
            }}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {/* File Picker Section */}
          <div className="space-y-3">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Source Video File
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Select a video file to compress (.mp4, .mkv, .mov, .webm...)"
                  value={inputPath}
                  onChange={(e) => setInputPath(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition flex items-center space-x-1.5 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Browse...</span>
                </button>
              </div>
            </div>

            {/* Probed Metadata Card */}
            {meta && (
              <div className="bg-slate-800/90 border border-slate-700/70 rounded-lg p-3 text-slate-300 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Resolution</span>
                  <span className="font-semibold text-slate-200 font-mono">
                    {meta.width > 0 ? `${meta.width}x${meta.height}` : 'Auto'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Duration</span>
                  <span className="font-semibold text-slate-200 font-mono">
                    {formatDuration(meta.duration_seconds)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Original Size</span>
                  <span className="font-semibold text-violet-300 font-mono">
                    {formatBytes(meta.size_bytes)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Codec / FPS</span>
                  <span className="font-semibold text-slate-200 font-mono">
                    {meta.video_codec} ({meta.fps.toFixed(0)} fps)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Preset Buttons */}
          <div>
            <label className="block font-medium text-slate-300 mb-2">
              Compression Preset
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handlePresetSelect('discord')}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  preset === 'discord'
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                    : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-xs text-white">Discord</span>
                  <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1 py-0.2 rounded font-mono">
                    &lt; 25 MB
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Target budget for free Discord & web sharing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePresetSelect('balanced')}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  preset === 'balanced'
                    ? 'bg-violet-600/20 border-violet-500 text-violet-200 shadow-sm'
                    : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-xs text-white">Balanced</span>
                  <span className="text-[10px] bg-violet-500/30 text-violet-300 px-1 py-0.2 rounded font-mono">
                    H.264
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Fast encode, crisp quality, universal compatibility.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePresetSelect('high')}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  preset === 'high'
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200 shadow-sm'
                    : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-xs text-white">Max Space</span>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1 py-0.2 rounded font-mono">
                    HEVC / H.265
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Maximum reduction with modern high-efficiency video coding.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePresetSelect('720p')}
                className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                  preset === '720p'
                    ? 'bg-amber-600/20 border-amber-500 text-amber-200 shadow-sm'
                    : 'bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-xs text-white">Mobile 720p</span>
                  <span className="text-[10px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-mono">
                    720p
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Downscale to 720p for fast mobile playback and lightweight size.
                </p>
              </button>
            </div>
          </div>

          {/* Advanced / Custom Options */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-300 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span>Fine-Tuning Options</span>
              </span>
              <button
                type="button"
                onClick={() => setPreset('custom')}
                className={`text-[11px] px-2 py-0.5 rounded transition ${
                  preset === 'custom'
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {preset === 'custom' ? 'Custom Mode: Active' : 'Switch to Custom Mode'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Video Codec</label>
                <select
                  value={codec}
                  onChange={(e) => {
                    setCodec(e.target.value as VideoCodecType);
                    setPreset('custom');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-violet-500"
                >
                  <option value="h264">H.264 (Universal AVC)</option>
                  <option value="hevc">H.265 (HEVC High-Efficiency)</option>
                  <option value="vp9">VP9 (Google Open Video)</option>
                  <option value="av1">AV1 (Next-Gen Open Codec)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Resolution Limit</label>
                <select
                  value={resolution}
                  onChange={(e) => {
                    setResolution(e.target.value as VideoResolutionType);
                    setPreset('custom');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-violet-500"
                >
                  <option value="original">Keep Original</option>
                  <option value="1080p">Downscale to 1080p</option>
                  <option value="720p">Downscale to 720p</option>
                  <option value="480p">Downscale to 480p</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Target Size Limit (MB)
                </label>
                <input
                  type="number"
                  placeholder="Optional (e.g. 24)"
                  value={targetMb}
                  onChange={(e) => {
                    setTargetMb(e.target.value);
                    setPreset('custom');
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-violet-500 font-mono"
                />
              </div>
            </div>

            {/* CRF Quality Slider (shown when not using target MB) */}
            {!targetMb && (
              <div className="pt-1">
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>CRF Quality: <strong className="text-white">{crf}</strong></span>
                  <span className="text-slate-500">18 (Near Lossless) &mdash; 28 (Default) &mdash; 35 (Smallest)</span>
                </div>
                <input
                  type="range"
                  min="18"
                  max="35"
                  step="1"
                  value={crf}
                  onChange={(e) => {
                    setCrf(parseInt(e.target.value, 10));
                    setPreset('custom');
                  }}
                  className="w-full accent-violet-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Output Path */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">
              Destination Output File
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Output destination path (.mp4)"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500 font-mono text-xs"
              />
              <button
                type="button"
                onClick={handleSelectOutput}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition flex items-center space-x-1.5 shrink-0"
              >
                <span>Save As...</span>
              </button>
            </div>
          </div>

          {/* Real-time Progress Bar */}
          {isCompressing && progress && (
            <div className="bg-violet-950/40 border border-violet-500/40 rounded-lg p-3 space-y-2 animate-in fade-in">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-violet-300 flex items-center space-x-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                  <span>Encoding Video: {progress.percent}%</span>
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  Speed: {progress.speed} | FPS: {progress.fps} | {formatDuration(progress.currentTime)} / {formatDuration(progress.totalDuration)}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2 transition-all duration-150"
                  style={{ width: `${Math.max(2, progress.percent)}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Summary Card */}
          {stats && (
            <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-3 text-slate-300 space-y-2 animate-in fade-in">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>Compression Successful!</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {stats.savings_pct > 0 ? `-${stats.savings_pct}% Smaller` : 'Optimized'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Original</span>
                  <span className="font-bold text-slate-300">{formatBytes(stats.input_bytes)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Compressed</span>
                  <span className="font-bold text-emerald-300">{formatBytes(stats.output_bytes)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Time Elapsed</span>
                  <span className="font-bold text-slate-300">{(stats.elapsed_ms / 1000).toFixed(1)}s</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 truncate pt-1">
                Saved to: <span className="text-sky-300 font-mono">{stats.output_path}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-lg text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-700/60 bg-slate-800/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            {isCompressing ? 'Encoding in progress...' : 'Hardware accelerated & multi-threaded'}
          </div>

          <div className="flex items-center space-x-2">
            {isCompressing ? (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition flex items-center space-x-1.5"
              >
                <StopCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg font-medium transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!inputPath || !outputPath || isProbing}
                  className={`px-4 py-2 rounded-lg font-medium transition flex items-center space-x-1.5 ${
                    inputPath && outputPath && !isProbing
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/30 active:scale-95'
                      : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Compression</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
