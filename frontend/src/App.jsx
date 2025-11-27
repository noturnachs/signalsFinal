import { useState, useCallback, useEffect, useRef } from "react";

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
  const [uploadProgress, setUploadProgress] = useState(0);

  // Refs for managing requests
  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      // Clean up on component unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-clear messages after delay
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000); // Clear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  // Validate file before upload
  const validateFile = (file) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      "audio/wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/ogg",
      "audio/flac",
    ];
    const allowedExtensions = [".wav", ".mp3", ".ogg", ".flac"];

    if (file.size > maxSize) {
      throw new Error(
        `File too large. Maximum size is 50MB (current: ${(
          file.size /
          1024 /
          1024
        ).toFixed(2)}MB)`
      );
    }

    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!allowedExtensions.includes(extension)) {
      throw new Error(
        `Invalid file type. Supported formats: WAV, MP3, OGG, FLAC`
      );
    }

    return true;
  };

  // Handle file selection (memoized for performance)
  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files[0];
      if (file) {
        try {
          // Validate file
          validateFile(file);

          setSelectedFile(file);
          setError(null);
          setSuccessMessage(null);
          setUploadProgress(0);

          // Revoke old URLs before creating new ones
          if (originalAudioUrl) {
            URL.revokeObjectURL(originalAudioUrl);
          }
          if (processedAudioUrl) {
            URL.revokeObjectURL(processedAudioUrl);
          }

          // Create URL for original audio preview
          const url = URL.createObjectURL(file);
          setOriginalAudioUrl(url);

          // Clear previous processed audio
          setProcessedAudioUrl(null);
          setProcessedAudioData(null);

          // Show success message
          setSuccessMessage(`File "${file.name}" loaded successfully`);
        } catch (err) {
          setError(err.message);
          setSelectedFile(null);

          // Revoke URL on error
          if (originalAudioUrl) {
            URL.revokeObjectURL(originalAudioUrl);
          }
          setOriginalAudioUrl(null);

          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      }
    },
    [originalAudioUrl, processedAudioUrl]
  );

  // Process audio file (memoized for performance)
  const handleProcessAudio = useCallback(async () => {
    if (!selectedFile) {
      setError("Please select an audio file first");
      return;
    }

    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);
    setUploadProgress(0);

    try {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("humFrequency", humFrequency);

      // Create abort controller
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, 120000); // 2 minute timeout

      // Simulate upload progress (since fetch doesn't provide progress)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 300);

      const response = await fetch("http://localhost:5000/api/process-audio", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Revoke ONLY old processed URL (keep original URL intact)
      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl);
      }

      // Convert base64 to blob URL for audio player
      const audioBlob = base64ToBlob(data.processedAudio, "audio/wav");
      const audioUrl = URL.createObjectURL(audioBlob);

      setProcessedAudioUrl(audioUrl);
      setProcessedAudioData(data.processedAudio);
      setSuccessMessage(data.message || "Audio processed successfully!");

      // DON'T revoke originalAudioUrl - we need it for playback!
    } catch (err) {
      if (err.name === "AbortError") {
        setError(
          "Processing cancelled or timed out. Please try a smaller file."
        );
      } else if (err.message.includes("fetch")) {
        setError(
          "Cannot connect to server. Please ensure the backend is running on port 5000."
        );
      } else {
        setError(err.message || "An error occurred during processing");
      }

      // Clear processed audio on error
      setProcessedAudioUrl(null);
      setProcessedAudioData(null);
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
      abortControllerRef.current = null;
    }
  }, [selectedFile, humFrequency, processedAudioUrl]);

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

  // Download processed audio (memoized for performance)
  const handleDownload = useCallback(() => {
    if (!processedAudioData || !selectedFile) return;

    const blob = base64ToBlob(processedAudioData, "audio/wav");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `processed_${selectedFile.name.replace(
      /\.[^/.]+$/,
      ""
    )}.wav`;

    // Use modern download API if available
    if ("download" in link) {
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Clean up URL immediately
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }, [processedAudioData, selectedFile]);

  // Cancel processing
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setUploadProgress(0);
      setError("Processing cancelled by user");
    }
  }, []);

  // Reset form (memoized for performance)
  const handleReset = useCallback(() => {
    // Cancel any ongoing processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clean up ALL URLs when resetting
    if (originalAudioUrl) {
      URL.revokeObjectURL(originalAudioUrl);
    }
    if (processedAudioUrl) {
      URL.revokeObjectURL(processedAudioUrl);
    }

    setSelectedFile(null);
    setOriginalAudioUrl(null);
    setProcessedAudioUrl(null);
    setProcessedAudioData(null);
    setError(null);
    setSuccessMessage(null);
    setHumFrequency(60);
    setIsProcessing(false);
    setUploadProgress(0);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [originalAudioUrl, processedAudioUrl]);

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
        <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4 relative">
          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] rounded-lg z-10" />
          )}

          {/* Upload Section */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Audio File
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".wav,.mp3,.ogg,.flac,audio/wav,audio/mpeg,audio/mp3,audio/ogg,audio/flac"
                onChange={handleFileChange}
                className="hidden"
                id="audio-upload"
                disabled={isProcessing}
                ref={fileInputRef}
              />
              <label
                htmlFor="audio-upload"
                className={`flex items-center justify-center w-full px-4 py-6 bg-slate-50 border border-slate-300 rounded transition-colors ${
                  isProcessing
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:bg-slate-100 hover:border-slate-400"
                }`}
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
                disabled={isProcessing}
                className={`px-4 py-3 border rounded font-medium text-sm transition-colors ${
                  humFrequency === 50
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="font-semibold">50 Hz</div>
                <div className="text-xs mt-0.5 opacity-75">
                  Europe, Asia, Africa
                </div>
              </button>
              <button
                type="button"
                onClick={() => setHumFrequency(60)}
                disabled={isProcessing}
                className={`px-4 py-3 border rounded font-medium text-sm transition-colors ${
                  humFrequency === 60
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300 hover:border-slate-400"
                } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="font-semibold">60 Hz</div>
                <div className="text-xs mt-0.5 opacity-75">Americas, Japan</div>
              </button>
            </div>
          </div>

          {/* Process Button */}
          <div className="flex gap-3">
            <button
              onClick={handleProcessAudio}
              disabled={!selectedFile || isProcessing}
              className="flex-1 px-4 py-2.5 bg-slate-900 text-white font-medium text-sm rounded hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
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

            {isProcessing && (
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 bg-red-600 text-white font-medium text-sm rounded hover:bg-red-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Processing Status Card with Progress */}
          {isProcessing && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded animate-in fade-in duration-300">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-shrink-0">
                  <svg
                    className="animate-spin h-5 w-5 text-blue-600"
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
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    Processing audio file...
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Removing {humFrequency} Hz interference and harmonics
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              {uploadProgress > 0 && (
                <div className="w-full bg-blue-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Status Messages with animations */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm animate-in slide-in-from-top duration-300">
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
                <div className="flex-1">
                  <p className="font-medium text-red-900">Error</p>
                  <p className="text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600 transition-colors"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {successMessage && !isProcessing && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm animate-in slide-in-from-top duration-300">
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
                <div className="flex-1">
                  <p className="font-medium text-green-900">Success</p>
                  <p className="text-green-700">{successMessage}</p>
                </div>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="text-green-400 hover:text-green-600 transition-colors"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {(originalAudioUrl || processedAudioUrl) && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 animate-in fade-in slide-in-from-bottom duration-500">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Results
            </h2>

            <div className="grid md:grid-cols-2 gap-5 mb-4">
              {/* Original Audio */}
              {originalAudioUrl && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
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
                        <h3 className="text-sm font-semibold text-slate-900">
                          Original
                        </h3>
                        <p className="text-xs text-slate-500">
                          With interference
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-md">
                      {humFrequency} Hz
                    </span>
                  </div>

                  <div className="mb-3">
                    <audio controls src={originalAudioUrl} className="w-full" />
                  </div>

                  <p className="text-xs text-slate-600">
                    {selectedFile?.name} • Contains power line hum
                  </p>
                </div>
              )}

              {/* Processed Audio */}
              {processedAudioUrl && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          Processed
                        </h3>
                        <p className="text-xs text-slate-500">Hum removed</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-green-600 text-white text-xs font-medium rounded-md">
                      Clean
                    </span>
                  </div>

                  <div className="mb-3">
                    <audio
                      controls
                      src={processedAudioUrl}
                      className="w-full"
                    />
                  </div>

                  <p className="text-xs text-green-700">
                    Filtered {humFrequency} Hz + harmonics • Ready to download
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
