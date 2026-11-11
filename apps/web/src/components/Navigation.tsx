'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  DoorOpen,
  BookOpen,
  Users2,
  Calendar,
  CalendarDays,
  CalendarClock,
  Printer,
  RotateCcw,
  LogOut,
  Database,
  Layers,
  Search,
  ClipboardList,
  ArrowLeftRight,
  Move,
  ChevronDown,
  Menu,
  SlidersHorizontal,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { api } from '@/lib/api';
import { Drawer } from '@djadwal/ui';

// Navigation Groups Definition
interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface NavGroup {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: 'basic-data',
    title: 'البيانات الأساسية',
    icon: Database,
    items: [
      {
        name: 'الأساتذة',
        href: '/professors',
        icon: Users,
        description: 'إدارة أعضاء هيئة التدريس والرتب والتخصصات',
      },
      {
        name: 'القاعات',
        href: '/rooms',
        icon: DoorOpen,
        description: 'المدرجات، القاعات العادية ومخابر الإعلام الآلي',
      },
      {
        name: 'المقاييس',
        href: '/courses',
        icon: BookOpen,
        description: 'المقررات الدراسية والمعاملات والوحدات التعليمية',
      },
      {
        name: 'الأفواج',
        href: '/groups',
        icon: Users2,
        description: 'الدفعات، الأقسام، والأفواج التخصصية',
      },
    ],
  },
  {
    id: 'schedules',
    title: 'الجداول والجدولة',
    icon: CalendarDays,
    items: [
      {
        name: 'الجدول الزمني',
        href: '/schedule',
        icon: Calendar,
        description: 'جدول التوقيت الأسبوعي العام (تخصص، أستاذ، قاعة)',
      },
      {
        name: 'جداول الأفواج',
        href: '/groups/schedules',
        icon: CalendarDays,
        description: 'جداول التوقيت المخصصة للأفواج ومقارنتها جنباً إلى جنب',
      },
      {
        name: 'الحصص والتكليفات',
        href: '/assignments',
        icon: CalendarClock,
        description: 'إدارة وتوزيع الحصص والتكليفات البيداغوجية والاستيراد الذري',
      },
    ],
  },
  {
    id: 'session-tools',
    title: 'أدوات الحصص',
    icon: SlidersHorizontal,
    items: [
      {
        name: 'القاعات المتاحة',
        href: '/available-rooms',
        icon: Search,
        description: 'كشف الشغور اللحظي للحصص الإضافية والتعويضات',
      },
      {
        name: 'أعباء الأساتذة',
        href: '/professor-workload',
        icon: ClipboardList,
        description: 'كشف الأعباء البيداغوجية وحساب النصاب والساعات الإضافية',
      },
      {
        name: 'تبديل الحصص',
        href: '/sessions/swap',
        icon: ArrowLeftRight,
        description: 'التبادل التوافقي الذري بين حصتين متزامنتين',
      },
      {
        name: 'نقل الحصص',
        href: '/sessions/move',
        icon: Move,
        description: 'نقل حصة إلى توقيت أو قاعة شاغرة بدون تعارض',
      },
      {
        name: 'مركز الطباعة',
        href: '/print',
        icon: Printer,
        description: 'طباعة الجداول والاستعمالات بصيغة A4 رسمية',
      },
    ],
  },
];

