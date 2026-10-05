import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Navigate, Route, Routes } from "react-router";
import { convex } from "@/auth/convexClient";
import { AppLayout } from "@/components/AppLayout";
import { StudioPassphraseGate } from "@/components/StudioPassphraseGate";
import {
  ImagePage,
  LibraryPage,
  MusicPage,
  SettingsPage,
  StoryboardPage,
  VideoPage,
} from "@/pages";

/**
 * Ace Studio, no personal accounts: one team passphrase, then straight into
 * the Video room. The passphrase sign-in creates the shared studio owner row
 * server-side, so there is no public bootstrap mutation any more.
 */
export function PublicAppRoutes() {
  return (
    <ConvexAuthProvider client={convex}>
      <StudioPassphraseGate>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<VideoPage />} />
            <Route path="/storyboard" element={<StoryboardPage />} />
            <Route path="/image" element={<ImagePage />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </StudioPassphraseGate>
    </ConvexAuthProvider>
  );
}
