import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Loader2, Lock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/**
 * No personal accounts, but not open to the internet either: one shared team
 * passphrase unlocks the shared studio (Cloudflare audit 2026-10-04, C1). The
 * session is a normal Convex Auth session, so it survives reloads.
 */
export function StudioPassphraseGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (isLoading) return null;
  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card variant="elevated" className="w-full max-w-sm">
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={async e => {
              e.preventDefault();
              setError("");
              setBusy(true);
              const passphrase = String(
                new FormData(e.currentTarget).get("passphrase") ?? "",
              );
              try {
                await signIn("studio_passphrase", { passphrase });
              } catch {
                setError("That passphrase didn't work.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4" /> Ace Studio
            </div>
            <div className="space-y-2">
              <Label htmlFor="passphrase">Studio passphrase</Label>
              <Input
                id="passphrase"
                name="passphrase"
                type="password"
                autoComplete="current-password"
                className="h-11"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
