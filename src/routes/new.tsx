import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, normalizeIndianPhone, uploadPhoto, type ListingType } from "@/lib/market";
import { getDeviceId } from "@/lib/access";
import { useSession } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Search = { type?: ListingType };

export const Route = createFileRoute("/new")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    type: s["type"] === "donate" || s["type"] === "bid" ? (s["type"] as ListingType) : "sell",
  }),
  head: () => ({
    meta: [
      { title: "Create a listing — RDX Market" },
      { name: "description", content: "Sell, donate or auction an item on RDX Market." },
      { property: "og:title", content: "Create a listing — RDX Market" },
      { property: "og:description", content: "Sell, donate or auction an item." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewListingPage,
});

const TITLES: Record<ListingType, string> = {
  sell: "Sell an item",
  donate: "Donate an item (free)",
  bid: "Start an auction",
};

function NewListingPage() {
  const { type = "sell" } = Route.useSearch();
  const navigate = useNavigate();
  const { userId, loading } = useSession();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string>("");
  const [location, setLocation] = useState("");
  const [deadline, setDeadline] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  // Profile fields (only needed the first time this account posts something)
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pAddress, setPAddress] = useState("");
  const [pAvatar, setPAvatar] = useState<File | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (loading || (userId && profileLoading))
    return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  if (!userId)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">Sign in to create a listing</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>
          Go to sign in
        </Button>
      </div>
    );

  // First time posting? Create the profile here (browsing and bidding never need one).
  const createProfile = async () => {
    const digits = normalizeIndianPhone(pPhone);
    if (!pName.trim()) return void toast.error("Please enter your name");
    if (!digits) return void toast.error("Enter a valid Indian mobile number");
    if (!pAddress.trim()) return void toast.error("Please enter your address");
    setBusy(true);
    try {
      let avatarPath: string | null = null;
      if (pAvatar) avatarPath = await uploadPhoto(userId, pAvatar);
      const { error } = await supabase.from("profiles").insert({
        id: userId,
        name: pName.trim(),
        address: pAddress.trim(),
        phone: digits,
        device_id: getDeviceId(),
        avatar_path: avatarPath,
      });
      if (error) throw error;
      localStorage.setItem("rdx_device_registered", "1");
      toast.success("Profile created — now post your listing!");
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create profile");
    } finally {
      setBusy(false);
    }
  };

  if (!profile)
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>Create your profile first</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You only need a profile to post a listing. Browsing and bidding don't need one.
            </p>
            <div className="space-y-2">
              <Label htmlFor="pname">Full name</Label>
              <Input id="pname" value={pName} onChange={(e) => setPName(e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pphone">Mobile number</Label>
              <Input id="pphone" value={pPhone} onChange={(e) => setPPhone(e.target.value)} inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paddr">Address (kept private)</Label>
              <Textarea id="paddr" value={pAddress} onChange={(e) => setPAddress(e.target.value)} rows={2} maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label>Profile photo (optional)</Label>
              <input type="file" accept="image/*" className="text-sm" onChange={(e) => setPAvatar(e.target.files?.[0] ?? null)} />
            </div>
            <Button className="w-full" disabled={busy} onClick={createProfile}>
              {busy ? "Saving…" : "Create profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  const submit = async () => {
    if (!title.trim()) return void toast.error("Add a title");
    if (!category) return void toast.error("Pick a category");
    if (!location.trim()) return void toast.error("Add your general location (e.g. area, city)");
    const priceNum = type === "donate" ? null : Number(price);
    if (type !== "donate" && (!priceNum || priceNum <= 0))
      return void toast.error(type === "bid" ? "Add a valid starting price" : "Add a valid price");
    if (type === "bid") {
      if (!deadline) return void toast.error("Set a bidding deadline");
      if (new Date(deadline).getTime() <= Date.now())
        return void toast.error("Deadline must be in the future");
    }
    if (files.length === 0) return void toast.error("Add at least one photo");

    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files.slice(0, 6)) paths.push(await uploadPhoto(userId, f));
      const { error } = await supabase.from("listings").insert({
        owner_id: userId,
        type,
        title: title.trim().slice(0, 120),
        description: description.trim().slice(0, 2000),
        price: priceNum,
        category,
        location: location.trim().slice(0, 120),
        photos: paths,
        bid_deadline: type === "bid" ? new Date(deadline).toISOString() : null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Listing submitted! It will appear once an admin approves it.");
      navigate({ to: "/my-listings" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create listing");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{TITLES[type]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Photos (up to 6)</Label>
            <input
              type="file"
              accept="image/*"
              multiple
              className="text-sm"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 6))}
            />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs">
                    {f.name.slice(0, 18)}
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={2000} />
          </div>
          {type !== "donate" && (
            <div className="space-y-2">
              <Label htmlFor="price">{type === "bid" ? "Starting price (₹)" : "Price (₹)"}</Label>
              <Input id="price" type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          )}
          {type === "bid" && (
            <div className="space-y-2">
              <Label htmlFor="deadline">Bidding deadline</Label>
              <Input
                id="deadline"
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc">Location (general area, shown publicly)</Label>
            <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Salt Lake, Kolkata" maxLength={120} />
          </div>
          <Button className="w-full" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "Submit for approval"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Every listing is reviewed by an admin before it goes live.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
