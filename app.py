import streamlit as st
import cv2
import numpy as np
import tempfile
from moviepy import VideoFileClip  # Corrected for MoviePy 2.x

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

# --- SIDEBAR CONTROLS ---
st.sidebar.header("VX FILTERING SUITE")
preset = st.sidebar.selectbox("Presets", ["Custom", "Master MK1"])

# Reference settings: Cyan 0.19, Crush 1.12, Sharp 1.0, Sat 1.06, Vig 1.0
d_tint, d_crush, d_sharp, d_sat, d_vig = 0.0, 1.0, 0.0, 1.0, 0.0
if preset == "Master MK1":
    d_tint, d_crush, d_sharp, d_sat, d_vig = 0.19, 1.12, 1.0, 1.06, 1.0

tint = st.sidebar.slider("CYAN / BLUE TINT", 0.0, 1.0, d_tint)
crush = st.sidebar.slider("BLACK CRUSH (CONTRAST)", 0.5, 2.0, d_crush)
sharp = st.sidebar.slider("DIGITAL SHARPENING", 0.0, 2.0, d_sharp)
sat = st.sidebar.slider("COLOR SATURATION", 0.0, 2.0, d_sat)
vig_strength = st.sidebar.slider("CORNER VIGNETTE", 0.0, 1.0, d_vig)

# --- VIDEO PROCESSING ---
uploaded_file = st.file_uploader("Upload Video", type=["mp4", "mov"])

if uploaded_file:
    tfile = tempfile.NamedTemporaryFile(delete=False)
    tfile.write(uploaded_file.read())
    
    if st.button("RENDER SKATERADE LOOK"):
        st.info("Processing frames... This may take a moment.")
        
        cap = cv2.VideoCapture(tfile.name)
        width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps    = cap.get(cv2.CAP_PROP_FPS)
        
        out_path = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # 1. Color and Contrast
            f = frame.astype(np.float32) / 255.0
            f = 1 / (1 + np.exp(-10 * (f - 0.5) * crush)) # Contrast
            f[:, :, 0] += tint * 0.1 # Blue Tint
            f = np.clip(f * sat, 0, 1)
            frame = (f * 255).astype(np.uint8)
            
            # 2. Master MK1 Vignette
            if vig_strength > 0:
                mask = np.ones((height, width), dtype=np.float32)
                cv2.ellipse(mask, (width//2, height//2), (int(width*0.6), int(height*0.7)), 0, 0, 360, 0, -1)
                mask = cv2.GaussianBlur(mask, (width//3|1, width//3|1), 0)
                for i in range(3):
                    frame[:,:,i] = frame[:,:,i] * (1 - mask * vig_strength)

            out.write(frame)

        cap.release()
        out.release()

        # Web-Safe Re-encoding
        clip = VideoFileClip(out_path)
        final_file = out_path.replace(".mp4", "_final.mp4")
        clip.write_videofile(final_file, codec="libx264")
        
        with open(final_file, "rb") as f:
            st.download_button("💾 DOWNLOAD SKATERADE CLIP", f, "skaterade_v1.mp4")
        st.success("Done!")
