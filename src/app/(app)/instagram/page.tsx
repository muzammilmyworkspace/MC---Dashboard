import { InstagramOAuthPanel } from "@/components/instagram/oauth-panel";
import { InstagramAnalytics } from "@/components/instagram/analytics/analytics-screen";

/**
 * Instagram, in the order a client reads it: the connection, then the
 * performance centre.
 *
 * The old daily-report and dashboard blocks are gone rather than sitting
 * alongside this: all three drew the same follower chart from three separate
 * code paths, and keeping them in step by hand had already failed once —
 * a correction to the unfollow wording landed in one and not the others.
 */
export default function Page() {
  return (
    <div className="space-y-8">
      <InstagramOAuthPanel />
      <InstagramAnalytics />
    </div>
  );
}
