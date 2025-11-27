import { useState } from "react";

const App = () => {
  // State management
  const [selectedFile, setSelectedFile] = useState(null);
  const [humFrequency, setHumFrequency] = useState(60);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
  const [processedAudioUrl, setProcessedAudioUrl] = useState(null);
  const [processedAudioData, setProcessedAudioData] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Handle file selection
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccessMessage(null);

      // Create URL for original audio preview
      const url = URL.createObjectURL(file);
      setOriginalAudioUrl(url);

      // Clear previous processed audio
      setProcessedAudioUrl(null);
      setProcessedAudioData(null);
    }
  };

  // Process audio file
  const handleProcessAudio = async () => {
    if (!selectedFile) {
      setError("Please select an audio file first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("humFrequency", humFrequency);

      // Call backend API
      const response = await fetch("http://localhost:5000/api/process-audio", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Processing failed");
      }

      // Convert base64 to blob URL for audio player
      const audioBlob = base64ToBlob(data.processedAudio, "audio/wav");
      const audioUrl = URL.createObjectURL(audioBlob);

      setProcessedAudioUrl(audioUrl);
      setProcessedAudioData(data.processedAudio);
      setSuccessMessage(data.message);
    } catch (err) {
      setError(err.message || "An error occurred during processing");
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert base64 to blob
  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  // Download processed audio
  const handleDownload = () => {
    if (!processedAudioData) return;

    const blob = base64ToBlob(processedAudioData, "audio/wav");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `processed_${selectedFile.name.replace(
      /\.[^/.]+$/,
      ""
    )}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset form
  const handleReset = () => {
    setSelectedFile(null);
    setOriginalAudioUrl(null);
    setProcessedAudioUrl(null);
    setProcessedAudioData(null);
    setError(null);
    setSuccessMessage(null);
    setHumFrequency(60);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <header className="mb-6 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-slate-900 rounded">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                Audio Hum Remover
              </h1>
              <p className="text-sm text-slate-600">
                Remove 50Hz/60Hz power line interference
              </p>
            </div>
          </div>
        </header>

        {/* Main Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
          {/* Upload Section */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Audio File
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".wav,.mp3,.ogg,.flac"
                onChange={handleFileChange}
                className="hidden"
                id="audio-upload"
              />
              <label
                htmlFor="audio-upload"
                className="flex items-center justify-center w-full px-4 py-6 bg-slate-50 border border-slate-300 rounded cursor-pointer hover:bg-slate-100 hover:border-slate-400 transition-colors"
              >
                <div className="text-center">
                  <svg
                    className="w-8 h-8 mx-auto mb-2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  {selectedFile ? (
                    <div>
                      <p className="text-slate-900 font-medium text-sm mb-0.5">
                        {selectedFile.name}
                      </p>
                      <p className="text-slate-500 text-xs">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-slate-700 font-medium text-sm mb-0.5">
                        Choose file
                      </p>
                      <p className="text-slate-500 text-xs">
                        WAV, MP3, OGG, FLAC • Max 50MB
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Controls Section */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Power Line Frequency
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHumFrequency(50)}
                className={`px-4 py-3 border rounded font-medium text-sm transition-colors ${
                  humFrequency === 50
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                }`}
              >
                <div className="font-semibold">50 Hz</div>
                <div className="text-xs mt-0.5 opacity-75">
                  Europe, Asia, Africa
                </div>
              </button>
              <button
                type="button"
                onClick={() => setHumFrequency(60)}
                className={`px-4 py-3 border rounded font-medium text-sm transition-colors ${
                  humFrequency === 60
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                }`}
              >
                <div className="font-semibold">60 Hz</div>
                <div className="text-xs mt-0.5 opacity-75">Americas, Japan</div>
              </button>
            </div>
          </div>

          {/* Process Button */}
          <button
            onClick={handleProcessAudio}
            disabled={!selectedFile || isProcessing}
            className="w-full px-4 py-2.5 bg-slate-900 text-white font-medium text-sm rounded hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              "Process Audio"
            )}
          </button>

          {/* Status Messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm">
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-red-900">Error</p>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm">
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-green-900">Success</p>
                  <p className="text-green-700">{successMessage}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {(originalAudioUrl || processedAudioUrl) && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Results
            </h2>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Original Audio */}
              {originalAudioUrl && (
                <div className="border border-slate-200 rounded p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="w-4 h-4 text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                    </svg>
                    <h3 className="text-sm font-medium text-slate-900">
                      Original
                    </h3>
                  </div>
                  <audio
                    controls
                    src={originalAudioUrl}
                    className="w-full h-9"
                  />
                  <p className="text-xs text-slate-600 mt-2">
                    Contains {humFrequency} Hz interference
                  </p>
                </div>
              )}

              {/* Processed Audio */}
              {processedAudioUrl && (
                <div className="border border-slate-200 rounded p-4 bg-slate-50">
                  <div className="flex items-center gap-2 mb-3">
                    <svg
                      className="w-4 h-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3 className="text-sm font-medium text-slate-900">
                      Processed
                    </h3>
                  </div>
                  <audio
                    controls
                    src={processedAudioUrl}
                    className="w-full h-9"
                  />
                  <p className="text-xs text-green-600 mt-2">
                    Interference removed
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {processedAudioUrl && (
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 px-4 py-2 bg-slate-900 text-white font-medium text-sm rounded hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium text-sm rounded hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reset
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-6 pt-4 border-t border-slate-200 text-center text-slate-500 text-xs">
          <p>
            IIR notch filter implementation • Removes fundamental and harmonic
            frequencies
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
