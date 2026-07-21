import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Role } from "./data";

interface UIState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;

  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;

  // Preview-only role switcher to demo the permission matrix
  viewAs: Role;
  setViewAs: (r: Role) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (v) => set({ collapsed: v }),

      commandOpen: false,
      setCommandOpen: (v) => set({ commandOpen: v }),

      viewAs: "super_admin",
      setViewAs: (r) => set({ viewAs: r }),
    }),
    { name: "nexus-ui", partialize: (s) => ({ collapsed: s.collapsed, viewAs: s.viewAs }) }
  )
);
