import { useConvexAuth } from "convex/react";
import {
  ArrowRight,
  Clapperboard,
  Image as ImageIcon,
  Music,
} from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

type LandingPageViewProps = {
  isAuthenticated: boolean;
  isLoading: boolean;
  showAuthActions: boolean;
};

const studios = [
  {
    icon: Clapperboard,
    name: "Video",
    text: "Cinematic 3 to 12 second shots with synced sound, from text or from your own photo. LTX-2.5 on our private engine.",
  },
  {
    icon: ImageIcon,
    name: "Image",
    text: "Stills, posters and thumbnails in three aspect ratios. Fast draft or best quality.",
  },
  {
    icon: Music,
    name: "Music",
    text: "Instrumental beds and full songs with lyrics from our in-house ACE-Step engine. Zero licensing.",
  },
];

function LandingPageView({
  isAuthenticated,
  isLoading,
  showAuthActions,
}: LandingPageViewProps) {
  return (
    <div className="flex-1 flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Eli Ace Studios · private
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Ace Studio
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Our own video, image and music engines behind one door. Type a
            prompt, get a shot. Everything you make lands in the Library.
          </p>
          {showAuthActions && !isLoading && (
            <div className="pt-2">
              <Button size="lg" className="text-base h-11 px-6" asChild>
                <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                  {isAuthenticated ? "Open the studio" : "Sign in"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto mt-16 w-full">
          {studios.map(s => (
            <div key={s.name} className="rounded-2xl border p-6 bg-card">
              <s.icon className="size-5 mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-1">{s.name}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function LandingPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  return (
    <LandingPageView
      isAuthenticated={isAuthenticated}
      isLoading={isLoading}
      showAuthActions
    />
  );
}
