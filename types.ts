
export enum ProcessingStatus {
  IDLE = 'IDLE',
  SIGNING = 'SIGNING',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export enum VXStyle {
  CLASSIC_LONGLENS = 'classic_longlens',
  FISHEYE_DYNAMIC = 'fisheye_dynamic',
  RAW_MK1 = 'raw_mk1'
}

export interface ProcessingResult {
  youtube_url: string;
  vertical_url: string;
}

export interface LookState {
  cyanBlueTint: number;
  vignetteIntensity: number;
  contrast: number; // Black Crush
  sharpen: number;  // Digital edge enhancement
  saturation: number;
  exposure: number;
  aspectRatio: 'original' | '4:3';
}

export interface MotionState {
  rampIntensity: number;
  slowSpeed: number;
  rampCenter: number;
  rampWidth: number;
}

export interface Clip {
  id: number;
  name: string;
  url: string;
  file: File;
}
