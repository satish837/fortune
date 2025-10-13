import { useMemo, useRef, useState, useEffect } from "react";
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
    fallback: "🌟",
  },
  { id: "5", name: "Festive Joy", video: "/background/5.mp4", fallback: "🎉" },
];

const PRESET_GREETINGS = [
  "This Diwali, may the flavours of the Fortune make your home shine brighter",
  "May your Diwali sparkle with love, laughter, and lots of Fortune",
  "Sharing the flavours of #DiwaliKaFortune with you",
];

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
  const [videoLoading, setVideoLoading] = useState<{ [key: string]: boolean }>(
    {},
  );
  const [videoError, setVideoError] = useState<{ [key: string]: boolean }>({});
  const [generationStep, setGenerationStep] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
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

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

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

  // Load Cloudinary configuration
  useEffect(() => {
    const loadCloudinaryConfig = async () => {
      try {
        const response = await fetch("/api/cloudinary-config");
        if (response.ok) {
          const config = await response.json();
          setCloudinaryConfig(config);
          console.log("✅ Cloudinary config loaded:", config);
        } else {
          console.error("❌ Failed to load Cloudinary config");
        }
      } catch (error) {
        console.error("❌ Error loading Cloudinary config:", error);
      }
    };

    loadCloudinaryConfig();
  }, []);

  // Initialize Canvas Recorder
  useEffect(() => {
    const initCanvasRecorder = async () => {
      try {
        console.log("🔄 Canvas recorder ready to initialize");
        // Canvas recorder will be initialized when needed
      } catch (error) {
        console.error("❌ Canvas recorder initialization failed:", error);
      }
    };

    initCanvasRecorder();
  }, []);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userData");
    navigate("/", { replace: true });
  };

  // Start videos when background selection step is active
  useEffect(() => {
    if (step === 2) {
      // Small delay to ensure videos are rendered
      setTimeout(() => {
        BACKGROUNDS.forEach((background) => {
          const video = videoRefs.current[background.id];
          if (video) {
            console.log(`Attempting to play video: ${background.video}`);
            video.currentTime = 0;
            video.play().catch((error) => {
              console.log(
                `Autoplay blocked for video: ${background.video}`,
                error,
              );
            });
          }
        });
      }, 500);
    }
  }, [step]);

  // Cycle through generation steps while loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setGenerationStep(0);
      setIsFading(false);
      interval = setInterval(() => {
        // Start fade out
        setIsFading(true);

        // After fade out completes, change step and fade in
        setTimeout(() => {
          setGenerationStep((prev) => (prev + 1) % GENERATION_STEPS.length);
          setIsFading(false);
        }, 800); // Fade out duration
      }, 10000); // Change step every 4 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading]);

  // Auto-start video recording when result is generated
  useEffect(() => {
    if (result && resultData && !recordedVideoUrl && !isRecording) {
      // Small delay to ensure the video is playing
      setTimeout(() => {
        startVideoRecording();
      }, 1000);
    }
  }, [result, resultData, recordedVideoUrl, isRecording]);

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

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cleanup animation loop
      if ((window as any).animationCleanup) {
        (window as any).animationCleanup();
        delete (window as any).animationCleanup;
      }

      // Cleanup mobile animation loop
      if ((window as any).mobileAnimationCleanup) {
        (window as any).mobileAnimationCleanup();
        delete (window as any).mobileAnimationCleanup;
      }

      // Cleanup canvas recorder
      if (canvasRecorder) {
        try {
          canvasRecorder.stop();
        } catch (error) {
          console.warn("Error stopping canvas recorder on cleanup:", error);
        }
      }

      // Cleanup video URLs
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }

      // Cleanup media recorder
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (error) {
          console.warn("Error stopping media recorder on cleanup:", error);
        }
      }

      console.log("🧹 Component cleanup completed");
    };
  }, [canvasRecorder, recordedVideoUrl]);

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

      // Get the background video element
      const backgroundVideo = cardContainer.querySelector(
        'video[src*="background"]',
      ) as HTMLVideoElement;
      if (!backgroundVideo) {
        throw new Error("Background video not found");
      }

      // Ensure video is playing
      if (backgroundVideo.paused) {
        backgroundVideo.play().catch(console.error);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context not found");
      }

      // Get the container's dimensions
      const rect = cardContainer.getBoundingClientRect();
      const whatsappSize = 512;
      const maxSize = Math.min(rect.width, rect.height);
      const scale = whatsappSize / maxSize;

      canvas.width = whatsappSize;
      canvas.height = whatsappSize;
      ctx.scale(scale, scale);

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
          const videoUrl = URL.createObjectURL(videoBlob);

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

          // Calculate centered position
          const offsetX = (whatsappSize - rect.width * scale) / 2;
          const offsetY = (whatsappSize - rect.height * scale) / 2;

          // Draw the background video
          if (
            backgroundVideo.videoWidth > 0 &&
            backgroundVideo.videoHeight > 0
          ) {
            ctx.drawImage(
              backgroundVideo,
              offsetX,
              offsetY,
              rect.width * scale,
              rect.height * scale,
            );
          }

          // Draw the generated image
          const generatedImg = new Image();
          generatedImg.crossOrigin = "anonymous";
          generatedImg.src = result;
          ctx.drawImage(
            generatedImg,
            offsetX,
            offsetY,
            rect.width * scale,
            rect.height * scale,
          );

          // Draw the photo frame
          const photoFrameImg = new Image();
          photoFrameImg.crossOrigin = "anonymous";
          photoFrameImg.src = "/photo-frame-story.png";
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
            ctx.font = "bold 32px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(greeting, whatsappSize / 2, whatsappSize - 80);
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

        // Set WhatsApp-compatible dimensions
        canvas.width = 512;
        canvas.height = 512;

        // Create MediaRecorder with strict WhatsApp settings
        const stream = canvas.captureStream(15); // 15 FPS for WhatsApp
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/mp4; codecs="avc1.42E01E"', // H.264 Baseline Profile
          videoBitsPerSecond: 200000, // 200kbps for WhatsApp compatibility
          audioBitsPerSecond: 32000, // 32kbps audio
        });

        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const optimizedBlob = new Blob(chunks, { type: "video/mp4" });
          const optimizedUrl = URL.createObjectURL(optimizedBlob);

          console.log("📱 WhatsApp-optimized video:", {
            originalSize: videoBlob.size,
            optimizedSize: optimizedBlob.size,
            sizeInMB: (optimizedBlob.size / (1024 * 1024)).toFixed(2),
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight,
          });

          // Validate WhatsApp compatibility
          if (optimizedBlob.size > 16 * 1024 * 1024) {
            // 16MB limit
            console.warn("⚠️ Video too large for WhatsApp, using original");
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
            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0, 512, 512);

            frameCount++;
            lastFrameTime = currentTime;
          }

          // Check if video has ended
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

        // Get the background video element
        const backgroundVideo = cardContainer.querySelector(
          'video[src*="background"]',
        ) as HTMLVideoElement;
        if (!backgroundVideo) {
          reject(new Error("Background video not found"));
          return;
        }

        // Ensure video is playing
        if (backgroundVideo.paused) {
          backgroundVideo.play().catch(console.error);
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not found"));
          return;
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

        // Initialize Canvas Recorder with strict WhatsApp-compatible settings
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
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Calculate centered position for square canvas
            const offsetX = (whatsappSize - rect.width * scale) / 2;
            const offsetY = (whatsappSize - rect.height * scale) / 2;

            // Draw the background video
            if (
              backgroundVideo.videoWidth > 0 &&
              backgroundVideo.videoHeight > 0
            ) {
              ctx.drawImage(
                backgroundVideo,
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
              ctx.font = "bold 32px Arial";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(greeting, whatsappSize / 2, whatsappSize - 80);
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

  // Start manual recording
  const startRecording = async () => {
    if (!result || !resultData) {
      console.error("Missing result data");
      return;
    }

    try {
      setIsRecording(true);
      setRecordingProgress(0);
      console.log("🎬 Starting manual video recording...");

      // Track video generation start
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "InitiateCheckout", {
          content_name: "Diwali Postcard Video",
          content_category: "Video Generation",
          value: 0,
          currency: "INR",
        });
      }

      // Track with Google Tag Manager
      if (typeof window !== "undefined" && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "video_generation_start",
          content_name: "Diwali Postcard Video",
          content_category: "Video Generation",
          value: 0,
          currency: "INR",
        });
      }

      // Initialize canvas recorder
      await initializeCanvasRecorder();
    } catch (error) {
      console.error("❌ Error starting video recording:", error);
      setIsRecording(false);
    }
  };

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
      setRecordedVideoUrl(videoUrl);

      console.log("✅ Video recording completed with canvas-record:", {
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
        const cloudinaryUrl = await uploadVideoToCloudinary(videoUrl);
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
    backgroundVideo: HTMLVideoElement,
    rect: DOMRect,
    scale: number,
    whatsappSize: number,
  ) => {
    try {
      console.log("📱 Initializing mobile video recorder...");

      // Create a stream from the canvas
      const stream = canvas.captureStream(15); // 15 FPS

      // Create MediaRecorder with WhatsApp-compatible settings
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

      mediaRecorder.onstop = async () => {
        console.log("📱 Mobile video recording stopped");

        // Create video blob
        const videoBlob = new Blob(chunks, { type: "video/mp4" });

        // Validate video
        if (videoBlob.size < 1000) {
          console.error("❌ Video too small, might be corrupted");
          setVideoGenerationError("Video recording failed. Please try again.");
          return;
        }

        // Create video URL
        const videoUrl = URL.createObjectURL(videoBlob);
        setRecordedVideoUrl(videoUrl);
        setRecordingProgress(0);

        console.log("✅ Mobile video recording completed:", {
          size: videoBlob.size,
          type: videoBlob.type,
          sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
        });

        // Upload to Cloudinary
        try {
          console.log("📤 Uploading mobile video to Cloudinary...");
          const cloudinaryUrl = await uploadVideoToCloudinary(videoUrl);
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
      startMobileAnimationLoop(
        canvas,
        ctx,
        backgroundVideo,
        rect,
        scale,
        whatsappSize,
      );
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
    backgroundVideo: HTMLVideoElement,
    rect: DOMRect,
    scale: number,
    whatsappSize: number,
  ) => {
    let animationId: number | null = null;
    let startTime = Date.now();
    let lastFrameTime = 0;
    let frameCount = 0;
    let isAnimating = true;
    const targetFPS = 15; // 15 FPS for WhatsApp compatibility
    const frameInterval = 1000 / targetFPS; // ~66.67ms per frame

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

              // Draw background video
              if (
                backgroundVideo.videoWidth > 0 &&
                backgroundVideo.videoHeight > 0
              ) {
                ctx.drawImage(
                  backgroundVideo,
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
                ctx.font = "bold 32px Arial";
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

    // Get the background video element
    const backgroundVideo = cardContainer.querySelector(
      'video[src*="background"]',
    ) as HTMLVideoElement;
    if (!backgroundVideo) {
      throw new Error("Background video not found");
    }

    // Ensure video is playing
    if (backgroundVideo.paused) {
      backgroundVideo.play().catch(console.error);
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
      await initializeMobileVideoRecorder(
        canvas,
        ctx,
        backgroundVideo,
        rect,
        scale,
        whatsappSize,
      );
      return;
    }

    // Load canvas-record if not already loaded
    await loadCanvasRecord();

    if (!Recorder) {
      console.warn(
        "⚠️ Canvas-record not available, falling back to MediaRecorder",
      );
      await initializeMobileVideoRecorder(
        canvas,
        ctx,
        backgroundVideo,
        rect,
        scale,
        whatsappSize,
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
        backgroundVideo,
        rect,
        scale,
        whatsappSize,
      );
    } catch (error) {
      console.error(
        "❌ Canvas recorder failed, falling back to MediaRecorder:",
        error,
      );
      await initializeMobileVideoRecorder(
        canvas,
        ctx,
        backgroundVideo,
        rect,
        scale,
        whatsappSize,
      );
    }
  };

  // Manual animation loop using canvas-record API with proper cleanup
  const startManualAnimationLoop = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    backgroundVideo: HTMLVideoElement,
    rect: DOMRect,
    scale: number,
    whatsappSize: number,
  ) => {
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

              // Calculate centered position for square canvas
              const offsetX = (whatsappSize - rect.width * scale) / 2;
              const offsetY = (whatsappSize - rect.height * scale) / 2;

              // Draw the background video
              if (
                backgroundVideo.videoWidth > 0 &&
                backgroundVideo.videoHeight > 0
              ) {
                ctx.drawImage(
                  backgroundVideo,
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
                ctx.font = "bold 32px Arial";
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
                    console.log(`📸 Frame ${frameCount} recorded`);
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

      // Get the background video element
      const backgroundVideo = cardContainer.querySelector(
        'video[src*="background"]',
      ) as HTMLVideoElement;
      if (!backgroundVideo) {
        console.error("Background video not found");
        setIsRecording(false);
        return;
      }

      // Ensure video is playing
      if (backgroundVideo.paused) {
        backgroundVideo.play().catch(console.error);
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
        const url = URL.createObjectURL(blob);
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

          // First, draw the background video
          if (
            backgroundVideo.videoWidth > 0 &&
            backgroundVideo.videoHeight > 0
          ) {
            console.log(
              "Drawing background video:",
              backgroundVideo.videoWidth,
              "x",
              backgroundVideo.videoHeight,
            );
            ctx.drawImage(backgroundVideo, 0, 0, rect.width, rect.height);
          } else {
            console.log(
              "Background video not ready:",
              backgroundVideo.videoWidth,
              "x",
              backgroundVideo.videoHeight,
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

            ctx.fillStyle = "white";
            ctx.font = "bold 28px Arial";
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

            // Draw each line
            lines.forEach((line, index) => {
              ctx.fillText(
                line,
                rect.width / 2,
                rect.height - 30 + (index - lines.length / 2) * 28,
              );
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

  const uploadVideoToCloudinary = async (videoUrl: string | Blob) => {
    try {
      setVideoUploading(true);

      // Get Blob
      let videoBlob: Blob;
      if (typeof videoUrl === "string") {
        const response = await fetch(videoUrl);
        videoBlob = await response.blob();
      } else {
        videoBlob = videoUrl;
      }

      console.log("🔧 Video details:", {
        videoSize: videoBlob.size,
        videoType: videoBlob.type,
        sizeInMB: (videoBlob.size / (1024 * 1024)).toFixed(2),
      });

      // Always use server-side signed upload to avoid CORS/stream issues
      // Send raw binary to server to avoid body-stream issues
      const arrayBuffer = await videoBlob.arrayBuffer();
      console.log("📤 Uploading raw binary to server-side signed upload...");

      const uploadResponse = await fetch("/api/upload-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-filename": `festive-postcard-${Date.now()}.mp4`,
        },
        body: arrayBuffer,
      });

      console.log("📡 Upload response status:", uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("❌ Upload failed:", errorText);
        throw new Error(
          `Cloudinary upload failed: ${uploadResponse.status} - ${errorText}`,
        );
      }

      const data = await uploadResponse.json();
      const url = data.secure_url || data.originalUrl || data.secureUrl;
      console.log("✅ Video uploaded to Cloudinary (server):", url);
      setCloudinaryVideoUrl(url);
      return url;
    } catch (error) {
      console.error("❌ Error uploading video to Cloudinary:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      throw error;
    } finally {
      setVideoUploading(false);
    }
  };

  const downloadVideo = async () => {
    if (recordedVideoUrl) {
      try {
        setDownloading(true);
        let videoUrl = recordedVideoUrl;

        // Always try to upload to Cloudinary first for better quality
        console.log("🔄 Uploading video to Cloudinary...");

        try {
          // Upload the video using our API endpoint
          console.log("🔄 Uploading video via API...");

          // Fetch the video blob
          const response = await fetch(recordedVideoUrl);
          const blob = await response.blob();

          // Send raw binary to server for upload
          const arrayBuffer = await blob.arrayBuffer();
          console.log("🔧 Upload Details:", {
            videoSize: blob.size,
            videoType: blob.type,
            cloudinaryConfig: cloudinaryConfig,
          });

          const uploadResponse = await fetch("/api/upload-video", {
            method: "POST",
            headers: {
              "Content-Type": "application/octet-stream",
              "x-filename": `festive-postcard-${Date.now()}.mp4`,
            },
            body: arrayBuffer,
          });

          console.log("📡 Upload response status:", uploadResponse.status);

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(
              `Upload failed: ${uploadResponse.status} - ${errorData.error || errorData.details}`,
            );
          }

          const uploadData = await uploadResponse.json();
          console.log("✅ Video uploaded successfully:", uploadData);

          videoUrl = uploadData.url || uploadData.secure_url || uploadData.originalUrl || videoUrl;

          // Update the state for future use
          setCloudinaryVideoUrl(videoUrl);

          console.log(
            "✅ Video processed through Cloudinary MP4 converter:",
            videoUrl,
          );
        } catch (cloudinaryError) {
          console.error("❌ Cloudinary processing failed:", cloudinaryError);
          console.log("⚠️ Falling back to original video URL");
          // Fallback to original video
          videoUrl = recordedVideoUrl;
        }

        // Prefer a direct download without navigating away
        try {
          const fetched = await fetch(videoUrl, { mode: "cors" });
          const finalBlob = await fetched.blob();
          const objectUrl = URL.createObjectURL(finalBlob);
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = `diwali-postcard-${Date.now()}.mp4`;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
          console.log("✅ Video download triggered");
        } catch (dlErr) {
          console.warn("⚠️ Direct download failed, opening in new tab:", dlErr);
          window.open(videoUrl, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        console.error("❌ Failed to download/open video:", error);
        // Fallback: open original video in new tab
        window.open(recordedVideoUrl, "_blank", "noopener,noreferrer");
      } finally {
        setDownloading(false);
      }
    }
  };

  // Build standardized social URL: https://res.cloudinary.com/<host>/video/upload/f_mp4,q_auto:best/v{version}/diwali-postcards/videos/{filename}.mp4
  const buildSocialUrl = (url?: string | null) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const filename = parsed.pathname.split("/").pop() || "";
      const hostname = parsed.hostname; // includes cloud name like dsol5tcu0
      // Try to extract version from the path: /v12345/
      const versionMatch = parsed.pathname.match(/\/v(\d+)\//);
      const versionSegment = versionMatch ? `/v${versionMatch[1]}` : "";
      const transform = "f_mp4,q_auto:best";
      return `${parsed.protocol}//${hostname}/video/upload/${transform}${versionSegment}/diwali-postcards/videos/${filename}`;
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

  const shareToWhatsApp = () => {
    if (cloudinaryVideoUrl) {
      const message = "Check out my festive Diwali postcard video! 🎆✨";

      // Track WhatsApp sharing
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Share", {
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "WhatsApp",
        });
      }

      // Track with Google Tag Manager
      if (typeof window !== "undefined" && (window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: "social_share",
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "WhatsApp",
        });
      }

      // Add WhatsApp-optimized transformations to the Cloudinary URL
      // This ensures the video is in a format WhatsApp can handle
      const optimizedUrl = cloudinaryVideoUrl.replace(
        "/upload/",
        "/upload/f_mp4,q_auto:best,w_512,h_512,c_fill,ac_mp4,vc_h264,fl_progressive/",
      );

      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message + " " + optimizedUrl)}`;
      window.open(whatsappUrl, "_blank");
    } else if (recordedVideoUrl) {
      // Track WhatsApp sharing
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Share", {
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "WhatsApp",
        });
      }

      // Fallback to local video URL if Cloudinary upload is not ready
      const message = "Check out my festive Diwali postcard video! ���✨";
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message + " " + recordedVideoUrl)}`;
      window.open(whatsappUrl, "_blank");
    } else {
      alert("Please generate a video first before sharing to WhatsApp.");
    }
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
    if (cloudinaryVideoUrl) {
      // Track Facebook sharing
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Share", {
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "Facebook",
        });
      }

      const message = "Check out my festive Diwali postcard video! 🎆✨";
      const socialUrl =
        buildSocialUrl(cloudinaryVideoUrl) || cloudinaryVideoUrl;
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(socialUrl)}&quote=${encodeURIComponent(message)}`;
      window.open(facebookUrl, "_blank");
    }
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
    if (cloudinaryVideoUrl) {
      // Track link copying
      if (typeof window !== "undefined" && (window as any).fbq) {
        (window as any).fbq("track", "Share", {
          content_name: "Diwali Postcard Video",
          content_category: "Social Sharing",
          method: "Copy Link",
        });
      }

      try {
        const socialUrl =
          buildSocialUrl(cloudinaryVideoUrl) || cloudinaryVideoUrl;
        await navigator.clipboard.writeText(socialUrl);
        alert("Video link copied to clipboard! You can now paste it anywhere.");
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = cloudinaryVideoUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        alert("Video link copied to clipboard!");
      }
    }
  };

  const generate = async () => {
    if (!photoData || !selectedDish || !consent) return;
    setLoading(true);
    setResult(null);
    setGenerationStep(0);
    setGenerationProgress(0);

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
      // Simulate progress through generation steps with slower animation
      for (let i = 0; i < GENERATION_STEPS.length; i++) {
        setGenerationStep(i);
        setIsFading(false);

        // Calculate progress percentage with smoother increments
        const stepProgress = ((i + 1) / GENERATION_STEPS.length) * 70; // 70% for steps, 30% for API call
        setGenerationProgress(stepProgress);

        // Add delay between steps for better UX (slower)
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Fade out current step
        setIsFading(true);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Animate progress from 70% to 90% over 1.5 seconds
      const animateTo90 = () => {
        return new Promise<void>((resolve) => {
          let progress = 70;
          const increment = 20 / 30; // 20% over 30 steps (1.5 seconds at 50ms intervals)
          const interval = setInterval(() => {
            progress += increment;
            if (progress >= 90) {
              progress = 90;
              clearInterval(interval);
              resolve();
            }
            setGenerationProgress(progress);
          }, 50); // 50ms intervals for smooth animation
        });
      };

      await animateTo90();

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personImageBase64: photoData,
          dishImageUrl: selectedDish.image,
          background: bg,
          greeting,
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();

      // Animate progress from 90% to 100% over 1.5 seconds
      const animateTo100 = () => {
        return new Promise<void>((resolve) => {
          let progress = 90;
          const increment = 10 / 30; // 10% over 30 steps (1.5 seconds at 50ms intervals)
          const interval = setInterval(() => {
            progress += increment;
            if (progress >= 100) {
              progress = 100;
              clearInterval(interval);
              resolve();
            }
            setGenerationProgress(progress);
          }, 50); // 50ms intervals for smooth animation
        });
      };

      await animateTo100();

      // Small delay to ensure progress bar animation completes
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      alert(
        e?.message ||
          "Failed to generate. Configure FAL_KEY in env and try again.",
      );
    } finally {
      setLoading(false);
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
                  {photoData ? (
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
                  />
                  <Button
                    type="button"
                    className="mt-4 bg-orange-600 hover:bg-orange-700"
                    onClick={() => {
                      setUploadError(null);
                      fileRef.current?.click();
                    }}
                  >
                    Choose File
                  </Button>
                </div>
                {/* Optimization status */}
                {isOptimizing && (
                  <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <p className="text-blue-700 text-sm font-medium">
                        Optimizing image with TinyPNG...
                      </p>
                    </div>
                  </div>
                )}

                {/* Optimization result */}
                {optimizationResult && (
                  <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-2 h-2 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <p className="text-green-700 text-sm font-medium">
                        Image optimized successfully!
                      </p>
                    </div>
                    <div className="text-xs text-green-600 space-y-1">
                      <p>
                        Original:{" "}
                        {(
                          optimizationResult.originalSize /
                          (1024 * 1024)
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                      <p>
                        Optimized:{" "}
                        {(
                          optimizationResult.optimizedSize /
                          (1024 * 1024)
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                      <p className="font-semibold">
                        Saved: {optimizationResult.compressionRatio.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}

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
                  disabled={true}
                  className="flex-1 h-12 bg-gray-500 hover:bg-gray-600 text-white"
                  onClick={() => setStep(step - 1)}
                >
                  �� Previous
                </Button>
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
                      // Try to play video on click
                      const video = videoRefs.current[b.id];
                      if (video) {
                        video.play().catch(() => {
                          console.log(
                            `Could not play video on click: ${b.video}`,
                          );
                        });
                      }
                    }}
                    className={cn(
                      "group overflow-hidden rounded-xl border h-28 relative bg-gradient-to-br from-orange-100 to-amber-200",
                      bg === b.id
                        ? "ring-2 ring-orange-500 border-orange-500"
                        : "border-orange-200",
                    )}
                  >
                    <video
                      ref={(el) => {
                        videoRefs.current[b.id] = el;
                      }}
                      src={b.video}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      autoPlay
                      playsInline
                      preload="metadata"
                      onLoadStart={() => {
                        console.log(`Loading video: ${b.video}`);
                        setVideoLoading((prev) => ({ ...prev, [b.id]: true }));
                      }}
                      onLoadedData={() => {
                        console.log(`Video data loaded: ${b.video}`);
                        setVideoLoading((prev) => ({ ...prev, [b.id]: false }));
                        setVideoError((prev) => ({ ...prev, [b.id]: false }));
                      }}
                      onCanPlay={() => {
                        console.log(`Video can play: ${b.video}`);
                        setVideoError((prev) => ({ ...prev, [b.id]: false }));
                      }}
                      onPlay={() => {
                        console.log(`Video playing: ${b.video}`);
                      }}
                      onError={(e) => {
                        console.error(`Video error for ${b.video}:`, e);
                        setVideoLoading((prev) => ({ ...prev, [b.id]: false }));
                        setVideoError((prev) => ({ ...prev, [b.id]: true }));
                      }}
                    />
                    {/* Loading indicator */}
                    {videoLoading[b.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {/* Fallback content when video fails to load */}
                    {videoError[b.id] && (
                      <div className="absolute inset-0 flex items-center justify-center text-4xl bg-gradient-to-br from-orange-200 to-amber-300">
                        {b.fallback}
                      </div>
                    )}
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
                          resultData?.background_video ||
                          selectedBackground.video
                        }
                        className="absolute inset-0 w-full h-full object-cover rounded-lg"
                        autoPlay
                        loop
                        muted
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
                          className="w-full absolute bottom-2 md:bottom-6 left-0 right-0 flex justify-center"
                          style={{ zIndex: 1002 }}
                        >
                          <div className="text-white py-2 rounded-lg text-center max-w-[95%] md:max-w-[90%]">
                            <p className="text-xl md:text-2xl font-semibold leading-tight">
                              {greeting}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* Manual Recording Controls */}
              {!recordedVideoUrl && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-4 px-6 py-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                    {!isRecording ? (
                      <Button
                        onClick={startRecording}
                        className="h-12 px-6 bg-red-600 hover:bg-red-700 text-white"
                        disabled={!result}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                          <span>Start Recording</span>
                        </div>
                      </Button>
                    ) : (
                      <Button
                        onClick={stopRecording}
                        className="h-12 px-6 bg-gray-600 hover:bg-gray-700 text-white"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-white rounded-sm"></div>
                          <span>Stop Recording</span>
                        </div>
                      </Button>
                    )}

                    {isRecording && (
                      <div className="text-sm text-orange-700">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span>
                            Recording: {recordingProgress.toFixed(1)}s
                          </span>
                          {recordingProgress < 2 && (
                            <span className="text-xs text-orange-600">
                              (Min: 2s)
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-500 mt-2">
                    <p>
                      Click "Start Recording" to begin, then "Stop Recording"
                      when finished
                    </p>
                    <p>
                      Like the{" "}
                      <a
                        href="https://dmnsgn.github.io/canvas-record/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:underline"
                      >
                        canvas-record demo
                      </a>
                    </p>
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-blue-700">
                      <p className="font-medium">⏱️ Recording Tips</p>
                      <p className="text-xs">
                        • Record for at least 2 seconds for best results
                      </p>
                      <p className="text-xs">
                        • Longer recordings create smoother videos
                      </p>
                    </div>
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-700">
                      <p className="font-medium">📱 Maximum Compatibility</p>
                      <p className="text-xs">
                        Videos are optimized for maximum compatibility (512x512,
                        15fps, H.264 Baseline)
                      </p>
                    </div>
                  </div>

                  {/* Video Generation Error */}
                  {videoGenerationError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">!</span>
                        </div>
                        <span className="font-medium">
                          Video Generation Issue
                        </span>
                      </div>
                      <p className="text-sm mt-1">{videoGenerationError}</p>
                      <button
                        onClick={() => {
                          setVideoGenerationError(null);
                          setRecordedVideoUrl(null);
                          setCanvasRecorder(null);
                        }}
                        className="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}

                 
                </div>
              )}

              

              {/* Upload Progress Indicator */}
              {downloading && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg mb-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Uploading video to Cloudinary...
                  </div>
                  <div className="text-xs text-gray-500">
                    This may take a few moments depending on video size.
                  </div>
                </div>
              )}

              {videoUploading && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Uploading video to cloud...
                  </div>
                </div>
              )}

              

              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <Button
                  type="button"
                  className="h-11 px-6 bg-orange-600 text-white hover:bg-orange-700"
                  onClick={recordedVideoUrl ? downloadVideo : startRecording}
                  disabled={isRecording || downloading}
                >
                  {isRecording
                    ? "Recording..."
                    : downloading
                      ? "Uploading to Cloudinary..."
                      : recordedVideoUrl
                        ? "Open Video"
                        : "Start Recording"}
                </Button>
                <Button
                  type="button"
                  className="h-11 px-6 bg-gray-600 text-white hover:bg-gray-700"
                  onClick={() => setShareOpen(true)}
                  disabled={videoUploading}
                >
                  {videoUploading ? "Uploading..." : "Quick Share"}
                </Button>
                <Button
                  type="button"
                  className="h-11 px-6 border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={() => {
                    setResult(null);
                    setResultData(null);
                    setStep(0);
                    setRecordedVideoUrl(null);
                    setCloudinaryVideoUrl(null);
                  }}
                >
                  Generate again
                </Button>

                <Button
                  onClick={copyVideoLink}
                  className="h-11 px-6 bg-blue-500 hover:bg-blue-600 text-white text-sm"
                >
                  Copy Video URL
                </Button>
              </div>

              {/* Social Sharing Modal */}
              <Dialog open={shareOpen} onOpenChange={setShareOpen}>
                <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                        <source src={cloudinaryVideoUrl || recordedVideoUrl || ""} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                    {/* Instagram */}
                    <Button onClick={shareToInstagram} className="h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                      <div className="flex flex-col items-center">
                        <span className="text-lg">📷</span>
                        <span className="text-xs font-medium">Instagram</span>
                      </div>
                    </Button>
                    
                    {/* WhatsApp */}
                    <Button onClick={shareToWhatsApp} className="h-12 bg-green-500 hover:bg-green-600 text-white">
                      <div className="flex flex-col items-center">
                        <span className="text-lg">💬</span>
                        <span className="text-xs font-medium">WhatsApp</span>
                      </div>
                    </Button>
                   
                    {/* Facebook */}
                    <Button onClick={shareToFacebook} className="h-12 bg-blue-600 hover:bg-blue-700 text-white">
                      <div className="flex flex-col items-center">
                        <span className="text-lg">👥</span>
                        <span className="text-xs font-medium">Facebook</span>
                      </div>
                    </Button>
                   
                  </div>

                  <div className="text-center">
                    <Button onClick={copyVideoLink} className="h-10 px-6 bg-gray-600 hover:bg-gray-700 text-white">
                      📋 Copy Video Link
                    </Button>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="text-sm text-orange-700">
                      💡 <strong>Tip:</strong> For Instagram and TikTok, download the video first, then upload it to the app!
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
