# Quick Start Guide

Get up and running in 5 minutes!

## Project Structure
```
signalsFinal/
├── backend/          # Python Flask API
└── frontend/         # React UI
```

## Step 1: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

## Step 2: Start Backend Server

```bash
python app.py
```

You should see: `Starting Flask server on http://localhost:5000`

## Step 3: Install Frontend Dependencies

Open a **new terminal** (keep backend running) and run:

```bash
cd frontend
npm install
```

## Step 4: Start Frontend

```bash
npm run dev
```

The app will open automatically at `http://localhost:3000`

## Step 5: Use the App!

1. Upload an audio file (WAV, MP3, etc.)
2. Select hum frequency (50 Hz or 60 Hz)
3. Click "Process Audio"
4. Listen to the results and download!

---

## Troubleshooting

**Backend won't start?**

- Make sure Python 3.8+ is installed: `python --version`
- Ensure all dependencies are installed: `pip install -r requirements.txt`

**Frontend won't start?**

- Make sure Node.js is installed: `node --version`
- Try deleting `node_modules` and running `npm install` again

**Can't process MP3 files?**

- MP3 support requires FFmpeg. For WAV files, no additional software is needed.

---

For detailed documentation, see [README.md](README.md)
