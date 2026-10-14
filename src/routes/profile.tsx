import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeIndianPhone, uploadPhoto } from "@/lib/market";
import { ListingImage } from "@/components/ListingCard";
import { useSession } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Profile {
  id: string;
  name: string;
  address: string;
  phone: string;
  avatar_path: string | null;
}

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My profile — RDX Market" },
      { name: "description", content: "View and edit your RDX Market profile." },
      { property: "og:title", content: "My profile — RDX Market" },
      { property: "og:description", content: "View and edit your profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Profile | null;
    },
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setAddress(profile.address);
      setPhone(profile.phone);
    }
  }, [profile]);

  if (loading || isLoading) return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  if (!userId)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">Sign in to view your profile</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
      </div>
    );

  const save = async () => {
    const digits = normalizeIndianPhone(phone);
    if (!name.trim()) return toast.error("Name is required");
    if (!digits) return toast.error("Enter a valid Indian mobile number");
    if (!address.trim()) return toast.error("Address is required");
    setBusy(true);
    try {
      let avatarPath = profile?.avatar_path ?? null;
      if (avatar) avatarPath = await uploadPhoto(userId, avatar);
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim(), address: address.trim(), phone: digits, avatar_path: avatarPath })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>My profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <ListingImage
              path={profile?.avatar_path ?? undefined}
              alt="Profile photo"
              className="h-16 w-16 rounded-full"
            />
            <input type="file" accept="image/*" className="text-sm" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Mobile number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
            <p className="text-xs text-muted-foreground">
              Changing your number changes how buyers reach you on WhatsApp.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Address (kept private)</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={300} />
          </div>
          <Button className="w-full" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save profile"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
