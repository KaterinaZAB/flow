import type { Metadata } from 'next';
import './globals.css';
export const viewport={width:'device-width',initialScale:1,themeColor:'#3562d8'};
import {PWA} from '@/components/product/pwa';
import {WebMCP} from '@/components/product/webmcp';
export const metadata: Metadata = { title: {default:'Поток — регулярные расходы', template:'%s · Поток'}, description:'Загрузите выписку и получите карту регулярных расходов: прогноз списаний, категории и понятные рекомендации.',manifest:'/manifest.webmanifest'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="ru"><body><PWA/><WebMCP/>{children}</body></html>}

