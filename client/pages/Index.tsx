import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BarChart3 } from "lucide-react";

interface FormState {
  name: string;
  email: string;
  phone: string;
  handle?: string;
  acceptTerms: boolean;
}

const JSON_CONTENT_TYPE = /application\/json/i;

async function readJsonBody<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    return null;
  }

  try {
    const raw = await response.clone().text();
    if (!raw?.trim()) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error("Failed to parse JSON response", error);
    return null;
  }
}

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

export default function Index() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    handle: "",
    acceptTerms: false,
  });
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [existingUserEmail, setExistingUserEmail] = useState("");
  const [existingUserLoading, setExistingUserLoading] = useState(false);
  const [existingUserError, setExistingUserError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("userProfile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as FormState;
        setForm(parsed);
      } catch {}
    }
    setReady(true);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) return;
    if (!form.acceptTerms) {
      alert("Please accept the Terms and Conditions to continue");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email,
          name: form.name,
        }),
      });

      const data = await readJsonBody<{ error?: string }>(response);

      if (response.ok) {
        navigate("/verify-otp", {
          state: {
            email: form.email,
            name: form.name,
            phone: form.phone,
            handle: form.handle,
          },
        });
      } else {
        alert(data?.error || "Failed to send OTP. Please try again.");
      }
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onExistingUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existingUserEmail) return;

    setExistingUserLoading(true);
    try {
      // Check if user exists and send OTP
      const response = await fetch("/api/existing-user-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: existingUserEmail,
        }),
      });

      const data = await readJsonBody<{
        error?: string;
        userData?: {
          name: string;
          email: string;
          phone: string;
          handle?: string;
        };
      }>(response);

      if (response.ok && data?.userData) {
        navigate("/verify-otp", {
          state: {
            email: data.userData.email,
            name: data.userData.name,
            phone: data.userData.phone,
            handle: data.userData.handle,
            isExistingUser: true,
          },
        });
      } else {
        setExistingUserError(
          data?.error ||
            "User not found or failed to send OTP. Please try again.",
        );
      }
    } catch (error) {
      console.error("Existing user OTP error:", error);
      setExistingUserError("Network error. Please try again.");
    } finally {
      setExistingUserLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full md:w-[80%] mx-auto px-6 py-10 grid md:grid-cols-2 gap-10 items-center">
        <div className="space-y-6 text-center">
          <div className="inline-flex justify-center items-center">
            <img src="/fortune-logo.png" alt="logo" className="w-217 h-73" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-orange-900 leading-tight">
            Create Your Diwali Postcard And Celebrate With
          </h1>
          <div className="text-orange-800/80 max-w-xl">
            <img
              src="/home-diwali-logo.png"
              alt="diwali-postcard"
              width={200}
              height={136}
              className="mx-auto"
            />
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur rounded-2xl p-8 shadow-xl border border-orange-200">
          {/* Toggle Buttons */}
          <div className="flex mb-6 bg-orange-50 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setIsExistingUser(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isExistingUser
                  ? "bg-orange-600 text-white"
                  : "text-orange-600 hover:bg-orange-100"
              }`}
            >
              New User
            </button>
            <button
              type="button"
              onClick={() => setIsExistingUser(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isExistingUser
                  ? "bg-orange-600 text-white"
                  : "text-orange-600 hover:bg-orange-100"
              }`}
            >
              Existing User
            </button>
          </div>

          {/* New User Form */}
          {!isExistingUser && (
            <form onSubmit={onSubmit} className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Your name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email ID</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                  placeholder="+91 90000 00000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="handle">Instagram/Facebook ID (optional)</Label>
                <Input
                  id="handle"
                  value={form.handle}
                  onChange={(e) => setForm({ ...form, handle: e.target.value })}
                  placeholder="@yourhandle"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="acceptTerms"
                  checked={form.acceptTerms}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, acceptTerms: checked as boolean })
                  }
                />
                <label htmlFor="acceptTerms" className="text-sm text-gray-700">
                  I accept the{" "}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="text-orange-600 hover:text-orange-700 underline"
                      >
                        Terms and Conditions
                      </button>
                    </DialogTrigger>
                    <DialogContent
                      className="max-w-4xl max-h-[80vh] overflow-y-auto"
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
                </label>
              </div>
              <Button
                className="mt-2 h-12 text-base bg-orange-600 hover:bg-orange-700"
                disabled={loading}
              >
                {loading ? "Sending OTP..." : "Let's Begin →"}
              </Button>
            </form>
          )}

          {/* Existing User Form */}
          {isExistingUser && (
            <form onSubmit={onExistingUserSubmit} className="grid gap-5">
              <div className="text-center mb-4">
                <h3 className="text-lg font-semibold text-orange-900 mb-2">
                  Welcome Back!
                </h3>
                <p className="text-sm text-gray-600">
                  Enter your email to receive OTP
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="existingEmail">Email ID</Label>
                <Input
                  id="existingEmail"
                  type="email"
                  value={existingUserEmail}
                  onChange={(e) => {
                    setExistingUserEmail(e.target.value);
                    if (existingUserError) setExistingUserError("");
                  }}
                  required
                  placeholder="you@example.com"
                />
                {existingUserError && (
                  <div className="text-red-600 text-sm mt-1">
                    {existingUserError}
                  </div>
                )}
              </div>
              <Button
                className="mt-2 h-12 text-base bg-orange-600 hover:bg-orange-700"
                disabled={existingUserLoading}
              >
                {existingUserLoading ? "Sending OTP..." : "Send OTP →"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
