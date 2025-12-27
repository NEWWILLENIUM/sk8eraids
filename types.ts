
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
  vxTint: number; // Changed from boolean to number (0 to 1)
  mk1Vignette: boolean;
  fisheye: number;
  grain: number;
  exposure: number;
  contrast: number;
  saturation: number;
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
