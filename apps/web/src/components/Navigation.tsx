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
  ChevronDown
} from 'lucide-react';
import { api } from '@/lib/api';

const navItems = [
  { name: 'لوحة التحكم', href: '/dashboard', icon: Calendar },
  { name: 'الأساتذة', href: '/professors', icon: Users },
  { name: 'القاعات', href: '/rooms', icon: DoorOpen },
  { name: 'المقاييس', href: '/courses', icon: BookOpen },
  { name: 'الأفواج', href: '/groups', icon: Users2 },
  { name: 'الجدول الزمني', href: '/schedule', icon: Calendar },
  { name: 'الحصص والتكليفات', href: '/sessions', icon: CalendarClock },
  { name: 'الطباعة والمعاينة', href: '/print', icon: Printer },
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
            {navItems.map((item) => {
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
          </div>
        </div>
      </nav>
    </header>
  );
}
