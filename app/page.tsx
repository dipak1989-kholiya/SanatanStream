"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "../firebase";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot
} from "firebase/firestore";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Edit3,
  Search,
  X,
  ChevronRight,
  Music,
  RotateCcw,
  Sparkles,
  Menu,
  Tv,
  ListVideo,
  Info,
  LogIn,
  LogOut,
  Lock
} from "lucide-react";

// Types
interface Video {
  id: string;
  title: string;
  url: string;
  category: string;
  description: string;
  thumbnail: string;
  type?: "youtube" | "hls";
  createdAt?: any;
}

// Default pre-loaded videos for SanatanStream
const DEFAULT_VIDEOS: Video[] = [
  {
    id: "1",
    title: "Serene Morning Raga - Flute Meditation",
    category: "Meditation",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=640&auto=format&fit=crop",
    description: "A calming morning flute melody designed to ground your consciousness and invite peace into your day."
  },
  {
    id: "2",
    title: "Vedic Chanting - Ancient Cosmic Mantras",
    category: "Mantras",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumbnail: "https://images.unsplash.com/photo-1602192103300-47e66756152e?q=80&w=640&auto=format&fit=crop",
    description: "Traditional vedic mantras chanted by experienced practitioners to elevate vibration and cleanse the energy field."
  },
  {
    id: "3",
    title: "Sri Krishna Bhajan - Divine Aarti & Kirtan",
    category: "Bhajans",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=640&auto=format&fit=crop",
    description: "Joyous and devotional singing praising the divine play and teachings of Lord Krishna."
  },
  {
    id: "4",
    title: "Himalayan Forest Sounds & Singing Bowls",
    category: "Spiritual",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    thumbnail: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=640&auto=format&fit=crop",
    description: "Deep atmospheric recordings from the high Himalayas paired with sacred sound healing bowls."
  }
];

const DEFAULT_CATEGORIES = ["All", "Meditation", "Mantras", "Bhajans", "Spiritual"];

