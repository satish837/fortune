import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocationState {
  email: string;
  name: string;
  phone: string;
  handle?: string;
}

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userData, setUserData] = useState<LocationState | null>(null);

  useEffect(() => {
    // Get user data from location state
    const state = location.state as LocationState;
    if (!state?.email) {
      // If no email in state, redirect back to home
      navigate('/');
      return;
    }
    setUserData(state);
  }, [location.state, navigate]);

  useEffect(() => {
    // Start resend cooldown timer
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData?.email,
          otp: otp,
          name: userData?.name,
          phone: userData?.phone,
          handle: userData?.handle
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // OTP verified successfully
        localStorage.setItem('authToken', data.token || 'verified');
        localStorage.setItem('userData', JSON.stringify(userData));
        navigate('/create');
      } else {
        setError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    setResendLoading(true);
    setError("");

    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData?.email,
          name: userData?.name
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendCooldown(60); // 60 seconds cooldown
        setError(""); // Clear any previous errors
      } else {
        setError(data.error || 'Failed to resend OTP. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-orange-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="w-full max-w-md mx-auto px-6">
        <div className="bg-white/80 backdrop-blur rounded-2xl p-8 shadow-xl border border-orange-200">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-orange-900 mb-2">Verify Your Email</h1>
            <p className="text-orange-700">
              We've sent a 6-digit verification code to
            </p>
            <p className="text-orange-900 font-semibold">{userData.email}</p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="otp">Enter Verification Code</Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(value);
                  setError("");
                }}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
                maxLength={6}
                required
              />
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base bg-orange-600 hover:bg-orange-700"
              disabled={loading || otp.length !== 6}
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </Button>

            <div className="text-center">
              <p className="text-sm text-orange-700 mb-2">
                Didn't receive the code?
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleResendOTP}
                disabled={resendLoading || resendCooldown > 0}
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                {resendLoading
                  ? "Sending..."
                  : resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend OTP"
                }
              </Button>
            </div>

            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-orange-600 hover:text-orange-700"
              >
                ← Back to Login
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
