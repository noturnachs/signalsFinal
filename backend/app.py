"""
Full-Stack Audio Processing Backend
Flask API for removing power line hum from audio files using IIR notch filters
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from scipy import signal
from scipy.fft import rfft, rfftfreq
from scipy.io import wavfile
import io
import base64

app = Flask(__name__)
CORS(app)

# Enable response compression for better performance
app.config['JSON_SORT_KEYS'] = False  # Faster JSON serialization

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'flac'}
DEFAULT_HUM_FREQUENCY = 60
DEFAULT_QUALITY_FACTOR = 30  # Higher Q = narrower notch (preserves more audio)
MAX_HARMONICS = 5  # Remove fundamental + 4 harmonics
DEBUG_MODE = False  # Set to True for detailed logging


def is_allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def load_audio_file(file_data, file_extension):
    """
    Load audio file from bytes data efficiently.
    Returns: (audio_data, sample_rate)
    """
    if file_extension == 'wav':
        # Use scipy for WAV files (fastest method)
        with io.BytesIO(file_data) as audio_buffer:
            sample_rate, audio_data = wavfile.read(audio_buffer)
            
            # Convert to float32 efficiently using vectorized operations
            if audio_data.dtype == np.int16:
                audio_data = audio_data.astype(np.float32, copy=False) / 32768.0
            elif audio_data.dtype == np.int32:
                audio_data = audio_data.astype(np.float32, copy=False) / 2147483648.0
            elif audio_data.dtype != np.float32:
                audio_data = audio_data.astype(np.float32, copy=False)
                
            return audio_data, sample_rate
    else:
        # For MP3 and other formats, use pydub
        try:
            from pydub import AudioSegment
            with io.BytesIO(file_data) as audio_buffer:
                audio = AudioSegment.from_file(audio_buffer, format=file_extension)
                
                # Convert to numpy array efficiently
                sample_rate = audio.frame_rate
                samples = audio.get_array_of_samples()
                audio_data = np.frombuffer(samples, dtype=np.int16 if audio.sample_width == 2 else np.int32)
                
                # Normalize efficiently
                max_val = 32768.0 if audio.sample_width == 2 else 2147483648.0
                audio_data = audio_data.astype(np.float32, copy=False) / max_val
                
                # Handle stereo by reshaping (view, not copy)
                if audio.channels == 2:
                    audio_data = audio_data.reshape((-1, 2))
                
                return audio_data, sample_rate
        except ImportError:
            raise Exception("pydub is required for MP3 processing. Install with: pip install pydub")


def design_notch_filter(center_freq, sample_rate, quality_factor=30):
    """
    Design an IIR notch filter using scipy.signal.iirnotch.
    Optimized for power line hum removal.
    
    Args:
        center_freq: Frequency to remove (Hz)
        sample_rate: Audio sample rate (Hz)
        quality_factor: Q factor (30 = narrow, precise notch)
    
    Returns:
        b, a: Filter coefficients (numerator, denominator)
    """
    # Design notch filter - scipy automatically handles normalization
    b, a = signal.iirnotch(center_freq, quality_factor, sample_rate)
    return b, a


def apply_notch_filter(audio_data, b, a):
    """
    Apply notch filter to audio data using zero-phase filtering.
    Optimized for both mono and stereo audio.
    """
    if len(audio_data.shape) == 1:
        # Mono audio - use filtfilt for zero-phase filtering (no distortion)
        return signal.filtfilt(b, a, audio_data)
    else:
        # Stereo audio - filter each channel independently
        # Pre-allocate array for better memory efficiency
        filtered_data = np.empty_like(audio_data)
        for channel in range(audio_data.shape[1]):
            filtered_data[:, channel] = signal.filtfilt(b, a, audio_data[:, channel])
        return filtered_data


def detect_hum_frequency(audio_data, sample_rate):
    """
    Detect if 50Hz or 60Hz hum is present in the audio.
    Returns the detected frequency (50 or 60) or None if neither is detected.
    """
    # Use first 2 seconds of audio for analysis (or entire file if shorter)
    analysis_samples = min(len(audio_data), sample_rate * 2)
    
    # If stereo, analyze first channel
    if len(audio_data.shape) == 2:
        audio_segment = audio_data[:analysis_samples, 0]
    else:
        audio_segment = audio_data[:analysis_samples]
    
    # Compute FFT
    fft_values = rfft(audio_segment)
    fft_freqs = rfftfreq(len(audio_segment), 1/sample_rate)
    
    # Get magnitude spectrum
    magnitude = np.abs(fft_values)
    
    # Define frequency ranges to check (±2 Hz around target frequencies)
    freq_50_range = (48, 52)
    freq_60_range = (58, 62)
    
    # Find indices for 50Hz and 60Hz ranges
    idx_50 = np.where((fft_freqs >= freq_50_range[0]) & (fft_freqs <= freq_50_range[1]))[0]
    idx_60 = np.where((fft_freqs >= freq_60_range[0]) & (fft_freqs <= freq_60_range[1]))[0]
    
    # Get peak magnitudes in each range
    if len(idx_50) > 0:
        peak_50 = np.max(magnitude[idx_50])
    else:
        peak_50 = 0
    
    if len(idx_60) > 0:
        peak_60 = np.max(magnitude[idx_60])
    else:
        peak_60 = 0
    
    # Get average magnitude for comparison (excluding DC component)
    avg_magnitude = np.mean(magnitude[1:])
    
    # Define threshold: peak should be at least 3x the average magnitude
    threshold = avg_magnitude * 3
    
    print(f"Hum detection - 50Hz peak: {peak_50:.2f}, 60Hz peak: {peak_60:.2f}, Threshold: {threshold:.2f}")
    
    # Determine which frequency has stronger hum
    if peak_50 > threshold or peak_60 > threshold:
        if peak_50 > peak_60:
            print("Detected 50Hz hum")
            return 50
        else:
            print("Detected 60Hz hum")
            return 60
    else:
        print("No significant hum detected")
        return None

def remove_hum(audio_data, sample_rate, hum_freq=60, quality_factor=30):
    """
    Remove power line hum and its harmonics from audio efficiently.
    Uses cascaded notch filters at fundamental and harmonic frequencies.
    
    Args:
        audio_data: Audio signal as numpy array (float32)
        sample_rate: Sample rate in Hz
        hum_freq: Hum frequency (50 or 60 Hz)
        quality_factor: Q factor (30 = optimal for hum removal)
    
    Returns:
        Filtered audio data (float64 from filtfilt)
    """
    nyquist = sample_rate / 2.0
    filtered_data = audio_data  # Work in-place for efficiency
    
    if DEBUG_MODE:
        print(f"Processing: SR={sample_rate}Hz, Nyquist={nyquist}Hz, Hum={hum_freq}Hz")
    
    # Apply notch filters at fundamental and harmonics
    # Remove up to MAX_HARMONICS for thorough hum removal
    for harmonic in range(1, MAX_HARMONICS + 1):
        target_freq = hum_freq * harmonic
        
        # Only filter if frequency is below Nyquist limit
        if target_freq < nyquist:
            if DEBUG_MODE:
                print(f"  Filtering {target_freq}Hz (harmonic {harmonic})")
            
            b, a = design_notch_filter(target_freq, sample_rate, quality_factor)
            filtered_data = apply_notch_filter(filtered_data, b, a)
    
    return filtered_data


def save_audio_to_base64(audio_data, sample_rate):
    """
    Save audio data to WAV format and encode as base64 efficiently.
    
    Returns:
        Base64 encoded string of WAV file
    """
    # Clip to valid range to prevent overflow (in-place for efficiency)
    np.clip(audio_data, -1.0, 1.0, out=audio_data)
    
    # Convert float to int16 for WAV format efficiently
    audio_int16 = (audio_data * 32767).astype(np.int16)
    
    if DEBUG_MODE:
        print(f"Converting to WAV: range=[{audio_int16.min()}, {audio_int16.max()}]")
    
    # Create WAV file in memory buffer
    with io.BytesIO() as wav_buffer:
        wavfile.write(wav_buffer, sample_rate, audio_int16)
        wav_buffer.seek(0)
        wav_bytes = wav_buffer.read()
    
    if DEBUG_MODE:
        print(f"WAV size: {len(wav_bytes)} bytes")
    
    # Encode to base64 (most efficient method)
    base64_audio = base64.b64encode(wav_bytes).decode('ascii')
    
    return base64_audio


@app.route('/api/process-audio', methods=['POST'])
def process_audio():
    """
    Process uploaded audio file to remove power line hum.
    
    Expects:
        - file: Audio file (multipart/form-data)
        - humFrequency: 50 or 60 (optional, default 60)
    
    Returns:
        JSON with processed audio as base64 string
    """
    try:
        # Validate file upload
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not is_allowed_file(file.filename):
            return jsonify({'error': f'File type not supported. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        # Get hum frequency parameter (can be "auto", 50, or 60)
        hum_frequency_param = request.form.get('humFrequency', 'auto')
        auto_detect = hum_frequency_param == 'auto'
        
        if not auto_detect:
            hum_frequency = int(hum_frequency_param)
            if hum_frequency not in [50, 60]:
                return jsonify({'error': 'Hum frequency must be 50, 60, or "auto"'}), 400
        
        # Read file data
        file_data = file.read()
        
        if len(file_data) > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large. Maximum size: 50MB'}), 400
        
        # Get file extension
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        
        # Load audio file
        audio_data, sample_rate = load_audio_file(file_data, file_extension)
        
        if DEBUG_MODE:
            print(f"\n{'='*60}")
            print(f"Loaded: shape={audio_data.shape}, sr={sample_rate}, dtype={audio_data.dtype}")
            print(f"Range: [{audio_data.min():.3f}, {audio_data.max():.3f}]")
        
        # Auto-detect hum frequency if requested
        detected_freq = None
        if auto_detect:
            detected_freq = detect_hum_frequency(audio_data, sample_rate)
            if detected_freq:
                hum_frequency = detected_freq
                if DEBUG_MODE:
                    print(f"Auto-detected hum frequency: {hum_frequency} Hz")
            else:
                # Default to 60 Hz if no hum detected
                hum_frequency = DEFAULT_HUM_FREQUENCY
                if DEBUG_MODE:
                    print(f"No hum detected, defaulting to {hum_frequency} Hz")
        
        # Process audio - remove hum using cascaded notch filters
        filtered_audio = remove_hum(
            audio_data, 
            sample_rate, 
            hum_freq=hum_frequency,
            quality_factor=DEFAULT_QUALITY_FACTOR
        )
        
        if DEBUG_MODE:
            print(f"Filtered: shape={filtered_audio.shape}, dtype={filtered_audio.dtype}")
            print(f"Range: [{filtered_audio.min():.3f}, {filtered_audio.max():.3f}]")
            print(f"{'='*60}\n")
        
        # Convert to base64
        base64_audio = save_audio_to_base64(filtered_audio, sample_rate)
        
        # Build response message
        if auto_detect:
            if detected_freq:
                message = f'Auto-detected and removed {hum_frequency} Hz hum and harmonics'
            else:
                message = f'No hum detected. Applied {hum_frequency} Hz filter as precaution'
        else:
            message = f'Successfully removed {hum_frequency} Hz hum and harmonics'
        
        return jsonify({
            'success': True,
            'processedAudio': base64_audio,
            'sampleRate': int(sample_rate),
            'humFrequency': hum_frequency,
            'detectedFrequency': detected_freq if auto_detect else None,
            'autoDetected': auto_detect,
            'message': message
        })
    
    except Exception as e:
        return jsonify({
            'error': f'Processing failed: {str(e)}'
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'message': 'Audio processing API is running'})


if __name__ == '__main__':
    print("=" * 60)
    print("Audio Processing API Server")
    print("=" * 60)
    print("Starting Flask server on http://localhost:5000")
    print("API Endpoint: POST http://localhost:5000/api/process-audio")
    print("=" * 60)
    app.run(debug=True, port=5000, host='0.0.0.0')

