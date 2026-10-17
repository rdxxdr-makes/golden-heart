import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, normalizeIndianPhone, uploadPhoto, type Listing } from "@/lib/market";
import { ListingImage } from "@/components/ListingCard";
import { useMyRoles, useSession } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — RDX Market" },
      { name: "description", content: "Review and manage listings and users." },
      { property: "og:title", content: "Admin — RDX Market" },
      { property: "og:description", content: "Review and manage listings and users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

interface Profile {
  id: string;
  name: string;
  phone: string;
  address: string;
  avatar_path: string | null;
  created_at: string;
}

function EditProfileDialog({ user, onSaved }: { user: Profile; onSaved: () => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [address, setAddress] = useState(user.address);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const digits = normalizeIndianPhone(phone);
    if (!name.trim()) return void toast.error("Name is required");
    if (!digits) return void toast.error("Enter a valid Indian mobile number");
    if (!address.trim()) return void toast.error("Address is required");
    setBusy(true);
    try {
      let avatarPath = user.avatar_path;
      if (avatar) avatarPath = await uploadPhoto(user.id, avatar);
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim(), phone: digits, address: address.trim(), avatar_path: avatarPath })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <ListingImage path={user.avatar_path ?? undefined} alt="Profile photo" className="h-16 w-16 rounded-full" />
        <input type="file" accept="image/*" className="text-sm" onChange={(e) => setAvatar(e.target.files?.[0] ?? null)} />
      </div>
      <div className="space-y-2">
        <Label>Full name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label>Mobile number</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={300} />
      </div>
      <Button className="w-full" disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
    </>
  );
}

function AdminPage() {
  const { userId, loading } = useSession();
  const roles = useMyRoles(userId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const isAdmin = roles.data?.includes("admin") ?? false;

  const { data: listings, refetch } = useQuery({
    queryKey: ["admin-listings"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Listing[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, phone, address, avatar_path, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Profile[];
    },
  });

  if (loading || (userId && roles.isLoading))
    return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  if (!userId)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">Sign in required</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">Admins only</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account does not have admin access.
        </p>
      </div>
    );

  const act = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) throw new Error(error.message);
      toast.success(ok);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["buy-listings"] });
      queryClient.invalidateQueries({ queryKey: ["latest-listings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const approve = (l: Listing) =>
    act(() => supabase.from("listings").update({ status: "approved", rejection_reason: null }).eq("id", l.id), "Approved");
  const reject = (l: Listing) =>
    act(
      () =>
        supabase
          .from("listings")
          .update({ status: "rejected", rejection_reason: reasons[l.id]?.trim() || null })
          .eq("id", l.id),
      "Rejected",
    );
  const setStatus = (l: Listing, status: string) =>
    act(() => supabase.from("listings").update({ status: status as Listing["status"] }).eq("id", l.id), "Status updated");
  const remove = (l: Listing) => {
    if (!confirm(`Delete "${l.title}" permanently?`)) return;
    return act(() => supabase.from("listings").delete().eq("id", l.id), "Deleted");
  };

  const pending = (listings ?? []).filter((l) => l.status === "pending");

  const renderRow = (l: Listing, withReason: boolean) => (
    <Card key={l.id}>
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <ListingImage path={l.photos[0]} alt={l.title} className="h-16 w-20 rounded-lg" />
        <div className="min-w-0 flex-1">
          <Link to="/listing/$id" params={{ id: l.id }} className="truncate font-semibold hover:underline">
            {l.title}
          </Link>
          <p className="text-sm text-muted-foreground">
            {l.type} · {l.type === "donate" ? "FREE" : formatINR(l.price)} · {l.category} · {l.location}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{l.description}</p>
        </div>
        <Badge variant="secondary">{l.status.toUpperCase()}</Badge>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {l.status === "pending" && (
            <>
              <Button size="sm" disabled={busy} onClick={() => approve(l)}>
                <Check className="mr-1 h-4 w-4" /> Approve
              </Button>
              {withReason && (
                <Input
                  className="w-40"
                  placeholder="Reject reason (optional)"
                  value={reasons[l.id] ?? ""}
                  onChange={(e) => setReasons({ ...reasons, [l.id]: e.target.value })}
                />
              )}
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => reject(l)}>
                <X className="mr-1 h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {l.status !== "pending" && (
            <Select value={l.status} onValueChange={(v) => setStatus(l, v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pending", "approved", "rejected", "sold"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => remove(l)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-extrabold">Admin dashboard</h1>
      <Tabs defaultValue="pending" className="mt-6">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="all">All listings ({listings?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="users">Users ({users?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
              Nothing waiting for review. 🎉
            </p>
          ) : (
            pending.map((l) => renderRow(l, true))
          )}
        </TabsContent>
        <TabsContent value="all" className="mt-4 space-y-3">
          {(listings ?? []).map((l) => renderRow(l, false))}
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Registered users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(users ?? []).map((u) => (
                <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-muted-foreground">{u.address}</p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">+{u.phone}</p>
                  <Button size="sm" variant="outline" onClick={() => setEditing(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editing && (
              <EditProfileDialog
                user={editing}
                onSaved={() => {
                  setEditing(null);
                  queryClient.invalidateQueries({ queryKey: ["admin-users"] });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
