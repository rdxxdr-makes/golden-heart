import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { formatINR, signedPhotoUrl, type Listing } from "@/lib/market";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function ListingImage({ path, alt, className }: { path: string | undefined; alt: string; className?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let on = true;
    if (path) signedPhotoUrl(path).then((u) => on && setUrl(u));
    return () => {
      on = false;
    };
  }, [path]);
  if (!path || !url)
    return (
      <div className={`flex items-center justify-center bg-secondary text-muted-foreground ${className ?? ""}`}>
        No photo
      </div>
    );
  return <img src={url} alt={alt} className={`object-cover ${className ?? ""}`} loading="lazy" />;
}

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link to="/listing/$id" params={{ id: listing.id }}>
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
        <ListingImage
          path={listing.photos[0]}
          alt={listing.title}
          className="aspect-[4/3] w-full"
        />
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 font-semibold">{listing.title}</h3>
            <Badge variant={listing.type === "donate" ? "secondary" : "default"} className="shrink-0">
              {listing.type === "donate" ? "FREE" : listing.type === "bid" ? "Auction" : formatINR(listing.price)}
            </Badge>
          </div>
          {listing.type !== "donate" && listing.type === "bid" && (
            <p className="mt-1 text-sm font-medium text-accent">
              Starts at {formatINR(listing.price)}
            </p>
          )}
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {listing.location}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
