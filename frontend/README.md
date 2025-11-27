# Frontend - Audio Hum Remover UI

React-based web interface for uploading, processing, and downloading audio files with power line hum removed.

## Setup

Install dependencies:

```bash
npm install
```

## Development

Start the dev server:

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## Build for Production

Build the app:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Features

- 📤 **File Upload**: Drag-and-drop or click to upload
- 🎛️ **Frequency Selection**: Choose 50 Hz or 60 Hz
- ⚡ **Real-time Processing**: Visual feedback during processing
- 🎵 **Audio Comparison**: Side-by-side original vs processed playback
- 💾 **Download**: Export processed audio as WAV
- 📱 **Responsive Design**: Works on mobile and desktop
- 🎨 **Modern UI**: Dark theme with Tailwind CSS 4.1

## Technology

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS 4.1** - Styling (using @tailwindcss/vite plugin)
- **Native HTML5 Audio** - Audio playback
- **Fetch API** - Backend communication

## Tailwind CSS 4.1 Setup

This project uses the latest Tailwind CSS 4.1 with the new Vite plugin:

1. **Vite Plugin** - Configured in `vite.config.js`:

```js
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

2. **CSS Import** - Simple import in `src/index.css`:

```css
@import "tailwindcss";
```

No configuration file needed! 🎉

## Configuration

Backend API URL is set to `http://localhost:5000` by default.

To change it for production, update the fetch URL in `src/App.jsx`:

```javascript
const response = await fetch("YOUR_PRODUCTION_URL/api/process-audio", {
  method: "POST",
  body: formData,
});
```
