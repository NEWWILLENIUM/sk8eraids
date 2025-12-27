
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
  Crop, 
  Settings2,
  RotateCcw
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
  // Startup ASCII Banner
  useEffect(() => {
    console.log(`%c
  /$$$$$$  /$$   /$$  /$$$$$$  /$$$$$$$$ /$$$$$$$$ /$$$$$$$   /$$$$$$  /$$$$$$$  /$$$$$$$$
 /$$__  $$| $$  /$$/ /$$__  $$|__  $$__/| $$_____/| $$__  $$ /$$__  $$| $$__  $$| $$_____/
| $$  \\__/| $$ /$$/ | $$  \\ $$   | $$   | $$      | $$  \\ $$| $$  \\ $$| $$  \\ $$| $$      
|  $$$$$$ | $$$$$/  | $$$$$$$$   | $$   | $$$$$   | $$$$$$$/| $$$$$$$$| $$  | $$| $$$$$   
 \\____  $$| $$  $$  | $$__  $$   | $$   | $$__/   | $$__  $$| $$__  $$| $$  | $$| $$__/   
 /$$  \\ $$| $$\\  $$ | $$  | $$   | $$   | $$      | $$  \\ $$| $$  | $$| $$  | $$| $$      
|  $$$$$$/| $$ \\  $$| $$  | $$   | $$   | $$$$$$$$| $$  | $$| $$  | $$| $$$$$$$/| $$$$$$$$
 \\______/ |__/  \\__/|__/  |__/   |__/   |________/|__/  |__/|__/  |__/|_______/ |________/
                                       v1.0 Beta - The Authentic VX1000 Experience
    `, "color: #10b981; font-family: monospace; font-weight: bold;");
  }, []);

  // Video States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Manual Look State - ALL OFF BY DEFAULT (0 or 1.0 neutral)
  const [look, setLook] = useState<LookState>({
    cyanBlueTint: 0, 
    vignetteIntensity: 0, 
    contrast: 0, // 0 = Neutral/Linear, 1 = Full S-Curve
    sharpen: 0,
    saturation: 1.0,
    exposure: 1.0,
    aspectRatio: 'original'
  });

  // Motion State - STRICT LOCK: DO NOT MODIFY
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

  // S-Curve Generation for Non-Linear Contrast (Protects Highs/Mids)
  const sCurveTable = useMemo(() => {
    const intensity = look.contrast;
    const points = 12;
    const table = [];
    for (let i = 0; i < points; i++) {
      const x = i / (points - 1);
      // Classic Sigmoid / S-Curve approximation using cubic Hermite
      const s = x * x * (3 - 2 * x);
      // Weighted blend for non-destructive darkening
      const val = x + (s - x) * intensity;
      table.push(val.toFixed(4));
    }
    return table.join(' ');
  }, [look.contrast]);

  // Selective Tint Logic: Protects shadows by scaling tint intensity by luminance
  const tintValues = useMemo(() => {
    const t = look.cyanBlueTint;
    return `
      1.0 0.0 0.0 0.0 0.0
      0.0 1.0 0.0 0.0 ${t * 0.08}
      0.0 0.0 1.0 0.0 ${t * 0.18}
      0.0 0.0 0.0 1.0 0.0
    `;
  }, [look.cyanBlueTint]);

  // Preset Handler
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
      applyPreset('raw'); // Critical: New import MUST start with 0 effects
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

      {/* Manual Control Header */}
      <header className="h-16 px-8 flex items-center justify-between border-b border-white/5 bg-black/60 backdrop-blur-lg z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Settings2 className="text-black" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight italic uppercase leading-tight">
              SKATERADE <span className="text-emerald-500 font-black">PRO MASTER</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Sony CCD Engine v1.0 Beta - Authentic VX1000 Experience</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-4 bg-slate-900/40 p-1.5 rounded-xl border border-white/5">
            <div className="relative group">
              <select 
                className="appearance-none bg-slate-900/80 border border-white/10 rounded-lg px-4 py-2 pr-10 text-[10px] font-black uppercase tracking-widest focus:outline-none hover:border-emerald-500/50 transition-all cursor-pointer min-w-[140px]"
                onChange={(e) => applyPreset(e.target.value as any)}
                value={look.vignetteIntensity === 0.95 ? 'master_mk1' : 'raw'}
              >
                <option value="raw">Raw (Clean)</option>
                <option value="master_mk1">Master MK1 (Pro)</option>
                <option value="classic">Classic VX</option>
                <option value="gritty">Gritty / Grime</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-emerald-500">
                <SlidersHorizontal size={14} />
              </div>
            </div>
            <button 
              onClick={() => applyPreset('raw')}
              title="Reset Skaterade CV filters"
              className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-emerald-400 transition-all border border-transparent hover:border-white/10"
            >
              <RotateCcw size={16} />
            </button>
          </div>
          
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
                <Share2 size={14} /> Export Final Master
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
        {/* Modular Sidebar */}
        <aside className="w-80 bg-black border-r border-white/5 p-6 flex flex-col gap-8 overflow-y-auto z-20">
          
          {/* Skaterade Look Section */}
          <section>
            <div className="flex items-center gap-2 mb-6">
              <Eye className="text-emerald-500" size={18} />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">SKATERADE FILTERING SUITE</h2>
            </div>
            
            <div className="space-y-5">
              <ControlSlider 
                label="Selective Cyan Tint" 
                value={look.cyanBlueTint} 
                onChange={v => setLook(l => ({...l, cyanBlueTint: v}))} 
              />
              <ControlSlider 
                label="S-Curve Black Crush" 
                value={look.contrast} 
                onChange={v => setLook(l => ({...l, contrast: v}))} 
              />
              <ControlSlider 
                label="Unsharp Mask Sharpness" 
                value={look.sharpen} 
                onChange={v => setLook(l => ({...l, sharpen: v}))} 
              />
              <ControlSlider 
                label="CCD Saturation" 
                min={0} max={2.0} step={0.01}
                value={look.saturation} 
                onChange={v => setLook(l => ({...l, saturation: v}))} 
              />
              <ControlSlider 
                label="Master MK1 Vignette" 
                value={look.vignetteIntensity} 
                onChange={v => setLook(l => ({...l, vignetteIntensity: v}))} 
              />
              <div className="h-[1px] bg-white/5 my-2" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Aspect Crop</span>
                <button 
                  onClick={() => setLook(l => ({...l, aspectRatio: l.aspectRatio === '4:3' ? 'original' : '4:3'}))}
                  className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${look.aspectRatio === '4:3' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400'}`}
                >
                  {look.aspectRatio === '4:3' ? '4:3 Locked' : 'Native'}
                </button>
              </div>
            </div>
          </section>

          {/* Separate Slow Motion Section - Logic strictly locked */}
          <section className="pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="text-emerald-500" size={18} />
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Speed Ramping</h2>
            </div>
            <div className="space-y-6">
              <ControlSlider label="Ramp Aggression" value={motion.rampIntensity} onChange={v => setMotion(m => ({...m, rampIntensity: v}))} />
              <ControlSlider label="Floor Speed" min={0.1} max={0.75} step={0.05} value={motion.slowSpeed} onChange={v => setMotion(m => ({...m, slowSpeed: v}))} />
              <ControlSlider label="Ramp Width" min={0.05} max={0.4} step={0.01} value={motion.rampWidth} onChange={v => setMotion(m => ({...m, rampWidth: v}))} />
            </div>
          </section>
        </aside>

        {/* Workspace */}
        <div className="flex-1 flex flex-col bg-[#050506] relative">
          {/* Main Preview */}
          <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
            <svg className="hidden">
              <defs>
                <filter id="skaterade-pro-filter">
                  {/* Cyan Tint Matrix - Balanced to avoid shadow contamination */}
                  <feColorMatrix 
                    type="matrix" 
                    values={tintValues} 
                  />
                  {/* S-Curve Contrast Engine - Selective Black Darkening */}
                  <feComponentTransfer>
                    <feFuncR type="table" tableValues={sCurveTable} />
                    <feFuncG type="table" tableValues={sCurveTable} />
                    <feFuncB type="table" tableValues={sCurveTable} />
                  </feComponentTransfer>
                  {/* Subtle USM Kernel: High-pass blend that avoids digital white noise */}
                  <feConvolveMatrix 
                    order="3" 
                    kernelMatrix={`0 -${look.sharpen * 0.8} 0 -${look.sharpen * 0.8} ${1 + look.sharpen * 3.2} -${look.sharpen * 0.8} 0 -${look.sharpen * 0.8} 0`} 
                    preserveAlpha="true" 
                  />
                </filter>
              </defs>
            </svg>

            <div 
              className={`relative h-full max-h-[82vh] bg-black rounded-sm overflow-hidden shadow-[0_0_120px_rgba(0,0,0,1)] border border-white/5 transition-all duration-500 ${look.aspectRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-video'}`}
              style={{
                filter: `
                  url(#skaterade-pro-filter)
                  brightness(${look.exposure}) 
                  saturate(${look.saturation})
                `
              }}
            >
              {activeClip ? (
                <div className="w-full h-full relative">
                  <video
                    ref={videoRef}
                    src={activeClip.url}
                    className="w-full h-full object-cover"
                    onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setIsPlaying(false)}
                  />
                  
                  {/* Master MK1 Vignette: Refined falloff for harsher corners with soft transition */}
                  {look.vignetteIntensity > 0 && (
                    <div className="absolute inset-0 pointer-events-none z-20" style={{ opacity: look.vignetteIntensity }}>
                      <div className="absolute inset-0" style={{
                        background: `radial-gradient(circle at center, 
                          transparent 38%, 
                          rgba(0,0,0,0.06) 58%, 
                          rgba(0,0,0,0.40) 78%, 
                          rgba(0,0,0,0.96) 91%, 
                          #000 96%, 
                          #000 100%)`
                      }} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-800">
                  <Film size={64} className="mb-4 opacity-5" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-20 text-center">Skaterade Pro Engine: Ready</p>
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
                <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 shadow-2xl overflow-hidden relative">
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
                          {status === ProcessingStatus.PROCESSING && "Engaging Skaterade Cloud GPUs..."}
                          {status === ProcessingStatus.COMPLETED && "Skaterade export successful"}
                          {status === ProcessingStatus.ERROR && "Processing failed"}
                        </p>
                      </div>
                    </div>
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
                        <Youtube size={16} /> View Preview
                      </a>
                      <a 
                        href={processingResult.vertical_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 py-3 rounded-xl border border-emerald-500/20 transition-all text-[11px] font-black uppercase tracking-tighter"
                      >
                        <Smartphone size={16} /> Final Asset
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

          {/* Locked Ramping Timeline */}
          <div className="h-48 bg-black border-t border-white/5 px-12 py-8">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[11px] font-mono text-emerald-500 font-bold uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                  <SlidersHorizontal size={14} /> Sync Status: {videoRef.current?.playbackRate.toFixed(2)}x
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
                  <MoveHorizontal size={10} /> Ramp Window
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

export default App;
