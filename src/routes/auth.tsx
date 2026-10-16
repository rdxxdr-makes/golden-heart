import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  authEmailFor,
  authPasswordFor,
  normalizeIndianPhone,
  uploadPhoto,
} from "@/lib/market";
import { redeemPin } from "@/lib/functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Join RDX Market" },
      { name: "description", content: "Register with your name, address and phone to buy, sell, donate and bid." },
      { property: "og:title", content: "Join RDX Market" },
      { property: "og:description", content: "Register to buy, sell, donate and bid." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const DEVICE_KEY = "rdx_device_id";
const DEVICE_DONE_KEY = "rdx_device_registered";
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"register" | "signin" | "pin">("register");
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [pin, setPin] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);

  const [deviceLocked, setDeviceLocked] = useState(false);

  // Already signed in? Go straight to the PIN step (no profile setup again).
  // Device already registered a profile? Only allow sign-in.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMode("pin");
    });
    const locked = () => {
      setDeviceLocked(true);
      setMode((m) => (m === "register" ? "signin" : m));
    };
    if (localStorage.getItem(DEVICE_DONE_KEY)) locked();
    supabase.rpc("device_registered", { _device: getDeviceId() }).then(({ data }) => {
      if (data) locked();
    });
  }, []);

  // Every sign-in / registration continues to the PIN step, which picks the portal.
  const afterAuth = async () => {
    setMode("pin");
  };

  const register = async () => {
    const digits = normalizeIndianPhone(phone);
    if (!name.trim()) return void toast.error("Please enter your name");
    if (!digits) return void toast.error("Enter a valid Indian mobile number");
    if (!address.trim()) return void toast.error("Please enter your address");
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmailFor(digits),
        password: authPasswordFor(digits),
      });
      if (error) {
        if (error.message.toLowerCase().includes("already")) {
          toast.error("This phone number is already registered — please sign in instead.");
          setMode("signin");
          return;
        }
        throw error;
      }
      const user = data.user;
      if (!user) throw new Error("Registration failed, please try again");
      let avatarPath: string | null = null;
      if (avatar) avatarPath = await uploadPhoto(user.id, avatar);
      const { error: pErr } = await supabase.from("profiles").insert({
        id: user.id,
        name: name.trim(),
        address: address.trim(),
        phone: digits,
        avatar_path: avatarPath,
      });
      if (pErr) throw pErr;
      toast.success("Welcome to RDX Market!");
      await afterAuth();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    const digits = normalizeIndianPhone(phone);
    if (!digits) return void toast.error("Enter a valid Indian mobile number");
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmailFor(digits),
        password: authPasswordFor(digits),
      });
      if (error) throw new Error("No account found for this number — please register first.");
      await afterAuth();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const submitPin = async () => {
    if (!pin.trim()) return;
    setBusy(true);
    try {
      const { role } = await redeemPin({ data: { pin: pin.trim() } });
      toast.success(role === "admin" ? "Admin access granted" : "Welcome in!");
      navigate({ to: role === "admin" ? "/admin" : "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      {mode === "pin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Enter your portal PIN</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the access PIN you were given to unlock your portal.
            </p>
            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                autoComplete="off"
              />
            </div>
            <Button className="w-full" disabled={busy} onClick={submitPin}>
              {busy ? "Verifying…" : "Unlock portal"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{mode === "register" ? "Create your account" : "Welcome back"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile number</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                inputMode="tel"
              />
            </div>
            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Address (kept private)</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    maxLength={300}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Profile photo (optional)</Label>
                  <input
                    ref={avatarRef}
                    type="file"
                    accept="image/*"
                    className="text-sm"
                    onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
                  />
                </div>
              </>
            )}
            <Button
              className="w-full"
              disabled={busy}
              onClick={mode === "register" ? register : signIn}
            >
              {busy ? "Please wait…" : mode === "register" ? "Register" : "Sign in"}
            </Button>
            <button
              className="w-full text-center text-sm font-medium text-accent hover:underline"
              onClick={() => setMode(mode === "register" ? "signin" : "register")}
            >
              {mode === "register"
                ? "Already registered? Sign in"
                : "New here? Create an account"}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
