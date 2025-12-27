import streamlit as st
import cv2
import numpy as np
import tempfile
from moviepy.editor import VideoFileClip

# --- SKATERADE ASCII BANNER ---
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
st.write("Upload your clip to apply the Master MK1 look and VX1000 filtering.")

# --- SIDEBAR CONTROLS ---
st.sidebar.header("VX FILTERING SUITE")

# Preset Toggle
preset = st.sidebar.selectbox("Presets", ["Custom", "Master MK1", "Raw Street"])

# Default Values (Custom)
d_tint, d_crush, d_sharp, d_sat, d_vig = 0.0, 1.0, 0.0, 1.0, 0.0

if preset == "Master MK1":
    d_tint, d_crush, d_sharp, d_sat, d_vig = 0.19, 1.12, 1.0, 1.06, 1.0

tint = st.sidebar.slider("CYAN / BLUE TINT", 0.0, 1.0, d_tint)
crush = st.sidebar.slider("BLACK CRUSH (CONTRAST)", 0.5, 2.0, d_crush)
sharp = st.sidebar.slider("DIGITAL SHARPENING", 0.0, 2.0, d_sharp)
sat = st.sidebar.slider("COLOR SATURATION", 0.0, 2.0, d_sat)
vig_strength = st.sidebar.slider("CORNER VIGNETTE", 0.0, 1.0, d_vig)
aspect = st.sidebar.radio("ASPECT CROP", ["NATIVE", "4:3"])

# --- CORE PROCESSING LOGIC ---
uploaded_file = st.file_uploader("Choose a video file...", type=["mp4", "mov", "avi"])

if uploaded_file is not None:
    tfile = tempfile.NamedTemporaryFile(delete=False)
    tfile.write(uploaded_file.read())
    
    if st.button("PROCESS VIDEO"):
        st.write("Processing... Please wait.")
        
        # Load Video
        cap = cv2.VideoCapture(tfile.name)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        # Setup Output
        out_path = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
        # Using a safer codec for initial OpenCV write
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # 1. Color Grading (Tint, Sat, Contrast)
            f = frame.astype(np.float32) / 255.0
            # S-Curve Contrast
            f = 1 / (1 + np.exp(-10 * (f - 0.5) * crush))
            # Tint (Blue/Cyan boost in midtones)
            f[:, :, 0] += tint * 0.1
            f = np.clip(f * sat, 0, 1)
            frame = (f * 255).astype(np.uint8)
            
            # 2. Digital Sharpening
            if sharp > 0:
                blurred = cv2.GaussianBlur(frame, (0, 0), 3)
                frame = cv2.addWeighted(frame, 1 + sharp, blurred, -sharp, 0)
            
            # 3. Master MK1 Vignette
            if vig_strength > 0:
                mask = np.ones((height, width), dtype=np.float32)
                center = (width // 2, height // 2)
                # Authentic 4:3 Rounded Geometry
                axes = (int(width * 0.6), int(height * 0.7))
                cv2.ellipse(mask, center, axes, 0, 0, 360, 0, -1)
                mask = cv2.GaussianBlur(mask, (width//3|1, width//3|1), 0)
                for i in range(3):
                    frame[:,:,i] = frame[:,:,i] * (1 - mask * vig_strength)

            out.write(frame)

        cap.release()
        out.release()

        # Final Export with H.264 (Web Safe)
        st.write("Finalizing encoding...")
        final_clip = VideoFileClip(out_path)
        final_out = out_path.replace(".mp4", "_h264.mp4")
        final_clip.write_videofile(final_out, codec="libx264")
        
        with open(final_out, "rb") as f:
            st.download_button("💾 DOWNLOAD PROCESSED CLIP", f, "skaterade_v1.mp4")
