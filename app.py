import streamlit as st
import cv2
import numpy as np
import tempfile
import os
from moviepy import VideoFileClip # Compatible with MoviePy 2.x

# --- BRANDING ---
st.set_page_config(page_title="Skaterade v1.0", layout="wide")
st.code("""
  /$$$$$$  /$$   /$$  /$$$$$$  /$$$$$$$$ /$$$$$$$$ /$$$$$$$   /$$$$$$  /$$$$$$$  /$$$$$$$$
 /$$__  $$| $$  /$$/ /$$__  $$|__  $$__/| $$_____/| $$__  $$ /$$__  $$| $$__  $$| $$_____/
| $$  \__/| $$ /$$/ | $$  \ $$   | $$   | $$      | $$  \ $$| $$  \ $$| $$  \ $$| $$      
|  $$$$$$ | $$$$$/  | $$$$$$$$   | $$   | $$$$$   | $$$$$$$/| $$$$$$$$| $$  | $$| $$$$$   
 \____  $$| $$  $$  | $$__  $$   | $$   | $$__/   | $$__  $$| $$__  $$| $$  | $$| $$__/   
 /$$  \ $$| $$\  $$ | $$  | $$   | $$   | $$      | $$  \ $$| $$  | $$| $$  | $$| $$      
|  $$$$$$/| $$ \  $$| $$  | $$   | $$   | $$$$$$$$| $$  | $$| $$  | $$| $$$$$$$/| $$$$$$$$
 \______/ |__/  \__/|__/  |__/   |__/   |________/|__/  |__/|__/  |__/|_______/ |________/
                                       v1.0 Beta - The Authentic VX1000 Experience
""")

st.title("Skaterade v1.0")

# --- SIDEBAR: VX FILTERING SUITE ---
st.sidebar.header("VX FILTERING SUITE")
preset = st.sidebar.selectbox("Presets", ["Custom", "Master MK1"])

# Calibrated Settings
d_tint, d_crush, d_sharp, d_sat, d_vig = 0.0, 1.0, 0.0, 1.0, 0.0
if preset == "Master MK1":
    d_tint, d_crush, d_sharp, d_sat, d_vig = 0.19, 1.12, 1.0, 1.06, 1.0

tint = st.sidebar.slider("CYAN / BLUE TINT", 0.0, 1.0, d_tint)
crush = st.sidebar.slider("BLACK CRUSH (CONTRAST)", 0.5, 2.0, d_crush)
sharp = st.sidebar.slider("DIGITAL SHARPENING", 0.0, 2.0, d_sharp)
sat = st.sidebar.slider("COLOR SATURATION", 0.0, 2.0, d_sat)
vig_strength = st.sidebar.slider("CORNER VIGNETTE", 0.0, 1.0, d_vig)

# --- LAYOUT AND PREVIEW ---
uploaded_file = st.file_uploader("Upload Clip", type=["mp4", "mov"])

if uploaded_file:
    # 1. Store the uploaded file in a temp location
    tfile = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tfile.write(uploaded_file.read())
    
    # 2. Show Previews
    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Raw Clip")
        st.video(tfile.name)
    
    # 3. Process the video on button click
    if st.button("RENDER SKATERADE LOOK", use_container_width=True):
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        # Load video properties
        cap = cv2.VideoCapture(tfile.name)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)

        # Setup temp output
        raw_out_path = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(raw_out_path, fourcc, fps, (width, height))

        # Pixel processing loop
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # Color/Contrast logic
            f = frame.astype(np.float32) / 255.0
            f = 1 / (1 + np.exp(-10 * (f - 0.5) * crush)) # Contrast Curve
            f[:, :, 0] += tint * 0.1 # Signature Blue/Cyan boost
            f = np.clip(f * sat, 0, 1)
            frame = (f * 255).astype(np.uint8)
            
            # Vignette logic
            if vig_strength > 0:
                mask = np.ones((height, width), dtype=np.float32)
                cv2.ellipse(mask, (width//2, height//2), (int(width*0.6), int(height*0.7)), 0, 0, 360, 0, -1)
                mask = cv2.GaussianBlur(mask, (width//3|1, width//3|1), 0)
                for i in range(3):
                    frame[:,:,i] = frame[:,:,i] * (1 - mask * vig_strength)

            out.write(frame)
            frame_idx += 1
            progress_bar.progress(frame_idx / total_frames)
            status_text.text(f"Processing frame {frame_idx} of {total_frames}...")

        cap.release()
        out.release()

        # 4. Final H.264 Web-Safe Re-encoding
        status_text.text("Finalizing web-safe export...")
        final_file = raw_out_path.replace(".mp4", "_final.mp4")
        with VideoFileClip(raw_out_path) as clip:
            clip.write_videofile(final_file, codec="libx264", audio_codec="aac")

        # 5. Display Processed Preview and Download
        with col2:
            st.subheader("Skaterade Look")
            st.video(final_file)
            with open(final_file, "rb") as f:
                st.download_button("💾 DOWNLOAD CLIP", f, "Skaterade_Export.mp4", use_container_width=True)
            st.success("Rendering complete!")
