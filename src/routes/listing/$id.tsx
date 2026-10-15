import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Gavel, MapPin, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatINR, timeLeft, whatsappLink, type Listing } from "@/lib/market";
import { ListingImage } from "@/components/ListingCard";
import { useSession } from "@/components/AppHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/listing/$id")({
  head: () => ({
    meta: [
      { title: "Listing — RDX Market" },
      { name: "description", content: "View item details, contact the seller on WhatsApp, or place a bid." },
      { property: "og:title", content: "Listing — RDX Market" },
      { property: "og:description", content: "View item details and contact the seller." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const { userId } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [bidAmount, setBidAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as Listing | null;
    },
  });

  const { data: highestBid } = useQuery({
    queryKey: ["highest-bid", id],
    enabled: listing?.type === "bid",
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("highest_bid", { _listing_id: id });
      if (error) throw error;
      return data as number | null;
    },
  });

  const { data: sellerPhone } = useQuery({
    queryKey: ["seller-phone", listing?.owner_id],
    enabled: !!listing && listing.status === "approved",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("seller_phone", { _seller_id: listing!.owner_id });
      if (error) throw error;
      return data as string | null;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`listing-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bids", filter: `listing_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["highest-bid", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "listings", filter: `id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["listing", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const ended = useMemo(
    () => (listing?.bid_deadline ? new Date(listing.bid_deadline).getTime() <= now : false),
    [listing, now],
  );

  if (isLoading) return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  if (!listing)
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">Listing not found</p>
        <p className="mt-1 text-sm text-muted-foreground">It may be pending review or was removed.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/buy" })}>
          Browse listings
        </Button>
      </div>
    );

  const currentHigh = highestBid ?? listing.price ?? 0;

  const placeBid = async () => {
    if (!userId) {
      toast.error("Sign in to place a bid");
      navigate({ to: "/auth" });
      return;
    }
    const amount = Number(bidAmount);
    if (!amount || amount <= 0) return void toast.error("Enter a valid amount");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("place_bid", { _listing_id: id, _amount: amount });
      if (error) throw new Error(error.message);
      toast.success("Bid placed!");
      setBidAmount("");
      queryClient.invalidateQueries({ queryKey: ["highest-bid", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bid failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <ListingImage path={listing.photos[0]} alt={listing.title} className="aspect-[4/3] w-full rounded-xl" />
          {listing.photos.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {listing.photos.slice(1, 5).map((p) => (
                <ListingImage key={p} path={p} alt={listing.title} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{listing.category}</Badge>
            {listing.type === "donate" && <Badge>FREE</Badge>}
            {listing.type === "bid" && <Badge variant="outline">Auction</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold">{listing.title}</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {listing.location}
          </p>

          {listing.type === "sell" && (
            <p className="mt-4 text-3xl font-extrabold text-accent">{formatINR(listing.price)}</p>
          )}
          {listing.type === "donate" && (
            <p className="mt-4 text-2xl font-extrabold text-accent">Free donation</p>
          )}

          {listing.type === "bid" && (
            <div className="mt-4 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Starting price</p>
                  <p className="font-bold">{formatINR(listing.price)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Highest bid</p>
                  <p className="text-xl font-extrabold text-accent">
                    {highestBid != null ? formatINR(highestBid) : "No bids yet"}
                  </p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1 text-sm font-medium">
                <Clock className="h-4 w-4" />
                {listing.bid_deadline && !ended
                  ? `Ends in ${timeLeft(listing.bid_deadline, now)}`
                  : "Bidding ended"}
              </p>
              {ended && highestBid != null && (
                <p className="mt-2 rounded-md bg-secondary px-3 py-2 text-sm font-semibold">
                  Final winning bid: {formatINR(highestBid)}
                </p>
              )}
              {!ended && listing.status === "approved" && (
                <div className="mt-3 flex gap-2">
                  <Input
                    type="number"
                    min={currentHigh + 1}
                    placeholder={`More than ${formatINR(currentHigh)}`}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                  />
                  <Button disabled={busy} onClick={placeBid}>
                    <Gavel className="mr-1 h-4 w-4" /> Bid
                  </Button>
                </div>
              )}
            </div>
          )}

          <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {listing.description}
          </p>

          {listing.status === "approved" && sellerPhone && userId !== listing.owner_id && (
            <a href={whatsappLink(sellerPhone, listing.title)} target="_blank" rel="noreferrer">
              <Button className="mt-6 w-full sm:w-auto" size="lg">
                <MessageCircle className="mr-2 h-5 w-5" /> Contact on WhatsApp
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
