import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'نظام Djadwal — إدارة الجداول الأكاديمية والامتحانات',
    short_name: 'Djadwal',
    description: 'منظومة إدارة وتوزيع الجداول الأكاديمية والتكليفات — جامعة الشهيد حمه لخضر بالوادي',
    start_url: '/',
    id: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#059669',
    orientation: 'any',
    dir: 'rtl',
    lang: 'ar',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'جدول التوقيت الأسبوعي',
        short_name: 'جدولي',
        url: '/schedule',
        description: 'استعراض وتعديل جدول التوقيت الأسبوعي وتوزيع الحصص',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'إدارة التكليفات والحصص',
        short_name: 'التكليفات',
        url: '/assignments',
        description: 'إدارة وتوزيع الحصص والتكليفات البيداغوجية',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'سجل التغييرات ومركز التراجع',
        short_name: 'إشعاراتي',
        url: '/settings/audit-undo',
        description: 'متابعة سجل التغييرات ومركز التراجع الفوري',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'الحصص والتعارضات',
        short_name: 'تعارضاتي',
        url: '/sessions',
        description: 'فحص الحصص وكشف التعارضات الأكاديمية',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
