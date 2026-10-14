import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, type Listing, type ListingType } from "@/lib/market";
import { ListingCard } from "@/components/ListingCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/buy")({
  head: () => ({
    meta: [
      { title: "Buy on RDX Market" },
      { name: "description", content: "Browse approved items for sale, free donations and live auctions near you." },
      { property: "og:title", content: "Buy on RDX Market" },
      { property: "og:description", content: "Browse items for sale, donations and auctions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuyPage,
});

function BuyPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["buy-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Listing[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("buy-listings")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["buy-listings"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listings ?? []).filter((l) => {
      if (category !== "all" && l.category !== category) return false;
      if (type !== "all" && l.type !== (type as ListingType)) return false;
      if (q && !`${l.title} ${l.description} ${l.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [listings, search, category, type]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-extrabold">Browse listings</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_160px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search items, locations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="sell">For sale</SelectItem>
            <SelectItem value="donate">Free / Donate</SelectItem>
            <SelectItem value="bid">Auctions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="mt-10 text-center text-muted-foreground">Loading listings…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-10 rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Nothing found. Try a different search or check back soon.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  );
}
