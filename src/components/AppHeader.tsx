import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Menu, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/functions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";

export function useSession() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { userId, loading };
}

export function useMyRoles(userId: string | null) {
  return useQuery({
    queryKey: ["my-roles", userId],
    enabled: !!userId,
    queryFn: async () => (await getMyRoles()).roles,
  });
}

const NAV = [
  { to: "/buy", label: "Buy" },
  { to: "/new", label: "Sell", search: { type: "sell" } },
  { to: "/new", label: "Donate", search: { type: "donate" } },
  { to: "/new", label: "Auction", search: { type: "bid" } },
  { to: "/my-listings", label: "My Listings" },
] as const;

export function AppHeader() {
  const { userId } = useSession();
  const roles = useMyRoles(userId);
  const isAdmin = roles.data?.includes("admin") ?? false;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/" });
  };

  const links = (
    <>
      {NAV.map((item) => (
        <Link
          key={item.label}
          to={item.to}
          {...("search" in item ? { search: item.search } : {})}
          className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
          onClick={() => setOpen(false)}
        >
          {item.label}
        </Link>
      ))}
      {isAdmin && (
        <Link
          to="/admin"
          className="rounded-md px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-secondary"
          onClick={() => setOpen(false)}
        >
          Admin
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="gold-plate flex h-8 w-8 items-center justify-center rounded-lg">
            <Store className="h-4 w-4" />
          </span>
          RDX Market
        </Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex">{links}</nav>
        <div className="ml-auto flex items-center gap-2">
          {userId ? (
            <>
              <Link to="/profile" className="hidden text-sm font-medium text-foreground/80 hover:text-foreground sm:block">
                Profile
              </Link>
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/auth" })}>
              Sign in
            </Button>
          )}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" aria-label="Menu">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <nav className="mt-6 flex flex-col gap-1">{links}</nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
