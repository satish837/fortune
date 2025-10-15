import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BarChart3, LogOut } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInstagram,
  faFacebook,
  faWhatsapp,
} from "@fortawesome/free-brands-svg-icons";
import { toast } from "@/hooks/use-toast";
// In dev, Vite's error overlay can crash when console logs receive complex/circular objects.
// Patch console.error to safely serialize arguments to primitives to avoid the overlay throwing.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const originalConsoleError = console.error.bind(console);
  const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (_key: string, value: any) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    };
  };

  console.error = (...args: any[]) => {
    try {
      const safeArgs = args.map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(a, getCircularReplacer());
        } catch (e) {
          return String(a);
        }
      });
      originalConsoleError(...safeArgs);
    } catch (e) {
      originalConsoleError("[console.error serialization failed]", String(e));
    }
  };
}

// Dynamic import for canvas-record (desktop only)
let Recorder: any = null;
let RecorderStatus: any = null;
let Encoders: any = null;

// Safe ArrayBuffer -> Base64 conversion (chunked to avoid call stack issues)
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB per chunk
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    // Convert chunk to string
    const chunk = bytes.subarray(i, i + chunkSize);
    // Use fromCharCode on an Array to avoid passing huge arg lists
    binary += String.fromCharCode.apply(
      null,
      Array.from(chunk) as unknown as number[],
    );
  }
  return btoa(binary);
};

// VIDEO FUNCTIONALITY - Constants uncommented but auto-trigger disabled
const VIDEO_WIDTH = 720;
const VIDEO_HEIGHT = 1280;

interface VideoCanvasMetrics {
  scale: number;
  drawWidth: number;
  drawHeight: number;
  offsetX: number;
  offsetY: number;
}

const getVideoCanvasMetrics = (rect: DOMRect): VideoCanvasMetrics => {
  const scale = Math.min(VIDEO_WIDTH / rect.width, VIDEO_HEIGHT / rect.height);
  const drawWidth = rect.width * scale;
  const drawHeight = rect.height * scale;
  const offsetX = (VIDEO_WIDTH - drawWidth) / 2;
  const offsetY = (VIDEO_HEIGHT - drawHeight) / 2;

  return { scale, drawWidth, drawHeight, offsetX, offsetY };
};

