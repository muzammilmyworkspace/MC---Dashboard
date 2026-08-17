import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Role } from "./data";
import { defaultSections, type SidebarSections, type SectionKey } from "./nav";

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

  // Draggable sidebar task layout (persisted)
  sections: SidebarSections;
  setSections: (s: SidebarSections) => void;
  resetSections: () => void;

  // Collapsible sidebar groups (persisted)
  expanded: Record<SectionKey, boolean>;
  toggleSection: (k: SectionKey) => void;
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

      sections: defaultSections,
      setSections: (s) => set({ sections: s }),
      resetSections: () => set({ sections: defaultSections }),

      expanded: { muzammil: true, hashaam: true, future: true },
      toggleSection: (k) => set((s) => ({ expanded: { ...s.expanded, [k]: !s.expanded[k] } })),
    }),
    {
      name: "mc-nexus-ui-v4",
      partialize: (s) => ({
        collapsed: s.collapsed,
        viewAs: s.viewAs,
        sections: s.sections,
        expanded: s.expanded,
        authed: s.authed,
      }),
    }
  )
);
