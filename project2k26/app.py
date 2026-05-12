import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image
import tensorflow as tf
import plotly.graph_objects as go
import io

# ---------------------------------------------------------
# 1. Page Config & Caching
# ---------------------------------------------------------
st.set_page_config(
    page_title="Hybrid Multi-Modal Fruit Quality System",
    page_icon="🍎",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Cache the model so it only loads once per session
@st.cache_resource
def load_fusion_model():
    try:
        # Load the custom multi-input/multi-output model
        model = tf.keras.models.load_model('final_hybrid_fruit_model.h5', compile=False)
        return model
    except Exception as e:
        return str(e)

hybrid_model = load_fusion_model()

# ---------------------------------------------------------
# 2. Sidebar Navigation
# ---------------------------------------------------------
st.sidebar.title("Navigation")
page = st.sidebar.radio("Go to:", ["📖 User Guide", "🧪 Run Diagnostics"])

st.sidebar.markdown("---")
st.sidebar.info(
    "**Hybrid Multi-Modal AI**\n\n"
    "Fuses Vision (MobileNetV2) and E-Nose IoT Sensors (MLP) to detect fruit spoilage."
)

# ---------------------------------------------------------
# 3. User Guide Page
# ---------------------------------------------------------
if page == "📖 User Guide":
    st.title("🍎 Hybrid Multi-Modal Fruit Quality System")
    st.markdown("Welcome! This AI evaluates both the **visual appearance** and **chemical emissions (gases)** of a fruit to determine its exact freshness and remaining shelf life.")
    
    st.header("How to Test the Model")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📷 1. Image Requirements")
        st.markdown(
            """
            * **Supported Fruits:** Red Apple, Banana, Strawberry, Tomato.
            * **Format:** `.jpg`, `.jpeg`, or `.png`.
            * **Rules:** Ensure the fruit is clearly visible and centered. The AI will automatically resize the image to 224x224 pixels.
            """
        )
        
    with col2:
        st.subheader("💨 2. E-Nose CSV Requirements")
        st.markdown(
            """
            * **Format:** `.csv` file.
            * **Sensors Required:** Must contain readings from MQ series sensors.
            * **Exact Headers Required:** The file *must* contain the following column names (capitalization matters):
              `Ticks`, `MQ2`, `MQ3`, `MQ4`, `MQ5`, `MQ6`, `MQ7`, `MQ8`, `MQ9`, `MQ135`
            * **Data length:** At least a few rows of continuous time-series data to calculate gas emission gradients.
            """
        )
        
    st.markdown("---")
    if type(hybrid_model) == str:
        st.error(f"⚠️ **Model Loading Error:** Ensure `best_hybrid_fruit_model.h5` is in the same directory as this script. Error: {hybrid_model}")
    else:
        st.success("✅ Model loaded successfully and ready for diagnostics!")

# ---------------------------------------------------------
# 4. Data Preprocessing Functions
# ---------------------------------------------------------
SENSOR_COLUMNS = ['MQ2', 'MQ3', 'MQ4', 'MQ5', 'MQ6', 'MQ7', 'MQ8', 'MQ9', 'MQ135']

def process_uploaded_image(upload_file):
    """Reads uploaded image, resizes to 224x224, normalizes, and expands dimensions."""
    try:
        img = Image.open(upload_file).convert('RGB')
        img = img.resize((224, 224))
        img_array = tf.keras.preprocessing.image.img_to_array(img)
        img_array = img_array / 255.0 # Normalize
        return np.expand_dims(img_array, axis=0), img # Return tensor and raw image for UI
    except Exception as e:
        return None, str(e)

def process_uploaded_csv(upload_file):
    """Reads CSV, strips headers, calculates mean, variance, and gradient (27 features)."""
    try:
        df = pd.read_csv(upload_file)
        
        # Strip hidden spaces from headers to prevent KeyError
        df.columns = df.columns.str.strip()
        
        # Check if required columns exist
        missing_cols = [col for col in SENSOR_COLUMNS if col not in df.columns]
        if missing_cols:
            return None, None, f"Missing columns: {', '.join(missing_cols)}"
            
        df_sensors = df[SENSOR_COLUMNS]
        
        # Calculate Features
        means = df_sensors.mean().values
        variances = df_sensors.var().values
        
        gradients = np.gradient(df_sensors.values, axis=0)
        mean_gradients = np.mean(gradients, axis=0) 
        
        # Concatenate into 27-dim vector and replace NaNs
        features = np.concatenate([means, variances, mean_gradients])
        features = np.nan_to_num(features)
        
        # Expand dims for batch size of 1: shape becomes (1, 27)
        tensor_features = np.expand_dims(features, axis=0)
        
        return tensor_features, mean_gradients, df_sensors.head() # Return tensor, gradients (for plots), and preview
    except Exception as e:
        return None, None, f"Error processing CSV: {str(e)}"

# ---------------------------------------------------------
# 5. Prediction Page UI (File Uploaders)
# ---------------------------------------------------------
if page == "🧪 Run Diagnostics":
    st.title("🧪 Run Fruit Diagnostics")
    st.markdown("Upload both an image and the corresponding E-Nose CSV to analyze the fruit.")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("📷 Upload Vision Data")
        img_file = st.file_uploader("Choose a Fruit Image", type=["jpg", "jpeg", "png"])
        if img_file is not None:
            st.image(img_file, caption="Uploaded Image Preview", use_container_width=True)
            
    with col2:
        st.subheader("💨 Upload Sensor Data")
        csv_file = st.file_uploader("Choose an E-Nose CSV", type=["csv"])
        if csv_file is not None:
            df_preview = pd.read_csv(csv_file).head(3)
            st.dataframe(df_preview, use_container_width=True)
            st.caption("CSV Preview (First 3 rows)")

    st.markdown("---")


    # ---------------------------------------------------------
    # 6. Inference Engine & Results
    # ---------------------------------------------------------
    # Only enable the button if both files are uploaded and model is loaded
    if img_file is not None and csv_file is not None:
        if type(hybrid_model) == str:
            st.error("Cannot run diagnostics: Model failed to load.")
        else:
            if st.button("🚀 Run Full Diagnostics", use_container_width=True):
                with st.spinner('Fusing Vision and Sensor Data... Running AI...'):
                    
                    # 1. Process Inputs
                    img_tensor, img_raw = process_uploaded_image(img_file)
                    csv_file.seek(0)
                    sensor_tensor, mean_gradients, df_preview = process_uploaded_csv(csv_file)
                    
                    if img_tensor is None:
                        st.error(f"Image Processing Error: {img_raw}")
                    elif sensor_tensor is None:
                        st.error(f"CSV Processing Error: {df_preview}")
                    else:
                        # 2. Run Model Inference
                        # Pass as a tuple to match Keras 3 multi-input requirements
                        # PASS INPUTS AS A LIST []
                        # 2. Run Model Inference
                        predictions = hybrid_model.predict((img_tensor, sensor_tensor))
                        
                        # NEW: Bulletproof extraction that ignores Keras layer names!
                        if isinstance(predictions, dict):
                            pred_values = list(predictions.values())
                            class_score = float(pred_values[0][0][0])
                            days_left = float(pred_values[1][0][0])
                        else:
                            class_score = float(predictions[0][0][0])
                            days_left = float(predictions[1][0][0])
                        
                        # Interpret Classification (Threshold 0.5)
                        is_fresh = class_score >= 0.5
                        health_status = "✅ Fresh" if is_fresh else "❌ Spoiled"
                        status_color = "normal" if is_fresh else "inverse"
                        
                        # Cap days left between 0 and 4 for display sanity
                        days_left_display = max(0.0, min(4.0, days_left))
                        
                        # 3. Display Results Dashboard
                        st.markdown("## 📊 Diagnostic Results")
                        res_col1, res_col2, res_col3 = st.columns(3)
                        
                        with res_col1:
                            st.metric(label="Overall Health Status", value=health_status, delta="Safe to Eat" if is_fresh else "Do Not Eat", delta_color=status_color)
                        with res_col2:
                            st.metric(label="Estimated Shelf Life", value=f"{days_left_display:.1f} Days Left", delta=f"AI Confidence: {abs(class_score - 0.5) * 200:.1f}%", delta_color="off")
                        with res_col3:
                            st.metric(label="Raw AI Freshness Score", value=f"{class_score:.3f}", help="Scale: 0.0 (Rotten) to 1.0 (Fresh)")
                        
                        st.markdown("---")
                        
                        # 4. Explainability: Spoilage Rate Visualization
                        st.markdown("### 🔬 Explainability: Gas Spoilage Rate")
                        st.markdown("This chart shows the rate of change (gradient) in gas emissions detected by the E-Nose. High fluctuations often indicate rapid ripening or active bacterial spoilage.")
                        
                        # Create a beautiful Plotly Bar Chart
                        fig = go.Figure(data=[
                            go.Bar(
                                x=SENSOR_COLUMNS, 
                                y=mean_gradients,
                                marker_color=['#2ecc71' if val < 0 else '#e74c3c' for val in mean_gradients],
                                text=[f"{val:.2f}" for val in mean_gradients],
                                textposition='auto'
                            )
                        ])
                        
                        fig.update_layout(
                            title="Average Rate of Change per MQ Sensor",
                            xaxis_title="Sensor Type",
                            yaxis_title="Concentration Gradient",
                            plot_bgcolor='rgba(0,0,0,0)',
                            margin=dict(l=20, r=20, t=40, b=20)
                        )
                        
                        st.plotly_chart(fig, use_container_width=True)
                        
    else:
        st.info("👆 Please upload **both** a Fruit Image and an E-Nose CSV file to enable the Diagnostics button.")

# ---------------------------------------------------------
# End of Application
# ---------------------------------------------------------