// Circular Progress Bar Component
const CircularProgressBar = ({
  percentage,
  size = 80,
  strokeWidth = 6,
  color = "#f97316",
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#fef3c7"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-orange-900">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
};

interface DishItem {
  id: string;
  name: string;
  image: string;
}

const DISHES: DishItem[] = [
  {
    id: "chakli",
    name: "Chakli",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257670/chakkli_ked8oq.png",
  },
  {
    id: "churma-ladoos",
    name: "Churma Ladoos",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257669/Churmaladoos_k6q2v5.png",
  },
  {
    id: "karanji",
    name: "Karanji",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257670/Karanji_qfrp0r.png",
  },
  {
    id: "malpua",
    name: "Malpua",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257670/Malpua_kx1nns.png",
  },
  {
    id: "mathri",
    name: "Mathri",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257671/Mathris_klyroa.png",
  },
  {
    id: "moongdal-halwa",
    name: "Moongdal Halwa",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257672/Moongdal-Halwa_fbxkou.png",
  },
  {
    id: "murukku",
    name: "Murukku",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257673/Murukku_hmudgd.png",
  },
  {
    id: "mysore-pak",
    name: "Mysore Pak",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257751/MysorePak_lrocm4.png",
  },
  {
    id: "payasam",
    name: "Payasam",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257675/Payasam_orwro2.png",
  },
  {
    id: "pinni",
    name: "Pinni",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257677/Pinni_zdxrt3.png",
  },
  {
    id: "samosa",
    name: "Samosa",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257679/Samosas_vfsnv4.png",
  },
  {
    id: "shankarpali",
    name: "Shankarpali",
    image:
      "https://res.cloudinary.com/dsol5tcu0/image/upload/v1760257678/Shankarpali_rhwyva.png",
  },
];

const BACKGROUNDS = [
  {
    id: "1",
    name: "Festive Celebration",
    video: "/background/1.mp4",
    fallback: "🎆",
  },
  {
    id: "2",
    name: "Golden Lights",
    video: "/background/2.mp4",
    fallback: "✨",
  },
  { id: "3", name: "Warm Glow", video: "/background/3.mp4", fallback: "🕯️" },
  {
    id: "4",
    name: "Diwali Sparkle",
    video: "/background/4.mp4",
    fallback: "��",
  },
  { id: "5", name: "Festive Joy", video: "/background/5.mp4", fallback: "🎉" },
];

const PRESET_GREETINGS = [
  "This Diwali, may the flavours of the Fortune make your home shine brighter",
  "May your Diwali sparkle with love, laughter, and lots of Fortune",
  "Sharing the flavours of #DiwaliKaFortune with you",
];

const LOADER_STEP_HOLD_MS = 4500; // 4.5 seconds hold
const LOADER_STEP_FADE_MS = 500;  // 0.5 seconds fade = 5 seconds total
const PROGRESS_INCREMENT_INTERVAL_MS = 1500;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const GENERATION_STEPS = [
  "North India glows with Malpua, mathris, Pakode and festive warmth!",
  "South India celebrates Diwali with polis, murukkus, payasam and memories!",
  "West India feasts on laddoos, chivda, chaklis and festive cheer!",
  "Rasgullas, nimkis, paayesh and festive joy sweeten East India!",
];

const TERMS_AND_CONDITIONS = `Terms & Conditions – #DiwaliKaFortune Postcard Experience

Participation in the #DiwaliKaFortune Postcard Experience ("Activity") is voluntary and free of charge.

Participants must be residents of India and meet the minimum age requirement of 18 years.

The Company reserves the right to modify, suspend, or withdraw the Activity at any time without prior notice.

By participating, users agree that this Activity is for recreational and festive engagement purposes only and does not constitute gambling, betting, or wagering under applicable Indian laws.

Any misuse of the platform or attempt to convert this Activity into a wagering or profit-seeking practice will lead to immediate disqualification and potential legal action.

The #DiwaliKaFortune Postcard Experience is a festive digital engagement hosted by AWL Agri Business Ltd ("Company") under the Fortune brand.

The Activity allows participants to create personalized Diwali postcards using the AI-powered generator available on the Fortune digital platform.

Each participant must upload a personal photo, select a festive dish, choose a background, add a greeting, and generate their customized postcard.

Logging in or registering alone will not be considered participation.

Each valid postcard generated through the platform shall count as one entry for the Activity.

The Activity is open for participation during the Diwali festive period of 2025 or such duration as may be decided by AWL Agri Business Ltd at its sole discretion.

The Company reserves the right to extend or curtail the campaign period as deemed appropriate.

Winner Criteria:
Participants who create and generate the highest number of postcards during the Activity period shall be declared winners.

In case of a tie, the Company reserves the right to determine the winner(s) based on additional eligibility criteria or other fair and transparent methods as it deems appropriate.

The decision of the AWL Agri Business Ltd committee shall be final and binding, and no correspondence or dispute shall be entertained regarding the winner selection or prize distribution.

The Company may award prizes, gratifications, or promotional rewards to selected winners.

All prizes are non-transferable and cannot be exchanged for cash or any other benefit.

Applicable taxes, if any, shall be borne by the winners.

The Company reserves the right to substitute prizes with others of equivalent value without prior notice.

By uploading a photo and participating in the Activity, users confirm that the image is original, belongs to them, and does not infringe upon any third-party rights including copyright, likeness, or privacy.

The user shall not upload any content that is obscene, offensive, defamatory, political, religious, or objectionable under Indian law.

Any violation of these conditions will result in removal of the entry and disqualification from the Activity.

By participating, users grant AWL Agri Business Ltd a non-exclusive, royalty-free, worldwide, perpetual license to use, reproduce, modify, and adapt the uploaded image solely for the purpose of generating and displaying the Diwali postcard.

Participants further consent to AWL Agri Business Ltd featuring their generated postcards, name, or greeting on its official digital and social media platforms as part of the #DiwaliKaFortune campaign without additional compensation or credit.

The postcards are AI-generated creative outputs.

Results may vary depending on the image quality, lighting, and technical factors.

AWL Agri Business Ltd makes no warranty regarding likeness, accuracy, or quality of the generated output.

The Activity is intended purely for festive engagement and creative participation.

All personal details provided by the users (name, email ID, and phone number) will be used solely for facilitating participation, communication, and winner verification.

By participating, users consent to the collection, storage, and processing of their data in accordance with AWL Agri Business Ltd's Privacy Policy.

The Company shall not sell or share personal data with third parties except as required by law or to operate the Activity.

Users may request deletion of their personal data by contacting the Company.

AWL Agri Business Ltd may conduct promotional activities, including but not limited to festive contests, engagement tasks, and reward campaigns, in connection with this Activity.

Each such activity may have separate terms and shall form part of these Terms and Conditions.

AWL Agri Business Ltd reserves the right to determine:
- The format and structure of the Activity,
- The nature and value of prizes or rewards,
- The process for selection of winners, and
- The manner and timeline for distribution of rewards.

AWL Agri Business Ltd makes no assurance and assumes no liability with respect to the availability, logistics, or quality of third-party products or vouchers offered as rewards.

Any claims regarding the same shall be addressed directly with the respective third-party provider.

By participating in this Activity, users consent to receive communications from AWL Agri Business Ltd, including announcements, administrative messages, and promotional updates, via SMS, email, or other media, in accordance with the Company's Privacy Policy.

Users acknowledge that all copyrights, trademarks, logos, and brand elements related to Fortune and the #DiwaliKaFortune Activity is the property of AWL Agri Business Ltd or its licensors.

Participants shall not copy, distribute, or create derivative works from any part of the Activity, designs, or assets unless expressly authorized by the Company.

All rights, title, and interest in and to the #DiwaliKaFortune Activity remains the exclusive property of AWL Agri Business Ltd and/or its licensors.

Nothing in these Terms grants participants the right to use AWL's trademarks, logos, or brand features without prior written consent.

The Activity and platform are provided on an "as is" and "as available" basis.

To the maximum extent permitted under law, AWL Agri Business Ltd disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.

The Company makes no warranty regarding accuracy, reliability, availability, or uninterrupted operation of the platform, or protection against unauthorized access or data loss.

To the maximum extent permitted by law, AWL Agri Business Ltd shall not be liable for any indirect, incidental, special, or consequential damages including loss of data, profits, or goodwill arising from participation in the Activity or use of the generated postcard.

Participants are solely responsible for their actions on the platform and agree to indemnify and hold harmless AWL Agri Business Ltd, its affiliates, employees, and officers from any claims, damages, or losses arising out of misuse, fraudulent activity, or violation of these Terms.

Failure to enforce any provision of these Terms shall not constitute a waiver.

If any provision is found unenforceable, it shall be limited to the minimum extent necessary so that the remaining provisions remain valid.

These Terms will be governed by and construed in accordance with the laws of India. Subject to applicable state-wise restrictions, any disputes shall be subject to the exclusive jurisdiction of the courts at Delhi.

By clicking "Let's Begin" and uploading an image, participants confirm that they have read, understood, and agreed to these Terms and Conditions.`;

function Stepper({ step }: { step: number }) {
  const items = [
    "Upload Your Photo",
    "Choose Your Favourite Dish",
    "Choose your Festive Background",
    "Add Your Greeting",
    "Generate",
  ];
  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-4 text-sm text-orange-900/80">
      {items.map((label, i) => (
        <div key={i} className="flex items-center gap-4">
          <div
            className={cn(
              "h-8 rounded-full px-3 inline-flex items-center justify-center border",
              i <= step
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white/70 border-orange-200",
            )}
          >
            {i + 1}
          </div>
          <span className="hidden sm:block">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Create() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [selectedDish, setSelectedDish] = useState<DishItem | null>(null);
  const [bg, setBg] = useState(BACKGROUNDS[0].id);
  const [greeting, setGreeting] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [generationStep, setGenerationStep] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  // VIDEO FUNCTIONALITY - State variables uncommented but auto-trigger disabled
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [cloudinaryVideoUrl, setCloudinaryVideoUrl] = useState<string | null>(
    null,
  );
  const [videoUploading, setVideoUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<{
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
  } | null>(null);
  const [showFooter, setShowFooter] = useState(false);
  const [canvasRecorder, setCanvasRecorder] = useState<any>(null);
  const [recorderStatus, setRecorderStatus] = useState<string>("idle");
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [videoGenerationError, setVideoGenerationError] = useState<
    string | null
  >(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isPageCrashed, setIsPageCrashed] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const [cloudinaryConfig, setCloudinaryConfig] = useState<{
    cloudName: string;
    uploadPreset: string;
    hasApiKey: boolean;
  } | null>(null);
  const [canvasRecordLoaded, setCanvasRecordLoaded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [imageDownloading, setImageDownloading] = useState(false);
  const [imageDownloadError, setImageDownloadError] = useState<string | null>(
    null,
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // VIDEO FUNCTIONALITY - Refs uncommented but auto-trigger disabled
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedMimeTypeRef = useRef<string>("video/mp4");
  const manualLoaderControlRef = useRef(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const isGeneratingRef = useRef(false);

  const clearProgressInterval = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const startProgressIncrement = useCallback(() => {
    clearProgressInterval();
    progressIntervalRef.current = setInterval(() => {
      setGenerationProgress((prev) => {
        if (prev >= 99) {
          clearProgressInterval();
          return prev;
        }
        const next = prev + 1;
        return next >= 99 ? 99 : next;
      });
    }, PROGRESS_INCREMENT_INTERVAL_MS);
  }, [clearProgressInterval]);

  const updateRecordedMimeType = useCallback((mime?: string | null) => {
    const normalized =
      typeof mime === "string" && mime.trim().length > 0 ? mime : "video/mp4";
    recordedMimeTypeRef.current = normalized;
  }, []);

  const getFileExtensionFromMime = (mime?: string | null) => {
    if (!mime) return "mp4";
    const lowerMime = mime.toLowerCase();
    if (lowerMime.includes("webm")) return "webm";
    if (lowerMime.includes("ogg")) return "ogg";
    if (lowerMime.includes("3gpp")) return "3gp";
    if (lowerMime.includes("quicktime")) return "mov";
    if (lowerMime.includes("matroska") || lowerMime.includes("mkv")) {
      return "mkv";
    }
    if (lowerMime.includes("avi")) return "avi";
    return "mp4";
  };

  const loadHtmlImage = useCallback((src: string) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }, []);

  // VIDEO FUNCTIONALITY - Functions uncommented but auto-trigger disabled
  const waitForVideoFrame = useCallback((video: HTMLVideoElement) => {
    return new Promise<void>((resolve, reject) => {
      if (!video) {
        reject(new Error("Video element not found"));
        return;
      }

      function cleanup() {
        video.removeEventListener("loadeddata", handleLoadedData);
        video.removeEventListener("error", handleError);
      }

      function handleLoadedData() {
        cleanup();
        resolve();
      }

      function handleError() {
        cleanup();
        reject(new Error("Failed to load video frame"));
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolve();
        return;
      }

      video.addEventListener("loadeddata", handleLoadedData, { once: true });
      video.addEventListener("error", handleError, { once: true });

      try {
        if (video.paused) {
          void video.play().catch(() => {
            // Playback may be blocked; rely on loadeddata event instead
          });
        }
        if (video.readyState === HTMLMediaElement.HAVE_NOTHING) {
          video.load();
        }
      } catch (error) {
        console.warn("Video preparation failed:", error);
      }
    });
  }, []);

  const getGreetingFont = useCallback(
    (baseSize = 20) => {
      const minimumSize = 14;
      const adjustedSize = Math.max(
        minimumSize,
        Math.round(baseSize * (isMobile ? 0.8 : 1)),
      );
      return `bold ${adjustedSize}px Arial`;
    },
    [isMobile],
  );

  const selectedBackground = useMemo(
    () => BACKGROUNDS.find((b) => b.id === bg) ?? BACKGROUNDS[0],
    [bg],
  );

  // Load canvas-record only on desktop devices
  const loadCanvasRecord = async () => {
    // Double-check mobile detection to prevent CommandLineOnNonRooted error
    const userAgent =
      navigator.userAgent || navigator.vendor || (window as any).opera;
    const isChromeMobile = /Chrome/.test(userAgent) && /Mobile/.test(userAgent);
    const isAndroidChrome =
      /Android/.test(userAgent) && /Chrome/.test(userAgent);
    const isMobileDevice =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent,
      );
    const isActuallyMobile =
      isMobileDevice || isChromeMobile || isAndroidChrome;

    if (isActuallyMobile || canvasRecordLoaded) {
      console.log("📱 Skipping canvas-record load on mobile device");
      return;
    }

    try {
      console.log("🖥️ Loading canvas-record for desktop...");
      const canvasRecordModule = await import("canvas-record");
      Recorder = canvasRecordModule.Recorder;
      RecorderStatus = canvasRecordModule.RecorderStatus;
      Encoders = canvasRecordModule.Encoders;
      setCanvasRecordLoaded(true);
      console.log("✅ Canvas-record loaded successfully");
    } catch (error) {
      console.error("❌ Failed to load canvas-record:", error);
      setVideoGenerationError(
        "Failed to load video recording library. Using fallback method.",
      );
    }
  };

  // Authentication check and mobile detection
  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem("authToken");
      const userData = localStorage.getItem("userData");

      if (!authToken || !userData) {
        // No authentication found, redirect to home page
        navigate("/", { replace: true });
        return;
      }

      // Authentication found, allow access
      setAuthLoading(false);
    };

    // Detect mobile device with enhanced detection
    const detectMobile = () => {
      const userAgent =
        navigator.userAgent || navigator.vendor || (window as any).opera;

      // Enhanced mobile detection
      const isMobileDevice =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent,
        );

      // Additional checks for mobile Chrome
      const isChromeMobile =
        /Chrome/.test(userAgent) && /Mobile/.test(userAgent);
      const isAndroidChrome =
        /Android/.test(userAgent) && /Chrome/.test(userAgent);

      // Force mobile mode for Chrome mobile to avoid CommandLineOnNonRooted error
      const forceMobile = isChromeMobile || isAndroidChrome;

      const finalIsMobile = isMobileDevice || forceMobile;

      setIsMobile(finalIsMobile);
      console.log("📱 Mobile detection:", {
        isMobileDevice,
        isChromeMobile,
        isAndroidChrome,
        forceMobile,
        finalIsMobile,
        userAgent,
      });
    };

    // Global error handler to prevent crashes
    const handleGlobalError = (event: ErrorEvent) => {
      console.error("🚨 Global error caught:", event.error);
      setIsPageCrashed(true);
      setVideoGenerationError(
        "An unexpected error occurred. Please refresh the page and try again.",
      );

      // Cleanup resources
      if ((window as any).animationCleanup) {
        (window as any).animationCleanup();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("🚨 Unhandled promise rejection:", event.reason);
      setIsPageCrashed(true);
      setVideoGenerationError(
        "An unexpected error occurred. Please refresh the page and try again.",
      );
    };

    // Add global error listeners
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    checkAuth();
    detectMobile();

    // Cleanup error listeners
    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, [navigate]);

  // Load Cloudinary configuration with better error handling and diagnostics
  useEffect(() => {
    const loadCloudinaryConfig = async () => {
      try {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        let response: Response | null = null;

        // Try absolute origin first (handles some proxy edge-cases), then fallback to relative
        const tryUrls = [
          `${origin}/api/cloudinary-config`,
          `/api/cloudinary-config`,
        ];
        for (const url of tryUrls) {
          try {
            response = await fetch(url);
            if (response && response.ok) {
              break;
            }
          } catch (err) {
            console.warn(`Fetch to ${url} failed:`, err);
            response = null;
          }
        }

        if (!response) {
          throw new Error(
            "All fetch attempts failed for /api/cloudinary-config",
          );
        }

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(`Non-ok response: ${response.status} ${text}`);
        }

        const config = await response.json();
        setCloudinaryConfig(config);
        console.log("✅ Cloudinary config loaded:", config);
      } catch (error: any) {
        console.error("❌ Error loading Cloudinary config:", error);
        try {
          toast({
            title: "Cloudinary config unavailable",
            description:
              "Could not load Cloudinary configuration from the API. Some features (upload/share) may be limited.",
          });
        } catch (e) {
          // ignore toast errors
        }

        // Attempt to fetch diagnostics endpoint to surface environment info
        try {
          const diagResp = await fetch("/api/test-env");
          if (diagResp.ok) {
            const diag = await diagResp.json();
            console.info("API diagnostics:", diag);
            try {
              toast({
                title: "Diagnostics available",
                description: "Server diagnostics printed to console.",
              });
            } catch (e) {}
          }
        } catch (diagErr) {
          console.warn("Diagnostics fetch failed:", diagErr);
        }
      }
    };

    const loadCustomFont = async () => {
      try {
        if (!document.fonts.check('bold 28px "Nordique Pro"')) {
          const font = new FontFace('Nordique Pro', 'url(/fonts/leksen_design_-_nordiquepro-bold-webfont.woff2)');
          await font.load();
          document.fonts.add(font);
          console.log('✅ Custom font preloaded successfully');
        }
      } catch (error) {
        console.warn('⚠️ Failed to preload custom font:', error);
      }
    };

    loadCloudinaryConfig();
    loadCustomFont();
  }, []);

  // VIDEO FUNCTIONALITY COMMENTED OUT
  // Initialize Canvas Recorder
  // useEffect(() => {
  //   const initCanvasRecorder = async () => {
  //     try {
  //       console.log("🔄 Canvas recorder ready to initialize");
  //       // Canvas recorder will be initialized when needed
  //     } catch (error) {
  //       console.error("❌ Canvas recorder initialization failed:", error);
  //     }
  //   };

  //   initCanvasRecorder();
  // }, []);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userData");
    navigate("/", { replace: true });
  };


  useEffect(() => {
    return () => {
      clearProgressInterval();
      isGeneratingRef.current = false;
    };
  }, [clearProgressInterval]);

  // Cycle through generation steps while rotating
  useEffect(() => {
    console.log("🔄 Loader rotation useEffect triggered:", { isRotating, loading, manualLoaderControl: manualLoaderControlRef.current });
    
    if (!isRotating) {
      console.log("❌ Loader rotation skipped: isRotating is false");
      return;
    }
    
    // Temporarily disable manualLoaderControlRef check for debugging
    if (manualLoaderControlRef.current) {
      console.log("⚠️ Manual loader control is active, but continuing anyway for debugging");
    }

    let holdTimeout: ReturnType<typeof setTimeout>;
    let fadeTimeout: ReturnType<typeof setTimeout>;

    const cycle = () => {
      console.log("🔄 Starting loader cycle, current step:", generationStep);
      holdTimeout = setTimeout(() => {
        console.log("🔄 Starting fade out for step:", generationStep);
        setIsFading(true);
        fadeTimeout = setTimeout(() => {
          setGenerationStep((prev) => {
            const nextStep = (prev + 1) % GENERATION_STEPS.length;
            console.log("🔄 Moving to next step:", prev, "->", nextStep);
            return nextStep;
          });
          setIsFading(false);
          cycle();
        }, LOADER_STEP_FADE_MS);
      }, LOADER_STEP_HOLD_MS);
    };

    // Reset and start cycling
    console.log("🔄 Resetting and starting loader rotation");
    setGenerationStep(0);
    setIsFading(false);
    cycle();

    return () => {
      console.log("🔄 Cleaning up loader rotation timeouts");
      clearTimeout(holdTimeout);
      clearTimeout(fadeTimeout);
    };
  }, [isRotating, loading]); // Also depend on loading to ensure it starts when generation begins

  // Auto-start video recording when result is generated
  // VIDEO FUNCTIONALITY COMMENTED OUT
  // useEffect(() => {
  //   if (result && resultData && !recordedVideoUrl && !isRecording) {
  //     // Small delay to ensure the video is playing
  //     setTimeout(() => {
  //       startVideoRecording();
  //     }, 1000);
  //   }
  // }, [result, resultData, recordedVideoUrl, isRecording]);

  // Show footer only when scrolled to bottom
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Show footer when scrolled to within 100px of bottom
      setShowFooter(scrollTop + windowHeight >= documentHeight - 100);
    };

    window.addEventListener("scroll", handleScroll);
    // Check initial state
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // VIDEO FUNCTIONALITY COMMENTED OUT
  // Cleanup effect to prevent memory leaks
  // useEffect(() => {
  //   return () => {
  //     // Cleanup animation loop
  //     if ((window as any).animationCleanup) {
  //       (window as any).animationCleanup();
  //       delete (window as any).animationCleanup;
  //     }

  //     // Cleanup mobile animation loop
  //     if ((window as any).mobileAnimationCleanup) {
  //       (window as any).mobileAnimationCleanup();
  //       delete (window as any).mobileAnimationCleanup;
  //     }

  //     // Cleanup canvas recorder
  //     if (canvasRecorder) {
  //       try {
  //         canvasRecorder.stop();
  //       } catch (error) {
  //         console.warn("Error stopping canvas recorder on cleanup:", error);
  //       }
  //     }

  //     // Cleanup video URLs
  //     if (recordedVideoUrl) {
  //       URL.revokeObjectURL(recordedVideoUrl);
  //     }

  //     // Cleanup media recorder
  //     if (mediaRecorderRef.current) {
  //       try {
  //         mediaRecorderRef.current.stop();
  //       } catch (error) {
  //         console.warn("Error stopping media recorder on cleanup:", error);
  //       }
  //     }

  //     console.log("🧹 Component cleanup completed");
  //   };
  // }, [canvasRecorder, recordedVideoUrl]);

  // Memory monitoring to prevent crashes
  useEffect(() => {
    const checkMemoryUsage = () => {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        const usedMB = memory.usedJSHeapSize / (1024 * 1024);
        setMemoryUsage(usedMB);

        // Warn if memory usage is high
        if (usedMB > 100) {
          // 100MB threshold
          console.warn(
            "⚠️ High memory usage detected:",
            usedMB.toFixed(2),
            "MB",
          );
          setVideoGenerationError(
            "High memory usage detected. Consider refreshing the page.",
          );
        }

        // Force cleanup if memory usage is very high
        if (usedMB > 200) {
          // 200MB threshold
          console.error("🚨 Critical memory usage:", usedMB.toFixed(2), "MB");
          setIsPageCrashed(true);
          setVideoGenerationError(
            "Memory usage too high. Please refresh the page.",
          );
        }
      }
    };

    // Check memory every 5 seconds
    const memoryInterval = setInterval(checkMemoryUsage, 5000);

    // Initial check
    checkMemoryUsage();

    return () => clearInterval(memoryInterval);
  }, []);

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Optimize image using TinyPNG API
  const optimizeImageWithTinyPNG = async (file: File): Promise<File> => {
    try {
      setIsOptimizing(true);
      console.log("🔄 Optimizing image with TinyPNG...");
      console.log(
        "📊 Original file size:",
        (file.size / (1024 * 1024)).toFixed(2),
        "MB",
      );

      // Create FormData for TinyPNG API
      const formData = new FormData();
      formData.append("file", file);

      // Send file to server-side TinyPNG proxy
      const dataUrl = await toBase64(file);
      const proxyRes = await fetch("/api/optimize-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dataUrl }),
      });

      if (!proxyRes.ok) {
        const details = await proxyRes.text();
        throw new Error(
          `TinyPNG proxy failed: ${proxyRes.status} - ${details}`,
        );
      }

      const proxyJson = await proxyRes.json();
      const optimizedDataUrl = proxyJson.dataUrl as string;
      if (!optimizedDataUrl) throw new Error("TinyPNG proxy returned no data");

      // Create blob from returned data URL
      const base64 = optimizedDataUrl.split(",")[1];
      const mime = optimizedDataUrl.split(",")[0].split(":")[1].split(";")[0];
      const optimizedBlob = await (async () => {
        const b = atob(base64);
        const u8 = new Uint8Array(b.length);
        for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i);
        return new Blob([u8], { type: mime });
      })();
      const optimizedFile = new File([optimizedBlob], file.name, {
        type: file.type,
        lastModified: Date.now(),
      });

      const compressionRatio = (1 - optimizedFile.size / file.size) * 100;

      console.log(
        "📊 Optimized file size:",
        (optimizedFile.size / (1024 * 1024)).toFixed(2),
        "MB",
      );
      console.log("📈 Compression ratio:", compressionRatio.toFixed(1), "%");

      // Set optimization result for UI display
      setOptimizationResult({
        originalSize: file.size,
        optimizedSize: optimizedFile.size,
        compressionRatio: compressionRatio,
      });

      setIsOptimizing(false);
      return optimizedFile;
    } catch (error) {
      console.error("❌ TinyPNG optimization failed:", error);
      console.log("⚠️ Using original file without optimization");
      setIsOptimizing(false);
      setOptimizationResult(null);
      return file; // Return original file if optimization fails
    }
  };

  const handleFile = async (f?: File) => {
    if (!f) return;

    // Clear any previous error
    setUploadError(null);

    // Check file size (10MB limit - increased for optimization)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (f.size > maxSize) {
      setUploadError(
        `File size too large. Please upload an image smaller than 10MB. Current size: ${(f.size / (1024 * 1024)).toFixed(2)}MB`,
      );
      return;
    }

    // Check file type
    if (!f.type.startsWith("image/")) {
      setUploadError("Please upload a valid image file (PNG, JPG, JPEG, etc.)");
      return;
    }

    try {
      // Clear previous optimization result
      setOptimizationResult(null);

      // Optimize image with TinyPNG
      const optimizedFile = await optimizeImageWithTinyPNG(f);

      // Convert optimized file to base64
      const data = await toBase64(optimizedFile);
      setPhotoData(data);
      setUploadError(null); // Clear any previous error on successful upload

      console.log("✅ Image uploaded and optimized successfully");
    } catch (error) {
      console.error("❌ Image processing failed:", error);
      setUploadError("Failed to process the image. Please try again.");
    }
  };

  // Check browser video format support
  const checkVideoFormatSupport = () => {
    const formats = [
      { type: "video/mp4;codecs=h264", name: "MP4 (H.264)" },
      { type: "video/mp4", name: "MP4" },
      { type: "video/webm;codecs=vp9", name: "WebM (VP9)" },
      { type: "video/webm;codecs=vp8", name: "WebM (VP8)" },
    ];

    const supported = formats.filter((format) =>
      MediaRecorder.isTypeSupported(format.type),
    );
    console.log(
      "Supported video formats:",
      supported.map((f) => f.name),
    );

    // Check if MP4 is supported
    const mp4Supported = supported.some((f) => f.type.includes("mp4"));
    if (!mp4Supported) {
      console.warn(
        "MP4 not supported - videos may not be compatible with all social media platforms",
      );
    }

    return { supported, mp4Supported };
  };

  // Validate video compatibility with WhatsApp-specific checks
  const validateVideoCompatibility = (videoBlob: Blob): boolean => {
    const maxSize = 16 * 1024 * 1024; // 16MB limit for WhatsApp
    const maxDuration = 60; // 60 seconds limit for WhatsApp
    const minSize = 1000; // Minimum 1KB

    console.log("📱 Validating WhatsApp compatibility:", {
      size: videoBlob.size,
      sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
      maxSize: maxSize / (1024 * 1024),
      type: videoBlob.type,
    });

    // WhatsApp file size limit
    if (videoBlob.size > maxSize) {
      console.warn("❌ Video too large for WhatsApp:", videoBlob.size);
      return false;
    }

    // WhatsApp format requirement
    if (!videoBlob.type.includes("mp4")) {
      console.warn(
        "❌ Video format not supported by WhatsApp:",
        videoBlob.type,
      );
      return false;
    }

    // Check if video is too small (might be corrupted)
    if (videoBlob.size < minSize) {
      console.warn("❌ Video too small, might be corrupted:", videoBlob.size);
      return false;
    }

    // WhatsApp prefers smaller files for better sharing
    if (videoBlob.size > 8 * 1024 * 1024) {
      // 8MB warning
      console.warn(
        "⚠️ Video is large for WhatsApp sharing:",
        (videoBlob.size / (1024 * 1024)).toFixed(2),
        "MB",
      );
    }

    console.log("✅ Video is WhatsApp compatible");
    return true;
  };

  // Fallback video generation using MediaRecorder
  const generateFallbackVideo = async (): Promise<string | null> => {
    try {
      console.log("🔄 Generating fallback video using MediaRecorder...");

      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error("Canvas not found");
      }

      // Get the generated card container
      const cardContainer = document.querySelector(
        ".generated-card-container",
      ) as HTMLElement;
      if (!cardContainer) {
        throw new Error("Generated card container not found");
      }

      // Get the background image element
      const backgroundImage = cardContainer.querySelector(
        'video[src*="background"]',
      ) as HTMLVideoElement;
      if (!backgroundImage) {
        throw new Error("Background image not found");
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context not found");
      }

      // Get the container's dimensions
      const rect = cardContainer.getBoundingClientRect();
      const metrics = getVideoCanvasMetrics(rect);
      const { offsetX, offsetY, drawWidth, drawHeight } = metrics;

      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;

      // Create MediaRecorder with WhatsApp-compatible settings
      const stream = canvas.captureStream(15); // 15 FPS for WhatsApp compatibility
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline Profile
        videoBitsPerSecond: 200000, // 200kbps for WhatsApp compatibility
        audioBitsPerSecond: 32000, // 32kbps audio for WhatsApp
      });

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      return new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          const videoBlob = new Blob(chunks, { type: "video/mp4" });
          updateRecordedMimeType(videoBlob.type);
          const videoUrl = URL.createObjectURL(videoBlob);
          setRecordedVideoBlob(videoBlob);

          console.log("✅ Fallback video generated:", {
            size: videoBlob.size,
            type: videoBlob.type,
            sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
          });

          resolve(videoUrl);
        };

        // Start recording
        mediaRecorder.start();

        // Record for 3 seconds
        setTimeout(() => {
          mediaRecorder.stop();
        }, 3000);

        // Draw content during recording
        const drawFrame = () => {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw the background image
          if (
            backgroundImage.videoWidth > 0 &&
            backgroundImage.videoHeight > 0
          ) {
            ctx.drawImage(
              backgroundImage,
              offsetX,
              offsetY,
              drawWidth,
              drawHeight,
            );
          }

          // Draw the generated image
          const generatedImg = new Image();
          generatedImg.crossOrigin = "anonymous";
          generatedImg.src = result;
          ctx.drawImage(generatedImg, offsetX, offsetY, drawWidth, drawHeight);

          // Draw the photo frame
          const photoFrameImg = new Image();
          photoFrameImg.crossOrigin = "anonymous";
          photoFrameImg.src = "/photo-frame-story.png";
          ctx.drawImage(photoFrameImg, offsetX, offsetY, drawWidth, drawHeight);

          // Draw the greeting text
          if (greeting) {
            ctx.fillStyle = "#ffffff";
            ctx.font = getGreetingFont();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(greeting, VIDEO_WIDTH / 2, VIDEO_HEIGHT - 80);
          }
        };

        // Draw frames with mobile-optimized FPS
        const interval = setInterval(drawFrame, 1000 / (isMobile ? 12 : 15)); // Mobile-optimized FPS

        // Stop drawing after 3 seconds
        setTimeout(() => {
          clearInterval(interval);
        }, 3000);
      });
    } catch (error) {
      console.error("❌ Fallback video generation failed:", error);
      return null;
    }
  };

  // Optimize video for WhatsApp compatibility
  const optimizeVideoForWhatsApp = async (videoBlob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(videoBlob);
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        // Create a canvas for re-encoding
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(URL.createObjectURL(videoBlob));
          return;
        }

        canvas.width = VIDEO_WIDTH;
        canvas.height = VIDEO_HEIGHT;

        let drawWidth = VIDEO_WIDTH;
        let drawHeight = VIDEO_HEIGHT;
        let offsetX = 0;
        let offsetY = 0;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          const scale = Math.min(
            VIDEO_WIDTH / video.videoWidth,
            VIDEO_HEIGHT / video.videoHeight,
          );
          drawWidth = video.videoWidth * scale;
          drawHeight = video.videoHeight * scale;
          offsetX = (VIDEO_WIDTH - drawWidth) / 2;
          offsetY = (VIDEO_HEIGHT - drawHeight) / 2;
        }

        // Create MediaRecorder with strict sharing-friendly settings
        const stream = canvas.captureStream(15);
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/mp4; codecs="avc1.42E01E"',
          videoBitsPerSecond: 200000,
          audioBitsPerSecond: 32000,
        });

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const optimizedBlob = new Blob(chunks, { type: "video/mp4" });
          updateRecordedMimeType(optimizedBlob.type);
          const optimizedUrl = URL.createObjectURL(optimizedBlob);

          console.log("📱 Optimized video:", {
            originalSize: videoBlob.size,
            optimizedSize: optimizedBlob.size,
            sizeInMB: (optimizedBlob.size / (1024 * 1024)).toFixed(2),
            duration: video.duration,
            width: VIDEO_WIDTH,
            height: VIDEO_HEIGHT,
          });

          if (optimizedBlob.size > 16 * 1024 * 1024) {
            console.warn(
              "⚠�� Video too large after optimization, using original",
            );
            resolve(URL.createObjectURL(videoBlob));
          } else {
            resolve(optimizedUrl);
          }
        };

        // Start recording
        mediaRecorder.start();

        // Draw video frames to canvas and record at 15 FPS
        let frameCount = 0;
        const targetFPS = 15;
        const frameInterval = 1000 / targetFPS;
        let lastFrameTime = 0;

        const drawFrame = (currentTime: number) => {
          if (currentTime - lastFrameTime >= frameInterval) {
            ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
            ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);

            frameCount++;
            lastFrameTime = currentTime;
          }

          if (video.ended || video.paused) {
            mediaRecorder.stop();
            return;
          }

          requestAnimationFrame(drawFrame);
        };

        // Start drawing frames
        video.currentTime = 0;
        video.play();
        requestAnimationFrame(drawFrame);
      };

      video.onerror = () => {
        // Fallback to original video if optimization fails
        console.warn("Video optimization failed, using original");
        resolve(URL.createObjectURL(videoBlob));
      };
    });
  };

  // Generate video using canvas-record with proper API
  const generateVideoWithCanvasRecord = async (): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) {
          reject(new Error("Canvas not found"));
          return;
        }

        // Get the generated card container
        const cardContainer = document.querySelector(
          ".generated-card-container",
        ) as HTMLElement;
        if (!cardContainer) {
          reject(new Error("Generated card container not found"));
          return;
        }

        // Get the background image element
        const backgroundImage = cardContainer.querySelector(
          'img[src*="background"]',
        ) as HTMLImageElement;
        if (!backgroundImage) {
          reject(new Error("Background image not found"));
          return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not found"));
          return;
        }

        // Get the container's dimensions and compute 9:16 metrics
        const rect = cardContainer.getBoundingClientRect();
        const metrics = getVideoCanvasMetrics(rect);
        const { offsetX, offsetY, drawWidth, drawHeight } = metrics;

        canvas.width = VIDEO_WIDTH;
        canvas.height = VIDEO_HEIGHT;

        // Initialize Canvas Recorder with strict sharing-compatible settings
        const recorder = new Recorder(ctx, {
          extension: "mp4",
          target: "in-browser",
          encoderOptions: {
            encoderOptions: {
              // Strict WhatsApp compatibility settings
              profile: "baseline",
              level: "3.0",
              bitrate: 500000, // 500kbps (WhatsApp prefers smaller files)
              framerate: 24, // 24fps (WhatsApp standard)
              keyframeInterval: 24,
              pixelFormat: "yuv420p",
              preset: "ultrafast",
              crf: 28, // Higher compression for smaller file size
              // Additional WhatsApp-specific settings
              maxrate: 500000,
              bufsize: 1000000,
              g: 24, // GOP size
              sc_threshold: 0,
              // Ensure proper metadata for WhatsApp
              movflags: "+faststart",
              // Audio settings (even though we don't have audio)
              audioCodec: "aac",
              audioBitrate: 64000,
              audioChannels: 1,
              audioSampleRate: 22050,
            },
          },
          onStatusChange: (status) => {
            console.log("Recorder status:", status);
            setRecorderStatus(String(status));
          },
        });

        setCanvasRecorder(recorder);

        // Start recording
        await recorder.start({
          filename: `diwali-postcard-${Date.now()}.mp4`,
        });

        console.log("📸 Starting 10-second video recording...");

        // Record for 10 seconds at 24 FPS (WhatsApp standard)
        const duration = 10000; // 10 seconds in milliseconds
        const fps = 24; // WhatsApp standard frame rate
        const frameInterval = 1000 / fps; // ~41.67ms per frame
        const totalFrames = Math.floor(duration / frameInterval); // 240 frames

        console.log(
          `📹 Recording ${totalFrames} frames at ${fps} FPS for ${duration / 1000} seconds`,
        );

        // Pre-load images to avoid async issues
        const generatedImg = new Image();
        generatedImg.crossOrigin = "anonymous";
        generatedImg.src = result;

        const photoFrameImg = new Image();
        photoFrameImg.crossOrigin = "anonymous";
        photoFrameImg.src = "/photo-frame-story.png";

        // Wait for images to load
        await new Promise((resolve) => {
          let loadedCount = 0;
          const onLoad = () => {
            loadedCount++;
            if (loadedCount === 2) resolve(void 0);
          };
          generatedImg.onload = onLoad;
          photoFrameImg.onload = onLoad;
        });

        // Animation loop with precise timing
        let frameCount = 0;
        let lastFrameTime = 0;

        const animate = async (currentTime: number) => {
          // Check if we should record this frame
          if (currentTime - lastFrameTime >= frameInterval) {
            // Clear canvas
            ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);

            // Draw the background image
            if (
              backgroundImage.naturalWidth > 0 &&
              backgroundImage.naturalHeight > 0
            ) {
              ctx.drawImage(
                backgroundImage,
                offsetX,
                offsetY,
                drawWidth,
                drawHeight,
              );
            }

            // Draw the generated image
            ctx.drawImage(
              generatedImg,
              offsetX,
              offsetY,
              drawWidth,
              drawHeight,
            );

            // Draw the photo frame
            ctx.drawImage(
              photoFrameImg,
              offsetX,
              offsetY,
              drawWidth,
              drawHeight,
            );

            // Draw the greeting text
            if (greeting) {
              ctx.fillStyle = "#ffffff";
              ctx.font = getGreetingFont();
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(greeting, VIDEO_WIDTH / 2, VIDEO_HEIGHT - 80);
            }

            // Record this frame
            recorder.step();

            frameCount++;
            lastFrameTime = currentTime;

            const progress = Math.round((frameCount / totalFrames) * 100);
            console.log(
              `📸 Frame ${frameCount}/${totalFrames} recorded (${progress}%)`,
            );

            // Update UI with progress
            setRecorderStatus(`recording-${progress}`);
          }

          // Check if we've recorded enough frames
          if (frameCount >= totalFrames) {
            console.log("🎬 Recording complete, stopping...");
            // Stop recording
            const videoData = await recorder.stop();
            const videoBlob = new Blob([videoData as BlobPart], {
              type: "video/mp4",
            });
            updateRecordedMimeType(videoBlob.type);

            console.log("✅ Video recording completed:", {
              size: videoBlob.size,
              type: videoBlob.type,
              sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
              frameCount: frameCount,
              expectedFrames: totalFrames,
            });

            // Validate and optimize for WhatsApp
            const optimizedVideoUrl = await optimizeVideoForWhatsApp(videoBlob);
            resolve(optimizedVideoUrl);
            return;
          }

          // Continue animation
          requestAnimationFrame(animate);
        };

        // Start animation
        requestAnimationFrame(animate);

        // Fallback timeout to ensure we stop recording after exactly 10 seconds
        setTimeout(async () => {
          if (frameCount < totalFrames) {
            console.log("⏰ Timeout reached, stopping recording...");
            try {
              const videoData = await recorder.stop();
              const videoBlob = new Blob([videoData as BlobPart], {
                type: "video/mp4",
              });
              updateRecordedMimeType(videoBlob.type);

              console.log("✅ Video recording completed (timeout):", {
                size: videoBlob.size,
                type: videoBlob.type,
                sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
                frameCount: frameCount,
                expectedFrames: totalFrames,
              });

              const optimizedVideoUrl =
                await optimizeVideoForWhatsApp(videoBlob);
              resolve(optimizedVideoUrl);
            } catch (error) {
              console.error("Error in timeout recording:", error);
              reject(error);
            }
          }
        }, duration + 1000); // 1 second buffer
      } catch (error) {
        console.error("Error in canvas-record video generation:", error);
        reject(error);
      }
    });
  };

  // VIDEO FUNCTIONALITY COMMENTED OUT
  // Start manual recording
  // const startRecording = async () => {
  //   if (!result || !resultData) {
  //     console.error("Missing result data");
  //     return;
  //   }

  //   try {
  //     setVideoGenerationError(null);
  //     setImageDownloadError(null);
  //     setIsRecording(true);
  //     setRecordingProgress(0);
  //     console.log("🎬 Starting manual video recording...");

  //     // Track video generation start
  //     if (typeof window !== "undefined" && (window as any).fbq) {
  //       (window as any).fbq("track", "InitiateCheckout", {
  //         content_name: "Diwali Postcard Video",
  //         content_category: "Video Generation",
  //         value: 0,
  //         currency: "INR",
  //       });
  //     }

  //     // Track with Google Tag Manager
  //     if (typeof window !== "undefined" && (window as any).dataLayer) {
  //       (window as any).dataLayer.push({
  //         event: "video_generation_start",
  //         content_name: "Diwali Postcard Video",
  //         content_category: "Video Generation",
  //         value: 0,
  //         currency: "INR",
  //       });
  //     }

  //     // Initialize canvas recorder
  //     await initializeCanvasRecorder();
  //   } catch (error) {
  //     console.error("❌ Error starting video recording:", error);
  //     setIsRecording(false);
  //   }
  // };

  // Stop manual recording with proper cleanup
  const stopRecording = async () => {
    try {
      console.log("🛑 Stopping video recording...");

      // Check minimum recording duration (at least 2 seconds)
      const minDuration = 2000; // 2 seconds
      const currentDuration = recordingProgress * 1000;

      if (currentDuration < minDuration) {
        console.log(
          `⏳ Recording too short (${currentDuration}ms), waiting for minimum duration...`,
        );
        setTimeout(() => {
          stopRecording();
        }, minDuration - currentDuration);
        return;
      }

      setIsRecording(false);

      // Handle mobile MediaRecorder
      if (isMobile && mediaRecorderRef.current) {
        console.log("📱 Stopping mobile MediaRecorder...");
        mediaRecorderRef.current.stop();
        setRecordingProgress(0);
        return; // Mobile recorder handles the rest in onstop event
      }

      // Handle desktop canvas-record
      if (!canvasRecorder || !Recorder) {
        console.error("No recorder available or canvas-record not loaded");
        return;
      }

      // Stop recording using canvas-record API with timeout
      const videoData = (await Promise.race([
        canvasRecorder.stop(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Video recording timeout")), 10000),
        ),
      ])) as any;

      // Clean up recorder immediately
      setCanvasRecorder(null);
      setRecordingProgress(0);

      // canvas-record returns the video data directly
      let videoBlob: Blob;
      if (videoData instanceof Blob) {
        videoBlob = videoData;
      } else {
        // If it's not a Blob, create one
        videoBlob = new Blob([videoData as BlobPart], { type: "video/mp4" });
      }

      updateRecordedMimeType(videoBlob.type);

      // Validate video compatibility
      const isCompatible = validateVideoCompatibility(videoBlob);

      if (!isCompatible) {
        console.warn(
          "⚠️ Video may not be compatible, trying fallback method...",
        );
        setVideoGenerationError(
          "Primary video generation failed, trying fallback method...",
        );

        // Try fallback video generation
        const fallbackVideoUrl = await generateFallbackVideo();
        if (fallbackVideoUrl) {
          setRecordedVideoUrl(fallbackVideoUrl);
          setVideoGenerationError(null);
          console.log("✅ Fallback video generation successful");
          return;
        } else {
          setVideoGenerationError(
            "Video generation failed. Please try again or contact support.",
          );
          console.error("❌ Both primary and fallback video generation failed");
          return;
        }
      }

      // Create video URL
      const videoUrl = URL.createObjectURL(videoBlob);
      setRecordedVideoBlob(videoBlob);
      setRecordedVideoUrl(videoUrl);

      console.log("�� Video recording completed with canvas-record:", {
        size: videoBlob.size,
        type: videoBlob.type,
        sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
        compatible: isCompatible,
      });

      // Track successful video generation
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Purchase", {
          content_name: "Diwali Postcard Video",
          content_category: "Video Generation",
          value: 2,
          currency: "INR",
        });
      }

      // Track with Google Tag Manager
      if (typeof window !== "undefined" && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "video_generation_complete",
          content_name: "Diwali Postcard Video",
          content_category: "Video Generation",
          value: 2,
          currency: "INR",
        });
      }

      // Automatically upload to Cloudinary with error handling
      try {
        console.log("📤 Uploading video to Cloudinary...");
        const cloudinaryUrl = await uploadVideoToCloudinary(videoBlob);
        setCloudinaryVideoUrl(cloudinaryUrl);
        console.log(
          "✅ Video uploaded to Cloudinary successfully!",
          cloudinaryUrl,
        );
      } catch (error) {
        console.error("❌ Failed to upload video to Cloudinary:", error);
        // Don't fail the entire process if Cloudinary upload fails
      }
    } catch (error) {
      console.error("❌ Error stopping video recording:", error);
      setIsRecording(false);
      setCanvasRecorder(null);
      setRecordingProgress(0);
      setVideoGenerationError("Video recording failed. Please try again.");
    }
  };

  // Mobile-specific video recorder using MediaRecorder
  const initializeMobileVideoRecorder = async (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    backgroundImage: HTMLImageElement,
    rect: DOMRect,
    metrics: VideoCanvasMetrics,
  ) => {
    try {
      console.log("📱 Initializing mobile video recorder...");

      // Create a stream from the canvas
      const stream = canvas.captureStream(15); // 15 FPS

      const preferredMimeTypes = [
        'video/mp4; codecs="avc1.42E01E"',
        "video/mp4",
        'video/webm; codecs="vp9"',
        'video/webm; codecs="vp8"',
        "video/webm",
      ];

      const supportedMimeType = preferredMimeTypes.find((type) => {
        if (typeof MediaRecorder === "undefined") {
          return false;
        }
        try {
          return MediaRecorder.isTypeSupported(type);
        } catch (error) {
          console.warn("MediaRecorder.isTypeSupported failed for", type, error);
          return false;
        }
      });

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: 200000, // 200kbps for WhatsApp compatibility
        audioBitsPerSecond: 32000, // 32kbps audio for WhatsApp
      };

      if (supportedMimeType) {
        recorderOptions.mimeType = supportedMimeType;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);

      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("📱 Mobile video recording stopped");

        const effectiveMimeType =
          mediaRecorder.mimeType || recorderOptions.mimeType || "video/webm";

        const videoBlob = new Blob(chunks, { type: effectiveMimeType });

        if (videoBlob.size < 1000) {
          console.error("❌ Video too small, might be corrupted");
          setVideoGenerationError("Video recording failed. Please try again.");
          return;
        }

        updateRecordedMimeType(effectiveMimeType);

        const videoUrl = URL.createObjectURL(videoBlob);
        setRecordedVideoBlob(videoBlob);
        setRecordedVideoUrl(videoUrl);
        setRecordingProgress(0);

        console.log("✅ Mobile video recording completed:", {
          size: videoBlob.size,
          type: videoBlob.type,
          sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
        });

        try {
          console.log("📤 Uploading mobile video to Cloudinary...");
          const cloudinaryUrl = await uploadVideoToCloudinary(videoBlob);
          setCloudinaryVideoUrl(cloudinaryUrl);
          console.log(
            "�� Mobile video uploaded to Cloudinary successfully!",
            cloudinaryUrl,
          );
        } catch (error) {
          console.error(
            "❌ Failed to upload mobile video to Cloudinary:",
            error,
          );
        }
      };

      // Store media recorder reference
      mediaRecorderRef.current = mediaRecorder;

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);

      console.log("📱 Mobile video recording started");

      // Start the animation loop
      startMobileAnimationLoop(canvas, ctx, backgroundImage, rect, metrics);
    } catch (error) {
      console.error("❌ Mobile video recorder initialization failed:", error);
      setVideoGenerationError(
        "Mobile video recording failed. Please try again.",
      );
    }
  };

  // Mobile animation loop
  const startMobileAnimationLoop = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    backgroundImage: HTMLImageElement,
    rect: DOMRect,
    metrics: VideoCanvasMetrics,
  ) => {
    const whatsappSize = 1080; // WhatsApp video size
    const scale = metrics.scale;
    let animationId: number | null = null;
    let startTime = Date.now();
    let lastFrameTime = 0;
    let frameCount = 0;
    let isAnimating = true;
    const targetFPS = 15; // 15 FPS for WhatsApp compatibility
    const frameInterval = 1000 / targetFPS; // ~66.67ms per frame

    const { offsetX, offsetY, drawWidth, drawHeight } = metrics;

    // Pre-load images
    const generatedImg = new Image();
    generatedImg.crossOrigin = "anonymous";
    generatedImg.src = result;

    const photoFrameImg = new Image();
    photoFrameImg.crossOrigin = "anonymous";
    photoFrameImg.src = "/photo-frame-story.png";

    // Cleanup function
    const cleanup = () => {
      isAnimating = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      console.log("🧹 Mobile animation loop cleaned up");
    };

    // Store cleanup function
    (window as any).mobileAnimationCleanup = cleanup;

    // Wait for images to load
    Promise.all([
      new Promise((resolve) => {
        if (generatedImg.complete) {
          resolve(void 0);
        } else {
          generatedImg.onload = () => resolve(void 0);
        }
      }),
      new Promise((resolve) => {
        if (photoFrameImg.complete) {
          resolve(void 0);
        } else {
          photoFrameImg.onload = () => resolve(void 0);
        }
      }),
    ])
      .then(() => {
        console.log("📸 Mobile images loaded, starting animation loop");

        const animate = (currentTime: number) => {
          if (!isAnimating || !isRecording) {
            cleanup();
            return;
          }

          if (currentTime - lastFrameTime >= frameInterval) {
            try {
              // Clear canvas
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Calculate centered position
              const offsetX = (whatsappSize - rect.width * scale) / 2;
              const offsetY = (whatsappSize - rect.height * scale) / 2;

              // Draw background image
              if (
                backgroundImage.naturalWidth > 0 &&
                backgroundImage.naturalHeight > 0
              ) {
                ctx.drawImage(
                  backgroundImage,
                  offsetX,
                  offsetY,
                  rect.width * scale,
                  rect.height * scale,
                );
              }

              // Draw generated image
              ctx.drawImage(
                generatedImg,
                offsetX,
                offsetY,
                rect.width * scale,
                rect.height * scale,
              );

              // Draw photo frame
              ctx.drawImage(
                photoFrameImg,
                offsetX,
                offsetY,
                rect.width * scale,
                rect.height * scale,
              );

              // Draw greeting text
              if (greeting) {
                ctx.fillStyle = "#ffffff";
                ctx.font = getGreetingFont();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(greeting, whatsappSize / 2, whatsappSize - 80);
              }

              frameCount++;
              if (frameCount % 30 === 0) {
                console.log(`📸 Mobile frame ${frameCount} recorded`);
              }

              lastFrameTime = currentTime;
            } catch (error) {
              console.error("Error in mobile animation loop:", error);
              cleanup();
              return;
            }
          }

          // Update progress
          const elapsed = Date.now() - startTime;
          setRecordingProgress(Math.min(elapsed / 1000, 60));

          if (isRecording && isAnimating) {
            animationId = requestAnimationFrame(animate);
          } else {
            console.log(
              `🛑 Mobile animation stopped after ${frameCount} frames`,
            );
            cleanup();
          }
        };

        animationId = requestAnimationFrame(animate);
      })
      .catch((error) => {
        console.error("Error loading mobile images:", error);
        cleanup();
      });
  };

  // Initialize canvas recorder for manual recording with mobile fallback
  const initializeCanvasRecorder = async () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    // Get the generated card container
    const cardContainer = document.querySelector(
      ".generated-card-container",
    ) as HTMLElement;
    if (!cardContainer) {
      throw new Error("Generated card container not found");
    }

    // Get the background image element
    const backgroundImage = cardContainer.querySelector(
      'img[src*="background"]',
    ) as HTMLImageElement;
    if (!backgroundImage) {
      throw new Error("Background image not found");
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas context not found");
    }

    // Get the container's dimensions and optimize for WhatsApp
    const rect = cardContainer.getBoundingClientRect();

    // WhatsApp prefers square videos
    const whatsappSize = 512; // WhatsApp-friendly size
    const maxSize = Math.min(rect.width, rect.height);
    const scale = whatsappSize / maxSize;

    canvas.width = whatsappSize;
    canvas.height = whatsappSize;
    ctx.scale(scale, scale);

    // For mobile devices, use MediaRecorder fallback
    if (isMobile) {
      console.log("📱 Mobile detected, using MediaRecorder fallback");
      const metrics = getVideoCanvasMetrics(rect);
      await initializeMobileVideoRecorder(
        canvas,
        ctx,
        backgroundImage,
        rect,
        metrics,
      );
      return;
    }

    // Load canvas-record if not already loaded
    await loadCanvasRecord();

    if (!Recorder) {
      console.warn(
        "⚠️ Canvas-record not available, falling back to MediaRecorder",
      );
      const metrics = getVideoCanvasMetrics(rect);
      await initializeMobileVideoRecorder(
        canvas,
        ctx,
        backgroundImage,
        rect,
        metrics,
      );
      return;
    }

    try {
      // Initialize Canvas Recorder with desktop-optimized settings
      const recorder = new Recorder(ctx, {
        extension: "mp4",
        target: "in-browser",
        encoderOptions: {
          // WhatsApp-compatible settings
          width: whatsappSize,
          height: whatsappSize,
          fps: 15, // 15 FPS for WhatsApp
          bitrate: 200000, // 200kbps for WhatsApp
          // H.264 Baseline Profile for maximum WhatsApp compatibility
          profile: "baseline",
          level: "3.0",
          keyframeInterval: 15,
          pixelFormat: "yuv420p",
          preset: "ultrafast",
          crf: 28, // Higher compression for smaller file size
          maxrate: 200000,
          bufsize: 400000,
          g: 15, // GOP size
          sc_threshold: 0,
          movflags: "+faststart", // Fast start for streaming
          audioCodec: "aac",
          audioBitrate: 32000, // 32kbps for WhatsApp
          audioChannels: 1,
          audioSampleRate: 16000,
        },
        onStatusChange: (status) => {
          console.log("Recorder status:", status);
          setRecorderStatus(String(status));
        },
      });

      setCanvasRecorder(recorder);

      // Start recording using official API
      await recorder.start({
        filename: `diwali-postcard-${Date.now()}.mp4`,
        initOnly: false, // Start recording immediately
      });

      console.log("📸 Manual recording started - click stop when ready");

      // Start the animation loop for manual recording
      startManualAnimationLoop(
        canvas,
        ctx,
        backgroundImage,
        rect,
        scale,
        whatsappSize,
      );
    } catch (error) {
      console.error(
        "❌ Canvas recorder failed, falling back to MediaRecorder:",
        error,
      );
      const metrics = getVideoCanvasMetrics(rect);
      await initializeMobileVideoRecorder(
        canvas,
        ctx,
        backgroundImage,
        rect,
        metrics,
      );
    }
  };

  // Manual animation loop using canvas-record API with proper cleanup
  const startManualAnimationLoop = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    backgroundImage: HTMLImageElement,
    rect: DOMRect,
    scale: number,
    whatsappSize: number,
  ) => {
    const targetWidth = VIDEO_WIDTH;
    const targetHeight = VIDEO_HEIGHT;
    let animationId: number | null = null;
    let startTime = Date.now();
    let lastFrameTime = 0;
    let frameCount = 0;
    let isAnimating = true;
    const targetFPS = isMobile ? 12 : 15; // Mobile-optimized frame rate
    const frameInterval = 1000 / targetFPS; // ~83.33ms per frame for mobile, ~66.67ms for desktop

    // Pre-load images to avoid async issues
    const generatedImg = new Image();
    generatedImg.crossOrigin = "anonymous";
    generatedImg.src = result;

    const photoFrameImg = new Image();
    photoFrameImg.crossOrigin = "anonymous";
    photoFrameImg.src = "/photo-frame-story.png";

    // Cleanup function
    const cleanup = () => {
      isAnimating = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      console.log("🧹 Animation loop cleaned up");
    };

    // Store cleanup function for later use
    (window as any).animationCleanup = cleanup;

    // Wait for images to load before starting animation
    Promise.all([
      new Promise((resolve) => {
        if (generatedImg.complete) {
          resolve(void 0);
        } else {
          generatedImg.onload = () => resolve(void 0);
        }
      }),
      new Promise((resolve) => {
        if (photoFrameImg.complete) {
          resolve(void 0);
        } else {
          photoFrameImg.onload = () => resolve(void 0);
        }
      }),
    ])
      .then(() => {
        console.log("📸 Images loaded, starting animation loop");

        const animate = (currentTime: number) => {
          // Check if animation should continue
          if (!isAnimating || !isRecording) {
            cleanup();
            return;
          }

          // Check if we should record this frame
          if (currentTime - lastFrameTime >= frameInterval) {
            try {
              // Clear canvas
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Calculate centered position for 9:16 canvas
              const offsetX = (targetWidth - rect.width * scale) / 2;
              const offsetY = (targetHeight - rect.height * scale) / 2;

              // Draw the background image
              if (
                backgroundImage.naturalWidth > 0 &&
                backgroundImage.naturalHeight > 0
              ) {
                ctx.drawImage(
                  backgroundImage,
                  offsetX,
                  offsetY,
                  rect.width * scale,
                  rect.height * scale,
                );
              }

              // Draw the generated image
              ctx.drawImage(
                generatedImg,
                offsetX,
                offsetY,
                rect.width * scale,
                rect.height * scale,
              );

              // Draw the photo frame
              ctx.drawImage(
                photoFrameImg,
                offsetX,
                offsetY,
                rect.width * scale,
                rect.height * scale,
              );

              // Draw the greeting text
              if (greeting) {
                ctx.fillStyle = "#ffffff";
                ctx.font = getGreetingFont();
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(greeting, whatsappSize / 2, whatsappSize - 80);
              }

              // Record this frame using canvas-record API
              if (canvasRecorder && isAnimating) {
                try {
                  canvasRecorder.step();
                  frameCount++;
                  if (frameCount % 30 === 0) {
                    // Log every 30 frames to reduce spam
                    console.log(`���� Frame ${frameCount} recorded`);
                  }
                } catch (error) {
                  console.error("Error recording frame:", error);
                  cleanup();
                  return;
                }
              }

              lastFrameTime = currentTime;
            } catch (error) {
              console.error("Error in animation loop:", error);
              cleanup();
              return;
            }
          }

          // Update progress (show recording time)
          const elapsed = Date.now() - startTime;
          setRecordingProgress(Math.min(elapsed / 1000, 60)); // Max 60 seconds

          // Continue animation if still recording and animating
          if (isRecording && isAnimating) {
            animationId = requestAnimationFrame(animate);
          } else {
            console.log(`🛑 Animation stopped after ${frameCount} frames`);
            cleanup();
          }
        };

        // Start animation
        animationId = requestAnimationFrame(animate);
      })
      .catch((error) => {
        console.error("Error loading images for animation:", error);
        cleanup();
      });
  };

  // Legacy video recording functions (keeping for fallback)
  const startVideoRecording = async () => {
    if (!result || !resultData) return;

    try {
      setVideoGenerationError(null);
      setImageDownloadError(null);
      setIsRecording(true);
      recordedChunksRef.current = [];

      // Get the generated card container
      const cardContainer = document.querySelector(
        ".generated-card-container",
      ) as HTMLElement;
      if (!cardContainer) {
        console.error("Generated card container not found");
        setIsRecording(false);
        return;
      }

      // Get the background image element
      const backgroundImage = cardContainer.querySelector(
        'video[src*="background"]',
      ) as HTMLVideoElement;
      if (!backgroundImage) {
        console.error("Background image not found");
        setIsRecording(false);
        return;
      }

      // Create a canvas to capture the container
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Get the container's dimensions
      const rect = cardContainer.getBoundingClientRect();
      const scale = 2; // Higher resolution
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      ctx.scale(scale, scale);

      // Create a stream from the canvas
      const stream = canvas.captureStream(30); // 30 FPS

      // Check video format support and choose best option for social media
      const { supported, mp4Supported } = checkVideoFormatSupport();

      let mimeType = "video/mp4";

      // Prioritize MP4 for social media compatibility
      if (MediaRecorder.isTypeSupported("video/mp4;codecs=h264")) {
        mimeType = "video/mp4;codecs=h264";
        console.log("✅ Using MP4 with H.264 codec - Best for social media");
      } else if (MediaRecorder.isTypeSupported("video/mp4")) {
        mimeType = "video/mp4";
        console.log("✅ Using MP4 format - Good for social media");
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
        mimeType = "video/webm;codecs=vp9";
        console.log(
          "⚠️ MP4 not supported, using WebM VP9 - Limited social media compatibility",
        );
      } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        mimeType = "video/webm;codecs=vp8";
        console.log(
          "⚠️ MP4 not supported, using WebM VP8 - Limited social media compatibility",
        );
      } else {
        console.warn("❌ No supported video format found, using default");
      }

      updateRecordedMimeType(mimeType);

      // Show user warning if MP4 is not supported
      if (!mp4Supported) {
        console.warn(
          "MP4 recording not supported in this browser. For best social media compatibility, use Chrome or Edge.",
        );
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        updateRecordedMimeType(blob.type || mimeType);
        const url = URL.createObjectURL(blob);
        setRecordedVideoBlob(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);

        // Log the final format for debugging
        console.log(`�� Video recorded successfully as ${mimeType}`);
        if (mimeType.includes("mp4")) {
          console.log("🎉 MP4 format - Perfect for social media sharing!");
        } else {
          console.log(
            "⚠️ Non-MP4 format - May have limited social media compatibility",
          );
        }

        // Upload the recorded blob to Cloudinary (server-side) once
        try {
          console.log("📤 Uploading recorded video blob to Cloudinary...");
          const cloudinaryUrl = await uploadVideoToCloudinary(blob);
          setCloudinaryVideoUrl(cloudinaryUrl);
          console.log(
            "✅ Video uploaded to Cloudinary successfully!",
            cloudinaryUrl,
          );
        } catch (error) {
          console.error("❌ Failed to upload video to Cloudinary:", error);
        }
      };

      // Start recording
      mediaRecorder.start();

      // Pre-load both the generated image and photo frame
      const generatedImg = new Image();
      const photoFrameImg = new Image();
      generatedImg.crossOrigin = "anonymous";
      photoFrameImg.crossOrigin = "anonymous";

      let imagesLoaded = 0;
      const totalImages = 2;

      const checkAllImagesLoaded = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
          startRecording();
        }
      };

      const startRecording = () => {
        console.log(
          "Generated image loaded successfully:",
          generatedImg.width,
          "x",
          generatedImg.height,
        );
        // Record for 5 seconds
        const recordDuration = 5000;
        const startTime = Date.now();

        const drawFrame = () => {
          if (Date.now() - startTime >= recordDuration) {
            mediaRecorder.stop();
            return;
          }

          // Clear canvas
          ctx.clearRect(0, 0, canvas.width / scale, canvas.height / scale);

          // First, draw the background image
          if (
            backgroundImage.videoWidth > 0 &&
            backgroundImage.videoHeight > 0
          ) {
            console.log(
              "Drawing background video:",
              backgroundImage.videoWidth,
              "x",
              backgroundImage.videoHeight,
            );
            ctx.drawImage(backgroundImage, 0, 0, rect.width, rect.height);
          } else {
            console.log(
              "Background video not ready:",
              backgroundImage.videoWidth,
              "x",
              backgroundImage.videoHeight,
            );
          }

          // Calculate position to center the image in the frame
          const imgAspectRatio = generatedImg.width / generatedImg.height;
          const containerAspectRatio = rect.width / rect.height;

          let drawWidth, drawHeight, drawX, drawY;

          if (imgAspectRatio > containerAspectRatio) {
            // Image is wider than container
            drawWidth = rect.width * 0.8;
            drawHeight = drawWidth / imgAspectRatio;
            drawX = (rect.width - drawWidth) / 2;
            drawY = (rect.height - drawHeight) / 2;
          } else {
            // Image is taller than container
            drawHeight = rect.height * 0.8;
            drawWidth = drawHeight * imgAspectRatio;
            drawX = (rect.width - drawWidth) / 2;
            drawY = (rect.height - drawHeight) / 2;
          }

          // Draw the generated image
          console.log("Drawing image at:", drawX, drawY, drawWidth, drawHeight);
          ctx.drawImage(generatedImg, drawX, drawY, drawWidth, drawHeight);

          // Draw the photo frame on top
          if (photoFrameImg.complete) {
            console.log("Drawing photo frame");
            ctx.drawImage(photoFrameImg, 0, 0, rect.width, rect.height);
          }

          // Draw greeting text at the bottom
          if (greeting) {
            ctx.save();

            // Add a subtle background for better text readability
            ctx.fillStyle = "rgba(0, 0, 0, 0)";
            ctx.fillRect(0, rect.height - 50, rect.width, 50);

            const baseFontSize = isMobile ? 16 : 18;
            const lineSpacing = isMobile ? 22 : 28;

            ctx.fillStyle = "white";
            ctx.font = getGreetingFont(baseFontSize);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // Add text shadow for better visibility
            ctx.shadowColor = "rgba(0, 0, 0, 0)";
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;

            // Split greeting into lines if it's too long
            const words = greeting.split(" ");
            const lines = [];
            let currentLine = "";

            for (const word of words) {
              const testLine = currentLine + (currentLine ? " " : "") + word;
              const metrics = ctx.measureText(testLine);
              if (metrics.width > rect.width - 40) {
                if (currentLine) {
                  lines.push(currentLine);
                  currentLine = word;
                } else {
                  lines.push(word);
                }
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine) {
              lines.push(currentLine);
            }

            const baseY =
              rect.height - 30 - ((lines.length - 1) / 2) * lineSpacing;

            // Draw each line
            lines.forEach((line, index) => {
              ctx.fillText(line, rect.width / 2, baseY + index * lineSpacing);
            });

            ctx.restore();
          }

          // Continue recording
          requestAnimationFrame(drawFrame);
        };

        drawFrame();
      };

      generatedImg.onload = () => {
        console.log(
          "Generated image loaded successfully:",
          generatedImg.width,
          "x",
          generatedImg.height,
        );
        checkAllImagesLoaded();
      };

      photoFrameImg.onload = () => {
        console.log(
          "Photo frame loaded successfully:",
          photoFrameImg.width,
          "x",
          photoFrameImg.height,
        );
        checkAllImagesLoaded();
      };

      generatedImg.onerror = (error) => {
        console.error("Error loading generated image:", error);
        console.log("Image source:", result);
        setIsRecording(false);
      };

      photoFrameImg.onerror = (error) => {
        console.error("Error loading photo frame:", error);
        setIsRecording(false);
      };

      generatedImg.src = result;
      photoFrameImg.src = "/photo-frame-story.png";

      // Add timeout to prevent hanging
      setTimeout(() => {
        if (
          isRecording &&
          (!generatedImg.complete || !photoFrameImg.complete)
        ) {
          console.error("Image loading timeout");
          setIsRecording(false);
        }
      }, 10000); // 10 second timeout
    } catch (error) {
      console.error("Error starting video recording:", error);
      setIsRecording(false);
    }
  };

  const downloadPostcardImage = useCallback(async () => {
    if (!result) {
      setImageDownloadError("No generated postcard image available.");
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    try {
      setImageDownloadError(null);
      setImageDownloading(true);

      const cardContainer = document.querySelector(
        ".generated-card-container",
      ) as HTMLElement | null;

      if (!cardContainer) {
        throw new Error("Generated postcard is not available on the page.");
      }

      const rect = cardContainer.getBoundingClientRect();
      const canvas = document.createElement("canvas");
      canvas.width = VIDEO_WIDTH;
      canvas.height = VIDEO_HEIGHT;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to create drawing context.");
      }

      const metrics = getVideoCanvasMetrics(rect);
      const { offsetX, offsetY, drawWidth, drawHeight, scale } = metrics;

      const mapRectToCanvas = (elementRect: DOMRect) => {
        const relativeX = elementRect.left - rect.left;
        const relativeY = elementRect.top - rect.top;
        return {
          x: offsetX + relativeX * scale,
          y: offsetY + relativeY * scale,
          width: elementRect.width * scale,
          height: elementRect.height * scale,
        };
      };

      const backgroundImage = cardContainer.querySelector(
        'video[src*="background"]',
      ) as HTMLVideoElement | null;
      const frameElement = cardContainer.querySelector(
        'img[alt="photo frame"]',
      ) as HTMLImageElement | null;
      const overlayElement = cardContainer.querySelector(
        "[data-generated-image]",
      ) as HTMLImageElement | null;
      const greetingElement = cardContainer.querySelector(
        "[data-generated-greeting]",
      ) as HTMLElement | null;

      let greetingRenderData: {
        lines: string[];
        font: string;
        fillStyle: string;
        textAlign: CanvasTextAlign;
        textBaseline: CanvasTextBaseline;
        textX: number;
        startY: number;
        lineHeight: number;
        shadowColor: string;
        shadowBlur: number;
        shadowOffsetX: number;
        shadowOffsetY: number;
      } | null = null;

      // Set transparent background instead of dark gray
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let backgroundDrawn = false;

      ctx.save();
      ctx.beginPath();
      ctx.rect(offsetX, offsetY, drawWidth, drawHeight);
      ctx.clip();

      if (backgroundImage) {
        try {
          if (
            backgroundImage.videoWidth > 0 &&
            backgroundImage.videoHeight > 0
          ) {
            const imageRect = backgroundImage.getBoundingClientRect();
            const { x, y, width, height } = mapRectToCanvas(imageRect);
            ctx.drawImage(backgroundImage, x, y, width, height);
            backgroundDrawn = true;
          }
        } catch (error) {
          console.warn("⚠️ Unable to capture background frame:", error);
        }
      }

      if (!backgroundDrawn) {
        // Don't draw a fallback background - keep it transparent
        // This prevents unwanted colored backgrounds in downloaded images

        if (selectedBackground?.fallback) {
          ctx.save();
          const emojiFontSize = Math.max(48, Math.round(drawWidth * 0.35));
          ctx.font = `${emojiFontSize}px Arial`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fillText(
            selectedBackground.fallback,
            offsetX + drawWidth / 2,
            offsetY + drawHeight / 2,
          );
          ctx.restore();
        }
      }

      const [generatedImg, frameImg] = await Promise.all([
        loadHtmlImage(result),
        loadHtmlImage("/photo-frame-story.png"),
      ]);

      if (overlayElement) {
        const overlayRect = overlayElement.getBoundingClientRect();
        const { x, y, width, height } = mapRectToCanvas(overlayRect);
        const naturalWidth =
          generatedImg.naturalWidth || generatedImg.width || width;
        const naturalHeight =
          generatedImg.naturalHeight || generatedImg.height || height;

        let targetWidth = width;
        let targetHeight = height;
        let drawX = x;
        let drawY = y;

        if (naturalWidth > 0 && naturalHeight > 0) {
          const sourceAspect = naturalWidth / naturalHeight;
          const destAspect = width / height;

          if (destAspect > sourceAspect) {
            targetHeight = height;
            targetWidth = targetHeight * sourceAspect;
            drawX += (width - targetWidth) / 2;
          } else {
            targetWidth = width;
            targetHeight = targetWidth / sourceAspect;
            drawY += (height - targetHeight) / 2;
          }
        }

        ctx.drawImage(generatedImg, drawX, drawY, targetWidth, targetHeight);
      } else {
        ctx.drawImage(generatedImg, offsetX, offsetY, drawWidth, drawHeight);
      }

      const trimmedGreeting = greeting.trim();

      if (trimmedGreeting && greetingElement && typeof window !== "undefined") {
        const greetingRect = greetingElement.getBoundingClientRect();
        const { x, y, width, height } = mapRectToCanvas(greetingRect);
        const style = window.getComputedStyle(greetingElement);

        const fontSize = parseFloat(style.fontSize) || 20;
        const fontFamily = style.fontFamily || "Arial";
        const fontWeight = style.fontWeight || "bold";
        const lineHeightValue = parseFloat(style.lineHeight);
        const lineHeightRatio =
          Number.isFinite(lineHeightValue) && lineHeightValue > 0
            ? lineHeightValue / fontSize
            : 1.2;

        const scaledFontSize = fontSize * scale;
        const scaledLineHeight = scaledFontSize * lineHeightRatio;
        const font = `${fontWeight} ${scaledFontSize}px ${fontFamily}`;
        const availableWidth = width > 0 ? width : drawWidth - 80;

        ctx.save();
        ctx.font = font;

        const words = trimmedGreeting.split(/\s+/);
        const lines: string[] = [];
        let currentLine = "";

        words.forEach((word) => {
          const candidate = currentLine ? `${currentLine} ${word}` : word;
          if (
            ctx.measureText(candidate).width > availableWidth &&
            currentLine
          ) {
            lines.push(currentLine);
            currentLine = word;
          } else if (ctx.measureText(candidate).width > availableWidth) {
            lines.push(candidate);
            currentLine = "";
          } else {
            currentLine = candidate;
          }
        });

        if (currentLine) {
          lines.push(currentLine);
        }

        ctx.restore();

        if (lines.length === 0) {
          lines.push(trimmedGreeting);
        }

        const totalHeight = lines.length * scaledLineHeight;
        const fallbackStartY =
          offsetY +
          drawHeight -
          80 -
          ((lines.length - 1) * scaledLineHeight) / 2;
        const startY =
          height > 0
            ? y + height / 2 - (totalHeight - scaledLineHeight) / 2
            : fallbackStartY;
        const textX = width > 0 ? x + width / 2 : offsetX + drawWidth / 2;

        greetingRenderData = {
          lines,
          font,
          fillStyle: style.color || "#ffffff",
          textAlign: "center",
          textBaseline: "middle",
          textX,
          startY,
          lineHeight: scaledLineHeight,
          shadowColor: "rgba(0, 0, 0, 0.35)",
          shadowBlur: 8 * scale,
          shadowOffsetX: 2 * scale,
          shadowOffsetY: 2 * scale,
        };
      } else if (trimmedGreeting) {
        const font = getGreetingFont();

        ctx.save();
        ctx.font = font;

        const maxWidth = drawWidth - 80;
        const lineHeight = 28;
        const words = trimmedGreeting.split(/\s+/);
        const lines: string[] = [];
        let currentLine = "";

        words.forEach((word) => {
          const candidate = currentLine ? `${currentLine} ${word}` : word;
          const exceeds = ctx.measureText(candidate).width > maxWidth;
          if (exceeds && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else if (exceeds) {
            lines.push(candidate);
            currentLine = "";
          } else {
            currentLine = candidate;
          }
        });

        if (currentLine) {
          lines.push(currentLine);
        }

        ctx.restore();

        if (lines.length === 0) {
          lines.push(trimmedGreeting);
        }

        const baseY =
          offsetY + drawHeight - 80 - ((lines.length - 1) * lineHeight) / 2;

        greetingRenderData = {
          lines,
          font,
          fillStyle: "#ffffff",
          textAlign: "center",
          textBaseline: "middle",
          textX: VIDEO_WIDTH / 2,
          startY: baseY,
          lineHeight,
          shadowColor: "rgba(0, 0, 0, 0.35)",
          shadowBlur: 8,
          shadowOffsetX: 2,
          shadowOffsetY: 2,
        };
      }

      ctx.restore();

      if (frameElement) {
        const frameRect = frameElement.getBoundingClientRect();
        const { x, y, width, height } = mapRectToCanvas(frameRect);
        ctx.drawImage(frameImg, x, y, width, height);
      } else {
        ctx.drawImage(frameImg, offsetX, offsetY, drawWidth, drawHeight);
      }

      if (greetingRenderData) {
        const {
          lines,
          font,
          fillStyle,
          textAlign,
          textBaseline,
          textX,
          startY,
          lineHeight,
          shadowColor,
          shadowBlur,
          shadowOffsetX,
          shadowOffsetY,
        } = greetingRenderData;

        ctx.save();
        ctx.beginPath();
        ctx.rect(offsetX, offsetY, drawWidth, drawHeight);
        ctx.clip();

        ctx.fillStyle = fillStyle;
        ctx.font = font;
        ctx.textAlign = textAlign;
        ctx.textBaseline = textBaseline;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOffsetX;
        ctx.shadowOffsetY = shadowOffsetY;

        lines.forEach((line, index) => {
          ctx.fillText(line, textX, startY + index * lineHeight);
        });

        ctx.restore();
      }

      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Failed to create image blob."));
            return;
          }

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `diwali-postcard-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setTimeout(() => URL.revokeObjectURL(url), 500);
          resolve();
        }, "image/png");
      });

      try {
        toast({
          title: "Postcard image downloaded",
          description: "Your festive postcard image is saved to your device.",
        });
      } catch (toastError) {
        console.warn("Toast invocation failed:", toastError);
      }
    } catch (error) {
      console.error("Failed to download postcard image:", error);
      setImageDownloadError(
        error instanceof Error
          ? error.message
          : "Failed to download postcard image.",
      );
      try {
        toast({
          title: "Download failed",
          description:
            "Unable to prepare the postcard image. Please try again.",
        });
      } catch (toastError) {
        console.warn("Toast invocation failed:", toastError);
      }
    } finally {
      setImageDownloading(false);
    }
  }, [
    getGreetingFont,
    greeting,
    loadHtmlImage,
    result,
    selectedBackground,
    waitForVideoFrame,
  ]);

  const uploadVideoToCloudinary = async (videoUrl: string | Blob) => {
    try {
      setVideoUploading(true);

      // Get Blob
      let videoBlob: Blob | null = null;
      if (typeof videoUrl === "string") {
        try {
          const response = await fetch(videoUrl);
          if (!response.ok)
            throw new Error(`Failed to fetch video: ${response.status}`);
          videoBlob = await response.blob();
        } catch (fetchErr) {
          console.warn(
            "⚠️ fetch(videoUrl) failed in uploadVideoToCloudinary, will try recordedChunksRef:",
            fetchErr,
          );
          if (
            recordedChunksRef.current &&
            recordedChunksRef.current.length > 0
          ) {
            videoBlob = new Blob(recordedChunksRef.current, {
              type: recordedMimeTypeRef.current || "video/mp4",
            });
          }
        }
      } else {
        videoBlob = videoUrl;
      }

      if (!videoBlob) throw new Error("Unable to obtain video blob for upload");

      updateRecordedMimeType(videoBlob.type || recordedMimeTypeRef.current);

      console.log("🔧 Video details:", {
        videoSize: videoBlob.size,
        videoType: videoBlob.type,
        sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
      });

      type CloudinarySignatureResponse = {
        cloudName: string;
        apiKey: string;
        timestamp: number;
        signature: string;
        folder?: string | null;
        publicId?: string | null;
        resourceType?: string | null;
        eager?: string | null;
        transformation?: string | null;
      };

      const requestSignedUploadParams =
        async (): Promise<CloudinarySignatureResponse> => {
          const response = await fetch("/api/cloudinary-signature", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              resourceType: "video",
              folder: "diwali-postcards/videos",
            }),
          });
          if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(
              `Failed to retrieve Cloudinary signature: ${response.status} - ${text}`,
            );
          }
          return (await response.json()) as CloudinarySignatureResponse;
        };

      const buildOptimizedVideoUrlFromUpload = (
        uploadData: any,
        cloudName: string,
      ) => {
        const secure = uploadData?.secure_url || uploadData?.url;
        const publicId: string = uploadData?.public_id || "";
        if (!publicId) {
          return secure;
        }
        const segments = publicId.split("/");
        const fileName = segments.pop();
        if (!fileName) {
          return secure;
        }
        const folderSegment =
          segments.length > 0 ? `${segments.join("/")}/` : "";
        const versionSegment = uploadData?.version
          ? `/v${uploadData.version}`
          : "";
        return `https://res.cloudinary.com/${cloudName}/video/upload/f_mp4,q_auto:best${versionSegment}/${folderSegment}${fileName}.mp4`;
      };

      const trySignedDirectUpload = async (): Promise<string> => {
        const signaturePayload = await requestSignedUploadParams();
        if (!signaturePayload?.cloudName || !signaturePayload?.apiKey) {
          throw new Error("Cloudinary signature response incomplete");
        }

        const signedExtension =
          getFileExtensionFromMime(
            (videoBlob as Blob).type || recordedMimeTypeRef.current,
          ) || "mp4";

        const fd = new FormData();
        fd.append(
          "file",
          videoBlob as Blob,
          `festive-postcard-${Date.now()}.${signedExtension}`,
        );
        fd.append("api_key", signaturePayload.apiKey);
        fd.append("timestamp", String(signaturePayload.timestamp));
        fd.append("signature", signaturePayload.signature);
        if (signaturePayload.folder) {
          fd.append("folder", signaturePayload.folder);
        }
        if (signaturePayload.publicId) {
          fd.append("public_id", signaturePayload.publicId);
        }
        if (signaturePayload.eager) {
          fd.append("eager", signaturePayload.eager);
        }
        if (signaturePayload.transformation) {
          fd.append("transformation", signaturePayload.transformation);
        }

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${signaturePayload.cloudName}/video/upload`,
          { method: "POST", body: fd },
        );
        if (!uploadRes.ok) {
          const txt = await uploadRes.text().catch(() => "");
          throw new Error(
            `Signed direct upload failed: ${uploadRes.status} - ${txt}`,
          );
        }
        const uploadJson = await uploadRes.json();
        const optimizedUrl = buildOptimizedVideoUrlFromUpload(
          uploadJson,
          signaturePayload.cloudName,
        );
        const finalUrl =
          optimizedUrl || uploadJson.secure_url || uploadJson.url;
        if (!finalUrl) {
          throw new Error("Signed direct upload returned no URL");
        }
        console.log(
          "✅ Video uploaded to Cloudinary (direct signed):",
          finalUrl,
        );
        setCloudinaryVideoUrl(finalUrl);
        updateRecordedMimeType("video/mp4");
        return finalUrl;
      };

      // First try server-side signed upload (preferred)
      try {
        const arrayBuffer = await videoBlob.arrayBuffer();
        console.log("📤 Uploading raw binary to server-side signed upload...");
        const filenameExtension = getFileExtensionFromMime(
          videoBlob.type || recordedMimeTypeRef.current,
        );
        const uploadResponse = await fetch("/api/upload-video", {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "x-filename": `festive-postcard-${Date.now()}.${filenameExtension}`,
          },
          body: arrayBuffer,
        });
        console.log("📡 Upload response status:", uploadResponse.status);
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => "");
          console.warn(
            "❌ Server upload failed, switching to direct Cloudinary upload:",
            errorText,
          );
          const directUrl = await trySignedDirectUpload();
          return directUrl;
        }
        const data = await uploadResponse.json();
        const url = data.secure_url || data.originalUrl || data.secureUrl;
        console.log("✅ Video uploaded to Cloudinary (server):", url);
        setCloudinaryVideoUrl(url);
        updateRecordedMimeType("video/mp4");
        return url;
      } catch (serverErr) {
        console.warn(
          "⚠️ Server upload error, switching to direct Cloudinary upload:",
          serverErr,
        );
        const directUrl = await trySignedDirectUpload();
        return directUrl;
      }
    } catch (error) {
      console.error("❌ Error uploading video to Cloudinary:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      throw error;
    } finally {
      setVideoUploading(false);
    }
  };

  const generateClientSidePostcard = async (data: any) => {
    try {
      // Create a canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const { width = 720, height = 1280, personImageUrl, dishImageUrl, greeting } = data;
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      // Load custom font only if not already loaded
      if (!document.fonts.check('bold 28px "Nordique Pro"')) {
        try {
          const font = new FontFace('Nordique Pro', 'url(/fonts/leksen_design_-_nordiquepro-bold-webfont.woff2)');
          await font.load();
          document.fonts.add(font);
          console.log('✅ Custom font loaded successfully');
        } catch (error) {
          console.warn('⚠️ Failed to load custom font, using fallback:', error);
        }
      }

      // Load images with CORS handling
    const personImage = new Image();
    const dishImage = new Image();
    
    // Set crossOrigin to anonymous to avoid CORS issues
    personImage.crossOrigin = 'anonymous';
    dishImage.crossOrigin = 'anonymous';
    
    // Helper function to convert image URL to data URL to avoid CORS issues
    const imageUrlToDataUrl = async (url: string): Promise<string> => {
      try {
        const response = await fetch(url, { mode: 'cors' });
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.warn('Failed to convert image to data URL, using original URL:', error);
        return url; // Fallback to original URL
      }
    };
    
    // Convert images to data URLs to avoid CORS issues
    const personDataUrl = await imageUrlToDataUrl(personImageUrl);
    const dishDataUrl = await imageUrlToDataUrl(dishImageUrl);
    
    await Promise.all([
      new Promise((resolve, reject) => {
        personImage.onload = resolve;
        personImage.onerror = reject;
        personImage.src = personDataUrl;
      }),
      new Promise((resolve, reject) => {
        dishImage.onload = resolve;
        dishImage.onerror = reject;
        dishImage.src = dishDataUrl;
      })
    ]);

      // Calculate positions and sizes
      const framePadding = 40;
      const frameWidth = width - (framePadding * 2);
      const frameHeight = height - (framePadding * 2);

      // Person image dimensions (centered in frame)
      const personAspectRatio = personImage.width / personImage.height;
      const personMaxWidth = frameWidth * 0.6;
      const personMaxHeight = frameHeight * 0.7;
      
      let personWidth = personMaxWidth;
      let personHeight = personMaxWidth / personAspectRatio;
      
      if (personHeight > personMaxHeight) {
        personHeight = personMaxHeight;
        personWidth = personMaxHeight * personAspectRatio;
      }

      const personX = (width - personWidth) / 2;
      // Position person image 44% from top (4% further down)
      const personY = height * 0.44 + (height * 0.3 - personHeight) / 2;

      // Dish image dimensions (smaller, positioned below person)
      const dishAspectRatio = dishImage.width / dishImage.height;
      const dishMaxWidth = frameWidth * 0.3;
      const dishMaxHeight = frameHeight * 0.2;
      
      let dishWidth = dishMaxWidth;
      let dishHeight = dishMaxWidth / dishAspectRatio;
      
      if (dishHeight > dishMaxHeight) {
        dishHeight = dishMaxHeight;
        dishWidth = dishMaxHeight * dishAspectRatio;
      }

      const dishX = (width - dishWidth) / 2;
      const dishY = personY + personHeight - 100;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);

      // Draw decorative border
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 8;
      ctx.strokeRect(framePadding, framePadding, frameWidth, frameHeight);

      // Draw inner border
      ctx.strokeStyle = '#ffa500';
      ctx.lineWidth = 4;
      ctx.strokeRect(framePadding + 10, framePadding + 10, frameWidth - 20, frameHeight - 20);

      // Draw person image
      ctx.drawImage(personImage, personX, personY, personWidth, personHeight);

      // Draw dish image
      ctx.drawImage(dishImage, dishX, dishY, dishWidth, dishHeight);

      // Draw greeting text with multi-line support and custom font
      if (greeting) {
        ctx.fillStyle = '#ffffff';
        // Use custom font with fallbacks
        const fontFamily = document.fonts.check('bold 28px "Nordique Pro"') 
          ? 'Nordique Pro' 
          : 'Arial, sans-serif';
        ctx.font = `bold 28px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        // Multi-line text support
        const maxWidth = width - 100; // Leave margin on sides
        const lineHeight = 35; // Line spacing
        const words = greeting.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        // Word wrapping logic
        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          lines.push(currentLine);
        }
        
        // Draw each line - positioned to work with person image at 40% from top
        const startY = height - 50 - (lines.length - 1) * lineHeight / 2;
        lines.forEach((line, index) => {
          ctx.fillText(line, width / 2, startY + index * lineHeight);
        });
      }

      // Convert canvas to blob and download with error handling
      try {
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `diwali-postcard-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast({
              title: "Postcard downloaded!",
              description: "Your festive postcard has been saved to your device.",
            });
          } else {
            throw new Error('Failed to create blob from canvas');
          }
        }, 'image/png');
      } catch (error) {
        console.error('Canvas export error:', error);
        throw new Error('Failed to export canvas. This might be due to CORS restrictions.');
      }
      
    } catch (error) {
      console.error('Error generating client-side postcard:', error);
      throw error;
    }
  };

  const downloadVideo = async () => {
    if (!result || !resultData || !selectedDish || !selectedBackground) {
      toast({
        title: "No postcard available",
        description: "Please generate a postcard first before downloading the video.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Show loading state
      toast({
        title: "Generating postcard...",
        description: "Creating your festive postcard, this may take a moment.",
      });

      // Prepare request data
      const requestData = {
        personImageUrl: resultData.image_url, // Use image_url from the API response
        dishImageUrl: selectedDish.image,
        backgroundVideoUrl: selectedBackground.video,
        greeting: greeting || "Happy Diwali!",
        width: 720,
        height: 1280,
        duration: 5
      };

      console.log('📤 Sending request data:', requestData);
      console.log('📤 resultData:', resultData);
      console.log('📤 selectedDish:', selectedDish);
      console.log('📤 selectedBackground:', selectedBackground);

      // Validate required fields
      if (!requestData.personImageUrl) {
        throw new Error('Person image URL is missing');
      }
      if (!requestData.dishImageUrl) {
        throw new Error('Dish image URL is missing');
      }
      if (!requestData.backgroundVideoUrl) {
        throw new Error('Background video URL is missing');
      }

      // Call the server API to generate video
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        let errorMessage = 'Video generation failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (jsonError) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Get the response data
      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.message || 'Server returned error');
      }

      // Generate the postcard video client-side
      await generateClientSideVideo(responseData.data);

    } catch (error) {
      console.error("Error generating/downloading video:", error);
      toast({
        title: "Postcard generation failed",
        description: error instanceof Error ? error.message : "There was an error generating your postcard. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Generate client-side video using HTML5 Canvas and MediaRecorder
  const generateClientSideVideo = async (data: any) => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const { width = 720, height = 1280, personImageUrl, dishImageUrl, backgroundVideoUrl, greeting } = data;
        
        console.log('🎬 Starting video generation...');
        console.log('Person image:', personImageUrl);
        console.log('Dish image:', dishImageUrl);
        console.log('Background video:', backgroundVideoUrl);
        
        // Create video element for background
        const backgroundVideo = document.createElement('video');
        backgroundVideo.src = backgroundVideoUrl;
        backgroundVideo.muted = true;
        backgroundVideo.loop = true;
        backgroundVideo.crossOrigin = 'anonymous';
        backgroundVideo.playsInline = true;
        backgroundVideo.preload = 'auto';
        
        // Create canvas for video recording
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Load images
        const personImage = new Image();
        const frameImage = new Image();
        
        personImage.crossOrigin = 'anonymous';
        frameImage.crossOrigin = 'anonymous';
        
        // Load custom font only if not already loaded
        if (!document.fonts.check('bold 28px "Nordique Pro"')) {
          try {
            const font = new FontFace('Nordique Pro', 'url(/fonts/leksen_design_-_nordiquepro-bold-webfont.woff2)');
            await font.load();
            document.fonts.add(font);
            console.log('✅ Custom font loaded successfully');
          } catch (error) {
            console.warn('⚠️ Failed to load custom font, using fallback:', error);
          }
        }
        
        // Helper function to convert image URL to data URL to avoid CORS issues
        const imageUrlToDataUrl = async (url: string): Promise<string> => {
          try {
            const response = await fetch(url, { mode: 'cors' });
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.warn('Failed to convert image to data URL, using original URL:', error);
            return url;
          }
        };
        
        // Convert person image to data URL to avoid CORS issues
        const personDataUrl = await imageUrlToDataUrl(personImageUrl);
        
        await Promise.all([
          new Promise((resolve, reject) => {
            personImage.onload = resolve;
            personImage.onerror = reject;
            personImage.src = personDataUrl;
          }),
          new Promise((resolve, reject) => {
            frameImage.onload = resolve;
            frameImage.onerror = reject;
            frameImage.src = '/photo-frame-story.png';
          })
        ]);

        // Wait for background video to be ready and start playing
        await new Promise<void>((resolve, reject) => {
          backgroundVideo.onloadeddata = () => {
            console.log('🎬 Background video loaded, starting playback...');
            backgroundVideo.play().then(() => {
              console.log('🎬 Background video playing');
              resolve();
            }).catch(reject);
          };
          backgroundVideo.onerror = (error) => {
            console.error('🎬 Background video error:', error);
            reject(error);
          };
          backgroundVideo.load();
        });

        // Set up MediaRecorder
        const stream = canvas.captureStream(30); // 30 FPS
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9'
        });
        
        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `diwali-postcard-${Date.now()}.webm`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          // Cleanup video element to prevent memory leaks
          backgroundVideo.pause();
          backgroundVideo.src = '';
          backgroundVideo.load();
          
          toast({
            title: "Video downloaded!",
            description: "Your festive postcard video has been saved to your device.",
          });
          
          resolve();
        };

        // Start recording
        mediaRecorder.start();
        
        // Small delay to ensure video is playing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Animation loop - reduced duration to prevent memory issues
        const duration = 3000; // 3 seconds (reduced from 5)
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          
          if (elapsed >= duration) {
            mediaRecorder.stop();
            return;
          }
          
          // Clear canvas
          ctx.clearRect(0, 0, width, height);
          
          // Draw background video first
          if (backgroundVideo.readyState >= 2) { // HAVE_CURRENT_DATA
            ctx.drawImage(backgroundVideo, 0, 0, width, height);
            // Only log occasionally to avoid spam
            if (elapsed % 1000 < 50) {
              console.log('🎬 Drawing background video frame at', elapsed + 'ms');
            }
          } else {
            // Only log occasionally to avoid spam
            if (elapsed % 1000 < 50) {
              console.log('🎬 Background video not ready, drawing solid background');
            }
            // Fallback: draw a solid background color
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, width, height);
          }
          
          // Calculate positions and sizes (same as image generation)
          const framePadding = 40;
          const frameWidth = width - (framePadding * 2);
          const frameHeight = height - (framePadding * 2);

        // Person image dimensions
        const personAspectRatio = personImage.width / personImage.height;
        const personMaxWidth = frameWidth * 0.6;
        const personMaxHeight = frameHeight * 0.7;
        
        let personWidth = personMaxWidth;
        let personHeight = personMaxWidth / personAspectRatio;
        
        if (personHeight > personMaxHeight) {
          personHeight = personMaxHeight;
          personWidth = personMaxHeight * personAspectRatio;
        }

        const personX = (width - personWidth) / 2;
        // Position person image 44% from top (4% further down)
        const personY = height * 0.44 + (height * 0.3 - personHeight) / 2;


          // Draw person image first (behind frame)
          ctx.drawImage(personImage, personX, personY, personWidth, personHeight);

          // Draw frame image on top of everything
          ctx.drawImage(frameImage, 0, 0, width, height);
          
          // Debug: Log frame drawing
          if (elapsed % 1000 < 50) {
            console.log('🎬 Drawing frame image at', elapsed + 'ms');
          }

          // Draw greeting text with multi-line support and custom font
          if (greeting) {
            ctx.fillStyle = '#ffffff';
            // Use custom font with fallbacks
            const fontFamily = document.fonts.check('bold 28px "Nordique Pro"') 
              ? 'Nordique Pro' 
              : 'Arial, sans-serif';
            ctx.font = `bold 28px ${fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            
            // Multi-line text support
            const maxWidth = width - 100; // Leave margin on sides
            const lineHeight = 35; // Line spacing
            const words = greeting.split(' ');
            const lines: string[] = [];
            let currentLine = '';
            
            // Word wrapping logic
            for (const word of words) {
              const testLine = currentLine + (currentLine ? ' ' : '') + word;
              const metrics = ctx.measureText(testLine);
              
              if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            }
            if (currentLine) {
              lines.push(currentLine);
            }
            
        // Draw each line - positioned to work with person image at 40% from top
        const startY = height - 50 - (lines.length - 1) * lineHeight / 2;
        lines.forEach((line, index) => {
          ctx.fillText(line, width / 2, startY + index * lineHeight);
        });
          }
          
          requestAnimationFrame(animate);
        };
        
        // Start animation
        animate();
        
      } catch (error) {
        console.error('Error generating client-side video:', error);
        reject(error);
      }
    });
  };

  // Build standardized social URL for Cloudinary by inserting an upload transform
  // Example: https://res.cloudinary.com/<cloud_name>/video/upload/{transform}/v12345/.../file.mp4
  const buildSocialUrl = (url?: string | null) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const fullPath = parsed.pathname; // e.g. /<cloud_name>/video/upload/v1234/path/to/file.mp4

      // Find the upload segment in the path
      const uploadIndex = fullPath.indexOf("/upload/");
      if (uploadIndex === -1) {
        // Not a Cloudinary-style URL we know how to transform
        return url;
      }

      const beforeUpload = fullPath.substring(0, uploadIndex); // includes cloud name
      const afterUpload = fullPath.substring(uploadIndex + "/upload/".length); // rest after upload/

      const transform = "f_mp4,q_auto:best";

      // Reconstruct URL preserving host and cloud name
      return `${parsed.protocol}//${parsed.hostname}${beforeUpload}/upload/${transform}/${afterUpload}`;
    } catch (e) {
      return null;
    }
  };

  // Social media sharing functions
  const shareToInstagram = () => {
    if (cloudinaryVideoUrl) {
      // Instagram doesn't support direct video sharing via URL
      // Open Instagram with instructions
      const message =
        "To share your Diwali postcard video on Instagram:\n\n1. Download the video first\n2. Open Instagram\n3. Create a new post\n4. Upload the downloaded video\n5. Add your caption and share!";
      alert(message);

      // Also open Instagram
      window.open("https://www.instagram.com/", "_blank");
    }
  };

  const shareToTikTok = () => {
    if (cloudinaryVideoUrl) {
      // TikTok doesn't support direct video sharing via URL
      const message =
        "To share your Diwali postcard video on TikTok:\n\n1. Download the video first\n2. Open TikTok\n3. Tap the + button to create\n4. Upload the downloaded video\n5. Add effects, music, and share!";
      alert(message);

      // Also open TikTok
      window.open("https://www.tiktok.com/", "_blank");
    }
  };

  const shareToWhatsApp = async () => {
    // Always prefer a public Cloudinary URL; upload if we only have a local blob
    let urlToShare: string | null = null;

    if (cloudinaryVideoUrl) {
      urlToShare = buildSocialUrl(cloudinaryVideoUrl) || cloudinaryVideoUrl;
    } else {
      const uploadSource = recordedVideoBlob ?? recordedVideoUrl;
      if (uploadSource) {
        try {
          setUploadError(null);
          const uploadedUrl = await uploadVideoToCloudinary(uploadSource);
          urlToShare = buildSocialUrl(uploadedUrl) || uploadedUrl;
        } catch (e) {
          alert("Unable to prepare a shareable link. Please try again.");
          return;
        }
      }
    }

    if (!urlToShare) {
      alert("Please generate a video first before sharing to WhatsApp.");
      return;
    }

    const message = "Check out my festive Diwali postcard video! 🎆✨";

    // Track
    if (typeof window !== "undefined") {
      if ((window as any).fbq) {
        (window as any).fbq("track", "Share", {
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "WhatsApp",
        });
      }
      if ((window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "social_share",
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "WhatsApp",
        });
      }
    }

    // Use web-friendly WhatsApp share link
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message + " " + urlToShare)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const shareToTwitter = () => {
    if (cloudinaryVideoUrl) {
      // Track Twitter sharing
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Share", {
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "Twitter",
        });
      }

      // Track with Google Tag Manager
      if (typeof window !== "undefined" && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "social_share",
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "Twitter",
        });
      }

      const message =
        "Check out my festive Diwali postcard video! 🎆✨ #Diwali #Festive #Postcard";
      const socialUrl =
        buildSocialUrl(cloudinaryVideoUrl) || cloudinaryVideoUrl;
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(socialUrl)}`;
      window.open(twitterUrl, "_blank");
    }
  };

  const shareToFacebook = () => {
    const urlToShare =
      (cloudinaryVideoUrl &&
        (buildSocialUrl(cloudinaryVideoUrl) || cloudinaryVideoUrl)) ||
      recordedVideoUrl ||
      null;

    if (!urlToShare) {
      alert("Please generate a video first before sharing to Facebook.");
      return;
    }

    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "Share", {
        content_name: "Diwali Postcard Video",
        content_category: "Social Sharing",
        method: "Facebook",
      });
    }

    const message = "Check out my festive Diwali postcard video! 🎆✨";
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlToShare)}&quote=${encodeURIComponent(message)}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer");
  };

  const shareToTelegram = () => {
    if (cloudinaryVideoUrl) {
      // Track Telegram sharing
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Share", {
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "Telegram",
        });
      }

      const message = "Check out my festive Diwali postcard video! 🎆✨";
      const socialUrl =
        buildSocialUrl(cloudinaryVideoUrl) || cloudinaryVideoUrl;
      const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(socialUrl)}&text=${encodeURIComponent(message)}`;
      window.open(telegramUrl, "_blank");
    }
  };

  const copyVideoLink = async () => {
    // Prefer optimized social URL when available; fallback to recorded local URL
    const urlFromCloud = cloudinaryVideoUrl
      ? buildSocialUrl(cloudinaryVideoUrl) || cloudinaryVideoUrl
      : null;
    const urlToCopy = urlFromCloud || recordedVideoUrl || "";

    if (!urlToCopy) {
      alert("Please generate a video first before copying a link.");
      return;
    }

    // Track link copying
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "Share", {
        content_name: "Diwali Postcard Video",
        content_category: "Social Sharing",
        method: "Copy Link",
      });
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = urlToCopy;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      alert("Video link copied to clipboard!");
    } catch (error) {
      alert(`Failed to copy. You can manually copy this link: ${urlToCopy}`);
    }
  };

  const stopRotation = () => {
    setIsRotating(false);
  };

  const startRotation = () => {
    setIsRotating(true);
  };

  const uploadPersonImageToCloudinary = async (base64Data: string): Promise<string> => {
    try {
      // Downscale/compress image on client to avoid large uploads (prevents 413)
      const optimizedDataUrl = await downscaleImageDataUrl(base64Data, {
        maxDimension: 2048,
        outputMimeType: 'image/jpeg',
        quality: 0.9,
      });

      // Convert optimized base64 to blob
      const base64 = optimizedDataUrl.split(',')[1];
      const mimeType = optimizedDataUrl.split(',')[0].split(':')[1].split(';')[0];
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      // Generate a unique public ID
      const publicId = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Get Cloudinary signature for signed upload
      const signatureRes = await fetch("/api/cloudinary-signature", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: 'diwali-postcards/person-images',
          publicId: publicId,
          resourceType: 'image'
        })
      });

      if (!signatureRes.ok) {
        throw new Error("Failed to get Cloudinary signature");
      }
      const signatureData = await signatureRes.json();

      // Create form data for signed upload
      const formData = new FormData();
      formData.append('file', blob, 'person-image.jpg');
      formData.append('api_key', signatureData.apiKey);
      formData.append('timestamp', signatureData.timestamp);
      formData.append('signature', signatureData.signature);
      formData.append('folder', 'diwali-postcards/person-images');
      formData.append('public_id', signatureData.publicId);
      formData.append('resource_type', 'image');

      // Upload to Cloudinary with signed upload
      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const error = await uploadRes.json();
        throw new Error(`Cloudinary upload failed: ${error.error?.message || uploadRes.statusText}`);
      }

      const result = await uploadRes.json();
      return result.secure_url;
    } catch (error) {
      console.error("Error uploading person image to Cloudinary:", error);
      throw error;
    }
  };

  // Downscale and compress a data URL on client to keep payloads small
  const downscaleImageDataUrl = async (
    dataUrl: string,
    options: { maxDimension: number; outputMimeType: string; quality: number },
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const image = new Image();
        image.onload = () => {
          const { maxDimension, outputMimeType, quality } = options;

          let targetWidth = image.naturalWidth;
          let targetHeight = image.naturalHeight;

          const maxSide = Math.max(targetWidth, targetHeight);
          if (maxSide > maxDimension) {
            const scale = maxDimension / maxSide;
            targetWidth = Math.round(targetWidth * scale);
            targetHeight = Math.round(targetHeight * scale);
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D context not available'));
            return;
          }

          ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

          // Convert to compressed data URL
          const out = canvas.toDataURL(outputMimeType, quality);
          resolve(out);
        };
        image.onerror = (e) => reject(new Error('Failed to load image for downscaling'));
        image.src = dataUrl;
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  };

  const generate = async () => {
    if (!photoData || !selectedDish || !consent) return;
    
    // Prevent multiple simultaneous calls
    if (isGeneratingRef.current || loading) {
      console.log("Generation already in progress, ignoring duplicate call");
      return;
    }
    
    isGeneratingRef.current = true;
    manualLoaderControlRef.current = true;
    setLoading(true);
    console.log("🔄 Starting generation, setting isRotating to true");
    setIsRotating(true); // Start the rotation
    setResult(null);
    setGenerationStep(0);
    setGenerationProgress(0);
    startProgressIncrement();

    // Track image generation start
    if (typeof window !== "undefined" && (window as any).fbq) {
      (window as any).fbq("track", "InitiateCheckout", {
        content_name: "Diwali Postcard Generation",
        content_category: "Image Generation",
        value: 0,
        currency: "INR",
      });
    }

    // Track with Google Tag Manager
    if (typeof window !== "undefined" && (window as any).dataLayer) {
      (window as any).dataLayer.push({
        event: "image_generation_start",
        content_name: "Diwali Postcard Generation",
        content_category: "Image Generation",
        value: 0,
        currency: "INR",
      });
    }

    try {
      // Let the useEffect handle the generation steps rotation
      // No need to manually cycle through steps here

      // Upload person image to Cloudinary first to avoid 413 error
      console.log("Uploading person image to Cloudinary...");
      const personImageUrl = await uploadPersonImageToCloudinary(photoData);
      console.log("Person image uploaded:", personImageUrl);

      // Debug selected dish
      console.log("Selected dish:", selectedDish);
      console.log("Dish image URL:", selectedDish?.image);
      
      // Validate required fields
      if (!personImageUrl) {
        throw new Error("Person image URL is missing");
      }
      if (!selectedDish?.image) {
        throw new Error("Dish image is missing - please select a dish");
      }

      const requestBody = {
        personImageUrl: personImageUrl,
        dishImageUrl: selectedDish.image,
        background: bg,
        greeting,
      };
      
      console.log("Sending request to /api/generate with body:", requestBody);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }).catch((fetchError) => {
        console.error("Fetch error:", fetchError);
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          throw new Error("Network error occurred. Please check your internet connection and try again.");
        }
        throw new Error(`Network error: ${fetchError.message}`);
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 422 && errorData.type === 'content_policy_violation') {
          throw new Error('The image you uploaded may contain content that violates our content policy. Please try with a different image.');
        }
        throw new Error(`HTTP ${res.status}: ${errorData.error || 'Unknown error'}`);
      }
      const json = await res.json();

      clearProgressInterval();
      setGenerationProgress(100);

      await delay(LOADER_STEP_FADE_MS);

      setResult(json?.image_url ?? json?.result_url ?? null);
      setResultData(json);

      // Track successful image generation
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Purchase", {
          content_name: "Diwali Postcard Image",
          content_category: "Image Generation",
          value: 1,
          currency: "INR",
        });
      }

      // Track with Google Tag Manager
      if (typeof window !== "undefined" && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "image_generation_complete",
          content_name: "Diwali Postcard Image",
          content_category: "Image Generation",
          value: 1,
          currency: "INR",
        });
      }
    } catch (e: any) {
      console.error("Generation failed:", e);
      
      // Better error handling with specific messages
      let errorMessage = "Failed to generate postcard. Please try again.";
      
      if (e?.message) {
        if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
          errorMessage = "Network error occurred. Please check your internet connection and try again.";
        } else if (e.message.includes("content_policy_violation")) {
          errorMessage = "The image you uploaded may contain content that violates our content policy. Please try with a different image.";
        } else if (e.message.includes("HTTP 413")) {
          errorMessage = "Image file is too large. Please try with a smaller image.";
        } else if (e.message.includes("HTTP 422")) {
          errorMessage = "Invalid image format. Please try with a different image.";
        } else {
          errorMessage = e.message;
        }
      }
      
      // Use toast instead of alert for better UX
      toast({
        title: "Postcard generation failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      console.log("🔄 Generation complete, stopping rotation");
      clearProgressInterval();
      manualLoaderControlRef.current = false;
      isGeneratingRef.current = false;
      setLoading(false);
      setIsRotating(false); // Stop rotation when generation is complete
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-orange-700">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Crash recovery UI
  if (isPageCrashed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🚨</div>
          <h1 className="text-2xl font-bold text-red-700 mb-4">Page Crashed</h1>
          <p className="text-red-600 mb-6">
            An unexpected error occurred during video generation. This might be
            due to memory issues or browser limitations.
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => {
                setIsPageCrashed(false);
                setVideoGenerationError(null);
                // Cleanup and reset
                if ((window as any).animationCleanup) {
                  (window as any).animationCleanup();
                }
                setCanvasRecorder(null);
                setRecordedVideoUrl(null);
                setRecordedVideoBlob(null);
                setCloudinaryVideoUrl(null);
                setRecordingProgress(0);
                setIsRecording(false);
              }}
              className="w-full bg-red-500 hover:bg-red-600 text-white"
            >
              🔄 Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white"
            >
              🔄 Refresh Page
            </Button>
            <Button
              onClick={() => navigate("/")}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              🏠 Go Home
            </Button>
          </div>
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-700">
              <strong>Tip:</strong> Try closing other browser tabs to free up
              memory, or use a different browser.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="w-[90%] md:w-[80%] mx-auto px-2 md:px-6 py-8 pb-24">
        <div className="flex items-center justify-between">
          <a href="/" className="font-extrabold text-orange-700 text-2xl">
            <img
              src="/fortune-logo.png"
              alt="logo"
              className="w-1/2 w-[100px] h-auto md:w-[217px] md:h-[73px]"
            />
          </a>
          <div className="flex items-center gap-4">
            <div className="text-sm text-orange-900/70">
              <img
                src="/home-diwali-logo.png"
                alt="diwali-postcard"
                className="mx-auto w-[100px] h-auto md:w-[200px] md:h-[136px]"
              />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-center text-3xl md:text-4xl font-extrabold text-orange-900">
            Let&#8217;s create your festive postcard
          </h2>
          <div className="mt-6">
            <Stepper step={step} />
          </div>
        </div>

        <div className="w-[100%] md:w-[70%] mx-auto mt-8 bg-[#fff1d2] border border-orange-200 rounded-2xl p-6 md:p-8 shadow-xl">
          {step === 0 && (
            <div className="flex flex-col gap-6 items-center text-center">
              <div className="w-full">
                <div className="text-xl font-extrabold text-orange-900 mb-2">
                  Upload my picture
                </div>
                <p className="text-orange-900/70 mb-4">
                  Use a clear selfie or portrait.
                </p>
                <div className="rounded-xl border-2 border-dashed border-orange-300  p-6 flex flex-col items-center justify-center text-center">
                  {isOptimizing ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-6 h-6 bg-orange-100 rounded-full"></div>
                        </div>
                      </div>
                      <div className="text-orange-800 font-medium">
                        Optimizing your image...
                      </div>
                      <div className="text-sm text-orange-700 text-center">
                        This may take a few seconds
                      </div>
                      <div className="w-full max-w-xs bg-orange-200 rounded-full h-2">
                        <div className="bg-orange-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                      </div>
                    </div>
                  ) : photoData ? (
                    <img
                      src={photoData}
                      alt="preview"
                      className="max-h-72 rounded-md shadow"
                    />
                  ) : (
                    <>
                      <p className="text-orange-800/80">Click to upload</p>
                      <p className="text-xs text-orange-900/60">PNG or JPG</p>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleFile(e.target.files?.[0] || undefined)
                    }
                    disabled={isOptimizing}
                  />
                  <Button
                    type="button"
                    className="mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      setUploadError(null);
                      fileRef.current?.click();
                    }}
                    disabled={isOptimizing}
                  >
                    {isOptimizing ? "Processing..." : "Choose File"}
                  </Button>
                </div>

                {/* Error message display */}
                {uploadError && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-red-700 text-sm font-medium">
                      {uploadError}
                    </p>
                  </div>
                )}

                

                {/* File size info */}
                <p className="text-xs text-orange-900/60 mt-2">
                  Maximum file size: 10MB (will be optimized automatically)
                </p>
              </div>
              <div className="w-full md:w-48 flex gap-2">
                <Button
                  disabled={!photoData}
                  className="flex-1 h-12 bg-orange-600 hover:bg-orange-700"
                  onClick={() => setStep(1)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="text-lg font-semibold text-orange-900 mb-4">
                Choose your favourite dish
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {DISHES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDish(d)}
                    className={cn(
                      "group overflow-hidden rounded-xl border p-2 bg-white/70 hover:shadow transition",
                      selectedDish?.id === d.id
                        ? "border-orange-500 ring-2 ring-orange-400"
                        : "border-orange-200",
                    )}
                  >
                    <img
                      src={d.image}
                      alt={d.name}
                      className="aspect-square w-full object-cover rounded-md"
                    />
                    <div className="mt-2 text-center text-sm font-medium text-orange-900">
                      {d.name}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-center gap-2">
                <Button
                  className="h-12 bg-gray-500 hover:bg-gray-600 text-white"
                  onClick={() => setStep(0)}
                >
                  ← Previous
                </Button>
                <Button
                  disabled={!selectedDish}
                  className="h-12 bg-orange-600 hover:bg-orange-700"
                  onClick={() => setStep(2)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="text-lg font-semibold text-orange-900 mb-4">
                Choose your festive background
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setBg(b.id);
                    }}
                    className={cn(
                      "group overflow-hidden rounded-xl border h-28 relative bg-gradient-to-br from-orange-100 to-amber-200",
                      bg === b.id
                        ? "ring-2 ring-orange-500 border-orange-500"
                        : "border-orange-200",
                    )}
                  >
                    <video
                      src={b.video}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                      onLoadedData={() => {
                        console.log(`Video loaded: ${b.video}`);
                      }}
                      onError={(e) => {
                        console.error(`Error loading video: ${b.video}`, e);
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2">
                      <span className="text-xs font-medium">{b.name}</span>
                    </div>
                    {bg === b.id && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-center gap-2">
                <Button
                  className="h-12 bg-gray-500 hover:bg-gray-600 text-white"
                  onClick={() => setStep(1)}
                >
                  ← Previous
                </Button>
                <Button
                  className="h-12 bg-orange-600 hover:bg-orange-700"
                  onClick={() => setStep(3)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col justify-center gap-6 items-center">
              <div className="w-full flex flex-col md:flex-row align-start  gap-3">
                <div className="text-xs text-orange-900/70 w-full md:w-1/2 min-h-[100%] flex flex-col justify-between">
                  <div className="text-lg font-semibold text-orange-900 mb-2 text-center md:text-left">
                    Add your greeting *
                  </div>
                  <Textarea
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    placeholder="Type your greeting here (max 75 characters)"
                    className="h-[80%] bg-white/70 resize-none"
                    maxLength={75}
                  />
                  <div className="text-xs text-orange-900/60 mt-1">
                    {greeting.length}/75 characters
                  </div>
                  {!greeting.trim() && (
                    <div className="text-xs text-red-600 mt-1">
                      * Greeting is required to continue
                    </div>
                  )}
                </div>
                <div className="grid gap-3 w-full md:w-1/2">
                  <div className="text-lg font-semibold text-orange-900 mb-2 text-center md:text-left">
                    Or select one of the below
                  </div>
                  {PRESET_GREETINGS.map((g, i) => (
                    <button
                      key={i}
                      onClick={() => setGreeting(g)}
                      className="rounded-md border border-orange-200 bg-white/70 px-3 py-2 text-sm hover:border-orange-400"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-full md:w-48 flex gap-2">
                <Button
                  className="flex-1 h-12 bg-gray-500 hover:bg-gray-600 text-white"
                  onClick={() => setStep(2)}
                >
                  ← Previous
                </Button>
                <Button
                  disabled={!greeting.trim()}
                  className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={() => setStep(4)}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}

          {step === 4 && !result && (
            <div className="space-y-6">
              <label className="flex items-start gap-3 text-orange-900">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I consent to the use of the uploaded image for generating the
                  AI visual.
                </span>
              </label>
              <div className="flex gap-2 flex-col md:flex-row">
                <Button
                  className="bg-gray-500 hover:bg-gray-600 text-white"
                  onClick={() => setStep(3)}
                >
                  ← Previous
                </Button>
                <Button
                  disabled={!consent || !photoData || !selectedDish || loading}
                  onClick={generate}
                  className="bg-orange-600 hover:bg-orange-700 flex-1"
                >
                  {loading ? "Generating..." : "Generate my Postcard"}
                </Button>
              </div>

              {/* Generation Progress Display */}
              {loading && (
                <div className="mt-8 bg-white/90 backdrop-blur border border-orange-200 rounded-2xl p-6 shadow-xl">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-orange-900 mb-4">
                      Creating Your Festive Postcard
                    </div>

                    {/* Scrolling Text Display */}
                    <div className="relative h-[140px] overflow-hidden bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className={`text-orange-800 font-medium text-lg transition-all duration-1200 ease-in-out ${
                            isFading
                              ? "opacity-0 transform scale-95"
                              : "opacity-100 transform scale-100"
                          }`}
                        >
                          {GENERATION_STEPS[generationStep]}
                        </div>
                      </div>
                    </div>

                    {/* Progress Dots */}
                    <div className="flex justify-center mt-4 space-x-2">
                      {GENERATION_STEPS.map((_, index) => (
                        <div
                          key={index}
                          className={`w-2 h-2 rounded-full transition-all duration-1200 ease-in-out ${
                            index === generationStep
                              ? "bg-orange-500 scale-125"
                              : "bg-orange-200 scale-100"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Circular Progress Bar */}
                    <div className="mt-6 flex justify-center">
                      <CircularProgressBar
                        percentage={generationProgress}
                        size={100}
                        strokeWidth={8}
                        color="#f97316"
                      />
                    </div>

                    {/* Progress Text */}
                    <div className="mt-3 text-sm text-orange-700 font-medium">
                      {generationProgress < 100
                        ? `Processing... ${Math.round(generationProgress)}%`
                        : "Complete!"}
                    </div>

                    
                  </div>
                </div>
              )}
            </div>
          )}

          {result && step === 4 && (
            <div
              className="mt-2"
              style={{ zIndex: 1000, position: "relative" }}
            >
              <div className="text-xl font-semibold text-orange-900 mb-4 text-center">
                Your festive postcard is ready!
              </div>
              <div className="flex justify-center generated-card-container">
                <div
                  className="relative max-w-sm sm:max-w-md lg:max-w-lg"
                  style={{ zIndex: 1000 }}
                >
                  {/* Photo Frame Container */}
                  <img
                    src="/photo-frame-story.png"
                    alt="photo frame"
                    className="w-full h-auto relative"
                    style={{ zIndex: 1000 }}
                  />
                  {/* Content inside the frame */}
                  <div className="absolute inset-0 flex items-center justify-center px-6 sm:px-8">
                    <div className="relative w-full h-full">
                      {/* Video Background */}
                      <video
                        src={
                          resultData?.background_image ||
                          selectedBackground.video
                        }
                        className="absolute inset-0 w-full h-full object-cover rounded-lg"
                        muted
                        loop
                        autoPlay
                        playsInline
                      />
                      {/* Generated Image Overlay */}
                      <div
                        className="relative flex items-center justify-center h-full"
                        style={{ zIndex: 99 }}
                      >
                        <img
                          src={result}
                          alt="result"
                          data-generated-image
                          className="object-contain absolute md:top-[28%] top-[30%]"
                          style={{
                            background: "transparent",
                            mixBlendMode: "normal",
                          }}
                        />
                      </div>
                      {/* Greeting Message Overlay */}
                      {greeting && (
                        <div
                          className="w-full absolute bottom-0 md:bottom-6 left-0 right-0 flex justify-center"
                          style={{ zIndex: 1002 }}
                        >
                          <div className="text-white py-2 rounded-lg text-center max-w-[95%] md:max-w-[90%]">
                            <p
                              className="text-sm md:text-2xl leading-tight font-semibold"
                              data-generated-greeting
                            >
                              {greeting}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Progress Indicator */}
              

              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    className="h-11 px-6 bg-orange-600 text-white hover:bg-orange-700 w-full sm:w-auto"
                    onClick={downloadPostcardImage}
                    disabled={imageDownloading}
                  >
                    {imageDownloading
                      ? "Preparing image..."
                      : "Download Postcard Image"}
                  </Button>
                  {imageDownloadError && (
                    <span className="text-xs text-red-600 text-center sm:text-left">
                      {imageDownloadError}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    className="h-11 px-6 bg-blue-600 text-white hover:bg-blue-700 w-full sm:w-auto"
                    onClick={downloadVideo}
                    disabled={!result || !resultData || !selectedDish || !selectedBackground}
                  >
                    Download Postcard
                  </Button>
                  {(!result || !resultData || !selectedDish || !selectedBackground) && (
                    <span className="text-xs text-gray-500 text-center sm:text-left">
                      Generate a postcard first
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  className="h-11 px-6 border border-gray-300 text-gray-700 hover:bg-gray-50 w-full sm:w-auto"
                  onClick={() => {
                    setResult(null);
                    setResultData(null);
                    setStep(0);
                    setRecordedVideoUrl(null);
                    setRecordedVideoBlob(null);
                    setCloudinaryVideoUrl(null);
                    setVideoGenerationError(null);
                    setImageDownloadError(null);
                    setImageDownloading(false);
                  }}
                >
                  Generate again
                </Button>
              </div>

              {videoGenerationError && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="font-semibold text-red-800">
                    We couldn't generate the video.
                  </div>
                  <p className="mt-1">{videoGenerationError}</p>
                  <div className="mt-3">
                    <p className="mb-3 text-xs text-red-600 sm:text-sm">
                      You can still download a festive image with the
                      background, frame, and your greeting.
                    </p>
                    <p className="text-xs text-orange-700">
                      Use the Download Postcard Image button above to save your
                      postcard.
                    </p>
                  </div>
                </div>
              )}

              {/* Social Sharing Modal */}
              <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                <DialogContent
                  className="max-w-2xl"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-orange-900">
                      🎉 Share Your Diwali Postcard Video!
                    </DialogTitle>
                  </DialogHeader>

                  {(cloudinaryVideoUrl || recordedVideoUrl) && (
                    <div className="mb-4">
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full rounded-lg shadow"
                        style={{ maxHeight: "360px" }}
                      >
                        <source
                          src={cloudinaryVideoUrl || recordedVideoUrl || ""}
                          type="video/mp4"
                        />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}

                  <div className="flex justify-center gap-3 mb-4">
                    {/* Instagram */}
                    <Button
                      onClick={shareToInstagram}
                      className="h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                      <div className="flex flex-col items-center">
                        <FontAwesomeIcon
                          icon={faInstagram}
                          className="w-5 h-5"
                        />
                        <span className="text-xs font-medium">Instagram</span>
                      </div>
                    </Button>

                    {/* WhatsApp */}
                    <Button
                      onClick={shareToWhatsApp}
                      className="h-12 bg-green-500 hover:bg-green-600 text-white"
                    >
                      <div className="flex flex-col items-center">
                        <FontAwesomeIcon
                          icon={faWhatsapp}
                          className="w-5 h-5"
                        />
                        <span className="text-xs font-medium">WhatsApp</span>
                      </div>
                    </Button>

                    {/* Facebook */}
                    <Button
                      onClick={shareToFacebook}
                      className="h-12 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <div className="flex flex-col items-center">
                        <FontAwesomeIcon
                          icon={faFacebook}
                          className="w-5 h-5"
                        />
                        <span className="text-xs font-medium">Facebook</span>
                      </div>
                    </Button>
                  </div>

                  <div className="text-center">
                    <Button
                      onClick={copyVideoLink}
                      className="h-10 px-6 bg-gray-600 hover:bg-gray-700 text-white"
                    >
                      📋 Copy Video Link
                    </Button>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="text-sm text-orange-700">
                      💡 <strong>Tip:</strong> For Instagram and TikTok,
                      download the video first, then upload it to the app!
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for video recording */}
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
        width={640}
        height={480}
      />

      {/* Footer */}
      {showFooter && (
        <footer className="fixed bottom-0 left-0 right-0 py-4 border-t border-orange-200 bg-orange-50/30 backdrop-blur-sm z-50">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-orange-900/70">
              <p>Copyright &copy;2025. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="text-orange-600 hover:text-orange-700 underline">
                      Terms & Conditions
                    </button>
                  </DialogTrigger>
                  <DialogContent
                    className="max-w-4xl max-h-[80vh] overflow-y-auto z-[999999]"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold text-orange-900">
                        Terms & Conditions
                      </DialogTitle>
                    </DialogHeader>
                    <div className="mt-4">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                        {TERMS_AND_CONDITIONS}
                      </pre>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
