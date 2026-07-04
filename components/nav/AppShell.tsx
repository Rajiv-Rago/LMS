"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { ChevronRight, PanelLeft } from "lucide-react";
import { BreadcrumbContext, type Crumb } from "@/components/nav/breadcrumbs";
import { NotificationBell } from "@/components/ui/NotificationBell";
import ThemeToggle from "@/components/ui/ThemeToggle";
import BottomNav from "@/components/ui/BottomNav";

const navigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Explore", href: "/explore" },
  { name: "My Courses", href: "/courses" },
  { name: "Profile", href: "/profile" },
  { name: "Settings", href: "/settings" },
];

// The authenticated sidebar shell, shared by the dashboard and public layouts so
// logged-in users get the same chrome on /explore and /courses/[id].
export default function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null };
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [desktopHidden, setDesktopHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [resizing, setResizing] = useState(false);

  // Load persisted sidebar prefs after mount — reading localStorage during
  // render would mismatch the server-rendered HTML.
  useEffect(() => {
    const w = Number(localStorage.getItem("sidebar-width"));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (w) setSidebarWidth(w);
    setDesktopHidden(localStorage.getItem("sidebar-hidden") === "1");
  }, []);

  const toggleDesktopSidebar = () => {
    setDesktopHidden((hidden) => {
      localStorage.setItem("sidebar-hidden", hidden ? "0" : "1");
      return !hidden;
    });
  };

  const clampWidth = (x: number) => Math.min(400, Math.max(200, x));

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    setResizing(true);
    const move = (ev: PointerEvent) => setSidebarWidth(clampWidth(ev.clientX));
    const up = (ev: PointerEvent) => {
      setResizing(false);
      localStorage.setItem("sidebar-width", String(clampWidth(ev.clientX)));
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleLogout = async () => {
    await signOut({ redirect: false, redirectTo: "/login" });
    router.push("/login");
    router.refresh();
  };

  return (
    <BreadcrumbContext.Provider value={setCrumbs}>
    <div
      className="min-h-screen bg-zinc-50 dark:bg-zinc-950"
      style={
        {
          "--sidebar-w": desktopHidden ? "0px" : `${sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[200] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          aria-label="Toggle sidebar"
          aria-expanded={sidebarOpen}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-semibold text-zinc-900 dark:text-white">Kantigo</span>
        <div className="w-6" />
      </header>

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        style={{ width: sidebarWidth }}
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transform ${
          resizing ? "" : "transition-transform duration-200 ease-in-out"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} ${
          desktopHidden ? "lg:-translate-x-full" : "lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-800">
            <Link href="/dashboard" className="text-xl font-bold text-zinc-900 dark:text-white">
              Kantigo
            </Link>
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                aria-label="Close sidebar"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto" aria-label="Sidebar navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-200">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Resize handle */}
        <div
          onPointerDown={startResize}
          className="hidden lg:block absolute inset-y-0 -right-1 w-2 cursor-col-resize hover:bg-indigo-400/40"
          aria-hidden="true"
        />
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main
        id="main-content"
        className={`lg:pl-[var(--sidebar-w)] pt-14 lg:pt-0 pb-16 lg:pb-0 ${
          resizing ? "" : "lg:transition-[padding-left] lg:duration-200"
        }`}
      >
        {/* Desktop top bar with sidebar toggle */}
        <div className="hidden lg:flex sticky top-0 z-30 h-12 items-center border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4">
          <button
            onClick={toggleDesktopSidebar}
            className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label="Toggle sidebar"
            aria-expanded={!desktopHidden}
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          {crumbs.length > 0 && (
            <>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-3" />
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-2 text-sm min-w-0"
              >
                {crumbs.map((crumb, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                    )}
                    {crumb.href && i < crumbs.length - 1 ? (
                      <Link
                        href={crumb.href}
                        className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 truncate"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="font-medium text-zinc-900 dark:text-white truncate">
                        {crumb.label}
                      </span>
                    )}
                  </Fragment>
                ))}
              </nav>
            </>
          )}
        </div>
        <div className="p-4 lg:p-6">{children}</div>
      </main>

      <BottomNav />
    </div>
    </BreadcrumbContext.Provider>
  );
}
