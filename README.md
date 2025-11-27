# Audio Hum Remover - Full-Stack Application

A comprehensive full-stack web application that removes power line hum (50Hz/60Hz) from audio files using IIR notch filters. Built with Python Flask backend and React frontend with Tailwind CSS.

## Features

- 🎵 **Audio Processing**: Remove power line hum using scipy IIR notch filters
- 🎯 **Dual Frequency Support**: Choose between 50 Hz (Europe/Asia/Africa) or 60 Hz (Americas/Japan)
- 🎨 **Beautiful UI**: Modern, responsive dark theme built with Tailwind CSS 4.1
- 🎧 **Audio Comparison**: Side-by-side playback of original and processed audio
- 💾 **Easy Download**: Export processed audio as WAV file
- 📱 **Mobile Friendly**: Fully responsive design for all devices

## Technology Stack

### Backend

- **Python 3.8+**
- **Flask** - Web framework
- **scipy** - Signal processing and filter design
- **numpy** - Numerical computations
- **pydub** - Audio file handling (MP3, OGG, FLAC support)

### Frontend

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS 4.1** - Styling
- **Modern ES6+** - JavaScript features

## How It Works

### Audio Processing Pipeline

1. **Upload**: User uploads an audio file (WAV, MP3, OGG, or FLAC)
2. **Frequency Selection**: User selects the power line frequency (50 Hz or 60 Hz)
3. **Filter Design**: Backend designs IIR notch filters using `scipy.signal.iirnotch`
4. **Filtering**: Applies notch filters at:
   - Fundamental frequency (f₀)
   - First harmonic (2 × f₀)
   - Second harmonic (3 × f₀)
5. **Output**: Returns processed audio as base64-encoded WAV file
6. **Playback & Download**: User can compare and download the cleaned audio

### IIR Notch Filter Specifications

- **Filter Type**: Infinite Impulse Response (IIR) Notch Filter
- **Quality Factor (Q)**: 30 (narrow notch to preserve surrounding frequencies)
- **Center Frequencies**: f₀, 2f₀, 3f₀ (where f₀ is 50 or 60 Hz)
- **Implementation**: `scipy.signal.iirnotch` and `scipy.signal.lfilter`

## Installation & Setup

### Prerequisites

- **Python 3.8 or higher**
- **Node.js 16 or higher**
- **npm or yarn**

### Backend Setup

1. **Navigate to backend directory**:

   ```bash
   cd signalsFinal/backend
   ```

2. **Install Python dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Flask backend**:

   ```bash
   python app.py
   ```

   The backend will start on `http://localhost:5000`

### Frontend Setup

1. **Open a new terminal** (keep the backend running)

2. **Navigate to frontend directory**:

   ```bash
   cd signalsFinal/frontend
   ```

3. **Install Node.js dependencies**:

   ```bash
   npm install
   ```

4. **Start the development server**:

   ```bash
   npm run dev
   ```

   The frontend will start on `http://localhost:3000` and open automatically in your browser.

## Usage

1. **Open the application** in your browser at `http://localhost:3000`

2. **Upload an audio file**:

   - Click the upload area or drag and drop
   - Supported formats: WAV, MP3, OGG, FLAC
   - Maximum file size: 50MB

3. **Select hum frequency**:

   - Choose **50 Hz** for Europe, Asia, Africa, Australia
   - Choose **60 Hz** for Americas (USA, Canada, etc.) and Japan

4. **Process the audio**:

   - Click the "Process Audio" button
   - Wait for processing to complete (usually a few seconds)

5. **Compare results**:

   - Listen to both original and processed audio
   - Compare the difference in audio quality

6. **Download**:
   - Click "Download Processed Audio" to save the cleaned file
   - File will be saved as WAV format

## API Endpoints

### POST `/api/process-audio`

Process an audio file to remove power line hum.

**Request**:

- Content-Type: `multipart/form-data`
- Body:
  - `file`: Audio file (WAV, MP3, OGG, or FLAC)
  - `humFrequency`: Integer, either 50 or 60 (optional, defaults to 60)

**Response** (Success):

```json
{
  "success": true,
  "processedAudio": "base64_encoded_wav_data",
  "sampleRate": 44100,
  "humFrequency": 60,
  "message": "Successfully removed 60 Hz hum and harmonics"
}
```

**Response** (Error):

```json
{
  "error": "Error message describing the issue"
}
```

### GET `/api/health`

Health check endpoint.

**Response**:

```json
{
  "status": "ok",
  "message": "Audio processing API is running"
}
```

## Project Structure

```
signalsFinal/
├── backend/
│   ├── app.py             # Flask backend with audio processing
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── main.jsx       # React entry point
│   │   └── styles.css     # Tailwind CSS imports
│   ├── index.html         # HTML entry point
│   ├── package.json       # Node.js dependencies and scripts
│   └── vite.config.js     # Vite configuration
├── README.md              # This file
├── QUICKSTART.md          # Quick setup guide
└── ARCHITECTURE.md        # Technical details
```

## Technical Details

### Filter Design Parameters

- **Notch Filter Design**: `scipy.signal.iirnotch(w0, Q, fs)`

  - `w0`: Normalized frequency (center_freq / nyquist_freq)
  - `Q`: Quality factor = 30
  - `fs`: Sample rate of the audio

- **Applied Filters**:
  1. Primary notch at fundamental (50 or 60 Hz)
  2. Second notch at first harmonic (100 or 120 Hz)
  3. Third notch at second harmonic (150 or 180 Hz)

### Audio Format Support

- **Native WAV**: Handled by `scipy.io.wavfile`
- **MP3/OGG/FLAC**: Requires `pydub` (which uses FFmpeg under the hood)
- **Output Format**: Always WAV (16-bit PCM)

### CORS Configuration

The backend is configured with CORS enabled to allow requests from the React development server. In production, configure CORS appropriately for your domain.

## Troubleshooting

### Backend Issues

**Error: "No module named 'scipy'"**

- Solution: Run `pip install -r requirements.txt` to install all required packages

**Error: "pydub is required for MP3 processing"**

- Solution: Install pydub: `pip install pydub`
- For MP3 support, you may also need FFmpeg installed on your system

**Port 5000 already in use**

- Solution: Change the port in `app.py` (last line) from 5000 to another port

### Frontend Issues

**Error: "Cannot find module 'react'"**

- Solution: Run `npm install` in the project directory

**Error: "Failed to fetch"**

- Solution: Ensure the backend is running on `http://localhost:5000`
- Check CORS settings if accessing from a different domain

**Tailwind styles not working**

- Solution: Ensure `src/styles.css` contains `@import "tailwindcss";`
- Restart the dev server: `npm run dev`

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- **File Size Limit**: 50MB (configurable in `app.py`)
- **Processing Time**: Typically 1-5 seconds for most audio files
- **Memory Usage**: Depends on audio file size; approximately 3-5x the file size during processing

## Future Enhancements

- [ ] Support for more audio formats (AAC, M4A)
- [ ] Adjustable Q factor for filter customization
- [ ] Batch processing multiple files
- [ ] Visualization of frequency spectrum before/after
- [ ] Additional harmonic removal (4th, 5th harmonics)
- [ ] Real-time preview during processing

## License

This project is provided as-is for educational and personal use.

## Credits

Built with:

- [Flask](https://flask.palletsprojects.com/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [SciPy](https://scipy.org/)
- [Vite](https://vitejs.dev/)

---

**Enjoy your hum-free audio! 🎵**
