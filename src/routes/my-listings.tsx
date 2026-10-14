import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, formatINR, type Listing } from "@/lib/market";
import { ListingImage } from "@/components/ListingCard";
import { useSession } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/my-listings")({
  head: () => ({
    meta: [
      { title: "My listings — RDX Market" },
      { name: "description", content: "Manage your listings: edit, delete, or mark as sold." },
      { property: "og:title", content: "My listings — RDX Market" },
      { property: "og:description", content: "Manage your listings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyListingsPage,
});

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  approved: "bg-accent text-accent-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  sold: "bg-muted text-muted-foreground",
};

function MyListingsPage() {
  const { userId, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Listing | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["my-listings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("owner_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Listing[];
    },
  });

  if (loading) return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  if (!userId)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">Sign in to manage your listings</p>
        <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
      </div>
    );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["my-listings", userId] });

  const remove = async (l: Listing) => {
    if (!confirm(`Delete "${l.title}"?`)) return;
    const { error } = await supabase.from("listings").delete().eq("id", l.id);
    if (error) return void toast.error(error.message);
    toast.success("Listing deleted");
    refresh();
  };

  const toggleSold = async (l: Listing) => {
    const next = l.status === "sold" ? "approved" : "sold";
    const { error } = await supabase.from("listings").update({ status: next }).eq("id", l.id);
    if (error) return void toast.error(error.message);
    toast.success(next === "sold" ? "Marked as sold" : "Marked as available");
    refresh();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      // Material edits to an approved listing send it back for re-approval.
      const backToPending = editing.status === "approved";
      const { error } = await supabase
        .from("listings")
        .update({
          title: editing.title.slice(0, 120),
          description: editing.description.slice(0, 2000),
          price: editing.price,
          category: editing.category,
          location: editing.location.slice(0, 120),
          ...(backToPending ? { status: "pending" as const } : {}),
        })
        .eq("id", editing.id);
      if (error) throw error;
      toast.success(backToPending ? "Saved — sent back for admin approval" : "Saved");
      setEditing(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-extrabold">My listings</h1>
      {isLoading ? (
        <p className="mt-8 text-center text-muted-foreground">Loading…</p>
      ) : !listings || listings.length === 0 ? (
        <p className="mt-8 rounded-xl border bg-card p-8 text-center text-muted-foreground">
          You haven't listed anything yet.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {listings.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <ListingImage path={l.photos[0]} alt={l.title} className="h-16 w-20 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.type === "donate" ? "Free donation" : formatINR(l.price)} · {l.category}
                  </p>
                  {l.status === "rejected" && l.rejection_reason && (
                    <p className="mt-1 text-xs text-destructive">Reason: {l.rejection_reason}</p>
                  )}
                </div>
                <Badge className={STATUS_STYLE[l.status]}>{l.status.toUpperCase()}</Badge>
                <div className="flex gap-2">
                  {(l.status === "approved" || l.status === "sold") && (
                    <Button size="sm" variant="outline" onClick={() => toggleSold(l)}>
                      {l.status === "sold" ? "Mark available" : "Mark sold"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditing(l)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(l)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit listing</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              {editing.type !== "donate" && (
                <div className="space-y-1">
                  <Label>{editing.type === "bid" ? "Starting price (₹)" : "Price (₹)"}</Label>
                  <Input
                    type="number"
                    value={editing.price ?? ""}
                    onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) || null })}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
              </div>
              {editing.status === "approved" && (
                <p className="text-xs text-muted-foreground">
                  Saving changes to an approved listing sends it back for admin re-approval.
                </p>
              )}
              <Button className="w-full" disabled={busy} onClick={saveEdit}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
