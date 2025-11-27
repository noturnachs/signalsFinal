# Application Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │          React Frontend (Port 3000)               │  │
│  │  • Upload Interface                               │  │
│  │  • Frequency Selection (50/60 Hz)                 │  │
│  │  • Audio Playback (Original + Processed)          │  │
│  │  • Download Controls                              │  │
│  └───────────────────┬───────────────────────────────┘  │
└────────────────────────┼───────────────────────────────┘
                         │ HTTP POST (multipart/form-data)
                         │ /api/process-audio
                         ↓
┌─────────────────────────────────────────────────────────┐
│             Flask Backend (Port 5000)                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │  API Endpoint: /api/process-audio                 │  │
│  │  1. Receive audio file                            │  │
│  │  2. Load & decode audio                           │  │
│  │  3. Design IIR notch filters                      │  │
│  │  4. Apply filters (f₀, 2f₀, 3f₀)                 │  │
│  │  5. Encode to base64 WAV                          │  │
│  │  6. Return JSON response                          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Upload Phase
```
User selects file
    ↓
File loaded in browser
    ↓
Original audio URL created (for playback)
    ↓
User clicks "Process Audio"
```

### 2. Processing Phase
```
FormData created with:
    • file: Audio file binary
    • humFrequency: 50 or 60
    ↓
POST to /api/process-audio
    ↓
Backend receives file
    ↓
scipy.io.wavfile or pydub loads audio
    ↓
Convert to float32 numpy array
    ↓
FOR EACH frequency (f₀, 2f₀, 3f₀):
    • Design IIR notch filter (scipy.signal.iirnotch)
    • Apply filter (scipy.signal.lfilter)
    ↓
Convert back to int16
    ↓
Save as WAV in memory (BytesIO)
    ↓
Encode to base64
    ↓
Return JSON with base64 audio
```

### 3. Playback Phase
```
Frontend receives base64 audio
    ↓
Convert base64 → Blob
    ↓
Create object URL
    ↓
Set as src for <audio> element
    ↓
User can play and compare
    ↓
User clicks download
    ↓
Trigger browser download with blob
```

## Component Breakdown

### Backend (`app.py`)

**Key Functions:**

1. **`load_audio_file()`**
   - Loads WAV using scipy.io.wavfile
   - Loads MP3/OGG/FLAC using pydub
   - Normalizes to float32

2. **`design_notch_filter()`**
   - Uses scipy.signal.iirnotch
   - Q factor = 30 (narrow notch)
   - Returns b, a coefficients

3. **`apply_notch_filter()`**
   - Applies scipy.signal.lfilter
   - Handles mono and stereo

4. **`remove_hum()`**
   - Orchestrates filter application
   - Removes f₀, 2f₀, 3f₀

5. **`save_audio_to_base64()`**
   - Converts to int16
   - Saves as WAV
   - Encodes to base64

### Frontend (`src/App.jsx`)

**Key State:**
- `selectedFile`: Uploaded file object
- `humFrequency`: 50 or 60 Hz
- `isProcessing`: Loading state
- `originalAudioUrl`: Blob URL for original
- `processedAudioUrl`: Blob URL for processed
- `processedAudioData`: Base64 string for download

**Key Functions:**

1. **`handleFileChange()`**
   - Updates file state
   - Creates preview URL

2. **`handleProcessAudio()`**
   - Creates FormData
   - Calls API
   - Handles response/errors

3. **`base64ToBlob()`**
   - Converts base64 to Blob
   - Used for audio playback

4. **`handleDownload()`**
   - Creates download link
   - Triggers browser download

## Filter Mathematics

### IIR Notch Filter Design

**Transfer Function:**
```
H(z) = (b₀ + b₁z⁻¹ + b₂z⁻²) / (1 + a₁z⁻¹ + a₂z⁻²)
```

**Parameters:**
- **Center Frequency (f₀)**: 50 or 60 Hz
- **Quality Factor (Q)**: 30
- **Sample Rate (fs)**: Determined from audio file

**Normalized Frequency:**
```
w₀ = f₀ / (fs/2)
```

**Filter Application:**
```
y[n] = b₀x[n] + b₁x[n-1] + b₂x[n-2] - a₁y[n-1] - a₂y[n-2]
```

### Multiple Harmonics

Power line hum contains harmonics at multiples of the fundamental:
- **60 Hz system**: 60, 120, 180 Hz
- **50 Hz system**: 50, 100, 150 Hz

We apply three cascaded notch filters to remove all three.

## UI/UX Design Principles

### Visual Hierarchy
1. **Upload area** - Primary action, large and prominent
2. **Frequency selection** - Secondary, clear visual distinction
3. **Process button** - Call-to-action, gradient styling
4. **Results** - Appears below, comparison layout

### Responsive Design
- Mobile-first approach
- Grid adapts: 2 columns (desktop) → 1 column (mobile)
- Touch-friendly button sizes (min 44px height)

### User Feedback
- Loading spinner during processing
- Success/error messages with icons
- Disabled states prevent invalid actions
- File size display for transparency

### Accessibility
- Semantic HTML structure
- SVG icons for visual elements
- High contrast text (WCAG AA compliant)
- Keyboard navigation support

## Performance Considerations

### Backend
- In-memory processing (no file system writes)
- Stream-based audio handling
- 50MB file size limit
- CORS enabled for local development

### Frontend
- Lazy audio loading (only when needed)
- Object URL cleanup to prevent memory leaks
- Single-component architecture for simplicity
- Tailwind JIT compilation for minimal CSS

## Security Considerations

### Backend
- File type validation
- File size limits
- Input sanitization (frequency must be 50 or 60)
- Error handling prevents information leakage

### Frontend
- File type restrictions via accept attribute
- Client-side validation before upload
- HTTPS recommended for production
- No sensitive data stored

## Deployment Recommendations

### Development
- Backend: `python app.py` (debug mode)
- Frontend: `npm run dev` (HMR enabled)

### Production
- Backend: Use Gunicorn or uWSGI
- Frontend: Build with `npm run build`, serve static files
- Reverse proxy: Nginx or Apache
- HTTPS: Let's Encrypt certificate
- CORS: Restrict to production domain

## Technology Choices Explained

### Why Flask?
- Lightweight and simple
- Perfect for single-endpoint APIs
- Great Python ecosystem integration
- Easy to deploy

### Why React?
- Component-based architecture
- Excellent state management
- Large community and resources
- Vite for fast development

### Why Tailwind CSS 4.1?
- No configuration needed
- Utility-first approach
- Consistent design system
- Small production bundle

### Why IIR Notch Filters?
- Narrow bandwidth (preserves audio quality)
- Efficient computation
- Industry-standard approach
- Excellent phase response at Q=30

### Why scipy?
- Battle-tested signal processing
- Optimized NumPy backend
- Comprehensive filter design tools
- Python scientific computing standard

---

## Quick Reference

**Backend Port**: 5000
**Frontend Port**: 3000
**Max File Size**: 50MB
**Supported Formats**: WAV, MP3, OGG, FLAC
**Output Format**: WAV (16-bit PCM)
**Filter Type**: IIR Notch (Q=30)
**Harmonics Removed**: f₀, 2f₀, 3f₀

