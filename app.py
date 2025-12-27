import streamlit as st
import cv2
import numpy as np
import tempfile
from moviepy import VideoFileClip

# --- 1. PROFESSIONAL UI CONFIG ---
st.set_page_config(page_title="Skaterade Pro", layout="wide", initial_sidebar_state="expanded")

# Custom CSS for a Professional Dark Theme
st.markdown("""
    <style>
    .main { background-color: #0e1117; }
    .stSlider > div [data-baseweb="slider"] { color: #ff4b4b; }
    .stButton>button { width: 100%; border-radius: 5px; height: 3em; background-color: #ff4b4b; color: white; border: none; }
    .stButton>button:hover { background-color: #ff3333; border: none; }
    .stSubheader { color: #f0f2f6; font-family: 'Courier New', Courier, monospace; letter-spacing: 2px; text-transform: uppercase; border-bottom: 1px solid #333; padding-bottom: 5px; }
    </style>
    """, unsafe_allow_html=True) # FIXED PARAMETER

# --- 2. SIDEBAR: NAVIGATION & PRESETS ---
with st.sidebar:
    st.title("🛹 SKATERADE")
    
    with st.expander("🎨 VX FILTERING", expanded=True):
        preset = st.selectbox("Load Preset", ["Custom", "Master MK1", "90s Hi-8"])
        
        # Calibration logic
        d_tint, d_crush, d_sat, d_vig = 0.0, 1.0, 1.0, 0.0
        if preset == "Master MK1":
            d_tint, d_crush, d_sat, d_vig = 0.19, 1.12, 1.06, 1.0
        elif preset == "90s Hi-8":
            d_tint, d_crush, d_sat, d_vig = 0.05, 1.4, 0.8, 0.4

        tint = st.slider("CYAN TINT", 0.0, 0.5, d_tint)
        crush = st.slider("BLACK CRUSH", 0.5, 2.0, d_crush)
        sat = st.slider("SATURATION", 0.0, 2.0, d_sat)
        vig_strength = st.slider("VIGNETTE", 0.0, 1.0, d_vig)

    with st.expander("⏱️ RAMPED SLOW-MO"):
        slow_active = st.checkbox("Enable Ramp", value=True)
        ramp_start = st.slider("Start (%)", 0, 100, 40)
        ramp_end = st.slider("End (%)", 0, 100, 60)
        slow_speed = st.slider("Intensity", 0.1, 0.9, 0.5)

# --- 3. MAIN DASHBOARD ---
col_left, col_right = st.columns([1, 1])

with col_left:
    st.subheader("📥 MEDIA INPUT")
    uploaded_file = st.file_uploader("Drop clip here", type=["mp4", "mov"])
    if uploaded_file:
        tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
        tfile.write(uploaded_file.read())
        st.video(tfile.name)

with col_right:
    st.subheader("📺 LIVE LOOK PREVIEW")
    if uploaded_file:
        # Live Preview Engine
        cap = cv2.VideoCapture(tfile.name)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Scrubber to choose which frame to preview
        preview_pos = st.slider("Preview Scrubber", 0, total_frames, total_frames//2)
        cap.set(cv2.CAP_PROP_POS_FRAMES, preview_pos)
        ret, frame = cap.read()
        cap.release()

        if ret:
            # Apply Filter Logic for Preview
            f = frame.astype(np.float32) / 255.0
            f = 1 / (1 + np.exp(-10 * (f - 0.5) * crush)) # Contrast
            f[:, :, 0] += tint # Blue Tint
            f = np.clip(f * sat, 0, 1)
            preview_frame = (f * 255).astype(np.uint8)
            
            if vig_strength > 0:
                h, w = preview_frame.shape[:2]
                mask = np.ones((h, w), dtype=np.float32)
                cv2.ellipse(mask, (w//2, h//2), (int(w*0.6), int(h*0.7)), 0, 0, 360, 0, -1)
                mask = cv2.GaussianBlur(mask, (w//3|1, w//3|1), 0)
                for i in range(3):
                    preview_frame[:,:,i] = preview_frame[:,:,i] * (1 - mask * vig_strength)
            
            st.image(preview_frame, channels="BGR", use_container_width=True)
    else:
        st.info("Upload a clip to begin.")

# --- 4. EXPORT SECTION ---
st.markdown("---")
if uploaded_file:
    if st.button("🎬 EXPORT & DOWNLOAD FINAL VIDEO"):
        progress = st.progress(0)
        status = st.empty()
        
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
                for c in range(3):
                    frame[:,:,c] = frame[:,:,c] * (1 - mask * vig_strength)

            # Slow-Mo Ramp
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
        status.info("Finalizing for download...")
        final_path = raw_out.replace(".mp4", "_final.mp4")
        with VideoFileClip(raw_out) as clip:
            clip.write_videofile(final_path, codec="libx264", audio_codec="aac")
            
        with open(final_path, "rb") as f:
            st.download_button("💾 DOWNLOAD COMPLETED CLIP", f, "Skaterade_Export.mp4")
        st.success("Export Complete!")
