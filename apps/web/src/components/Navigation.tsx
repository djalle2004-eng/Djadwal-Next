'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  DoorOpen,
  BookOpen,
  Users2,
  CalendarClock,
  Printer,
  RotateCcw,
  LogOut,
  Database,
  Layers,
  Search,
  ClipboardList,
  CalendarDays,
  ArrowLeftRight,
  Move,
  UserCog,
  ScrollText,
  ExternalLink,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { api } from '@/lib/api';

// Core Navigation Items in Next.js
const coreNavItems = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: Calendar },
  { name: 'الأساتذة', href: '/professors', icon: Users },
  { name: 'القاعات', href: '/rooms', icon: DoorOpen },
  { name: 'المقاييس', href: '/courses', icon: BookOpen },
  { name: 'الأفواج', href: '/groups', icon: Users2 },
  { name: 'الجدول الزمني', href: '/schedule', icon: Calendar },
  { name: 'جداول الأفواج', href: '/groups/schedules', icon: CalendarDays },
  { name: 'الحصص والتكليفات', href: '/sessions', icon: CalendarClock },
  { name: 'تبديل الحصص', href: '/sessions/swap', icon: ArrowLeftRight },
  { name: 'نقل الحصص', href: '/sessions/move', icon: Move },
  { name: 'القاعات المتاحة', href: '/available-rooms', icon: Search },
  { name: 'أعباء الأساتذة', href: '/professor-workload', icon: ClipboardList },
  { name: 'الطباعة', href: '/print', icon: Printer },
  { name: 'نظام التصميم', href: '/design-system', icon: Sparkles },
];

// Rich Faculty Tools (Directly served from Legacy SPA with 100% features)
const facultyTools = [
  { name: 'القاعات المتاحة (الحصص الإضافية والتعويضات)', href: '/legacy/available-rooms', icon: Search },
  { name: 'عبء العمل للأساتذة (طباعة الأعباء)', href: '/legacy/professor-workload', icon: ClipboardList },
  { name: 'جداول الأفواج', href: '/legacy/group-schedules', icon: CalendarDays },
  { name: 'تبديل الحصص', href: '/legacy/session-swap', icon: ArrowLeftRight },
  { name: 'نقل الحصص', href: '/legacy/session-move', icon: Move },
  { name: 'السنوات الدراسية', href: '/legacy/academic-years', icon: Layers },
  { name: 'إعدادات الطباعة', href: '/legacy/print-settings', icon: Printer },
  { name: 'إدارة المستخدمين', href: '/legacy/users', icon: UserCog },
  { name: 'النسخ الاحتياطي', href: '/legacy/backup', icon: Database },
  { name: 'سجل الأنشطة', href: '/legacy/audit-log', icon: ScrollText },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const [dbStatus, setDbStatus] = useState<any>({
    status: 'متصل',
    readSource: 'postgres',
    dualWriteTarget: 'Turso (Dual-Write)',
  });

  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [currentYear, setCurrentYear] = useState<string>('2026-2027');
  const [currentSemester, setCurrentSemester] = useState<string>('السداسي الأول');

  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  useEffect(() => {
    // 1. Fetch DB Status (P6 indicator)
    api.getDatabaseStatus().then(setDbStatus).catch(() => {});

    // 2. Fetch Academic Years from API v1
    api.get('/academic/years').then((years) => {
      if (Array.isArray(years) && years.length > 0) {
        setAcademicYears(years);
        const active = years.find((y: any) => y.is_current === 1 || y.is_current === true);
        if (active) setCurrentYear(active.year_name);
      }
    }).catch(() => {});
  }, []);

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/signout', {});
    } catch (_) {}
    // Clear cookies
    document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = '__Host-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm no-print">
      {/* Top Banner: Status & Context */}
      <div className="bg-slate-900 text-white px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Institution & Active Year */}
          <div className="flex items-center gap-3">
            <span className="font-semibold text-emerald-400">نظام Djadwal (App Router v1)</span>
            <span className="text-gray-400">|</span>
            <div className="flex items-center gap-1.5 text-gray-300">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>السنة الدراسية:</span>
              <strong className="text-white">{currentYear}</strong>
              <span>-</span>
              <strong className="text-white">{currentSemester}</strong>
            </div>
          </div>

          {/* Database Live Telemetry & Switch to Legacy */}
          <div className="flex items-center gap-3">
            {/* P6 Live Indicator */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300">قراءة من:</span>
              <span className="font-medium text-emerald-300">Neon PostgreSQL</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">نسخ:</span>
              <span className="text-cyan-300 font-mono text-[11px]">Turso</span>
            </div>

            {/* Quick Switch to Legacy UI */}
            <a
              href="/legacy"
              className="inline-flex items-center gap-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 px-2.5 py-0.5 rounded-full transition-colors font-medium text-xs"
              title="الانتقال إلى الواجهة السابقة (Vite SPA)"
            >
              <RotateCcw className="h-3 w-3" />
              <span>الواجهة القديمة (Legacy)</span>
            </a>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="text-gray-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              title="تسجيل الخروج"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                جد
              </div>
              <span className="font-bold text-gray-900 text-lg">Djadwal</span>
            </Link>
          </div>

          {/* Navigation Items */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {coreNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/' || pathname === '/dashboard'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 shadow-sm font-semibold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Faculty & Advanced Tools Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  showToolsDropdown
                    ? 'bg-amber-100 text-amber-900'
                    : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Search className="h-4 w-4 text-amber-600" />
                <span>أدوات الكلية (القاعات المتاحة، الأعباء، التبديل)</span>
                <ChevronDown className="h-3.5 w-3.5 text-amber-600" />
              </button>

              {showToolsDropdown && (
                <div
                  className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-in fade-in slide-in-from-top-1"
                  onMouseLeave={() => setShowToolsDropdown(false)}
                >
                  <div className="px-3 py-1.5 border-b border-gray-100 text-xs font-semibold text-gray-500">
                    أدوات الكلية المعتمدة (الواجهة المكتملة)
                  </div>
                  {facultyTools.map((tool) => {
                    const ToolIcon = tool.icon;
                    return (
                      <a
                        key={tool.href}
                        href={tool.href}
                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                        onClick={() => setShowToolsDropdown(false)}
                      >
                        <div className="flex items-center gap-2">
                          <ToolIcon className="h-4 w-4 text-gray-400" />
                          <span>{tool.name}</span>
                        </div>
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

