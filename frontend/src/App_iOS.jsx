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
  const [detectedRegion, setDetectedRegion] = useState(null);

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
        setHumFrequency(60);
        setDetectedRegion("60 Hz");
      } else {
        setHumFrequency(50);
        setDetectedRegion("50 Hz");
      }
    };

    detectFrequency();
  }, []);

  const abortControllerRef = useRef(null);
  const fileInputRef = useRef(null);

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

          if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
          if (processedAudioUrl) URL.revokeObjectURL(processedAudioUrl);

          const url = URL.createObjectURL(file);
          setOriginalAudioUrl(url);
          setProcessedAudioUrl(null);
          setProcessedAudioData(null);
          setSuccessMessage(`File "${file.name}" loaded successfully`);
        } catch (err) {
          setError(err.message);
          setSelectedFile(null);
          if (originalAudioUrl) URL.revokeObjectURL(originalAudioUrl);
          setOriginalAudioUrl(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      }
    },
    [originalAudioUrl, processedAudioUrl]
  );

  const handleFrequencyChange = useCallback((freq) => {
    setHumFrequency(freq);
  }, []);

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
      formData.append("audio", selectedFile);
      formData.append("humFrequency", humFrequency);

      const response = await fetch("http://localhost:5000/api/process-audio", {
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
    setHumFrequency(60);
    setIsProcessing(false);
    setUploadProgress(0);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [originalAudioUrl, processedAudioUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* iOS Style Header */}
      <header className="backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Audio Hum Remover
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 font-medium">
            Remove power line interference from your recordings
          </p>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Main Card - iOS Frosted Glass Style */}
        <div className="backdrop-blur-2xl bg-white/80 rounded-[32px] shadow-2xl border border-white/40 p-8 mb-6 relative overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xl z-20 flex items-center justify-center rounded-[32px]">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 relative">
                  <svg
                    className="animate-spin h-16 w-16 text-blue-600"
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
                </div>
                <p className="text-lg font-semibold text-slate-900 mb-2">
                  Processing Audio
                </p>
                <p className="text-sm text-slate-600">
                  Removing {humFrequency} Hz interference...
                </p>
                {uploadProgress > 0 && (
                  <div className="w-48 mx-auto mt-4 bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
                <button
                  onClick={handleCancelProcessing}
                  className="mt-6 px-5 py-2.5 text-sm font-semibold text-red-600 bg-red-50 rounded-full hover:bg-red-100 transition-colors active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="relative z-10 space-y-6">
            {/* Upload Section */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
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
                className={`flex items-center justify-center w-full px-6 py-12 bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-xl border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${
                  isProcessing
                    ? "opacity-60 cursor-not-allowed border-slate-300"
                    : "border-slate-300 hover:border-blue-400 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                }`}
              >
                {selectedFile ? (
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-[20px] flex items-center justify-center shadow-lg">
                      <svg
                        className="w-8 h-8 text-white"
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
                      <p className="text-base font-semibold text-slate-900">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-[24px] flex items-center justify-center">
                      <svg
                        className="w-10 h-10 text-blue-600"
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
                    <p className="text-base font-semibold text-slate-700 mb-2">
                      Drop your audio file here
                    </p>
                    <p className="text-sm text-slate-500 mb-3">
                      or click to browse
                    </p>
                    <p className="text-xs text-slate-400">
                      WAV, MP3, OGG, FLAC • Max 50MB
                    </p>
                  </div>
                )}
              </label>
            </div>

            {/* Frequency Selection */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-slate-700">
                  Power Line Frequency
                </label>
                {detectedRegion && (
                  <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-full font-medium">
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
                    {detectedRegion}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleFrequencyChange(50)}
                  disabled={isProcessing}
                  className={`px-5 py-5 rounded-[20px] font-semibold transition-all duration-300 ${
                    humFrequency === 50
                      ? "bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl shadow-slate-900/40 scale-105"
                      : "bg-white/80 backdrop-blur-xl text-slate-700 border-2 border-slate-200 hover:border-blue-300 hover:shadow-lg"
                  } ${
                    isProcessing
                      ? "opacity-60 cursor-not-allowed"
                      : "active:scale-95"
                  }`}
                >
                  <div className="font-bold text-xl">50 Hz</div>
                  <div className="text-xs mt-1.5 opacity-80">Most of world</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleFrequencyChange(60)}
                  disabled={isProcessing}
                  className={`px-5 py-5 rounded-[20px] font-semibold transition-all duration-300 ${
                    humFrequency === 60
                      ? "bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl shadow-slate-900/40 scale-105"
                      : "bg-white/80 backdrop-blur-xl text-slate-700 border-2 border-slate-200 hover:border-blue-300 hover:shadow-lg"
                  } ${
                    isProcessing
                      ? "opacity-60 cursor-not-allowed"
                      : "active:scale-95"
                  }`}
                >
                  <div className="font-bold text-xl">60 Hz</div>
                  <div className="text-xs mt-1.5 opacity-80">
                    Americas, Philippines, Japan
                  </div>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3 text-center font-medium">
                Auto-detected based on your region
              </p>
            </div>

            {/* Process Button */}
            <button
              onClick={handleProcessAudio}
              disabled={!selectedFile || isProcessing}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold text-base rounded-[20px] hover:shadow-2xl hover:shadow-blue-500/50 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-300 active:scale-95"
            >
              {isProcessing ? "Processing..." : "Process Audio"}
            </button>

            {/* Messages */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
                <p className="text-sm text-green-700 font-medium">
                  {successMessage}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {(originalAudioUrl || processedAudioUrl) && (
          <div className="backdrop-blur-2xl bg-white/80 rounded-[32px] shadow-2xl border border-white/40 p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Audio Comparison
            </h2>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {originalAudioUrl && (
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-[24px] p-6 border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-900 rounded-[16px] flex items-center justify-center">
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
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Original
                        </h3>
                        <p className="text-xs text-slate-500">
                          With interference
                        </p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                      {humFrequency} Hz
                    </span>
                  </div>
                  <audio
                    controls
                    src={originalAudioUrl}
                    className="w-full mb-3"
                  />
                  <p className="text-xs text-slate-600 font-medium">
                    {selectedFile?.name}
                  </p>
                </div>
              )}
              {processedAudioUrl && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-[24px] p-6 border border-green-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-600 rounded-[16px] flex items-center justify-center">
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Processed
                        </h3>
                        <p className="text-xs text-slate-500">Hum removed</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-full">
                      Clean
                    </span>
                  </div>
                  <audio
                    controls
                    src={processedAudioUrl}
                    className="w-full mb-3"
                  />
                  <p className="text-xs text-green-700 font-medium">
                    Filtered {humFrequency} Hz + harmonics
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDownload}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-[16px] hover:shadow-xl transition-all active:scale-95"
              >
                Download Clean Audio
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-white/80 backdrop-blur-xl text-slate-700 font-semibold rounded-[16px] border-2 border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all active:scale-95"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
