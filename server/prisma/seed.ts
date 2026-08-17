/**
 * Seeds the workspace: team, the full July content plan and integration rows.
 * The July plan is imported from the frontend content module so there is a
 * single source of truth for content.
 *
 * Run: npm run db:seed   (after `npm run db:push`)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, Platform, ContentStatus, PostType, ReviewStatus } from "@prisma/client";
import { julyPlans } from "../../src/lib/july.js";

const prisma = new PrismaClient();

const PASSWORD = process.env.SEED_PASSWORD ?? "MainCharacter#2026";

const toPlatform = (v: string) => v.toUpperCase() as Platform;
const toStatus = (v: string) => v.toUpperCase() as ContentStatus;
const toPostType = (v: string) => v.toUpperCase() as PostType;
const toReviewStatus = (v: string) => v.toUpperCase() as ReviewStatus;

const seedUsers = [
  { key: "u_muz", email: "muzammil.myworkspace@gmail.com", name: "Muzammil", role: "TEAM" as const, title: "Marketing Lead", avatarColor: "#2456d6" },
  { key: "u_hash", email: "hashaamzafar999@gmail.com", name: "Hashaam", role: "TEAM" as const, title: "Creative", avatarColor: "#475569" },
  { key: "u_client", email: "onyema@maincharacter.nl", name: "Onyema", role: "CLIENT" as const, title: "Client · Reviewer", avatarColor: "#16a34a" },
];

async function main() {
  console.log("→ seeding users…");
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const userIdByKey = new Map<string, string>();

  for (const u of seedUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, passwordHash, role: u.role, title: u.title, avatarColor: u.avatarColor },
      update: { name: u.name, role: u.role, title: u.title, avatarColor: u.avatarColor },
    });
    userIdByKey.set(u.key, user.id);
  }
  console.log(`  ✔ ${seedUsers.length} users`);

  console.log("→ seeding July content plan…");
  const creatorId = userIdByKey.get("u_hash")!;

  for (const plan of julyPlans) {
    const date = new Date(`${plan.date}T00:00:00.000Z`);

    // Replace any previous version of this day so the seed is idempotent.
    await prisma.dayPlan.deleteMany({ where: { date } });

    const created = await prisma.dayPlan.create({
      data: {
        date,
        goal: plan.goal,
        purpose: plan.purpose,
        primaryPlatform: toPlatform(plan.primaryPlatform),
        postingTime: plan.time,
        status: toStatus(plan.status),
        gradient: plan.gradient,
        emoji: plan.emoji,
        cta: plan.cta,
        captionNl: plan.captionNl,
        hashtags: plan.hashtags,
        storyIdeas: plan.storyIdeas,
        createdById: creatorId,
        captions: {
          create: Object.entries(plan.captions).map(([platform, text]) => ({
            platform: toPlatform(platform),
            text: text as string,
          })),
        },
        reel: {
          create: {
            topic: plan.reel.topic,
            hook: plan.reel.hook,
            script: plan.reel.script,
            bRoll: plan.reel.bRoll,
            closingCta: plan.reel.closingCta,
            thumbnailConcept: plan.reel.thumbnailConcept,
            editorNotes: plan.reel.editorNotes,
          },
        },
        ...(plan.post
          ? {
              post: {
                create: {
                  type: toPostType(plan.post.type),
                  topic: plan.post.topic,
                  imageConcept: plan.post.imageConcept,
                  photographyDirection: plan.post.photographyDirection,
                  graphicText: plan.post.graphicText,
                  designerNotes: plan.post.designerNotes,
                  slides: plan.post.slides ?? null,
                },
              },
            }
          : {}),
      },
    });

    if (plan.reviews?.length) {
      await prisma.review.createMany({
        data: plan.reviews.map((r) => ({
          dayPlanId: created.id,
          authorId: userIdByKey.get(r.author) ?? creatorId,
          status: toReviewStatus(r.status),
          comment: r.comment,
          createdAt: new Date(r.at),
        })),
      });
    }
  }
  console.log(`  ✔ ${julyPlans.length} day plans`);

  console.log("→ seeding integrations…");
  const { providerList } = await import("../src/services/integrations/registry.js");
  const connectedKeys = new Set([
    "meta-graph", "instagram-graph", "facebook-graph", "google-ads",
    "ga4", "search-console", "workspace", "youtube", "cloudinary", "google-drive", "openai", "smtp",
  ]);

  for (const p of providerList) {
    const connected = connectedKeys.has(p.key);
    await prisma.integration.upsert({
      where: { key: p.key },
      create: {
        key: p.key, name: p.name, category: p.category, scopes: p.scopes,
        status: connected ? "CONNECTED" : "NOT_CONNECTED",
        health: connected ? "HEALTHY" : "UNKNOWN",
        lastSyncAt: connected ? new Date() : null,
      },
      update: { name: p.name, category: p.category, scopes: p.scopes },
    });
  }
  console.log(`  ✔ ${providerList.length} integrations`);

  console.log("→ seeding notifications…");
  const adminId = userIdByKey.get("u_muz")!;
  await prisma.notification.deleteMany({ where: { userId: adminId } });
  await prisma.notification.createMany({
    data: [
      { userId: adminId, title: "Content approved", body: "Onyema approved the July 23 signature-story reel.", tone: "SUCCESS" },
      { userId: adminId, title: "New comment", body: "Onyema left a note on the 3-part framework reel.", tone: "ACCENT" },
      { userId: adminId, title: "Changes requested", body: "Workshop 'last seats' reel needs a clearer end card.", tone: "WARNING" },
    ],
  });

  console.log("\n✅ Seed complete.\n");
  console.log("   Sign in with any of:");
  for (const u of seedUsers) console.log(`     ${u.email.padEnd(34)} ${PASSWORD}   (${u.role})`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("\n✖ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
