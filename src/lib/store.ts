import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Role } from "./data";

interface UIState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;

  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  mobileNavOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;

  // Session
  authed: boolean;
  viewAs: Role;
  setViewAs: (r: Role) => void;
  signIn: (r: Role) => void;
  signOut: () => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (v) => set({ collapsed: v }),

      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),

      mobileNavOpen: false,
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),

      authed: false,
      viewAs: "team",
      setViewAs: (r) => set({ viewAs: r }),
      signIn: (r) => set({ authed: true, viewAs: r }),
      signOut: () => set({ authed: false }),
    }),
    {
      // v5: the task-section layout was removed with the Muzammil/Hashaam
      // sidebar. Bumping the key also clears any `authed: true` left over
      // from the old mock login, which used to let the UI look signed in
      // while the API had never issued a token.
      name: "mc-nexus-ui-v5",
      partialize: (s) => ({
        collapsed: s.collapsed,
        viewAs: s.viewAs,
        authed: s.authed,
      }),
    }
  )
);
