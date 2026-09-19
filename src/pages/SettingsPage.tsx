import { Github, Moon, Palette, Sun } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";

const REPO_URL = "https://github.com/ilya7-eng/ace-studio-";

/** Ace Studio has no accounts, so Settings is appearance plus where the code lives. */
export function SettingsPage() {
  const { theme, toggleTheme, switchable } = useTheme();

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          No login, no accounts. Everything you render lands in the shared
          Library.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4 text-muted-foreground" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {switchable ? (
            <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
                  {theme === "light" ? (
                    <Moon className="size-5 text-foreground" />
                  ) : (
                    <Sun className="size-5 text-foreground" />
                  )}
                </div>
                <div>
                  <Label htmlFor="dark-mode" className="font-medium">
                    Dark mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Easier on the eyes in the edit bay
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground px-4 py-2">
              Theme follows your system preference
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="size-4 text-muted-foreground" />
            Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline underline-offset-4 hover:text-primary"
          >
            {REPO_URL.replace("https://", "")}
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
