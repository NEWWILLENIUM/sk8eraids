
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  Film, 
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
  Share2, 
  Settings2,
  RotateCcw,
  Download,
  Terminal
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

const ASCII_BANNER = `
  /$$$$$$  /$$   /$$  /$$$$$$  /$$$$$$$$ /$$$$$$$$ /$$$$$$$   /$$$$$$  /$$$$$$$  /$$$$$$$$
 /$$__  $$| $$  /$$/ /$$__  $$|__  $$__/| $$_____/| $$__  $$ /$$__  $$| $$__  $$| $$_____/
| $$  \\__/| $$ /$$/ | $$  \\ $$   | $$   | $$      | $$  \\ $$| $$  \\ $$| $$  \\ $$| $$      
|  $$$$$$ | $$$$$/  | $$$$$$$$   | $$   | $$$$$   | $$$$$$$/| $$$$$$$$| $$  | $$| $$$$$   
 \\____  $$| $$  $$  | $$__  $$   | $$   | $$__/   | $$__  $$| $$__  $$| $$  | $$| $$__/   
 /$$  \\ $$| $$\\  $$ | $$  | $$   | $$   | $$      | $$  \\ $$| $$  | $$| $$  | $$| $$      
|  $$$$$$/| $$ \\  $$| $$  | $$   | $$   | $$$$$$$$| $$  | $$| $$  | $$| $$$$$$$/| $$$$$$$$
 \\______/ |__/  \\__/|__/  |__/   |__/   |________/|__/  |__/|__/  |__/|_______/ |________/
                                       v1.0 Beta - The Authentic VX1000 Experience
`;

