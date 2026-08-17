"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Search, PanelLeftClose, PanelLeftOpen, GripVertical, PackageOpen, ChevronDown, X } from "lucide-react";
import {
  pinnedForRole,
  sectionActions,
  sectionMeta,
  sectionsForRole,
  itemFor,
  type NavItem,
  type SectionKey,
  type SidebarSections,
} from "@/lib/nav";
import { useUI } from "@/lib/store";
import { useTasks, priorityMeta } from "@/lib/tasks";
import { Logo, LogoMark } from "@/components/brand/logo";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ---------------- Desktop rail ---------------- */
export function Sidebar() {
  const { collapsed, toggleCollapsed } = useUI();
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 276 }}
      transition={{ type: "spring", stiffness: 280, damping: 32 }}
      className="sticky top-0 z-30 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex"
    >
      <SidebarBody collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={toggleCollapsed}
          className={cn("flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-xs font-medium text-sidebar-muted transition-colors hover:bg-white/[0.05] hover:text-white", collapsed && "justify-center px-0")}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Collapse sidebar</span>}
        </button>
      </div>
    </motion.aside>
  );
}

/* ---------------- Mobile drawer ---------------- */
export function MobileSidebar() {
  const { mobileNavOpen, setMobileNavOpen } = useUI();
  return (
    <AnimatePresence>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute inset-y-0 left-0 flex w-[86%] max-w-[300px] flex-col bg-sidebar text-sidebar-foreground shadow-2xl"
          >
            <button onClick={() => setMobileNavOpen(false)} className="absolute right-3 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-sidebar-muted hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
            <SidebarBody collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Shared body ---------------- */
function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { setCommandOpen, viewAs, expanded, toggleSection } = useUI();
  const [sections, setSections] = useState<SidebarSections>(() => useUI.getState().sections);
  const [activeId, setActiveId] = useState<string | null>(null);
  const tasks = useTasks((s) => s.tasks);
  const visibleKeys = sectionsForRole(viewAs);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function findContainer(id: string): SectionKey | undefined {
    if (id in sections) return id as SectionKey;
    return (Object.keys(sections) as SectionKey[]).find((k) => sections[k].includes(id));
  }
  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeC = findContainer(String(active.id));
    const overC = findContainer(String(over.id));
    if (!activeC || !overC || activeC === overC) return;
    setSections((prev) => {
      const overItems = prev[overC];
      const overIndex = overItems.indexOf(String(over.id));
      const insertAt = overIndex >= 0 ? overIndex : overItems.length;
      return {
        ...prev,
        [activeC]: prev[activeC].filter((i) => i !== String(active.id)),
        [overC]: [...overItems.slice(0, insertAt), String(active.id), ...overItems.slice(insertAt)],
      };
    });
  }
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeC = findContainer(String(active.id));
    const overC = findContainer(String(over.id));
    if (!activeC || !overC) return;
    let next = sections;
    if (activeC === overC) {
      const items = sections[activeC];
      const from = items.indexOf(String(active.id));
      const to = items.indexOf(String(over.id));
      if (from !== to && to >= 0) { next = { ...sections, [activeC]: arrayMove(items, from, to) }; setSections(next); }
    }
    useUI.getState().setSections(next);
    toast.success("Sidebar updated", { description: "Your task layout was saved." });
  }
  const activeItem = activeId ? itemFor(activeId) : null;

  return (
    <>
      {/* Header */}
      <div className={cn("flex h-16 items-center border-b border-sidebar-border px-5", collapsed && "justify-center px-0")}>
        {collapsed ? <LogoMark size={28} className="text-white" /> : <Logo size={30} tone="light" />}
      </div>

      {/* Search */}
      <div className={cn("px-3 pt-4", collapsed && "flex justify-center px-0")}>
        {collapsed ? (
          <Tooltip content="Search ( ⌘K )">
            <button onClick={() => setCommandOpen(true)} className="flex size-10 items-center justify-center rounded-xl border border-sidebar-border text-sidebar-muted transition-colors hover:border-accent/50 hover:text-white">
              <Search className="size-[18px]" />
            </button>
          </Tooltip>
        ) : (
          <button onClick={() => setCommandOpen(true)} className="flex h-10 w-full items-center gap-2.5 rounded-xl border border-sidebar-border bg-white/[0.02] px-3.5 text-sm text-sidebar-muted transition-colors hover:border-accent/50 hover:text-white">
            <Search className="size-4" /> <span>Search…</span>
            <kbd className="ml-auto rounded-md border border-sidebar-border px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
          </button>
        )}
      </div>

      {/* Pinned — fixed, never scrolls away */}
      <div className="space-y-1 px-3 pt-3">
        {pinnedForRole(viewAs).map((item) => (
          <StaticRow key={item.href} item={item} active={pathname === item.href} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>

      {/* Scrollable task sections */}
      <nav className="no-scrollbar mt-2 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {collapsed ? (
          <div className="space-y-1">
            <div className="mx-auto my-2 h-px w-8 bg-sidebar-border" />
            {visibleKeys.flatMap((k) => sections[k]).map((href) => (
              <StaticRow key={href} item={itemFor(href)} active={pathname === href} collapsed onNavigate={onNavigate} />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
            {visibleKeys.map((key) => {
              const meta = sectionMeta.find((s) => s.key === key)!;
              const open = !!activeId || expanded[key];
              const action = sectionActions[key];
              const sectionTasks = tasks.filter((t) => t.section === key);
              return (
                <DroppableSection
                  key={key}
                  id={key}
                  title={meta.title}
                  count={sections[key].length + sectionTasks.length}
                  open={open}
                  onToggle={() => toggleSection(key)}
                >
                  {action && (
                    <Link
                      href={action.href}
                      onClick={onNavigate}
                      className={cn(
                        "mb-1 flex h-9 items-center gap-2.5 rounded-lg border border-dashed border-sidebar-border px-3 text-sm font-medium transition-colors",
                        pathname === action.href ? "border-accent/40 bg-sidebar-active text-white" : "text-sidebar-muted hover:border-accent/40 hover:text-white"
                      )}
                    >
                      <action.icon className="size-[16px]" /> {action.label}
                    </Link>
                  )}

                  <SortableContext items={sections[key]} strategy={verticalListSortingStrategy}>
                    {sections[key].map((href) => (
                      <SortableRow key={href} href={href} active={pathname === href} dragging={activeId === href} onNavigate={onNavigate} />
                    ))}
                  </SortableContext>

                  {sectionTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/add-task?id=${t.id}`}
                      onClick={onNavigate}
                      className="group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-sidebar-muted transition-colors hover:bg-white/[0.05] hover:text-white"
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: priorityMeta[t.priority].color }} />
                      <span className="flex-1 truncate">{t.title}</span>
                    </Link>
                  ))}

                  {sections[key].length === 0 && sectionTasks.length === 0 && (
                    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-sidebar-border/80 px-3 py-6 text-center">
                      <PackageOpen className="size-5 text-sidebar-muted/70" />
                      <p className="text-xs text-sidebar-muted">Drop tasks here for future planning.</p>
                    </div>
                  )}
                </DroppableSection>
              );
            })}
            <DragOverlay>
              {activeItem ? (
                <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-sidebar-elevated px-3 py-2.5 text-sm font-medium text-white shadow-glow">
                  <activeItem.icon className="size-[18px] text-accent" /> {activeItem.label}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </nav>
    </>
  );
}

function DroppableSection({ id, title, count, open, onToggle, children }: { id: SectionKey; title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="space-y-1.5">
      <button onClick={onToggle} className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted transition-colors hover:text-sidebar-foreground">
        <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }}><ChevronDown className="size-3" /></motion.span>
        <span className="flex-1 text-left">{title}</span>
        <span className="rounded-full bg-white/5 px-1.5 text-[10px] font-medium">{count}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <div ref={setNodeRef} className={cn("space-y-0.5 rounded-xl transition-colors", isOver && "bg-white/[0.03] ring-1 ring-accent/25")}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableRow({ href, active, dragging, onNavigate }: { href: string; active: boolean; dragging: boolean; onNavigate?: () => void }) {
  const item = itemFor(href);
  const Icon = item.icon;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: href });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <Link
      ref={setNodeRef}
      href={href}
      onClick={onNavigate}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex h-10 touch-none items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "bg-sidebar-active text-white ring-1 ring-accent/25" : "text-sidebar-muted hover:bg-white/[0.05] hover:text-white",
        (isDragging || dragging) && "opacity-40"
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
      <Icon className={cn("size-[18px] shrink-0", active && "text-accent")} />
      <span className="flex-1 truncate">{item.label}</span>
      <GripVertical className="size-4 text-sidebar-muted/50 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function StaticRow({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const inner = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active ? "bg-sidebar-active text-white ring-1 ring-accent/25" : "text-sidebar-muted hover:bg-white/[0.05] hover:text-white",
        collapsed && "justify-center px-0"
      )}
    >
      {active && !collapsed && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" />}
      <Icon className={cn("size-[18px] shrink-0", active && "text-accent")} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {collapsed && item.badge ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" /> : null}
    </Link>
  );
  return <Tooltip content={item.label} hidden={!collapsed}>{inner}</Tooltip>;
}
