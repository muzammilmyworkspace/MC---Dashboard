/* ------------------------------------------------------------------ *
 *  MC Nexus — Profile & workspace settings (persisted locally,
 *  ready to sync with /api/users + /api/workspace in Phase 2).
 * ------------------------------------------------------------------ */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const languages = [
  { value: "en", label: "English" },
  { value: "nl", label: "Nederlands (Dutch)" },
] as const;

export const timezones = [
  "Europe/Amsterdam",
  "Europe/London",
  "Europe/Berlin",
  "UTC",
  "America/New_York",
  "Asia/Karachi",
  "Asia/Dubai",
] as const;

export interface NotificationPrefs {
  contentApproved: boolean;
  changesRequested: boolean;
  newComment: boolean;
  upcomingPost: boolean;
  weeklySummary: boolean;
  emailDigest: boolean;
}

export interface Profile {
  name: string;
  title: string;
  email: string;
  avatarColor: string;
  language: string;
  timezone: string;
}

export interface Workspace {
  name: string;
  clientName: string;
  weekStartsMonday: boolean;
  defaultPostTime: string;
}

interface SettingsStore {
  profile: Profile;
  notifications: NotificationPrefs;
  workspace: Workspace;
  setProfile: (p: Partial<Profile>) => void;
  setNotifications: (n: Partial<NotificationPrefs>) => void;
  setWorkspace: (w: Partial<Workspace>) => void;
}

export const avatarPalette = ["#2456d6", "#16a34a", "#d97706", "#e5484d", "#475569", "#0f766e", "#7c3aed", "#0ea5e9"];

const defaults = {
  profile: {
    name: "Muzammil",
    title: "Marketing Lead",
    email: "muzammil.myworkspace@gmail.com",
    avatarColor: "#2456d6",
    language: "en",
    timezone: "Europe/Amsterdam",
  } satisfies Profile,
  notifications: {
    contentApproved: true,
    changesRequested: true,
    newComment: true,
    upcomingPost: true,
    weeklySummary: false,
    emailDigest: false,
  } satisfies NotificationPrefs,
  workspace: {
    name: "MC Nexus",
    clientName: "Main Character",
    weekStartsMonday: true,
    defaultPostTime: "18:00",
  } satisfies Workspace,
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaults,
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      setNotifications: (n) => set((s) => ({ notifications: { ...s.notifications, ...n } })),
      setWorkspace: (w) => set((s) => ({ workspace: { ...s.workspace, ...w } })),
    }),
    { name: "mc-nexus-settings-v1" }
  )
);

export const settingsDefaults = defaults;
