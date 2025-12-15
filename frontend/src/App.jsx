import { useState, useCallback, useEffect, useRef } from "react";

// Get API URL from environment variable
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const App = () => {
  // State management
  const [selectedFile, setSelectedFile] = useState(null);
  const [humFrequency, setHumFrequency] = useState("auto");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState(null);
  const [processedAudioUrl, setProcessedAudioUrl] = useState(null);
  const [processedAudioData, setProcessedAudioData] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [detectedRegion, setDetectedRegion] = useState(null);
  const [detectedHumFrequency, setDetectedHumFrequency] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-detect power frequency based on timezone/location
  useEffect(() => {
    const detectFrequency = () => {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const hz60Regions = [
        "America/",
        "US/",
        "Canada/",
        "Mexico/",
        "Brazil/",
        "Colombia/",
        "Venezuela/",
        "Asia/Tokyo",
        "Asia/Seoul",
        "Asia/Taipei",
        "Asia/Manila",
        "Asia/Riyadh",
        "Asia/Kuwait",
        "Pacific/Guam",
        "Pacific/Saipan",
      ];

      const is60Hz = hz60Regions.some((region) => timezone.startsWith(region));

      if (is60Hz) {
        setDetectedRegion("60 Hz");
      } else {
        setDetectedRegion("50 Hz");
      }
      // Keep auto as default
      setHumFrequency("auto");
    };

    detectFrequency();
  }, []);

  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const validateFile = (file) => {
    const maxSize = 50 * 1024 * 1024;
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

    const fileExtension = "." + file.name.split(".").pop().toLowerCase();
    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      throw new Error(
        "Invalid file type. Please upload WAV, MP3, OGG, or FLAC files."
      );
    }
  };

  // Analyze audio to detect hum frequency
  const analyzeAudio = useCallback(
    async (file) => {
      if (humFrequency !== "auto") return; // Only analyze if auto mode

      setIsAnalyzing(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_URL}/api/detect-hum`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.detectedFrequency) {
            setDetectedHumFrequency(data.detectedFrequency);
            setSuccessMessage(
              `Detected ${data.detectedFrequency} Hz hum in audio`
            );
          } else {
            setSuccessMessage("No hum detected - audio appears clean");
          }
        }
      } catch (err) {
        console.error("Analysis error:", err);
        // Don't show error - analysis is optional
      } finally {
        setIsAnalyzing(false);
      }
    },
    [humFrequency]
  );

  const handleFileChange = useCallback(
    (event) => {
      const file = event.target.files[0];
      if (file) {
        try {
          validateFile(file);
          setSelectedFile(file);
          setError(null);
          setSuccessMessage(null);
          setUploadProgress(0);
          setDetectedHumFrequency(null);

          if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
          if (processedAudioUrl) URL.revokeObjectURL(processedAudioUrl);

          const url = URL.createObjectURL(file);
          setOriginalAudioUrl(url);
          setProcessedAudioUrl(null);
          setProcessedAudioData(null);

          // Analyze audio if in auto mode
          analyzeAudio(file);
        } catch (err) {
          setError(err.message);
          setSelectedFile(null);
          if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
          setOriginalAudioUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      }
    },
    [originalAudioUrl, processedAudioUrl, analyzeAudio]
  );

  const handleFrequencyChange = useCallback(
    (freq) => {
      setHumFrequency(freq);
      setDetectedHumFrequency(null); // Clear detection when manually changed

      // If switching to auto and file is loaded, analyze it
      if (freq === "auto" && selectedFile) {
        analyzeAudio(selectedFile);
      }
    },
    [selectedFile, analyzeAudio]
  );

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        try {
          validateFile(file);
          setSelectedFile(file);
          setError(null);
          setSuccessMessage(null);
          setUploadProgress(0);
          setDetectedHumFrequency(null);

          if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
          if (processedAudioUrl) URL.revokeObjectURL(processedAudioUrl);

          const url = URL.createObjectURL(file);
          setOriginalAudioUrl(url);
          setProcessedAudioUrl(null);
          setProcessedAudioData(null);

          // Analyze audio if in auto mode
          analyzeAudio(file);
        } catch (err) {
          setError(err.message);
          setSelectedFile(null);
          if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
          setOriginalAudioUrl(null);
        }
      }
    },
    [originalAudioUrl, processedAudioUrl, analyzeAudio]
  );

  const base64ToBlob = (base64, mimeType) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const handleProcessAudio = useCallback(async () => {
    if (!selectedFile) {
      setError("Please select an audio file first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccessMessage(null);
    setUploadProgress(0);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("humFrequency", humFrequency);

      const response = await fetch(`${API_URL}/api/process-audio`, {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      if (processedAudioUrl) {
        URL.revokeObjectURL(processedAudioUrl);
      }

      const audioBlob = base64ToBlob(data.processedAudio, "audio/wav");
      const audioUrl = URL.createObjectURL(audioBlob);

      setProcessedAudioUrl(audioUrl);
      setProcessedAudioData(data.processedAudio);
      setDetectedHumFrequency(data.detectedFrequency || data.humFrequency);
      setSuccessMessage(data.message || "Audio processed successfully!");
      setUploadProgress(100);
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Processing cancelled");
      } else {
        setError(err.message || "Failed to process audio");
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  }, [selectedFile, humFrequency, processedAudioUrl]);

  const handleCancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!processedAudioData) return;

    const audioBlob = base64ToBlob(processedAudioData, "audio/wav");
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedFile.name.split(".")[0]}_clean.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [processedAudioData, selectedFile]);

  const handleReset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
    if (processedAudioUrl) URL.revokeObjectURL(processedAudioUrl);

    setSelectedFile(null);
    setOriginalAudioUrl(null);
    setProcessedAudioUrl(null);
    setProcessedAudioData(null);
    setError(null);
    setSuccessMessage(null);
    setHumFrequency("auto");
    setDetectedHumFrequency(null);
    setIsProcessing(false);
    setUploadProgress(0);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [originalAudioUrl, processedAudioUrl]);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Premium Header */}
      <header className="pt-8 pb-6 sm:pt-12 sm:pb-8 border-b border-neutral-200/50">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl">
          <div className="flex flex-col items-center">
            <div className="mb-4 p-4 bg-white border-2 border-neutral-200 rounded-2xl shadow-sm">
              <img
                src="/hum.svg"
                alt="Audio Hum Remover"
                className="w-12 h-12 sm:w-14 sm:h-14"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-3 tracking-tight">
              Audio Hum Remover
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 font-medium max-w-md text-center">
              Professional power line interference removal using advanced signal
              processing
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-4 max-w-3xl">
        {/* How to Use - Simple Steps */}
        <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg border border-neutral-200/60 p-5 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-4">
            How to Use
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-neutral-800 text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm">
                1
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Upload Audio
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Drop or select your audio file
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-neutral-800 text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm">
                2
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Auto-Detect
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  We identify the hum frequency
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-neutral-800 text-white rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm">
                3
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  Process & Download
                </p>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Get your clean audio file
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works - Process Explanation */}
        <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg border border-neutral-200/60 p-5 sm:p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-700 mb-3">
            How The Cleaning Process Works
          </h2>
          <div className="space-y-3 text-sm text-neutral-600">
            <p className="leading-relaxed">
              Power lines create electrical interference at specific frequencies
              (50 Hz or 60 Hz depending on your region). This interference
              appears in your recordings as an annoying background hum.
            </p>
            <p className="leading-relaxed">
              Our tool identifies this hum frequency in your audio and applies a
              specialized filter called a{" "}
              <span className="font-medium text-neutral-800">notch filter</span>
              . Think of it like noise-canceling headphones, but for recorded
              audio.
            </p>
            <p className="leading-relaxed">
              The filter removes the hum frequency and its{" "}
              <span className="font-medium text-neutral-800">harmonics</span>{" "}
              (multiples of the main frequency like 100 Hz, 150 Hz, etc.) while
              preserving your voice or music. The result is clean,
              professional-sounding audio without the electrical buzz.
            </p>
          </div>
        </div>

        {/* Main Card - Clean Glass */}
        <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg border border-neutral-200/60 p-5 sm:p-8 mb-6 relative overflow-hidden">
          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-20 flex items-center justify-center rounded-2xl">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-4 relative">
                  <svg
                    className="animate-spin h-12 w-12 text-neutral-700"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-20"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <p className="text-base font-medium text-neutral-900 mb-1">
                  Processing Audio
                </p>
                <p className="text-sm text-neutral-600">
                  Removing {humFrequency} Hz interference...
                </p>
                {uploadProgress > 0 && (
                  <div className="w-48 mx-auto mt-4 bg-neutral-200 rounded-full h-1.5">
                    <div
                      className="bg-neutral-800 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <button
                  onClick={handleCancelProcessing}
                  className="mt-5 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="relative z-10 space-y-5">
            {/* Upload Section */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Audio File
              </label>
              <input
                type="file"
                accept=".wav,.mp3,.ogg,.flac"
                onChange={handleFileChange}
                className="hidden"
                id="audio-upload"
                ref={fileInputRef}
                disabled={isProcessing}
              />
              <label
                htmlFor="audio-upload"
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex items-center justify-center w-full px-6 py-10 backdrop-blur-md border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${
                  isProcessing
                    ? "opacity-60 cursor-not-allowed border-neutral-300 bg-white/50"
                    : isDragging
                    ? "border-neutral-800 bg-neutral-100 scale-[1.02] shadow-lg"
                    : "border-neutral-300 hover:border-neutral-400 bg-white/50 hover:bg-white/60"
                }`}
              >
                {selectedFile ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-neutral-800 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
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
                    <div className="text-left">
                      <p className="text-sm font-medium text-neutral-900">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-neutral-600 mt-0.5">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto mb-3 bg-neutral-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-7 h-7 text-neutral-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-neutral-700 mb-1">
                      Drop your audio file here
                    </p>
                    <p className="text-xs text-neutral-500 mb-2">
                      or click to browse
                    </p>
                    <p className="text-xs text-neutral-400">
                      WAV, MP3, OGG, FLAC • Max 50MB
                    </p>
                  </div>
                )}
              </label>
            </div>

            {/* Frequency Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-neutral-700">
                  Hum Frequency
                </label>
                {isAnalyzing && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <svg
                      className="animate-spin h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Identifying Hz...
                  </span>
                )}
                {!isAnalyzing && detectedHumFrequency && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Detected: {detectedHumFrequency} Hz
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleFrequencyChange("auto")}
                  disabled={isProcessing}
                  className={`px-3 py-4 rounded-lg font-medium transition-all duration-200 ${
                    humFrequency === "auto"
                      ? "bg-neutral-800 text-white"
                      : "backdrop-blur-md bg-white/50 text-neutral-700 border border-neutral-200 hover:bg-white/70"
                  } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="font-semibold text-base">Auto</div>
                  <div className="text-xs mt-1 opacity-75">Detect</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleFrequencyChange(50)}
                  disabled={isProcessing}
                  className={`px-3 py-4 rounded-lg font-medium transition-all duration-200 ${
                    humFrequency === 50
                      ? "bg-neutral-800 text-white"
                      : "backdrop-blur-md bg-white/50 text-neutral-700 border border-neutral-200 hover:bg-white/70"
                  } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="font-semibold text-base">50 Hz</div>
                  <div className="text-xs mt-1 opacity-75">Europe/Asia</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleFrequencyChange(60)}
                  disabled={isProcessing}
                  className={`px-3 py-4 rounded-lg font-medium transition-all duration-200 ${
                    humFrequency === 60
                      ? "bg-neutral-800 text-white"
                      : "backdrop-blur-md bg-white/50 text-neutral-700 border border-neutral-200 hover:bg-white/70"
                  } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  <div className="font-semibold text-base">60 Hz</div>
                  <div className="text-xs mt-1 opacity-75">Americas</div>
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-2 text-center">
                Auto mode detects hum frequency automatically
              </p>
            </div>

            {/* Process Button */}
            <button
              onClick={handleProcessAudio}
              disabled={!selectedFile || isProcessing}
              className="w-full px-6 py-3 bg-neutral-800 text-white font-medium text-sm rounded-lg hover:bg-neutral-700 disabled:bg-neutral-300 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {isProcessing ? "Processing..." : "Process Audio"}
            </button>

            {/* Messages */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {(originalAudioUrl || processedAudioUrl) && (
          <div className="backdrop-blur-lg bg-white/70 rounded-2xl shadow-lg border border-neutral-200/60 p-5 sm:p-8">
            <h2 className="text-lg font-semibold text-neutral-900 mb-5">
              Audio Comparison
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-5">
              {originalAudioUrl && (
                <div className="backdrop-blur-md bg-white/50 rounded-xl p-5 border border-neutral-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-neutral-800 rounded-lg flex items-center justify-center">
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
                        <h3 className="text-sm font-medium text-neutral-900">
                          Original
                        </h3>
                        <p className="text-xs text-neutral-500">
                          With interference
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-neutral-800 text-white text-xs font-medium rounded">
                      {detectedHumFrequency || humFrequency} Hz
                    </span>
                  </div>
                  <audio
                    controls
                    src={originalAudioUrl}
                    className="w-full mb-2"
                  />
                  <p className="text-xs text-neutral-600">
                    {selectedFile?.name}
                  </p>
                </div>
              )}
              {processedAudioUrl && (
                <div className="backdrop-blur-md bg-white/50 rounded-xl p-5 border border-neutral-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-neutral-800 rounded-lg flex items-center justify-center">
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
                        <h3 className="text-sm font-medium text-neutral-900">
                          Processed
                        </h3>
                        <p className="text-xs text-neutral-500">Hum removed</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-neutral-800 text-white text-xs font-medium rounded">
                      Clean
                    </span>
                  </div>
                  <audio
                    controls
                    src={processedAudioUrl}
                    className="w-full mb-2"
                  />
                  <p className="text-xs text-neutral-600">
                    Filtered {detectedHumFrequency || humFrequency} Hz +
                    harmonics
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 px-5 py-2.5 bg-neutral-800 text-white font-medium text-sm rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Download Clean Audio
              </button>
              <button
                onClick={handleReset}
                className="sm:w-auto px-5 py-2.5 backdrop-blur-md bg-white/50 text-neutral-700 font-medium text-sm rounded-lg border border-neutral-200 hover:bg-white/70 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 sm:py-12 mt-8 border-t border-neutral-200/50">
        <div className="container mx-auto px-4 sm:px-6 max-w-3xl text-center">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <span className="text-sm font-medium text-neutral-700">
              Dan Lius Monsales
            </span>
            <span className="text-neutral-300">•</span>
            <span className="text-sm font-medium text-neutral-700">
              Eduardo Miguel Cortes
            </span>
            <span className="text-neutral-300">•</span>
            <span className="text-sm font-medium text-neutral-700">
              Regine Christian Buenafe
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
