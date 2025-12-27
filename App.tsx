
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  Film, 
  Download, 
  Eye,
  Clock,
  Upload,
  Zap,
  Maximize,
  SlidersHorizontal,
  MoveHorizontal,
  Youtube,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Share2
} from 'lucide-react';
import { vxService } from './services/vxService';
import { 
  ProcessingStatus, 
  VXStyle, 
  ProcessingResult, 
  LookState, 
  MotionState, 
  Clip 
} from './types';

const App: React.FC = () => {
  // Video States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Look State
  const [look, setLook] = useState<LookState>({
    vxTint: 0.8, 
    mk1Vignette: true,
    fisheye: 0.8,
    grain: 0.15,
    exposure: 1.1,
    contrast: 1.2,
    saturation: 1.1
  });

  // Motion State
  const [motion, setMotion] = useState<MotionState>({
    rampIntensity: 0.7,
    slowSpeed: 0.25,
    rampCenter: 0.5,
    rampWidth: 0.2
  });

  // Editor States
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);

  // Cloud Processing States
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<VXStyle>(VXStyle.CLASSIC_LONGLENS);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Sync Video Element with State
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.preservesPitch = false; 
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current && !isPlaying) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.05) {
        videoRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime, isPlaying]);

  // Smoother Speed Ramping Logic for Preview
  useEffect(() => {
    if (!videoRef.current || !isPlaying) return;

    const interval = setInterval(() => {
      const pos = currentTime / (duration || 1);
      const dist = Math.abs(pos - motion.rampCenter);
      
      let targetSpeed = 1.0;
      
      if (dist < motion.rampWidth) {
        const curve = Math.pow(dist / motion.rampWidth, 2);
        targetSpeed = motion.slowSpeed + (1.0 - motion.slowSpeed) * curve;
      } else {
        targetSpeed = 1.0 + (motion.rampIntensity * 0.5); 
      }

      if (videoRef.current) {
        const currentRate = videoRef.current.playbackRate;
        videoRef.current.playbackRate = currentRate + (targetSpeed - currentRate) * 0.2;
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, duration, motion]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newClip: Clip = { id: Date.now(), name: file.name, url: url, file: file };
      setClips(prev => [...prev, newClip]);
      setActiveClip(newClip);
      setIsPlaying(false);
      setCurrentTime(0);
      setProcessingResult(null);
      setError(null);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && isPlaying) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const startCloudProcessing = async () => {
    if (!activeClip) return;

    try {
      setStatus(ProcessingStatus.SIGNING);
      setError(null);

      // 1. Sign
      const { upload_url, gcs_uri } = await vxService.signUpload(activeClip.file.name, activeClip.file.type);
      
      // 2. Upload
      setStatus(ProcessingStatus.UPLOADING);
      await vxService.uploadFile(upload_url, activeClip.file, (progress) => {
        setUploadProgress(progress);
      });

      // 3. Process
      setStatus(ProcessingStatus.PROCESSING);
      const result = await vxService.processVideo(gcs_uri, selectedStyle);
      
      setProcessingResult(result);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      console.error('VX Cloud Error:', err);
      let message = err.message || 'An unexpected error occurred.';
      if (message.includes('Failed to fetch')) {
        message = 'Cloud API connection failed. This might be a CORS issue or the backend is offline.';
      }
      setError(message);
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const formatTime = (time: number) => {
    const s = Math.floor(time || 0);
    const ms = Math.floor(((time || 0) % 1) * 100);
    return `${s}.${ms.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0b] text-slate-200 font-sans overflow-hidden">
      <input type="file" accept="video/mp4,video/quicktime" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      {/* Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Zap className="text-black fill-black" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight italic uppercase leading-tight">
              VX Skate <span className="text-emerald-500 font-black">Bot</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Cloud Processor v3.1</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border border-white/5"
          >
            <Upload size={14} /> Import Footage
          </button>
          <button 
            disabled={!activeClip || (status !== ProcessingStatus.IDLE && status !== ProcessingStatus.COMPLETED && status !== ProcessingStatus.ERROR)}
            onClick={startCloudProcessing}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-black rounded-lg text-xs font-black transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 uppercase tracking-tight"
          >
            {status === ProcessingStatus.IDLE || status === ProcessingStatus.COMPLETED || status === ProcessingStatus.ERROR ? (
              <>
                <Share2 size={14} /> Process Cloud Edit
              </>
            ) : (
              <>
                <Loader2 size={14} className="animate-spin" /> {status}...
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Controls */}
        <aside className="w-80 bg-black/20 border-r border-white/5 p-6 flex flex-col gap-8 overflow-y-auto">
          {/* Cloud Style Selector */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Film className="text-emerald-500" size={18} />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Processing Style</h2>
            </div>
            <div className="space-y-2">
              <StyleButton 
                label="Classic LongLens" 
                active={selectedStyle === VXStyle.CLASSIC_LONGLENS} 
                onClick={() => setSelectedStyle(VXStyle.CLASSIC_LONGLENS)}
                description="4:3 aspect, classic Sony saturation."
              />
              <StyleButton 
                label="Dynamic Fisheye" 
                active={selectedStyle === VXStyle.FISHEYE_DYNAMIC} 
                onClick={() => setSelectedStyle(VXStyle.FISHEYE_DYNAMIC)}
                description="Aggressive barrel distortion, high contrast."
              />
              <StyleButton 
                label="Raw MK1 Glass" 
                active={selectedStyle === VXStyle.RAW_MK1} 
                onClick={() => setSelectedStyle(VXStyle.RAW_MK1)}
                description="Zero crop, edge vignettes, raw audio."
              />
            </div>
          </section>

          {/* Local Preview Look */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Eye className="text-emerald-500" size={18} />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Preview Filters</h2>
            </div>
            
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <ToggleOption 
                  label="MK1 Glass Vignette" 
                  active={look.mk1Vignette} 
                  onClick={() => setLook(l => ({...l, mk1Vignette: !l.mk1Vignette}))} 
                />
              </div>

              <div className="h-[1px] bg-white/5 my-2" />
              
              <ControlSlider label="Sony VX Tint Intensity" value={look.vxTint} onChange={v => setLook(l => ({...l, vxTint: v}))} />
              <ControlSlider label="MK1 Fisheye Field" value={look.fisheye} onChange={v => setLook(l => ({...l, fisheye: v}))} />
              <ControlSlider label="CCD Grain" value={look.grain} onChange={v => setLook(l => ({...l, grain: v}))} />
              <ControlSlider label="Exposure Offset" min={0.5} max={2} step={0.01} value={look.exposure} onChange={v => setLook(l => ({...l, exposure: v}))} />
              <ControlSlider label="Dynamic Contrast" min={0.5} max={2} step={0.01} value={look.contrast} onChange={v => setLook(l => ({...l, contrast: v}))} />
            </div>
          </section>

          {/* Motion Controls */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Clock className="text-emerald-500" size={18} />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Motion Ramping</h2>
            </div>
            <div className="space-y-6">
              <ControlSlider label="Ramp Aggression" value={motion.rampIntensity} onChange={v => setMotion(m => ({...m, rampIntensity: v}))} />
              <ControlSlider label="Slow-Mo Speed" min={0.1} max={0.75} step={0.05} value={motion.slowSpeed} onChange={v => setMotion(m => ({...m, slowSpeed: v}))} />
              <ControlSlider label="Timing Window" min={0.05} max={0.4} step={0.01} value={motion.rampWidth} onChange={v => setMotion(m => ({...m, rampWidth: v}))} />
            </div>
          </section>
        </aside>

        {/* Central Workspace */}
        <div className="flex-1 flex flex-col bg-[#050506]">
          {/* Main Preview */}
          <div className="flex-1 relative flex items-center justify-center p-8">
            <div 
              className="relative aspect-video w-full max-w-5xl bg-black rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/5"
              style={{
                filter: `
                  brightness(${look.exposure}) 
                  contrast(${look.contrast + (look.vxTint * 0.2)}) 
                  saturate(${look.saturation + (look.vxTint * 0.4)}) 
                  sepia(${look.vxTint * 0.15}) 
                  hue-rotate(${look.vxTint * -8}deg)
                `
              }}
            >
              {activeClip ? (
                <div 
                  className="w-full h-full relative"
                  style={{
                    transform: `scale(${1 + look.fisheye * 0.45})`,
                    transition: 'transform 0.15s cubic-bezier(0.2, 0, 0.2, 1)'
                  }}
                >
                  <video
                    ref={videoRef}
                    src={activeClip.url}
                    className="w-full h-full object-cover"
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {look.mk1Vignette && (
                    <div className="absolute inset-0 pointer-events-none z-20">
                      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                         <defs>
                           <mask id="lensMask">
                             <rect width="100" height="100" fill="white" />
                             {/* Small radius for realistic MK1 glass cutoff */}
                             <circle cx="50" cy="50" r="45" fill="black" />
                           </mask>
                           <filter id="lensBlur">
                             <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" />
                           </filter>
                         </defs>
                         {/* Softer edge blackout using filter stdDeviation 1.8 */}
                         <rect width="100" height="100" fill="#000" mask="url(#lensMask)" filter="url(#lensBlur)" />
                         
                         {/* Glass edge reflections and chromatic aberration effects */}
                         <circle cx="50" cy="50" r="47.1" fill="none" stroke="#fff" strokeWidth="0.08" opacity="0.12" />
                         <circle cx="50" cy="50" r="45.5" fill="none" stroke="#3b82f6" strokeWidth="0.04" opacity="0.08" />
                         <circle cx="50" cy="50" r="45.2" fill="none" stroke="#60a5fa" strokeWidth="0.02" opacity="0.15" />
                         <circle cx="50" cy="50" r="44.8" fill="none" stroke="#ef4444" strokeWidth="0.02" opacity="0.04" />
                      </svg>
                      {/* Refined realistic radial falloff from transparent 25% to deep black 94% */}
                      <div className="absolute inset-0" style={{
                        background: `radial-gradient(circle at center, transparent 25%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.15) 75%, rgba(0,0,0,0.85) 94%)`
                      }} />
                    </div>
                  )}

                  <div 
                    className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
                    style={{ 
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                      opacity: look.grain 
                    }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700">
                  <Film size={64} className="mb-4 opacity-10" />
                  <p className="text-sm font-bold uppercase tracking-widest opacity-30 text-center">Load a raw VX clip to begin</p>
                </div>
              )}

              {/* Minimal HUD Controls */}
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-black/60 backdrop-blur-xl rounded-full border border-white/10 opacity-0 hover:opacity-100 transition-opacity z-20">
                <SkipBack size={24} className="cursor-pointer hover:text-emerald-400" onClick={() => setCurrentTime(0)} />
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-xl shadow-white/5"
                >
                  {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>
                <Maximize size={24} className="cursor-pointer hover:text-emerald-400" />
              </div>
            </div>

            {/* Cloud Status Overlay */}
            {status !== ProcessingStatus.IDLE && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-6">
                <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {status === ProcessingStatus.COMPLETED ? (
                        <CheckCircle2 className="text-emerald-500" />
                      ) : status === ProcessingStatus.ERROR ? (
                        <AlertCircle className="text-red-500" />
                      ) : (
                        <Loader2 className="text-emerald-500 animate-spin" />
                      )}
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest leading-none mb-1">
                          {status.replace('_', ' ')}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {status === ProcessingStatus.UPLOADING && `Payload stream: ${uploadProgress}%`}
                          {status === ProcessingStatus.PROCESSING && "Engaging VX Cloud GPUs..."}
                          {status === ProcessingStatus.COMPLETED && "Edit rendered successfully"}
                          {status === ProcessingStatus.ERROR && "Processing failed"}
                        </p>
                      </div>
                    </div>
                    {status === ProcessingStatus.COMPLETED && (
                      <button onClick={() => setStatus(ProcessingStatus.IDLE)} className="text-[10px] text-slate-500 hover:text-white uppercase font-black">Dismiss</button>
                    )}
                  </div>

                  {(status === ProcessingStatus.UPLOADING || status === ProcessingStatus.PROCESSING) && (
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.8)]" 
                        style={{ width: status === ProcessingStatus.UPLOADING ? `${uploadProgress}%` : '100%' }}
                      />
                    </div>
                  )}

                  {status === ProcessingStatus.COMPLETED && processingResult && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <a 
                        href={processingResult.youtube_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-500 py-3 rounded-xl border border-red-500/20 transition-all text-[11px] font-black uppercase tracking-tighter"
                      >
                        <Youtube size={16} /> Watch YouTube (4:3)
                      </a>
                      <a 
                        href={processingResult.vertical_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 py-3 rounded-xl border border-emerald-500/20 transition-all text-[11px] font-black uppercase tracking-tighter"
                      >
                        <Smartphone size={16} /> Download Vertical
                      </a>
                    </div>
                  )}

                  {status === ProcessingStatus.ERROR && error && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-mono leading-relaxed break-words">
                      {error}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="h-48 bg-black/40 border-t border-white/5 px-12 py-8">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] font-mono text-emerald-500 font-bold uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                  <SlidersHorizontal size={14} /> Playback: {videoRef.current?.playbackRate.toFixed(2)}x
                </div>
              </div>
            </div>

            <div 
              className="relative h-12 bg-white/5 rounded-2xl cursor-pointer group"
              ref={timelineRef}
              onClick={(e) => {
                const rect = timelineRef.current?.getBoundingClientRect();
                if (rect) {
                  const pos = (e.clientX - rect.left) / rect.width;
                  setCurrentTime(pos * (duration || 1));
                }
              }}
            >
              {/* Ramp Zone Indicator */}
              <div 
                className="absolute h-full bg-emerald-500/10 border-x border-emerald-500/30 flex items-center justify-center transition-all duration-300"
                style={{ 
                  left: `${(motion.rampCenter - motion.rampWidth) * 100}%`,
                  width: `${(motion.rampWidth * 2) * 100}%`
                }}
              >
                <div className="text-[8px] font-black uppercase text-emerald-500/50 flex items-center gap-1 pointer-events-none">
                  <MoveHorizontal size={10} /> Trick Zone
                </div>
              </div>

              {/* Speed Ramp Center Handle */}
              <div 
                className="absolute top-0 bottom-0 w-8 flex items-center justify-center -translate-x-1/2 cursor-grab active:cursor-grabbing hover:bg-white/10 rounded-lg transition-colors z-20"
                style={{ left: `${motion.rampCenter * 100}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const move = (moveEvent: MouseEvent) => {
                    const rect = timelineRef.current?.getBoundingClientRect();
                    if (rect) {
                      const val = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
                      setMotion(prev => ({...prev, rampCenter: val}));
                    }
                  };
                  window.addEventListener('mousemove', move);
                  window.addEventListener('mouseup', () => window.removeEventListener('mousemove', move), {once: true});
                }}
              >
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,1)]" />
              </div>

              {/* Playhead */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        input[type="range"] {
          -webkit-appearance: none;
          background: transparent;
          cursor: pointer;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          background: rgba(255,255,255,0.05);
          height: 4px;
          border-radius: 2px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          background: #10b981;
          border-radius: 50%;
          margin-top: -4px;
          box-shadow: 0 0 10px rgba(16,185,129,0.4);
        }
      `}</style>
    </div>
  );
};

const ToggleOption: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex justify-between items-center p-3 rounded-xl border transition-all duration-300 ${
      active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_15px_rgba(16,185,129,0.05)]' : 'bg-slate-900/50 border-white/5 text-slate-500 hover:text-slate-200'
    }`}
  >
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    <div className={`w-3 h-3 rounded-full transition-all ${active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'}`} />
  </button>
);

const ControlSlider: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }> = ({ label, value, onChange, min = 0, max = 1, step = 0.01 }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      <span className="text-[10px] font-mono text-emerald-500">{value.toFixed(2)}</span>
    </div>
    <input 
      type="range" 
      className="w-full opacity-60 hover:opacity-100 transition-opacity" 
      min={min} max={max} step={step} 
      value={value} 
      onChange={e => onChange(parseFloat(e.target.value))} 
    />
  </div>
);

const StyleButton: React.FC<{ label: string; description: string; active: boolean; onClick: () => void }> = ({ label, description, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full text-left p-3 rounded-xl border transition-all duration-300 group ${
      active ? 'bg-white/10 border-white/20 text-white' : 'bg-slate-900/30 border-white/5 text-slate-500 hover:text-slate-400'
    }`}
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {active && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
    </div>
    <p className="text-[9px] font-mono opacity-60 leading-tight">{description}</p>
  </button>
);

export default App;