// Helper to extract YouTube video ID
function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /youtu\.be\/([^#\&\?]{11})/,
    /youtube\.com\/watch\?v=([^#\&\?]{11})/,
    /youtube\.com\/embed\/([^#\&\?]{11})/,
    /youtube\.com\/v\/([^#\&\?]{11})/,
    /youtube\.com\/live\/([^#\&\?]{11})/,
    /youtube\.com\/shorts\/([^#\&\?]{11})/,
    /youtube\.com\/.*[?&]v=([^#\&\?]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/|shorts\/)([^#\&\?]{11})/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  return null;
}

// Custom Player Component with precise, custom controls
function CustomPlayer({
  video,
  onEnded,
  autoplay = true,
  onAutoplayToggle,
  ambientGlow = true,
  onAmbientGlowToggle,
  rounded = true
}: {
  video: Video;
  onEnded?: () => void;
  autoplay?: boolean;
  onAutoplayToggle?: () => void;
  ambientGlow?: boolean;
  onAmbientGlowToggle?: () => void;
  rounded?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const ytId = getYouTubeId(video.url);

  // Play/Pause handler
  const togglePlay = () => {
    if (ytId || !videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => {});
    }
  };

  // Skip time
  const skip = (seconds: number) => {
    if (ytId || !videoRef.current) return;
    videoRef.current.currentTime = Math.min(
      Math.max(0, videoRef.current.currentTime + seconds),
      duration
    );
  };

  // Format time (MM:SS)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (ytId) {
      // For YouTube iframe, request fullscreen on the container
      if (!containerRef.current) return;
      const container = containerRef.current;
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
          setIsFullscreen(false);
        }
      }
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    // Check iOS Safari webkitEnterFullscreen first for iOS mobile devices
    if ((videoEl as any).webkitEnterFullscreen) {
      try {
        (videoEl as any).webkitEnterFullscreen();
        setIsFullscreen(true);
        return;
      } catch (err) {
        console.warn("webkitEnterFullscreen failed or not supported:", err);
      }
    }

    // Standard DOM fullscreen on container
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      const requestFS = container.requestFullscreen || 
                       (container as any).mozRequestFullScreen || 
                       (container as any).webkitRequestFullscreen || 
                       (container as any).msRequestFullscreen;
      if (requestFS) {
        requestFS.call(container).then(() => {
          setIsFullscreen(true);
        }).catch(() => {});
      }
    } else {
      const exitFS = document.exitFullscreen || 
                     (document as any).mozCancelFullScreen || 
                     (document as any).webkitExitFullscreen || 
                     (document as any).msExitFullscreen;
      if (exitFS) {
        exitFS.call(document).then(() => {
          setIsFullscreen(false);
        }).catch(() => {});
      }
    }
  };

  // Sync controls overlay auto-hide
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 2500);
  };

  // Effect to reset player state when video URL changes
  useEffect(() => {
    if (ytId) {
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
      setIsBuffering(false);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsBuffering(false);
      if (videoRef.current) {
        videoRef.current.load();
      }
    }
  }, [video.url, ytId]);

  // Clean timeouts on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Sync fullscreen state with document and iOS-specific events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleWebkitBeginFS = () => setIsFullscreen(true);
    const handleWebkitEndFS = () => setIsFullscreen(false);

    videoEl.addEventListener("webkitbeginfullscreen", handleWebkitBeginFS);
    videoEl.addEventListener("webkitendfullscreen", handleWebkitEndFS);

    return () => {
      videoEl.removeEventListener("webkitbeginfullscreen", handleWebkitBeginFS);
      videoEl.removeEventListener("webkitendfullscreen", handleWebkitEndFS);
    };
  }, []);

  // Keyboard shortcut listener (Space to play/pause, Arrows to seek)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (ytId) return; // Ignore keyboard shortcuts for YouTube iframe
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return; // Ignore inside input fields
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        skip(-10);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        skip(10);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, duration, ytId]);

  const renderInnerPlayer = () => {
    if (ytId) {
      // Elegant fallback for YouTube Videos with standard YouTube Embed API
      return (
        <div className={`relative w-full aspect-video overflow-hidden bg-black select-none ${
          rounded ? "rounded-2xl border border-slate-800 shadow-2xl" : "border-b border-slate-800"
        }`}>
          <iframe
            ref={iframeRef}
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&fs=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0 pointer-events-auto"
          ></iframe>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        className={`relative w-full aspect-video overflow-hidden bg-black group select-none ${
          rounded ? "rounded-2xl border border-slate-800 shadow-2xl" : "border-b border-slate-800"
        }`}
      >
        <video
          ref={videoRef}
          src={video.url}
          className="w-full h-full object-contain"
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (videoRef.current) {
              setCurrentTime(videoRef.current.currentTime);
            }
          }}
          onDurationChange={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
          onEnded={() => {
            setIsPlaying(false);
            if (onEnded) onEnded();
          }}
          autoPlay
        />

        {/* Buffering Indicator */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 pointer-events-none">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Big Play Overlay (appears when paused or hover) */}
        <AnimatePresence>
          {(!isPlaying || showControls) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none"
            >
              <button
                onClick={togglePlay}
                className="w-16 h-16 rounded-full bg-amber-500/90 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 hover:scale-110 active:scale-95 transition-all pointer-events-auto"
              >
                {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Control Bar */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/95 via-slate-950/80 to-transparent p-4 flex flex-col gap-3"
            >
              {/* Seekbar and tooltips */}
              <div className="flex items-center gap-3 group/seekbar">
                <span className="text-xs font-mono text-slate-300">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCurrentTime(val);
                    if (videoRef.current) videoRef.current.currentTime = val;
                  }}
                  className="flex-1 h-1.5 rounded-full appearance-none bg-slate-700 accent-amber-500 cursor-pointer outline-none hover:h-2 transition-all"
                />
                <span className="text-xs font-mono text-slate-300">{formatTime(duration)}</span>
              </div>

              {/* Left and Right Controls */}
              <div className="flex items-center justify-between">
                {/* Left group */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={togglePlay}
                    className="text-slate-200 hover:text-amber-400 transition"
                  >
                    {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  </button>

                  {/* Skip buttons */}
                  <button
                    onClick={() => skip(-10)}
                    className="text-slate-400 hover:text-slate-200 text-xs font-mono flex items-center gap-0.5"
                    title="Rewind 10s"
                  >
                    <RotateCcw size={14} /> <span>10s</span>
                  </button>

                  {/* Volume slider */}
                  <div className="flex items-center gap-2 group/volume">
                    <button
                      onClick={() => {
                        const nextMute = !isMuted;
                        setIsMuted(nextMute);
                        if (videoRef.current) videoRef.current.muted = nextMute;
                      }}
                      className="text-slate-300 hover:text-amber-400 transition"
                    >
                      {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setVolume(val);
                        setIsMuted(false);
                        if (videoRef.current) {
                          videoRef.current.volume = val;
                          videoRef.current.muted = false;
                        }
                      }}
                      className="w-16 h-1 rounded-full bg-slate-700 accent-amber-500 cursor-pointer group-hover/volume:w-20 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Right group */}
                <div className="flex items-center gap-4">
                  {/* Autoplay Toggle */}
                  {onAutoplayToggle && (
                    <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 select-none hidden sm:inline">
                        Autoplay
                      </span>
                      <button
                        type="button"
                        onClick={onAutoplayToggle}
                        className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoplay ? "bg-amber-500" : "bg-slate-700"
                        }`}
                        title={autoplay ? "Disable Autoplay" : "Enable Autoplay"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                            autoplay ? "translate-x-3.5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {/* Ambient Glow Toggle */}
                  {onAmbientGlowToggle && (
                    <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1">
                      <Sparkles size={11} className={ambientGlow ? "text-amber-400" : "text-slate-400"} />
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 select-none hidden sm:inline">
                        Glow
                      </span>
                      <button
                        type="button"
                        onClick={onAmbientGlowToggle}
                        className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          ambientGlow ? "bg-amber-500" : "bg-slate-700"
                        }`}
                        title={ambientGlow ? "Disable Ambient Glow" : "Enable Ambient Glow"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                            ambientGlow ? "translate-x-3.5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {/* Playback speed selector */}
                  <select
                    value={playbackRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPlaybackRate(val);
                      if (videoRef.current) videoRef.current.playbackRate = val;
                    }}
                    className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-xs outline-none accent-amber-500"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1">1.0x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2.0x</option>
                  </select>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="text-slate-300 hover:text-amber-400 transition"
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="relative w-full group/player-wrapper">
      {/* Dynamic Ambient Glow effect matching the current video's thumbnail */}
      {ambientGlow && (
        <div 
          className="absolute -inset-4 sm:-inset-6 md:-inset-8 rounded-[2rem] bg-cover bg-center opacity-30 blur-[40px] sm:blur-[60px] md:blur-[80px] pointer-events-none transition-all duration-700 select-none scale-[1.03] z-0"
          style={{ backgroundImage: `url(${video.thumbnail})` }}
        />
      )}
      <div className="relative z-10 w-full">
        {renderInnerPlayer()}
      </div>
    </div>
  );
}

// Main page Component
export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("dipak.kholiya@gmail.com");
  const [authPassword, setAuthPassword] = useState("Dipak@3626");
  const [authError, setAuthError] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAdminUrl, setIsAdminUrl] = useState(false);

  // Sync auth state and check admin URL query parameters
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === "true") {
        setIsAdminUrl(true);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (currentUser.email !== "dipak.kholiya@gmail.com") {
          signOut(auth);
          setUser(null);
          setAuthError("Unauthorized user. Only the owner (dipak.kholiya@gmail.com) is allowed to access the admin portal.");
          setIsAuthModalOpen(true);
        } else {
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const [videos, setVideos] = useState<Video[]>(DEFAULT_VIDEOS);
  const [activeVideo, setActiveVideo] = useState<Video>(DEFAULT_VIDEOS[0]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [ambientGlow, setAmbientGlow] = useState(true);

  // Dynamic Categories Management
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryInput, setEditingCategoryInput] = useState("");

  // Sync isMobile flag on resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Modal States
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [videoToEdit, setVideoToEdit] = useState<Video | null>(null);
  const [isAddingVideo, setIsAddingVideo] = useState(false);

  // Form States (for Add & Edit)
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCategory, setFormCategory] = useState("Meditation");
  const [formDescription, setFormDescription] = useState("");
  const [formThumbnail, setFormThumbnail] = useState("");
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState<boolean | null>(null);

  // Initialize and load saved state from Firestore with localStorage fallback
  useEffect(() => {
    // 1. Initial fast load from localStorage as synchronous fallback
    const saved = localStorage.getItem("sanatan_videos");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVideos(parsed);
          setActiveVideo(parsed[0]);
        }
      } catch (e) {
        console.error("Error loading localStorage data", e);
      }
    }

    const savedCats = localStorage.getItem("sanatan_categories");
    if (savedCats) {
      try {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const clean = parsed.filter((c: string) => c !== "All");
          setCategories(["All", ...clean]);
        }
      } catch (e) {
        console.error("Error loading categories", e);
      }
    }

    const savedAutoplay = localStorage.getItem("sanatan_autoplay");
    if (savedAutoplay !== null) {
      setAutoplay(savedAutoplay === "true");
    }

    const savedGlow = localStorage.getItem("sanatan_glow");
    if (savedGlow !== null) {
      setAmbientGlow(savedGlow === "true");
    }

    // 2. Real-time Firebase Sync
    const unsubscribeVideos = onSnapshot(collection(db, "videos"), async (snapshot) => {
      if (!snapshot.empty) {
        const fetchedVideos: Video[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedVideos.push({
            id: doc.id,
            title: data.title || "",
            url: data.url || "",
            category: data.category || "",
            description: data.description || "",
            thumbnail: data.thumbnail || "",
            type: data.type || "hls",
            createdAt: data.createdAt
          });
        });

        // Sort by createdAt
        fetchedVideos.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeA - timeB;
        });

        setVideos(fetchedVideos);
        localStorage.setItem("sanatan_videos", JSON.stringify(fetchedVideos));
        
        setActiveVideo((currentActive) => {
          if (!currentActive && fetchedVideos.length > 0) {
            return fetchedVideos[0];
          }
          if (currentActive) {
            const found = fetchedVideos.find((v) => v.id === currentActive.id);
            return found || fetchedVideos[0];
          }
          return currentActive;
        });
      } else {
        // If Firestore is empty, we keep the localStorage or DEFAULT_VIDEOS
        // And if authenticated user is the admin, seed default videos!
        if (auth.currentUser && auth.currentUser.email === "dipak.kholiya@gmail.com") {
          console.log("Seeding default videos to Firestore...");
          for (const video of DEFAULT_VIDEOS) {
            try {
              const docRef = doc(collection(db, "videos"), video.id);
              await setDoc(docRef, {
                id: video.id,
                title: video.title,
                url: video.url,
                category: video.category,
                description: video.description,
                thumbnail: video.thumbnail,
                type: getYouTubeId(video.url) ? "youtube" : "hls",
                createdAt: new Date()
              });
            } catch (err) {
              console.error("Error seeding video:", err);
            }
          }
        }
      }
    }, (error) => {
      console.error("Error subscribing to Firestore videos:", error);
    });

    const unsubscribeCategories = onSnapshot(collection(db, "categories"), async (snapshot) => {
      if (!snapshot.empty) {
        const fetchedCats: string[] = ["All"];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.name && data.name !== "All") {
            fetchedCats.push(data.name);
          }
        });
        setCategories(fetchedCats);
        localStorage.setItem("sanatan_categories", JSON.stringify(fetchedCats));
      } else {
        // If Firestore is empty and we are admin, seed default categories!
        if (auth.currentUser && auth.currentUser.email === "dipak.kholiya@gmail.com") {
          console.log("Seeding default categories to Firestore...");
          const rawCats = DEFAULT_CATEGORIES.filter((c) => c !== "All");
          for (const cat of rawCats) {
            try {
              const docRef = doc(collection(db, "categories"), cat);
              await setDoc(docRef, { name: cat });
            } catch (err) {
              console.error("Error seeding category:", err);
            }
          }
        }
      }
    }, (error) => {
      console.error("Error subscribing to Firestore categories:", error);
    });

    return () => {
      unsubscribeVideos();
      unsubscribeCategories();
    };
  }, [user]);

  // Toggle autoplay state & save to local storage
  const handleToggleAutoplay = () => {
    setAutoplay((prev) => {
      const nextVal = !prev;
      localStorage.setItem("sanatan_autoplay", String(nextVal));
      return nextVal;
    });
  };

  // Toggle ambient glow state & save to local storage
  const handleToggleAmbientGlow = () => {
    setAmbientGlow((prev) => {
      const nextVal = !prev;
      localStorage.setItem("sanatan_glow", String(nextVal));
      return nextVal;
    });
  };

  // Fetch details from YouTube oEmbed via backend API route
  const fetchVideoDetails = async (url: string) => {
    const ytId = getYouTubeId(url);
    if (!ytId) return;

    setIsFetchingDetails(true);
    setFetchSuccess(null);

    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.title) setFormTitle(data.title);
        if (data.thumbnail) setFormThumbnail(data.thumbnail);
        if (data.description) setFormDescription(data.description);
        setFetchSuccess(true);
      } else {
        setFetchSuccess(false);
      }
    } catch (err) {
      console.error("Error auto-fetching video details:", err);
      setFetchSuccess(false);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  // Handler for form URL input change
  const handleUrlChange = (val: string) => {
    setFormUrl(val);
    const ytId = getYouTubeId(val);
    if (ytId) {
      fetchVideoDetails(val);
    } else {
      setFetchSuccess(null);
    }
  };

  // Save changes to localStorage
  const saveToLocalStorage = (list: Video[]) => {
    localStorage.setItem("sanatan_videos", JSON.stringify(list));
  };

  const saveCategoriesToLocalStorage = (list: string[]) => {
    localStorage.setItem("sanatan_categories", JSON.stringify(list));
  };

  // Add new category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;

    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      alert("This category already exists.");
      return;
    }

    // Save to Firestore if Admin
    if (user && user.email === "dipak.kholiya@gmail.com") {
      try {
        const docRef = doc(collection(db, "categories"), trimmed);
        await setDoc(docRef, { name: trimmed });
      } catch (err) {
        console.error("Error adding category to Firestore:", err);
      }
    }

    const updated = [...categories, trimmed];
    setCategories(updated);
    saveCategoriesToLocalStorage(updated);
    setNewCategoryInput("");
  };

  // Edit category name
  const handleEditCategory = async (index: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const oldName = categories[index];
    if (oldName === "All") return;

    if (categories.some((c, i) => i !== index && c.toLowerCase() === trimmed.toLowerCase())) {
      alert("Another category with this name already exists.");
      return;
    }

    // Save to Firestore if Admin
    if (user && user.email === "dipak.kholiya@gmail.com") {
      try {
        // Delete old doc and create new doc
        const oldDocRef = doc(collection(db, "categories"), oldName);
        const newDocRef = doc(collection(db, "categories"), trimmed);
        await deleteDoc(oldDocRef);
        await setDoc(newDocRef, { name: trimmed });
      } catch (err) {
        console.error("Error editing category in Firestore:", err);
      }
    }

    const updatedCats = [...categories];
    updatedCats[index] = trimmed;
    setCategories(updatedCats);
    saveCategoriesToLocalStorage(updatedCats);

    // Update all videos in this category
    const updatedVideos = videos.map((v) => {
      if (v.category.toLowerCase() === oldName.toLowerCase()) {
        const uv = { ...v, category: trimmed };
        // Sync each video's category in Firestore
        if (user && user.email === "dipak.kholiya@gmail.com") {
          const docRef = doc(collection(db, "videos"), v.id);
          setDoc(docRef, { category: trimmed }, { merge: true }).catch(console.error);
        }
        return uv;
      }
      return v;
    });
    setVideos(updatedVideos);
    saveToLocalStorage(updatedVideos);

    // Sync active video category
    if (activeVideo && activeVideo.category.toLowerCase() === oldName.toLowerCase()) {
      setActiveVideo((prev) => prev ? { ...prev, category: trimmed } : prev);
    }

    // Sync selectedCategory
    if (selectedCategory.toLowerCase() === oldName.toLowerCase()) {
      setSelectedCategory(trimmed);
    }

    setEditingCategoryIndex(null);
    setEditingCategoryInput("");
  };

  // Delete category
  const handleDeleteCategory = async (index: number) => {
    const catToDelete = categories[index];
    if (catToDelete === "All") return;

    const remainingCats = categories.filter((_, i) => i !== index);
    if (remainingCats.length <= 1) {
      alert("You must have at least one category remaining.");
      return;
    }

    const fallbackCat = remainingCats[1]; // First available after "All"

    if (
      confirm(
        `Are you sure you want to delete category "${catToDelete}"? All videos in this category will be reassigned to "${fallbackCat}".`
      )
    ) {
      // Delete from Firestore if Admin
      if (user && user.email === "dipak.kholiya@gmail.com") {
        try {
          const docRef = doc(collection(db, "categories"), catToDelete);
          await deleteDoc(docRef);
        } catch (err) {
          console.error("Error deleting category from Firestore:", err);
        }
      }

      setCategories(remainingCats);
      saveCategoriesToLocalStorage(remainingCats);

      // Reassign videos
      const updatedVideos = videos.map((v) => {
        if (v.category.toLowerCase() === catToDelete.toLowerCase()) {
          const uv = { ...v, category: fallbackCat };
          // Sync each video's category in Firestore
          if (user && user.email === "dipak.kholiya@gmail.com") {
            const docRef = doc(collection(db, "videos"), v.id);
            setDoc(docRef, { category: fallbackCat }, { merge: true }).catch(console.error);
          }
          return uv;
        }
        return v;
      });
      setVideos(updatedVideos);
      saveToLocalStorage(updatedVideos);

      // Sync active video
      if (activeVideo && activeVideo.category.toLowerCase() === catToDelete.toLowerCase()) {
        setActiveVideo((prev) => prev ? { ...prev, category: fallbackCat } : prev);
      }

      // Sync selected category filter
      if (selectedCategory.toLowerCase() === catToDelete.toLowerCase()) {
        setSelectedCategory("All");
      }
    }
  };

  // Render sidebar contents reusable on desktop & mobile
  const SidebarContent = () => (
    <>
      {/* Quick Stats Panel */}
      <div className="p-4 border-b border-slate-800/50">
        <div className="bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/10 rounded-2xl p-4.5">
          <span className="text-xs text-amber-400 font-medium">Sacred Library</span>
          <p className="text-2xl font-bold mt-1 text-slate-100">{videos.length} Videos</p>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
            <Music size={12} />
            <span>Curated for Spiritual Growth</span>
          </div>
        </div>
      </div>

      {/* Navigation Links (Categories) */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Categories
          </span>
          {user && (
            <button
              onClick={() => setIsManagingCategories(true)}
              className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 transition-all"
              title="Manage categories"
            >
              <Edit3 size={11} />
              <span>Manage</span>
            </button>
          )}
        </div>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setSelectedCategory(cat);
              setIsSidebarOpen(false);
            }}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between group transition ${
              selectedCategory.toLowerCase() === cat.toLowerCase()
                ? "bg-[#18233a] text-amber-400 border border-amber-500/20"
                : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
            }`}
          >
            <span>{cat}</span>
            <ChevronRight
              size={14}
              className={`opacity-0 group-hover:opacity-100 transition-all ${
                selectedCategory.toLowerCase() === cat.toLowerCase() ? "opacity-100 text-amber-400" : "text-slate-400"
              }`}
            />
          </button>
        ))}
      </div>

      {/* User/Author Credits */}
      <div className="p-4 border-t border-slate-800 bg-[#080d17] text-xs text-slate-400 text-center">
        <p className="font-medium text-slate-300 flex items-center justify-center gap-1">
          <span>Powered by D kholiya</span>
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">© 2026 SanatanStream</p>
      </div>
    </>
  );

  // Auth Submit Handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;

    if (authEmail.toLowerCase().trim() !== "dipak.kholiya@gmail.com") {
      setAuthError("Unauthorized user. Only the owner (dipak.kholiya@gmail.com) is allowed to access the admin portal.");
      return;
    }

    setIsAuthLoading(true);
    setAuthError("");

    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      setIsAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
    } catch (err: any) {
      console.error("Authentication error:", err);
      let friendlyMessage = "Authentication failed. Please check your credentials.";
      if (err.code === "auth/invalid-credential") {
        friendlyMessage = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        friendlyMessage = "This email is already in use.";
      } else if (err.code === "auth/weak-password") {
        friendlyMessage = "Password should be at least 6 characters.";
      } else if (err.code === "auth/invalid-email") {
        friendlyMessage = "Please enter a valid email address.";
      } else if (err.code === "auth/operation-not-allowed") {
        friendlyMessage = "Email/Password sign-in is disabled in your Firebase console. To enable it:\n1. Go to Firebase Console > Authentication > Sign-in method.\n2. Click 'Add new provider' > 'Email/Password'.\n3. Enable and Save.\nOr sign in using Google Sign-In below!";
      }
      setAuthError(friendlyMessage);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Google Auth Sign In Handler
  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const loggedUser = result.user;
      if (loggedUser && loggedUser.email !== "dipak.kholiya@gmail.com") {
        await signOut(auth);
        setAuthError("Unauthorized user. Only the owner (dipak.kholiya@gmail.com) is allowed to access the admin portal.");
        setIsAuthModalOpen(true);
      } else {
        setIsAuthModalOpen(false);
      }
    } catch (err: any) {
      console.error("Google Authentication error:", err);
      let friendlyMessage = "Google Authentication failed. Please try again.";
      if (err.code === "auth/popup-closed-by-user") {
        friendlyMessage = "Sign-in popup was closed before completion.";
      } else if (err.code === "auth/operation-not-allowed") {
        friendlyMessage = "Google sign-in is not enabled in your Firebase project. Please enable it in the console.";
      }
      setAuthError(friendlyMessage);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Trigger forms initialization
  const openEditModal = (video: Video) => {
    setVideoToEdit(video);
    setFormTitle(video.title);
    setFormUrl(video.url);
    setFormCategory(video.category);
    setFormDescription(video.description);
    setFormThumbnail(video.thumbnail);
    setIsFetchingDetails(false);
    setFetchSuccess(null);
  };

  const openAddModal = () => {
    setIsAddingVideo(true);
    setFormTitle("");
    setFormUrl("");
    
    // Dynamically set category to the currently active filter, or the first available category (skipping "All")
    const availableCategories = categories.filter((cat) => cat !== "All");
    const currentFilter = selectedCategory !== "All" && availableCategories.includes(selectedCategory)
      ? selectedCategory
      : (availableCategories[0] || "Meditation");

    setFormCategory(currentFilter);
    setFormDescription("");
    setFormThumbnail("");
    setIsFetchingDetails(false);
    setFetchSuccess(null);
  };

  // Add video handler
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formUrl) return;

    // Validate that the selected category actually exists in the categories list
    const availableCategories = categories.filter((cat) => cat !== "All");
    const finalCategory = availableCategories.includes(formCategory)
      ? formCategory
      : (availableCategories[0] || "Meditation");

    const videoId = Date.now().toString();
    const newVideo: Video = {
      id: videoId,
      title: formTitle,
      url: formUrl,
      category: finalCategory,
      description: formDescription || "No description provided.",
      thumbnail: formThumbnail || "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=640&auto=format&fit=crop"
    };

    // If logged in user is admin, save to Firestore
    if (user && user.email === "dipak.kholiya@gmail.com") {
      try {
        const docRef = doc(collection(db, "videos"), videoId);
        await setDoc(docRef, {
          id: videoId,
          title: newVideo.title,
          url: newVideo.url,
          category: newVideo.category,
          description: newVideo.description,
          thumbnail: newVideo.thumbnail,
          type: getYouTubeId(newVideo.url) ? "youtube" : "hls",
          createdAt: new Date()
        });
      } catch (err) {
        console.error("Error saving video to Firestore:", err);
      }
    }

    const updated = [...videos, newVideo];
    setVideos(updated);
    saveToLocalStorage(updated);
    setIsAddingVideo(false);
    setActiveVideo(newVideo); // Play newly added video immediately
  };

  // Edit video handler
  const handleEditVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoToEdit || !formTitle || !formUrl) return;

    // Validate category exists
    const availableCategories = categories.filter((cat) => cat !== "All");
    const finalCategory = availableCategories.includes(formCategory)
      ? formCategory
      : (availableCategories[0] || "Meditation");

    const updatedVideo: Video = {
      ...videoToEdit,
      title: formTitle,
      url: formUrl,
      category: finalCategory,
      description: formDescription,
      thumbnail: formThumbnail || videoToEdit.thumbnail
    };

    // If logged in user is admin, update in Firestore
    if (user && user.email === "dipak.kholiya@gmail.com") {
      try {
        const docRef = doc(collection(db, "videos"), videoToEdit.id);
        await setDoc(docRef, {
          id: videoToEdit.id,
          title: updatedVideo.title,
          url: updatedVideo.url,
          category: updatedVideo.category,
          description: updatedVideo.description,
          thumbnail: updatedVideo.thumbnail,
          type: getYouTubeId(updatedVideo.url) ? "youtube" : "hls",
          createdAt: videoToEdit.createdAt || new Date()
        }, { merge: true });
      } catch (err) {
        console.error("Error updating video in Firestore:", err);
      }
    }

    const updated = videos.map((v) => (v.id === videoToEdit.id ? updatedVideo : v));
    setVideos(updated);
    saveToLocalStorage(updated);

    // Sync active video if it was the edited one
    if (activeVideo.id === videoToEdit.id) {
      setActiveVideo(updatedVideo);
    }

    setVideoToEdit(null);
  };

  // Delete video handler
  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;

    // If logged in user is admin, delete from Firestore
    if (user && user.email === "dipak.kholiya@gmail.com") {
      try {
        const docRef = doc(collection(db, "videos"), videoToDelete.id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Error deleting video from Firestore:", err);
      }
    }

    const updated = videos.filter((v) => v.id !== videoToDelete.id);
    setVideos(updated);
    saveToLocalStorage(updated);

    // If deleted video was active, switch active video
    if (activeVideo.id === videoToDelete.id) {
      if (updated.length > 0) {
        setActiveVideo(updated[0]);
      }
    }

    setVideoToDelete(null);
  };

  // Filter & Search
  const filteredVideos = videos.filter((v) => {
    const matchesCategory = selectedCategory === "All" || v.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#070b13] font-sans antialiased">
      {/* Header Panel */}
      <header className="sticky top-0 z-40 bg-[#0b101c]/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-300 hover:text-amber-400 md:hidden rounded-lg hover:bg-slate-800/50 transition"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-amber-500/20">
              <Tv size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-300 bg-clip-text text-transparent flex items-center gap-1.5">
                SanatanStream <Sparkles size={14} className="text-amber-400 animate-pulse" />
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">
                Premium Devotional Player
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md flex-1 mx-4 hidden md:block">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search prayers, bhajans, instructions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121a2a] border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
          />
        </div>

        {/* Add/Auth Buttons */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Add Video Button */}
              <button
                onClick={openAddModal}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-semibold px-4 py-2 rounded-xl text-sm transition shadow-lg shadow-amber-500/10"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span className="hidden sm:inline">Add Video</span>
              </button>

              {/* User Avatar with Logout Button */}
              <div className="flex items-center gap-2 bg-[#121a2a] border border-slate-700 pl-2.5 pr-3 py-1.5 rounded-xl text-xs text-slate-200">
                <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold border border-amber-500/25">
                  {user.email ? user.email[0].toUpperCase() : "A"}
                </div>
                <span className="max-w-[120px] truncate hidden md:inline-block font-medium">
                  {user.email}
                </span>
                <button
                  onClick={() => signOut(auth)}
                  className="p-1 hover:text-rose-400 text-slate-400 transition"
                  title="Sign Out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </>
          ) : isAdminUrl ? (
            <button
              onClick={() => {
                setAuthError("");
                setIsAuthModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-[#121a2a] hover:bg-slate-800 border border-slate-700 active:scale-95 text-slate-200 hover:text-amber-400 px-4 py-2 rounded-xl text-sm transition shadow-md"
            >
              <LogIn size={14} />
              <span>Admin Login</span>
            </button>
          ) : null}
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex flex-1 relative">
        {/* Mobile sidebar overlay & navigation */}
        <AnimatePresence>
          {isSidebarOpen && isMobile && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-xs z-40 md:hidden"
              />
              {/* Sidebar container */}
              <motion.nav
                drag="x"
                dragConstraints={{ left: -256, right: 0 }}
                dragElastic={{ left: 0.15, right: 0 }}
                onDragEnd={(event, info) => {
                  if (info.offset.x < -80 || info.velocity.x < -300) {
                    setIsSidebarOpen(false);
                  }
                }}
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="fixed inset-y-0 left-0 w-64 bg-[#0a0f1b] border-r border-slate-800/80 z-50 flex flex-col pt-16"
              >
                {/* Close Sidebar button for mobile */}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
                <SidebarContent />
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        {/* Desktop Navigation Sidebar (Desktop persistent) */}
        <nav className="hidden md:flex w-64 bg-[#0a0f1b] border-r border-slate-800/80 flex-col shrink-0 pt-4">
          <SidebarContent />
        </nav>

        {/* Content Panel */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto overflow-x-hidden">
          {/* Mobile Search Bar fallback */}
          <div className="relative w-full md:hidden mb-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search prayers, bhajan, instruction..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121a2a] border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-100 focus:outline-none"
            />
          </div>

          {/* Mobile Categories Scrollable Pills */}
          <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0 -mx-4 px-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition border ${
                  selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? "bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10"
                    : "bg-[#121a2a]/60 text-slate-300 border-slate-800/80 hover:bg-[#121a2a]"
                }`}
              >
                {cat}
              </button>
            ))}
            {user && (
              <button
                onClick={() => setIsManagingCategories(true)}
                className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition border border-dashed border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 flex items-center gap-1"
              >
                <Plus size={12} />
                <span>Manage</span>
              </button>
            )}
          </div>

          {isMobile ? (
            /* MOBILE THUMBNAIL/THUMBLINE VIEW GRID */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-bold text-white tracking-tight flex items-center gap-2">
                  <ListVideo size={16} className="text-amber-400" />
                  <span>Sacred Video Gallery</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {filteredVideos.length} found
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredVideos.length > 0 ? (
                  filteredVideos.map((vid) => (
                    <div
                      key={vid.id}
                      onClick={() => {
                        setActiveVideo(vid);
                        setIsMobilePlayerOpen(true);
                      }}
                      className={`group/card flex flex-col bg-[#0b101c]/90 border rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 shadow-md shadow-black/10 ${
                        activeVideo?.id === vid.id
                          ? "border-amber-500/40 shadow-md shadow-amber-500/5 bg-[#121a2a]"
                          : "border-slate-800 hover:border-slate-700/80 hover:bg-[#121929]"
                      }`}
                    >
                      {/* Thumbnail aspect ratio wrapper */}
                      <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
                        <img
                          src={vid.thumbnail}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                        />
                        
                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 bg-black/35 sm:bg-black/40 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="p-3 bg-amber-500 rounded-full text-slate-950 transform scale-100 sm:scale-90 sm:group-hover/card:scale-100 transition-transform duration-300 shadow-lg shadow-amber-500/20">
                            <Play size={18} fill="currentColor" />
                          </div>
                        </div>

                        {/* Top-right Category badge */}
                        <span className="absolute top-2.5 right-2.5 text-[10px] bg-slate-900/90 text-amber-400 font-semibold px-2 py-0.5 rounded border border-slate-700/60 uppercase tracking-wider">
                          {vid.category}
                        </span>

                        {/* Playing status indicator */}
                        {activeVideo?.id === vid.id && (
                          <div className="absolute bottom-2.5 left-2.5 bg-[#18233a]/90 border border-amber-500/30 rounded-lg px-2 py-1 flex items-center gap-1.5 backdrop-blur-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                            <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">
                              Now Playing
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="p-4 flex flex-col justify-between flex-1">
                        <div>
                          <h4 className="text-sm font-bold text-slate-100 group-hover/card:text-amber-300 transition leading-snug line-clamp-2">
                            {vid.title}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {vid.description}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-800/60">
                          <div className="flex items-center gap-1 text-amber-400 font-semibold text-xs bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                            <Play size={11} fill="currentColor" />
                            <span>Play Stream</span>
                          </div>
                          
                          {user && (
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(vid);
                                }}
                                className="p-1.5 bg-slate-800/80 text-slate-400 hover:text-amber-400 rounded-lg transition border border-slate-700/50"
                                title="Edit video metadata"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVideoToDelete(vid);
                                }}
                                className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition border border-rose-500/20"
                                title="Delete video"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-16 border border-slate-800/50 rounded-2xl bg-[#0b101c]/30">
                    <p className="text-base text-slate-400">No streams found matching your filters.</p>
                    <button
                      onClick={() => {
                        setSelectedCategory("All");
                        setSearchQuery("");
                      }}
                      className="mt-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-amber-500/20 transition"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* DESKTOP SPLIT VIEW LAYOUT */
            <div className="flex flex-col lg:flex-row gap-6 w-full">
              {/* Left Player Area (Holds Active Player and Info details) */}
              <section className="flex-1 flex flex-col gap-5 max-w-3xl">
                {activeVideo ? (
                  <div className="flex flex-col gap-4">
                    {/* Embedded Custom Player */}
                    <CustomPlayer
                      video={activeVideo}
                      autoplay={autoplay}
                      onAutoplayToggle={handleToggleAutoplay}
                      ambientGlow={ambientGlow}
                      onAmbientGlowToggle={handleToggleAmbientGlow}
                      onEnded={() => {
                        if (autoplay) {
                          // Try to play next video in list automatically
                          const currentIndex = filteredVideos.findIndex((v) => v.id === activeVideo.id);
                          if (currentIndex !== -1 && currentIndex < filteredVideos.length - 1) {
                            setActiveVideo(filteredVideos[currentIndex + 1]);
                          }
                        }
                      }}
                    />

                    {/* Video Info Card */}
                    <div className="bg-[#0b101c] border border-slate-800 rounded-2xl p-5 md:p-6 shadow-md shadow-black/10">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <span className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium text-xs px-2.5 py-1 rounded-full mb-3">
                            {activeVideo.category}
                          </span>
                          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white leading-tight">
                            {activeVideo.title}
                          </h2>
                        </div>
                        {/* Active Edit/Delete Options */}
                        <div className="flex items-center gap-4">
                          {/* Autoplay setting switch inside info card */}
                          <div className="flex items-center gap-2 bg-[#121a2a] border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider select-none hidden sm:inline">
                              Autoplay
                            </span>
                            <button
                              type="button"
                              onClick={handleToggleAutoplay}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                autoplay ? "bg-amber-500" : "bg-slate-700"
                              }`}
                              title={autoplay ? "Autoplay is ON" : "Autoplay is OFF"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  autoplay ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                          {/* Ambient Glow toggle switch inside info card */}
                          <div className="flex items-center gap-2 bg-[#121a2a] border border-slate-800 rounded-xl px-3 py-1.5 shadow-inner">
                            <Sparkles size={14} className={ambientGlow ? "text-amber-400" : "text-slate-500"} />
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider select-none hidden sm:inline">
                              Glow
                            </span>
                            <button
                              type="button"
                              onClick={handleToggleAmbientGlow}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                ambientGlow ? "bg-amber-500" : "bg-slate-700"
                              }`}
                              title={ambientGlow ? "Glow is ON" : "Glow is OFF"}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  ambientGlow ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>

                          {user && (
                            <>
                              <button
                                onClick={() => openEditModal(activeVideo)}
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-xl border border-slate-700 transition"
                                title="Edit current video metadata"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => setVideoToDelete(activeVideo)}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition"
                                title="Delete current video"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <hr className="my-4 border-slate-800" />

                      <div className="flex items-start gap-3">
                        <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-300 leading-relaxed">
                          {activeVideo.description}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-[#0b101c]/40 min-h-[300px]">
                    <ListVideo size={48} className="text-slate-600 mb-3 animate-pulse" />
                    <h3 className="text-lg font-bold text-slate-200">No Video Active</h3>
                    <p className="text-sm text-slate-400 mt-1 max-w-sm">
                      Add some spiritual streams or select a category to start your devotional journey.
                    </p>
                    <button
                      onClick={openAddModal}
                      className="mt-4 bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-sm font-semibold transition"
                    >
                      Create First Video
                    </button>
                  </div>
                )}
              </section>

              {/* Right Video Playlist Column */}
              <section className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-bold text-white tracking-tight flex items-center gap-2">
                    <ListVideo size={16} className="text-amber-400" />
                    <span>Divine Playlist</span>
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {filteredVideos.length} found
                  </span>
                </div>

                {/* Scrolling playlist panel */}
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1">
                  {filteredVideos.length > 0 ? (
                    filteredVideos.map((vid) => (
                      <div
                        key={vid.id}
                        onClick={() => setActiveVideo(vid)}
                        className={`group/card flex gap-3 p-2.5 rounded-2xl border cursor-pointer transition-all ${
                          activeVideo?.id === vid.id
                            ? "bg-[#18233a] border-amber-500/40 shadow-md shadow-amber-500/5"
                            : "bg-[#0b101c]/90 border-slate-800 hover:bg-[#121929] hover:border-slate-700/80"
                        }`}
                      >
                        {/* Video Thumbnail preview */}
                        <div className="relative w-28 aspect-video rounded-xl overflow-hidden shrink-0 bg-slate-950 border border-slate-800">
                          <img
                            src={vid.thumbnail}
                            alt={vid.title}
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          {activeVideo?.id === vid.id && (
                            <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                              <span className="text-[10px] font-bold text-amber-400 tracking-wider ml-1.5 uppercase">
                                Playing
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Text Details */}
                        <div className="flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            <span className="text-[10px] bg-slate-800/80 text-amber-400 font-semibold px-2 py-0.5 rounded border border-slate-700/60 uppercase tracking-wider">
                              {vid.category}
                            </span>
                            <h4 className="text-sm font-semibold text-slate-100 line-clamp-2 mt-1.5 group-hover/card:text-amber-300 transition leading-snug">
                              {vid.title}
                            </h4>
                          </div>

                          {/* Card Operations */}
                          {user && (
                            <div className="flex justify-end gap-1.5 mt-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(vid);
                                }}
                                className="p-1 bg-slate-800/80 text-slate-400 hover:text-amber-400 rounded-lg transition border border-slate-700/50"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setVideoToDelete(vid);
                                }}
                                className="p-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition border border-rose-500/20"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 border border-slate-800/50 rounded-2xl bg-[#0b101c]/30">
                      <p className="text-sm text-slate-400">No streams available here.</p>
                      <button
                        onClick={() => {
                          setSelectedCategory("All");
                          setSearchQuery("");
                        }}
                        className="mt-2 text-xs text-amber-400 hover:underline"
                      >
                        Clear Filters
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* --- ALL CUSTOM MODALS (Fully animated under <AnimatePresence>) --- */}
      <AnimatePresence>
        {/* ADMIN AUTH MODAL */}
        {isAuthModalOpen && (
          <motion.div
            key="auth-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              key="auth-modal-container"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col relative"
            >
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/55 transition"
              >
                <X size={18} />
              </button>
              <div className="flex flex-col items-center text-center mb-5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-3 shadow-lg shadow-amber-500/5">
                  <Lock size={22} />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Admin Portal
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                  Sign in using your owner credentials to add, edit or delete video streams.
                </p>
              </div>

              {authError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-xl text-xs mb-4 flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                  <span className="flex-1 whitespace-pre-line text-left leading-relaxed">{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full bg-[#121a2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#121a2a] border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-amber-500/15 flex items-center justify-center gap-2 mt-2"
                >
                  {isAuthLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Lock size={14} />
                      <span>Sign In</span>
                    </>
                  )}
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-3 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Or</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthLoading}
                  className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 disabled:opacity-50 text-slate-200 font-semibold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-black/20"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* ADD VIDEO MODAL */}
        {isAddingVideo && (
          <motion.div
            key="add-video-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              key="add-video-modal-container"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col relative"
            >
              <button
                onClick={() => setIsAddingVideo(false)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/55 transition"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold text-white mb-1 tracking-tight flex items-center gap-2">
                <Plus size={18} className="text-amber-400" /> Add Sacred Stream
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Integrate external video URL (MP4 raw link or YouTube Embed link) into your repository.
              </p>

              <form onSubmit={handleAddVideo} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Video Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mahamrityunjaya Mantra"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Stream URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="YouTube Link or raw MP4 URL"
                    value={formUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                  <div className="flex items-center justify-between mt-1.5 px-1 min-h-[16px]">
                    {isFetchingDetails ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400">
                        <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span>Fetching YouTube details...</span>
                      </div>
                    ) : fetchSuccess === true ? (
                      <div className="text-xs text-emerald-400 flex items-center gap-1">
                        <span>✨ Metadata loaded successfully!</span>
                      </div>
                    ) : fetchSuccess === false ? (
                      <div className="text-xs text-rose-400 flex items-center gap-1">
                        <span>⚠️ Failed to fetch details.</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        Paste a YouTube URL to auto-fill details.
                      </div>
                    )}

                    {getYouTubeId(formUrl) && !isFetchingDetails && (
                      <button
                        type="button"
                        onClick={() => fetchVideoDetails(formUrl)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition"
                      >
                        <RotateCcw size={10} />
                        <span>Refetch</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                    >
                      {categories.filter((cat) => cat !== "All").map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Custom Thumbnail (Optional)</label>
                    <input
                      type="url"
                      placeholder="Image URL"
                      value={formThumbnail}
                      onChange={(e) => setFormThumbnail(e.target.value)}
                      className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Explain the devotional merit or context..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 resize-none"
                  ></textarea>
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingVideo(false)}
                    className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-sm transition font-semibold"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* EDIT VIDEO MODAL */}
        {videoToEdit && (
          <motion.div
            key="edit-video-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              key="edit-video-modal-container"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col relative"
            >
              <button
                onClick={() => setVideoToEdit(null)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/55 transition"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold text-white mb-1 tracking-tight flex items-center gap-2">
                <Edit3 size={18} className="text-amber-400" /> Edit Metadata
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Update details for &quot;{videoToEdit.title}&quot; dynamically.
              </p>

              <form onSubmit={handleEditVideo} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Video Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Stream URL *</label>
                  <input
                    type="url"
                    required
                    value={formUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                  <div className="flex items-center justify-between mt-1.5 px-1 min-h-[16px]">
                    {isFetchingDetails ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400">
                        <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span>Fetching YouTube details...</span>
                      </div>
                    ) : fetchSuccess === true ? (
                      <div className="text-xs text-emerald-400 flex items-center gap-1">
                        <span>✨ Metadata loaded successfully!</span>
                      </div>
                    ) : fetchSuccess === false ? (
                      <div className="text-xs text-rose-400 flex items-center gap-1">
                        <span>⚠️ Failed to fetch details.</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        Paste a YouTube URL to auto-fill details.
                      </div>
                    )}

                    {getYouTubeId(formUrl) && !isFetchingDetails && (
                      <button
                        type="button"
                        onClick={() => fetchVideoDetails(formUrl)}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition"
                      >
                        <RotateCcw size={10} />
                        <span>Refetch</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                    >
                      {categories.filter((cat) => cat !== "All").map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Thumbnail URL</label>
                    <input
                      type="url"
                      value={formThumbnail}
                      onChange={(e) => setFormThumbnail(e.target.value)}
                      className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 resize-none"
                  ></textarea>
                </div>

                <div className="flex gap-3 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setVideoToEdit(null)}
                    className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-sm font-semibold transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* DELETE VIDEO CONFIRMATION MODAL */}
        {videoToDelete && (
          <motion.div
            key="delete-video-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div
              key="delete-video-modal-container"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col relative"
            >
              <button
                onClick={() => setVideoToDelete(null)}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/55 transition"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold text-white mb-2 tracking-tight flex items-center gap-2">
                <Trash2 size={18} className="text-rose-500" /> Remove Sacred Stream?
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Are you sure you want to remove &quot;<span className="text-amber-300 font-medium">{videoToDelete.title}</span>&quot;? This action cannot be undone.
              </p>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setVideoToDelete(null)}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteVideo}
                  className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MANAGE CATEGORIES MODAL */}
        {isManagingCategories && (
          <motion.div
            key="manage-categories-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div
              key="manage-categories-container"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0b1120] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col relative"
            >
              <button
                onClick={() => {
                  setIsManagingCategories(false);
                  setEditingCategoryIndex(null);
                  setEditingCategoryInput("");
                  setNewCategoryInput("");
                }}
                className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/55 transition"
              >
                <X size={18} />
              </button>

              <h3 className="text-lg font-bold text-white mb-1 tracking-tight flex items-center gap-2">
                <Edit3 size={18} className="text-amber-400" /> Manage Categories
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Add, rename, or delete devotional categories.
              </p>

              {/* Add New Category form */}
              <form onSubmit={handleAddCategory} className="flex gap-2 mb-5">
                <input
                  type="text"
                  placeholder="New Category Name"
                  required
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  className="flex-1 bg-[#121a2a] border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-xl text-xs transition"
                >
                  Add
                </button>
              </form>

              {/* List of categories */}
              <div className="flex-1 max-h-60 overflow-y-auto flex flex-col gap-2.5 pr-1">
                {categories.map((cat, index) => {
                  const isAll = cat === "All";
                  return (
                    <div
                      key={cat + index}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-[#121a2a]/30"
                    >
                      {editingCategoryIndex === index ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="text"
                            value={editingCategoryInput}
                            onChange={(e) => setEditingCategoryInput(e.target.value)}
                            className="flex-1 bg-[#121a2a] border border-amber-500/50 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleEditCategory(index, editingCategoryInput)}
                            className="text-emerald-400 hover:text-emerald-300 text-xs font-semibold px-2 py-1 bg-emerald-500/10 rounded-md"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryIndex(null);
                              setEditingCategoryInput("");
                            }}
                            className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded-md"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm text-slate-200 font-medium">
                            {cat} {isAll && <span className="text-[10px] text-slate-500">(System Default)</span>}
                          </span>
                          {!isAll && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryIndex(index);
                                  setEditingCategoryInput(cat);
                                }}
                                className="p-1.5 text-slate-400 hover:text-amber-400 rounded-md hover:bg-slate-800 transition"
                                title="Rename Category"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(index)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition"
                                title="Delete Category"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setIsManagingCategories(false);
                    setEditingCategoryIndex(null);
                    setEditingCategoryInput("");
                    setNewCategoryInput("");
                  }}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* MOBILE BIG SCREEN PLAYER OVERLAY */}
        {isMobile && isMobilePlayerOpen && activeVideo && (
          <motion.div
            key="mobile-big-screen-player"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 400 }}
            dragElastic={{ top: 0.1, bottom: 0.5 }}
            onDragEnd={(event, info) => {
              if (info.offset.y > 150 || info.velocity.y > 500) {
                setIsMobilePlayerOpen(false);
              }
            }}
            className="fixed inset-0 z-50 bg-[#070b13] flex flex-col"
          >
            {/* Header bar */}
            <div className="bg-[#0b101c] border-b border-slate-800 px-4 py-3 flex items-center justify-between shrink-0">
              <button
                onClick={() => setIsMobilePlayerOpen(false)}
                className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 font-medium text-sm transition"
              >
                <X size={18} />
                <span>Back to Library</span>
              </button>
              
              {user && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(activeVideo)}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 rounded-xl border border-slate-700 transition"
                    title="Edit current stream"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setVideoToDelete(activeVideo);
                      setIsMobilePlayerOpen(false);
                    }}
                    className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition"
                    title="Delete current stream"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
 
             {/* Immersive Scrollable Player Area */}
             {/* Custom Player Wrapper - Edge-to-Edge with no border, no rounded corners, shadow below */}
             <div className="w-full bg-slate-950 shrink-0 relative z-10">
               <CustomPlayer
                 video={activeVideo}
                 autoplay={autoplay}
                 onAutoplayToggle={handleToggleAutoplay}
                 ambientGlow={ambientGlow}
                 onAmbientGlowToggle={handleToggleAmbientGlow}
                 rounded={false}
                 onEnded={() => {
                   if (autoplay) {
                     const currentIndex = filteredVideos.findIndex((v) => v.id === activeVideo.id);
                     if (currentIndex !== -1 && currentIndex < filteredVideos.length - 1) {
                       setActiveVideo(filteredVideos[currentIndex + 1]);
                     }
                   }
                 }}
               />
             </div>
 
             {/* Scrollable details and suggested next below */}
             <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gradient-to-b from-[#070b13] to-[#04070d]">
               {/* Details card below the video */}
               <div className="bg-[#0b101c] border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-block bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium text-xs px-2.5 py-1 rounded-full">
                    {activeVideo.category}
                  </span>

                  {/* Autoplay & Ambient Glow setting badge/toggle for mobile view */}
                  <div className="flex items-center gap-3">
                    {/* Autoplay Toggle */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Autoplay
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleAutoplay}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoplay ? "bg-amber-500" : "bg-slate-700"
                        }`}
                        title={autoplay ? "Autoplay is ON" : "Autoplay is OFF"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                            autoplay ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Ambient Glow Toggle */}
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={11} className={ambientGlow ? "text-amber-400" : "text-slate-500"} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Glow
                      </span>
                      <button
                        type="button"
                        onClick={handleToggleAmbientGlow}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          ambientGlow ? "bg-amber-500" : "bg-slate-700"
                        }`}
                        title={ambientGlow ? "Glow is ON" : "Glow is OFF"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
                            ambientGlow ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {activeVideo.title}
                </h2>
                
                <hr className="my-4 border-slate-800" />

                <div className="flex items-start gap-3">
                  <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-300 leading-relaxed">
                    {activeVideo.description}
                  </div>
                </div>
              </div>

              {/* Suggested Next Streams inside Big Screen Mode */}
              <div className="flex flex-col gap-3 mt-2 pb-8">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                  <ListVideo size={14} className="text-amber-400" />
                  <span>Up Next</span>
                </h3>
                
                <div className="flex flex-col gap-2.5">
                  {filteredVideos
                    .filter((v) => v.id !== activeVideo.id)
                    .slice(0, 4)
                    .map((vid) => (
                      <div
                        key={vid.id}
                        onClick={() => setActiveVideo(vid)}
                        className="flex gap-3 p-2 rounded-xl bg-[#0b101c]/60 border border-slate-800/80 hover:border-slate-700 transition cursor-pointer"
                      >
                        <div className="relative w-24 aspect-video rounded-lg overflow-hidden shrink-0 bg-slate-950 border border-slate-800/50">
                          <img
                            src={vid.thumbnail}
                            alt={vid.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex flex-col justify-center min-w-0 flex-1">
                          <h4 className="text-xs font-semibold text-slate-200 line-clamp-1">
                            {vid.title}
                          </h4>
                          <span className="text-[10px] text-amber-400 mt-1 font-medium">
                            {vid.category}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
