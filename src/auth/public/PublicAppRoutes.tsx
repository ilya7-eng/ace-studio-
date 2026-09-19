import { ConvexProvider, useMutation } from "convex/react";
import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router";
import { convex } from "@/auth/convexClient";
import { AppLayout } from "@/components/AppLayout";
import {
  ImagePage,
  LibraryPage,
  MusicPage,
  SettingsPage,
  StoryboardPage,
  VideoPage,
} from "@/pages";
import { api } from "../../../convex/_generated/api";

/** No login: make sure the shared studio owner row exists before any query. */
function StudioBootstrap() {
  const ensure = useMutation(api.studio.ensure);
  useEffect(() => {
    ensure().catch(err => console.error("studio bootstrap failed", err));
  }, [ensure]);
  return null;
}

/** Ace Studio, no accounts: land straight in the Video room. */
export function PublicAppRoutes() {
  return (
    <ConvexProvider client={convex}>
      <StudioBootstrap />
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
    </ConvexProvider>
  );
}