const App: React.FC = () => {
  // Video States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Manual Look State
  const [look, setLook] = useState<LookState>({
    cyanBlueTint: 0, 
    vignetteIntensity: 0, 
    contrast: 0, 
    sharpen: 0,
    saturation: 1.0,
    exposure: 1.0,
    aspectRatio: 'original'
  });

  // Motion State - STRICT LOCK: DO NOT MODIFY MATH
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // S-Curve Generation for Non-Linear Contrast
  const sCurveTable = useMemo(() => {
    const intensity = look.contrast;
    const points = 12;
    const table = [];
    for (let i = 0; i < points; i++) {
      const x = i / (points - 1);
      const s = x * x * (3 - 2 * x);
      const val = x + (s - x) * intensity;
      table.push(val.toFixed(4));
    }
    return table.join(' ');
  }, [look.contrast]);

  // Selective Tint Logic
  const tintValues = useMemo(() => {
    const t = look.cyanBlueTint;
    return `
      1.0 0.0 0.0 0.0 0.0
      0.0 1.0 0.0 0.0 ${t * 0.08}
      0.0 0.0 1.0 0.0 ${t * 0.18}
      0.0 0.0 0.0 1.0 0.0
    `;
  }, [look.cyanBlueTint]);

  const applyPreset = (preset: 'raw' | 'classic' | 'gritty' | 'master_mk1') => {
    switch (preset) {
      case 'raw':
        setLook({
          cyanBlueTint: 0,
          vignetteIntensity: 0,
          contrast: 0,
          sharpen: 0,
          saturation: 1.0,
          exposure: 1.0,
          aspectRatio: 'original'
        });
        break;
      case 'master_mk1':
        setLook({
          cyanBlueTint: 0.72,
          vignetteIntensity: 0.95,
          contrast: 0.55,
          sharpen: 0.35,
          saturation: 1.25,
          exposure: 1.10,
          aspectRatio: '4:3'
        });
        break;
      case 'classic':
        setLook({
          cyanBlueTint: 0.50,
          vignetteIntensity: 0.75,
          contrast: 0.40,
          sharpen: 0.25,
          saturation: 1.15,
          exposure: 1.05,
          aspectRatio: '4:3'
        });
        break;
      case 'gritty':
        setLook({
          cyanBlueTint: 0.35,
          vignetteIntensity: 0.90,
          contrast: 0.85,
          sharpen: 0.60,
          saturation: 0.85,
          exposure: 0.98,
          aspectRatio: '4:3'
        });
        break;
    }
  };

  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
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

  // Motion Ramping Logic - STRICT LOCK: DO NOT MODIFY
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
      applyPreset('raw');
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

      const { upload_url, gcs_uri } = await vxService.signUpload(activeClip.file.name, activeClip.file.type);
      
      setStatus(ProcessingStatus.UPLOADING);
      await vxService.uploadFile(upload_url, activeClip.file, (progress) => {
        setUploadProgress(progress);
      });

      setStatus(ProcessingStatus.PROCESSING);
      const result = await vxService.processVideo(gcs_uri, VXStyle.RAW_MK1);
      
      setProcessingResult(result);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      console.error('Skaterade Cloud Error:', err);
      setError(err.message || 'An unexpected error occurred during export.');
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const formatTime = (time: number) => {
    const s = Math.floor(time || 0);
    const ms = Math.floor(((time || 0) % 1) * 100);
    return `${s}.${ms.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="flex flex-col h-screen bg-[#050506] text-slate-200 font-sans overflow-hidden">
      <input type="file" accept="video/mp4,video/quicktime" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      {/* Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-lg z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Settings2 className="text-black" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight italic uppercase leading-tight">
              SKATERADE <span className="text-emerald-500 font-black">PRO</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Sony CCD Engine v1.0 Beta</p>
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
              <><Share2 size={14} /> Export Final Master</>
            ) : (
              <><Loader2 size={14} className="animate-spin" /> {status}...</>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Streamlit-inspired Sidebar */}
        <aside className="w-80 bg-black border-r border-white/5 flex flex-col overflow-hidden z-20">
          <div className="p-6 border-b border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Terminal size={14} className="text-emerald-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Preset Master</span>
            </div>
            <select 
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-2.5 text-[11px] font-black uppercase tracking-widest focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
              onChange={(e) => applyPreset(e.target.value as any)}
              value={look.vignetteIntensity === 0.95 ? 'master_mk1' : (look.cyanBlueTint === 0 ? 'raw' : 'custom')}
            >
              <option value="raw">Raw (Clean)</option>
              <option value="master_mk1">Master MK1 (Pro)</option>
              <option value="classic">Classic VX</option>
              <option value="gritty">Gritty / Grime</option>
              <option value="custom" disabled>Custom Look</option>
            </select>
          </div>

          <div className="flex-1 p-6 overflow-y-auto space-y-8 scrollbar-hide">
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Eye className="text-emerald-500" size={16} />
                  <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Filtering Suite</h2>
                </div>
                <button onClick={() => applyPreset('raw')} className="p-1 hover:text-emerald-400 text-slate-600 transition-all">
                  <RotateCcw size={14} />
                </button>
              </div>
              
              <div className="space-y-6">
                <ControlSlider label="Cyan / Blue Tint" value={look.cyanBlueTint} onChange={v => setLook(l => ({...l, cyanBlueTint: v}))} />
                <ControlSlider label="Black Crush (S-Curve)" value={look.contrast} onChange={v => setLook(l => ({...l, contrast: v}))} />
                <ControlSlider label="Digital Sharpening" value={look.sharpen} onChange={v => setLook(l => ({...l, sharpen: v}))} />
                <ControlSlider label="Saturation" min={0} max={2.0} step={0.01} value={look.saturation} onChange={v => setLook(l => ({...l, saturation: v}))} />
                <ControlSlider label="MK1 Vignette" value={look.vignetteIntensity} onChange={v => setLook(l => ({...l, vignetteIntensity: v}))} />
                
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-3">Aspect Ratio</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setLook(l => ({...l, aspectRatio: 'original'}))}
                      className={`py-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${look.aspectRatio === 'original' ? 'bg-emerald-500 text-black' : 'bg-slate-900 text-slate-400'}`}
                    >
                      Native
                    </button>
                    <button 
                      onClick={() => setLook(l => ({...l, aspectRatio: '4:3'}))}
                      className={`py-2 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${look.aspectRatio === '4:3' ? 'bg-emerald-500 text-black' : 'bg-slate-900 text-slate-400'}`}
                    >
                      4:3 Lock
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="pt-8 border-t border-white/5">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="text-emerald-500" size={16} />
                <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Speed Ramping</h2>
              </div>
              <div className="space-y-6">
                <ControlSlider label="Ramp Aggression" value={motion.rampIntensity} onChange={v => setMotion(m => ({...m, rampIntensity: v}))} />
                <ControlSlider label="Floor Speed" min={0.1} max={0.75} step={0.05} value={motion.slowSpeed} onChange={v => setMotion(m => ({...m, slowSpeed: v}))} />
                <ControlSlider label="Ramp Width" min={0.05} max={0.4} step={0.01} value={motion.rampWidth} onChange={v => setMotion(m => ({...m, rampWidth: v}))} />
              </div>
            </section>
          </div>
        </aside>

        {/* Workspace */}
        <div className="flex-1 flex flex-col bg-[#050506] relative">
          <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
            {/* SVG Filters */}
            <svg className="hidden">
              <defs>
                <filter id="skaterade-pro-filter">
                  <feColorMatrix type="matrix" values={tintValues} />
                  <feComponentTransfer>
                    <feFuncR type="table" tableValues={sCurveTable} />
                    <feFuncG type="table" tableValues={sCurveTable} />
                    <feFuncB type="table" tableValues={sCurveTable} />
                  </feComponentTransfer>
                  <feConvolveMatrix 
                    order="3" 
                    kernelMatrix={`0 -${look.sharpen} 0 -${look.sharpen} ${1 + look.sharpen * 4} -${look.sharpen} 0 -${look.sharpen} 0`} 
                    preserveAlpha="true" 
                  />
                </filter>
              </defs>
            </svg>

            {activeClip ? (
              <div 
                className={`relative h-full max-h-[82vh] bg-black rounded-sm overflow-hidden shadow-[0_0_80px_rgba(0,0,0,1)] border border-white/5 transition-all duration-500 ${look.aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-video'}`}
                style={{
                  filter: `url(#skaterade-pro-filter) brightness(${look.exposure}) saturate(${look.saturation})`
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
                
                {look.vignetteIntensity > 0 && (
                  <div className="absolute inset-0 pointer-events-none z-20" style={{ opacity: look.vignetteIntensity }}>
                    <div className="absolute inset-0" style={{
                      background: `radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.1) 60%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0.95) 95%, #000 100%)`
                    }} />
                  </div>
                )}

                {/* Video Playback HUD */}
                <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center opacity-0 hover:opacity-100 transition-opacity z-30">
                  <div className="flex items-center gap-6 px-8 py-3 bg-black/80 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
                    <button onClick={() => setCurrentTime(0)} className="hover:text-emerald-400 transition-colors">
                      <SkipBack size={20} />
                    </button>
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                    >
                      {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <button className="hover:text-emerald-400 transition-colors">
                      <Maximize size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl w-full flex flex-col items-center">
                <pre className="text-emerald-500/40 text-[7px] leading-[1] font-mono mb-8 select-none">
                  {ASCII_BANNER}
                </pre>
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Welcome to Skaterade v1.0</h2>
                  <p className="text-slate-500 text-sm font-medium max-w-md mx-auto">
                    Upload your raw footage to get that authentic VX1000 vibe. Professional-grade CCD filtering and speed ramping logic included.
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-6 px-8 py-3 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-full hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20"
                  >
                    Get Started - Upload Clip
                  </button>
                </div>
              </div>
            )}

            {/* Cloud Status */}
            {status !== ProcessingStatus.IDLE && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-6">
                <div className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl">
                  <div className="flex items-center gap-4">
                    {status === ProcessingStatus.COMPLETED ? (
                      <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                    ) : status === ProcessingStatus.ERROR ? (
                      <AlertCircle className="text-red-500 shrink-0" size={20} />
                    ) : (
                      <Loader2 className="text-emerald-500 animate-spin shrink-0" size={20} />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-black uppercase tracking-widest truncate">{status.replace('_', ' ')}</h3>
                      <div className="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300" 
                          style={{ width: status === ProcessingStatus.UPLOADING ? `${uploadProgress}%` : '100%' }}
                        />
                      </div>
                    </div>
                  </div>

                  {status === ProcessingStatus.COMPLETED && processingResult && (
                    <div className="grid grid-cols-1 gap-2 mt-4">
                      <a 
                        href={processingResult.vertical_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 bg-emerald-500 text-black py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all"
                      >
                        <Download size={14} /> Download Final Asset
                      </a>
                    </div>
                  )}

                  {status === ProcessingStatus.ERROR && error && (
                    <div className="mt-3 text-red-400 text-[10px] font-mono leading-tight">{error}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="h-44 bg-black border-t border-white/5 px-12 py-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Locked Ramping Matrix</span>
            </div>

            <div 
              className="relative h-10 bg-white/5 rounded-full cursor-pointer group border border-white/5"
              ref={timelineRef}
              onClick={(e) => {
                const rect = timelineRef.current?.getBoundingClientRect();
                if (rect) {
                  const pos = (e.clientX - rect.left) / rect.width;
                  setCurrentTime(pos * (duration || 1));
                }
              }}
            >
              <div 
                className="absolute h-full bg-emerald-500/10 border-x border-emerald-500/20"
                style={{ 
                  left: `${(motion.rampCenter - motion.rampWidth) * 100}%`,
                  width: `${(motion.rampWidth * 2) * 100}%`
                }}
              />

              {/* Ramping Center Handle */}
              <div 
                className="absolute top-0 bottom-0 w-6 flex items-center justify-center -translate-x-1/2 cursor-ew-resize z-20"
                style={{ left: `${motion.rampCenter * 100}%` }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const move = (m: MouseEvent) => {
                    const r = timelineRef.current?.getBoundingClientRect();
                    if (r) setMotion(prev => ({...prev, rampCenter: Math.max(0, Math.min(1, (m.clientX - r.left) / r.width))}));
                  };
                  window.addEventListener('mousemove', move);
                  window.addEventListener('mouseup', () => window.removeEventListener('mousemove', move), {once: true});
                }}
              >
                <div className="w-1 h-5 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]" />
              </div>

              {/* Playhead */}
              <div 
                className="absolute top-0 bottom-0 w-px bg-white z-10"
                style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        input[type="range"] { -webkit-appearance: none; background: transparent; cursor: pointer; }
        input[type="range"]::-webkit-slider-runnable-track { background: rgba(255,255,255,0.08); height: 3px; border-radius: 2px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; height: 10px; width: 10px; background: #10b981; border-radius: 50%; margin-top: -3.5px; box-shadow: 0 0 8px rgba(16,185,129,0.5); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

const ControlSlider: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }> = ({ label, value, onChange, min = 0, max = 1, step = 0.01 }) => (
  <div className="space-y-2.5">
    <div className="flex justify-between items-center">
      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{label}</label>
      <span className="text-[9px] font-mono text-emerald-500 font-bold">{(value * 100).toFixed(0)}%</span>
    </div>
    <input type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
  </div>
);

export default App;
