import streamlit as st
import cv2
import numpy as np
import tempfile
import os
from moviepy import VideoFileClip

# --- 1. THEME & SESSION STATE ---
st.set_page_config(page_title="Skaterade Pro (Local)", layout="wide")

st.markdown("""
    <style>
    .main { background-color: #0b0d10; color: #ffffff; }
    .stSlider > div [data-baseweb="slider"] { color: #ff3131; }
    .stButton>button { width: 100%; border-radius: 8px; background-color: #ff3131; color: white; height: 3.5em; font-weight: bold; border: none; }
    [data-testid="stSidebar"] { background-color: #111418; border-right: 1px solid #222; }
    </style>
    """, unsafe_allow_html=True)

# Define defaults for reset
DEFAULTS = {"tint": 0.19, "crush": 1.12, "sat": 1.06, "vig": 1.0}

if 'vx' not in st.session_state:
    st.session_state.vx = DEFAULTS.copy()

def reset_to_raw():
    st.session_state.vx = {"tint": 0.0, "crush": 1.0, "sat": 1.0, "vig": 0.0}

# --- 2. SIDEBAR CONTROLS ---
with st.sidebar:
    st.title("🛹 SKATERADE")
    uploaded_file = st.file_uploader("SELECT VIDEO", type=["mp4", "mov"])
    
    if st.button("🔄 RESET TO RAW"):
        reset_to_raw()
        st.rerun() # Refresh to apply reset

    with st.expander("🎨 VX LOOK", expanded=True):
        t_val = st.slider("CYAN TINT", 0.0, 0.5, st.session_state.vx["tint"])
        c_val = st.slider("BLACK CRUSH", 0.5, 2.0, st.session_state.vx["crush"])
        s_val = st.slider("SATURATION", 0.0, 2.0, st.session_state.vx["sat"])
        v_val = st.slider("VIGNETTE", 0.0, 1.0, st.session_state.vx["vig"])
        # Update session state as user slides
        st.session_state.vx = {"tint": t_val, "crush": c_val, "sat": s_val, "vig": v_val}

    with st.expander("⏱️ SLOW-MO RAMP"):
        slow_active = st.checkbox("Enable Ramp", value=True)
        ramp = st.slider("Window (%)", 0, 100, (40, 60))
        speed = st.slider("Speed", 0.1, 0.9, 0.5)

# --- 3. LIVE EDITOR ---
if uploaded_file:
    # Save upload to a local temp file for speed
    tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tfile.write(uploaded_file.read())
    
    cap = cv2.VideoCapture(tfile.name)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    st.subheader("📺 COLOR-ACCURATE PREVIEW")
    scrub = st.select_slider("SCRUB THROUGH CLIP", options=range(total_frames), value=total_frames//2)
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, scrub)
    ret, frame = cap.read()
    cap.release()

    if ret:
        # High Fidelity RGB Processing
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = img_rgb.astype(np.float32) / 255.0
        img = 1 / (1 + np.exp(-10 * (img - 0.5) * c_val)) # Deep Crush
        img[:, :, 2] += t_val # Correct RGB Blue/Cyan boost
        img = np.clip(img * s_val, 0, 1)
        processed = (img * 255).astype(np.uint8)
        
        if v_val > 0:
            h, w = processed.shape[:2]
            mask = np.ones((h, w), dtype=np.float32)
            cv2.ellipse(mask, (w//2, h//2), (int(w*0.6), int(h*0.7)), 0, 0, 360, 0, -1)
            mask = cv2.GaussianBlur(mask, (w//3|1, w//3|1), 0)
            for i in range(3):
                processed[:,:,i] = (processed[:,:,i] * (1 - mask * v_val)).astype(np.uint8)
        
        st.image(processed, use_container_width=True)
        
        # --- 4. HIGH-SPEED LOCAL EXPORT ---
        if st.button("🎬 EXPORT ULTRA-HD VIDEO"):
            progress = st.progress(0)
            cap = cv2.VideoCapture(tfile.name)
            fps, h, w = cap.get(cv2.CAP_PROP_FPS), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)), int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            
            raw_out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
            out = cv2.VideoWriter(raw_out, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))

            for i in range(total_frames):
                ret, f = cap.read()
                if not ret: break
                f_rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
                f_f = f_rgb.astype(np.float32) / 255.0
                f_f = 1 / (1 + np.exp(-10 * (f_f - 0.5) * c_val))
                f_f[:, :, 2] += t_val
                f_final = (np.clip(f_f * s_val, 0, 1) * 255).astype(np.uint8)
                
                if v_val > 0:
                    for c in range(3):
                        f_final[:,:,c] = (f_final[:,:,c] * (1 - mask * v_val)).astype(np.uint8)

                rep = int(1/speed) if (slow_active and ramp[0] <= (i/total_frames)*100 <= ramp[1]) else 1
                for _ in range(rep):
                    out.write(cv2.cvtColor(f_final, cv2.COLOR_RGB2BGR))
                progress.progress(i / total_frames)

            cap.release()
            out.release()
            
            # Local High-Bitrate Export
            final_path = os.path.join(os.path.expanduser("~"), "Desktop", "Skaterade_Export.mp4")
            with VideoFileClip(raw_out) as clip:
                clip.write_videofile(final_path, codec="libx264", audio_codec="aac", ffmpeg_params=["-crf", "18"])
            st.success(f"Video saved directly to Desktop: {final_path}")
