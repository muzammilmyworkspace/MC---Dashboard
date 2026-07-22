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

  // Preview-only role switcher to demo the permission matrix
  viewAs: Role;
  setViewAs: (r: Role) => void;

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

      viewAs: "super_admin",
      setViewAs: (r) => set({ viewAs: r }),

      sections: defaultSections,
      setSections: (s) => set({ sections: s }),
      resetSections: () => set({ sections: defaultSections }),

      expanded: { muzammil: true, hashaam: true, future: true },
      toggleSection: (k) => set((s) => ({ expanded: { ...s.expanded, [k]: !s.expanded[k] } })),
    }),
    {
      name: "mc-nexus-ui-v3",
      partialize: (s) => ({ collapsed: s.collapsed, viewAs: s.viewAs, sections: s.sections, expanded: s.expanded }),
    }
  )
);
