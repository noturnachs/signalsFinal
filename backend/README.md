# Backend - Audio Processing API

Flask-based REST API for removing power line hum from audio files using scipy IIR notch filters.

## Setup

Install dependencies:

```bash
pip install -r requirements.txt
```

## Run

Start the server:

```bash
python app.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### POST `/api/process-audio`

Process an audio file to remove power line hum.

**Request:**

- Content-Type: `multipart/form-data`
- Body:
  - `file`: Audio file (WAV, MP3, OGG, or FLAC)
  - `humFrequency`: Integer (50 or 60), optional, defaults to 60

**Response:**

```json
{
  "success": true,
  "processedAudio": "base64_encoded_wav_data",
  "sampleRate": 44100,
  "humFrequency": 60,
  "message": "Successfully removed 60 Hz hum and harmonics"
}
```

### GET `/api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "message": "Audio processing API is running"
}
```

## Technical Details

- **Filter Type**: IIR Notch Filter (scipy.signal.iirnotch)
- **Quality Factor**: Q = 30
- **Harmonics Removed**: Fundamental (f₀), 1st harmonic (2f₀), 2nd harmonic (3f₀)
- **Max File Size**: 50MB
- **Supported Formats**: WAV, MP3, OGG, FLAC
- **Output Format**: WAV (16-bit PCM)
