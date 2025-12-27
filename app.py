import streamlit as st
import cv2
import numpy as np
import tempfile
from moviepy import VideoFileClip

# --- BRANDING & CONFIG ---
st.set_page_config(page_title="Skaterade", layout="wide")
st.title("Skaterade v1.0")

# --- SIDEBAR: VX LOOK & SLOW-MO RAMPS ---
st.sidebar.header("VX FILTERING")
preset = st.sidebar.selectbox("Presets", ["Custom", "Master MK1"])

# Calibrated VX Defaults
d_tint, d_crush, d_sat, d_vig = 0.0, 1.0, 1.0, 0.0
if preset == "Master MK1":
    d_tint, d_crush, d_sat, d_vig = 0.19, 1.12, 1.06, 1.0

tint = st.sidebar.slider("CYAN TINT", 0.0, 0.5, d_tint)
crush = st.sidebar.slider("BLACK CRUSH", 0.5, 2.0, d_crush)
sat = st.sidebar.slider("SATURATION", 0.0, 2.0, d_sat)
vig_strength = st.sidebar.slider("VIGNETTE", 0.0, 1.0, d_vig)

st.sidebar.markdown("---")
st.sidebar.header("RAMPED SLOW-MO")
slow_active = st.sidebar.checkbox("Enable Slow-Mo", value=True)
ramp_start = st.sidebar.slider("Ramp Start (%)", 0, 100, 40)
ramp_end = st.sidebar.slider("Ramp End (%)", 0, 100, 60)
slow_speed = st.sidebar.slider("Slow-Mo Intensity", 0.1, 0.9, 0.5)

# --- MEDIA HANDLING ---
uploaded_file = st.file_uploader("Upload Clip", type=["mp4", "mov"])

if uploaded_file:
    # Use temp file for processing
    tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tfile.write(uploaded_file.read())
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Original Clip")
        st.video(tfile.name)

    # --- LIVE PREVIEW LOGIC ---
    # We grab a middle frame to show the effects live
    cap = cv2.VideoCapture(tfile.name)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)
    ret, frame = cap.read()
    cap.release()

    if ret:
        with col2:
            st.subheader("Live Filter Preview")
            # Apply filters to preview frame
            f = frame.astype(np.float32) / 255.0
            f = 1 / (1 + np.exp(-10 * (f - 0.5) * crush)) # Contrast
            f[:, :, 0] += tint # Tint
            f = np.clip(f * sat, 0, 1)
            preview_frame = (f * 255).astype(np.uint8)
            
            # Vignette Preview
            if vig_strength > 0:
                h, w = preview_frame.shape[:2]
                mask = np.ones((h, w), dtype=np.float32)
                cv2.ellipse(mask, (w//2, h//2), (int(w*0.6), int(h*0.7)), 0, 0, 360, 0, -1)
                mask = cv2.GaussianBlur(mask, (w//3|1, w//3|1), 0)
                for i in range(3):
                    preview_frame[:,:,i] = preview_frame[:,:,i] * (1 - mask * vig_strength)
            
            st.image(preview_frame, channels="BGR", use_container_width=True)

    # --- EXPORT BUTTON ---
    if st.button("🚀 EXPORT FINAL VIDEO", use_container_width=True):
        progress = st.progress(0)
        status = st.empty()
        
        # Rendering Engine
        cap = cv2.VideoCapture(tfile.name)
        fps = cap.get(cv2.CAP_PROP_FPS)
        h, w = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)), int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        
        raw_out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
        out = cv2.VideoWriter(raw_out, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))

        for i in range(total_frames):
            ret, frame = cap.read()
            if not ret: break
            
            # Filter Logic
            f = frame.astype(np.float32) / 255.0
            f = 1 / (1 + np.exp(-10 * (f - 0.5) * crush))
            f[:, :, 0] += tint
            frame = (np.clip(f * sat, 0, 1) * 255).astype(np.uint8)
            
            if vig_strength > 0:
                mask = np.ones((h, w), dtype=np.float32)
                cv2.ellipse(mask, (w//2, h//2), (int(w*0.6), int(h*0.7)), 0, 0, 360, 0, -1)
                mask = cv2.GaussianBlur(mask, (w//3|1, w//3|1), 0)
                for i in range(3):
                    frame[:,:,i] = frame[:,:,i] * (1 - mask * vig_strength)

            # Slow-Mo Ramp Logic
            repeat = 1
            if slow_active:
                p = (i / total_frames) * 100
                if ramp_start <= p <= ramp_end:
                    repeat = int(1 / slow_speed)
            
            for _ in range(repeat):
                out.write(frame)
            progress.progress(i / total_frames)

        cap.release()
        out.release()
        
        # Web-Safe Re-encode
        status.text("Finalizing file for mobile...")
        final_path = raw_out.replace(".mp4", "_ready.mp4")
        with VideoFileClip(raw_out) as clip:
            clip.write_videofile(final_path, codec="libx264")
            
        with open(final_path, "rb") as f:
            st.download_button("💾 DOWNLOAD VIDEO", f, "Skaterade_Edit.mp4", use_container_width=True)
        st.success("Export Complete!")
