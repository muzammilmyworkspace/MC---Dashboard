import { InstagramDashboard } from "@/components/instagram/instagram-dashboard";
import { InstagramOAuthPanel } from "@/components/instagram/oauth-panel";

/**
 * Two independent connections to the same account, deliberately kept apart:
 * the OAuth panel is the interactive Meta login, the dashboard below is the
 * System User token sync that owns the daily follower history.
 */
export default function Page() {
  return (
    <div className="space-y-6">
      <InstagramOAuthPanel />
      <InstagramDashboard />
    </div>
  );
}