// Helper to determine exact active status without subpath collision
function isRouteActive(href: string, currentPath: string): boolean {
  if (href === '/dashboard') {
    return currentPath === '/' || currentPath === '/dashboard';
  }
  if (href === '/groups') {
    return (
      currentPath === '/groups' ||
      (currentPath.startsWith('/groups/') && !currentPath.startsWith('/groups/schedules'))
    );
  }
  if (href === '/sessions') {
    return (
      currentPath === '/sessions' ||
      (currentPath.startsWith('/sessions/') &&
        !currentPath.startsWith('/sessions/swap') &&
        !currentPath.startsWith('/sessions/move'))
    );
  }
  return currentPath.startsWith(href);
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [dbStatus, setDbStatus] = useState<any>({
    status: 'متصل',
    readSource: 'postgres',
    dualWriteTarget: 'Turso (Dual-Write)',
  });

  const [, setAcademicYears] = useState<any[]>([]);
  const [currentYear, setCurrentYear] = useState<string>('2026-2027');
  const [currentSemester, setCurrentSemester] = useState<string>('السداسي الأول');

  // Active dropdown menu ID for desktop
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Mobile Drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
        setMobileDrawerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close dropdown and drawer when pathname changes
  useEffect(() => {
    setActiveDropdown(null);
    setMobileDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    // 1. Fetch DB Status (P6 indicator)
    api.getDatabaseStatus().then(setDbStatus).catch(() => {});

    // 2. Fetch Academic Years from API v1
    api
      .get('/academic/years')
      .then((years) => {
        if (Array.isArray(years) && years.length > 0) {
          setAcademicYears(years);
          const active = years.find((y: any) => y.is_current === 1 || y.is_current === true);
          if (active) setCurrentYear(active.year_name);
        }
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/signout', {});
    } catch (_) {}
    document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = '__Host-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  const isDashboardActive = isRouteActive('/dashboard', pathname);

  return (
    <header className="sticky top-0 z-40 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 shadow-xs transition-all no-print">
      {/* Top Banner: Status & Context Telemetry */}
      <div className="bg-slate-900 text-white px-4 py-1.5 text-xs border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Institution & Active Year */}
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-emerald-400">نظام Djadwal (App Router v1)</span>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">السنة الدراسية:</span>
              <strong className="text-white">{currentYear}</strong>
              <span>-</span>
              <strong className="text-white">{currentSemester}</strong>
            </div>
          </div>

          {/* Database Live Telemetry & Switch to Legacy */}
          <div className="flex items-center gap-3">
            {/* P6 Live Indicator */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-0.5 rounded-full border border-slate-700/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300">قراءة من:</span>
              <span className="font-medium text-emerald-300">Neon PostgreSQL</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">نسخ:</span>
              <span className="text-cyan-300 font-mono text-[11px]">{dbStatus.dualWriteTarget || 'Turso'}</span>
            </div>

            {/* Quick Switch to Legacy UI */}
            <a
              href="/legacy"
              className="inline-flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 px-2.5 py-0.5 rounded-full transition-colors font-medium text-xs"
              title="الانتقال إلى الواجهة السابقة (Vite SPA)"
            >
              <RotateCcw className="h-3 w-3" />
              <span>الواجهة القديمة</span>
            </a>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main SaaS Navigation Bar */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16" ref={navContainerRef}>
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-emerald-600/20 group-hover:scale-105 transition-transform duration-200">
                جد
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight">Djadwal</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono">
                    v2.0
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium -mt-1 hidden sm:inline">
                  نظام الجداول والامتحانات
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Groups (Modern SaaS Dropdowns - No scrollbar!) */}
            <div className="hidden lg:flex items-center gap-1.5">
              {/* 1. Direct Link: Dashboard */}
              <Link
                href="/dashboard"
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 select-none ${
                  isDashboardActive
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200/70 dark:border-emerald-800/50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-zinc-800/70'
                }`}
              >
                <LayoutDashboard
                  className={`h-4 w-4 ${isDashboardActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                />
                <span>لوحة التحكم</span>
              </Link>

              {/* 2, 3, 4. Grouped Dropdowns */}
              {navGroups.map((group) => {
                const GroupIcon = group.icon;
                const isGroupActive = group.items.some((item) => isRouteActive(item.href, pathname));
                const isOpen = activeDropdown === group.id;

                return (
                  <div key={group.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveDropdown(isOpen ? null : group.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 select-none ${
                        isGroupActive
                          ? 'bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200/70 dark:border-emerald-800/50 shadow-xs'
                          : isOpen
                          ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-zinc-800/70'
                      }`}
                      aria-expanded={isOpen}
                    >
                      <GroupIcon
                        className={`h-4 w-4 ${isGroupActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                      />
                      <span>{group.title}</span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-slate-700 dark:text-slate-200' : 'text-slate-400'
                        }`}
                      />
                    </button>

                    {/* Popover Dropdown Menu */}
                    {isOpen && (
                      <div className="absolute start-0 top-full mt-2 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/80 dark:border-zinc-800/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-start">
                        <div className="px-3 py-1.5 mb-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {group.title}
                        </div>
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const ItemIcon = item.icon;
                            const isItemActive = isRouteActive(item.href, pathname);

                            return (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setActiveDropdown(null)}
                                className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-150 group ${
                                  isItemActive
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:text-slate-950 dark:hover:text-white'
                                }`}
                              >
                                <div
                                  className={`p-2 rounded-lg transition-colors shrink-0 mt-0.5 ${
                                    isItemActive
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/50 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                                  }`}
                                >
                                  <ItemIcon className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold">{item.name}</span>
                                    {isItemActive && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-1">
                                    {item.description}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>

                        {/* Extra Tools Footer for Session Tools */}
                        {group.id === 'session-tools' && (
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between px-2.5 py-1">
                            <span className="text-[11px] text-slate-400">تحتاج خيارات متقدمة؟</span>
                            <a
                              href="/legacy"
                              className="text-[11px] text-amber-600 hover:text-amber-700 font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <span>الواجهة المعتمدة (Legacy)</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Side: Quick Action & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            {/* Quick Print Shortcut on Desktop */}
            <Link
              href="/print"
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                pathname === '/print'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>مركز الطباعة</span>
            </Link>

            {/* Mobile / Tablet Menu Button (Hamburger) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="فتح القائمة الرئيسية"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer (Responsive Navigation Drawer via @djadwal/ui) */}
      <Drawer
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        side="start"
        title="قائمة نظام Djadwal"
        className="w-full max-w-sm"
      >
        <div className="space-y-6 text-start">
          {/* Direct Dashboard Link */}
          <div>
            <Link
              href="/dashboard"
              onClick={() => setMobileDrawerOpen(false)}
              className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                isDashboardActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/60'
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    isDashboardActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <span className="text-sm font-semibold">لوحة التحكم الرئيسية</span>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          {/* Grouped Nav Sections */}
          {navGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <GroupIcon className="w-3.5 h-3.5" />
                  <span>{group.title}</span>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isItemActive = isRouteActive(item.href, pathname);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors ${
                          isItemActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200/50'
                            : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                            isItemActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-500'
                          }`}
                        >
                          <ItemIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{item.name}</div>
                          <div className="text-xs text-slate-400 leading-tight mt-0.5">
                            {item.description}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Quick Switch to Legacy */}
          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800">
            <a
              href="/legacy"
              className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/40 font-semibold text-xs transition-colors hover:bg-amber-100"
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600" />
                <span>الواجهة الكلاسيكية القديمة (Vite SPA)</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
            </a>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
