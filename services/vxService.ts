
import { VXStyle, ProcessingResult } from '../types';

const API_BASE = 'https://vx-skate-processor-675304308102.us-central1.run.app';

export const vxService = {
  async signUpload(filename: string, contentType: string): Promise<{ upload_url: string; gcs_uri: string }> {
    try {
      const response = await fetch(`${API_BASE}/sign-upload`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify({ filename, content_type: contentType }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Sign upload failed (${response.status}): ${text || response.statusText}`);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Network error or CORS block. Please check your connection or ensuring the API is reachable.');
      }
      throw error;
    }
  },

  async uploadFile(uploadUrl: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      
      // CRITICAL: Use the file's actual type so it matches the GCS signed signature
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}. This usually means a signature mismatch.`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload (possible CORS issue)'));
      xhr.send(file);
    });
  },

  async processVideo(inputUri: string, style: VXStyle = VXStyle.CLASSIC_LONGLENS): Promise<ProcessingResult> {
    try {
      const response = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        body: JSON.stringify({
          input_uri: inputUri,
          style: style,
          output_prefix: `vx_edit_${Date.now()}`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Processing failed with status ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        throw new Error('Processing request blocked by network/CORS. Check if the backend is online.');
      }
      throw error;
    }
  }
};
