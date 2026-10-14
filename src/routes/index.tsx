import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Gavel, Gift, ShoppingBag, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/market";
import { ListingCard } from "@/components/ListingCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RDX Market — Buy, Sell, Donate & Bid" },
      { name: "description", content: "Your local marketplace: sell items, donate for free, auction with timed bidding, and buy from neighbours." },
      { property: "og:title", content: "RDX Market — Buy, Sell, Donate & Bid" },
      { property: "og:description", content: "Your local marketplace: sell, donate, auction and buy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const PORTALS = [
  { to: "/new", search: { type: "sell" }, icon: Tag, title: "Sell", desc: "List your item with photos and a price." },
  { to: "/new", search: { type: "donate" }, icon: Gift, title: "Donate", desc: "Give items away for free to someone nearby." },
  { to: "/new", search: { type: "bid" }, icon: Gavel, title: "Auction", desc: "Start a timed bidding battle for your item." },
  { to: "/buy", search: undefined, icon: ShoppingBag, title: "Buy", desc: "Browse approved listings and contact sellers." },
] as const;

function Index() {
  const queryClient = useQueryClient();
  const { data: latest } = useQuery({
    queryKey: ["latest-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as unknown as Listing[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("home-listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["latest-listings"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div>
      <section className="hero-glow border-b">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Buy, Sell, Donate &amp; <span className="text-primary">Bid</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            RDX Market connects neighbours. List in seconds, chat on WhatsApp, and win timed auctions.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {PORTALS.map((p) => (
            <Link
              key={p.title}
              to={p.to}
              search={p.search as never}
              className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="gold-plate flex h-11 w-11 items-center justify-center rounded-xl">
                <p.icon className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-lg font-bold">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Fresh listings</h2>
          <Link to="/buy" className="text-sm font-semibold text-accent hover:underline">
            Browse all →
          </Link>
        </div>
        {latest && latest.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {latest.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            No approved listings yet — be the first to sell, donate or auction something!
          </p>
        )}
      </section>
    </div>
  );
}
