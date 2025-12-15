import { useState, useRef, useEffect } from "react";

const AudioPlayer = ({ src, variant = "default" }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showVolume, setShowVolume] = useState(false);
  const audioRef = useRef(null);
  const volumeRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [src]);

  // Click outside to close volume
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (volumeRef.current && !volumeRef.current.contains(event.target)) {
        setShowVolume(false);
      }
    };

    if (showVolume) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showVolume]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audioRef.current.volume = newVolume;
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Color schemes based on variant
  const colors = {
    default: {
      bg: "bg-neutral-50",
      playBtn: "bg-neutral-800 hover:bg-neutral-700",
      playBtnText: "text-white",
      progress: "bg-neutral-800",
      progressBg: "bg-neutral-200",
      text: "text-neutral-700",
      textMuted: "text-neutral-500",
    },
    success: {
      bg: "bg-green-50",
      playBtn: "bg-green-600 hover:bg-green-700",
      playBtnText: "text-white",
      progress: "bg-green-600",
      progressBg: "bg-green-200",
      text: "text-green-800",
      textMuted: "text-green-600",
    },
  };

  const theme = colors[variant] || colors.default;

  return (
    <div className={`${theme.bg} rounded-lg p-4 transition-all duration-200`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`${theme.playBtn} ${theme.playBtnText} w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 ml-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Progress Bar and Time */}
        <div className="flex-1 space-y-1">
          {/* Time Display */}
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={theme.text}>{formatTime(currentTime)}</span>
            <span className={theme.textMuted}>{formatTime(duration)}</span>
          </div>

          {/* Progress Bar */}
          <div
            className={`relative h-2 ${theme.progressBg} rounded-full cursor-pointer group`}
            onClick={handleSeek}
          >
            <div
              className={`absolute top-0 left-0 h-full ${theme.progress} rounded-full transition-all duration-100`}
              style={{ width: `${progress}%` }}
            />
            {/* Progress Handle */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 ${theme.progress} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md`}
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
        </div>

        {/* Volume Control */}
        <div className="relative flex-shrink-0" ref={volumeRef}>
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`${theme.text} w-8 h-8 flex items-center justify-center hover:bg-white/50 rounded-lg transition-colors`}
            aria-label="Volume"
          >
            {volume === 0 ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            ) : volume < 0.5 ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m-9.95-9.193L9.293 10.05a1 1 0 001.414 0l4.243-4.243a1 1 0 011.414 1.414L12.121 11.464a1 1 0 000 1.414l4.243 4.243a1 1 0 01-1.414 1.414L10.707 14.293a1 1 0 00-1.414 0L5.05 18.536"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
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
            )}
          </button>

          {/* Volume Slider */}
          {showVolume && (
            <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg p-3 border border-neutral-200 z-10">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 accent-neutral-800 cursor-pointer"
                style={{
                  writingMode: "bt-lr",
                  WebkitAppearance: "slider-vertical",
                  height: "80px",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
