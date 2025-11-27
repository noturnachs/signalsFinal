"""
Full-Stack Audio Processing Backend
Flask API for removing power line hum from audio files using IIR notch filters
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from scipy import signal
from scipy.io import wavfile
import io
import base64
import tempfile
import os

app = Flask(__name__)
CORS(app)

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'flac'}
DEFAULT_HUM_FREQUENCY = 60
DEFAULT_QUALITY_FACTOR = 30


def is_allowed_file(filename):
    """Check if the uploaded file has an allowed extension."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def load_audio_file(file_data, file_extension):
    """
    Load audio file from bytes data.
    Returns: (audio_data, sample_rate)
    """
    if file_extension == 'wav':
        # Use scipy for WAV files
        with io.BytesIO(file_data) as audio_buffer:
            sample_rate, audio_data = wavfile.read(audio_buffer)
            # Convert to float32 for processing
            if audio_data.dtype == np.int16:
                audio_data = audio_data.astype(np.float32) / 32768.0
            elif audio_data.dtype == np.int32:
                audio_data = audio_data.astype(np.float32) / 2147483648.0
            return audio_data, sample_rate
    else:
        # For MP3 and other formats, try pydub
        try:
            from pydub import AudioSegment
            with io.BytesIO(file_data) as audio_buffer:
                audio = AudioSegment.from_file(audio_buffer, format=file_extension)
                # Convert to numpy array
                sample_rate = audio.frame_rate
                audio_data = np.array(audio.get_array_of_samples()).astype(np.float32)
                
                # Normalize based on sample width
                if audio.sample_width == 2:  # 16-bit
                    audio_data = audio_data / 32768.0
                elif audio.sample_width == 4:  # 32-bit
                    audio_data = audio_data / 2147483648.0
                
                # Handle stereo by reshaping
                if audio.channels == 2:
                    audio_data = audio_data.reshape((-1, 2))
                
                return audio_data, sample_rate
        except ImportError:
            raise Exception("pydub is required for MP3 processing. Install with: pip install pydub")


def design_notch_filter(center_freq, sample_rate, quality_factor=30):
    """
    Design an IIR notch filter using scipy.signal.iirnotch.
    
    Args:
        center_freq: Frequency to remove (Hz)
        sample_rate: Audio sample rate (Hz)
        quality_factor: Q factor (higher = narrower notch)
    
    Returns:
        b, a: Filter coefficients
    """
    # Normalize frequency (0 to 1, where 1 is Nyquist frequency)
    nyquist = sample_rate / 2.0
    normalized_freq = center_freq / nyquist
    
    # Design notch filter
    b, a = signal.iirnotch(normalized_freq, quality_factor, sample_rate)
    
    return b, a


def apply_notch_filter(audio_data, b, a):
    """
    Apply notch filter to audio data.
    Handles both mono and stereo audio.
    """
    if len(audio_data.shape) == 1:
        # Mono audio
        filtered_data = signal.lfilter(b, a, audio_data)
    else:
        # Stereo audio - filter each channel
        filtered_data = np.zeros_like(audio_data)
        for channel in range(audio_data.shape[1]):
            filtered_data[:, channel] = signal.lfilter(b, a, audio_data[:, channel])
    
    return filtered_data


def remove_hum(audio_data, sample_rate, hum_freq=60, quality_factor=30):
    """
    Remove power line hum and its first harmonic from audio.
    
    Args:
        audio_data: Audio signal as numpy array
        sample_rate: Sample rate in Hz
        hum_freq: Hum frequency (50 or 60 Hz)
        quality_factor: Q factor for notch filter
    
    Returns:
        Filtered audio data
    """
    nyquist = sample_rate / 2.0
    filtered_data = audio_data.copy()
    
    # Apply notch filter at fundamental frequency
    if hum_freq < nyquist:
        b, a = design_notch_filter(hum_freq, sample_rate, quality_factor)
        filtered_data = apply_notch_filter(filtered_data, b, a)
    
    # Apply notch filter at first harmonic (2 * f0)
    harmonic_freq = 2 * hum_freq
    if harmonic_freq < nyquist:
        b, a = design_notch_filter(harmonic_freq, sample_rate, quality_factor)
        filtered_data = apply_notch_filter(filtered_data, b, a)
    
    # Apply notch filter at second harmonic (3 * f0) for better results
    harmonic_freq_2 = 3 * hum_freq
    if harmonic_freq_2 < nyquist:
        b, a = design_notch_filter(harmonic_freq_2, sample_rate, quality_factor)
        filtered_data = apply_notch_filter(filtered_data, b, a)
    
    return filtered_data


def save_audio_to_base64(audio_data, sample_rate):
    """
    Save audio data to WAV format and encode as base64.
    
    Returns:
        Base64 encoded string of WAV file
    """
    # Convert float32 back to int16 for WAV
    audio_int16 = (audio_data * 32767).astype(np.int16)
    
    # Create WAV file in memory
    with io.BytesIO() as wav_buffer:
        wavfile.write(wav_buffer, sample_rate, audio_int16)
        wav_buffer.seek(0)
        wav_bytes = wav_buffer.read()
    
    # Encode to base64
    base64_audio = base64.b64encode(wav_bytes).decode('utf-8')
    
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
        
        # Get hum frequency parameter
        hum_frequency = int(request.form.get('humFrequency', DEFAULT_HUM_FREQUENCY))
        if hum_frequency not in [50, 60]:
            return jsonify({'error': 'Hum frequency must be 50 or 60 Hz'}), 400
        
        # Read file data
        file_data = file.read()
        
        if len(file_data) > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large. Maximum size: 50MB'}), 400
        
        # Get file extension
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        
        # Load audio file
        audio_data, sample_rate = load_audio_file(file_data, file_extension)
        
        # Process audio - remove hum
        filtered_audio = remove_hum(
            audio_data, 
            sample_rate, 
            hum_freq=hum_frequency,
            quality_factor=DEFAULT_QUALITY_FACTOR
        )
        
        # Convert to base64
        base64_audio = save_audio_to_base64(filtered_audio, sample_rate)
        
        return jsonify({
            'success': True,
            'processedAudio': base64_audio,
            'sampleRate': int(sample_rate),
            'humFrequency': hum_frequency,
            'message': f'Successfully removed {hum_frequency} Hz hum and harmonics'
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

