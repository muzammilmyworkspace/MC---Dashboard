import { InstagramOAuthPanel } from "@/components/instagram/oauth-panel";
import { InstagramDailyReport } from "@/components/instagram/daily-report";
import { InstagramDashboard } from "@/components/instagram/instagram-dashboard";

/**
 * Instagram, in the order a client reads it: connection, then how the
 * audience is changing, then how the content performed.
 */
export default function Page() {
  return (
    <div className="space-y-8">
      <InstagramOAuthPanel />
      <InstagramDailyReport />
      <InstagramDashboard />
    </div>
  );
}
