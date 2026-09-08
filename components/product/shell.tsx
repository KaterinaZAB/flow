'use client';
import { ExpenseForm } from './expense-form';


import type { ReactNode } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Repeat2,
  UploadCloud,
  Sparkles,
  Settings2,
  ArrowUpRight,
  Waves,

} from 'lucide-react';
const navigation = [
  {
    key: 'overview',
    href: '/',
    label: 'Обзор',
    short: 'Обзор',
    icon: LayoutDashboard,
  },
  {
    key: 'expenses',
    href: '/expenses',
    label: 'Регулярные расходы',
    short: 'Расходы',
    icon: Repeat2,
  },
  {
    key: 'import',
    href: '/import',
    label: 'Импорт выписки',
    short: 'Импорт',
    icon: UploadCloud,
  },
  {
    key: 'recommendations',
    href: '/recommendations',
    label: 'Рекомендации',
    short: 'Советы',
    icon: Sparkles,
  },
];
export function Shell({
  children,
  active,
  userName,

}: {
  children: ReactNode;
  active: string;
  userName?: string;

}) {
  return (
    <SidebarProvider>
      <Sidebar className="product-sidebar">
        <SidebarHeader>
          <a href="/" className="brand">
            <span className="brand-icon">
              <Waves size={24} />
            </span>
            поток
          </a>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navigation.map(({ key, href, label, icon: Icon }) => (
              <SidebarMenuItem key={key}>
                <SidebarMenuButton
                  render={<a href={href} aria-label={label} />}
                  isActive={active === key}
                  className="nav-item"
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="sidebar-tip">
            <span className="tip-icon">
              <UploadCloud size={20} />
            </span>
            <strong>Данные на устройстве</strong>
            <p>Выписка анализируется локально. Синхронизация — с шифрованием.</p>
            <a href="/settings/sources">
              Источники данных <ArrowUpRight size={15} />
            </a>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenuButton
            render={<a href="/settings" aria-label="Настройки" />}
            isActive={active === 'settings'}
            className="nav-item"
          >
            <Settings2 size={19} />
            Настройки
          </SidebarMenuButton>
          <a className="profile" href="/settings/sync">
            <span className="avatar">
              {userName?.[0]?.toUpperCase() || 'П'}
            </span>
            <span>
              <strong>
                Ваш Поток
              </strong>
              <small>
                Хранение и синхронизация
              </small>
            </span>
          </a>
        </SidebarFooter>
      </Sidebar>
      <div className="app-surface">
        <header className="mobile-header">
          <a className="brand" href="/">
            <span className="brand-icon">
              <Waves size={22} />
            </span>
            поток
          </a>
          <a href="/settings" aria-label="Настройки" className="avatar">
            <Settings2 size={19} />
          </a>
        </header>
        <main className="main-content">
          {children}
        </main>
        <footer className="main-footer">
          <span>Поток · Спокойствие в цифрах</span>
          <span>Прогнозы основаны на истории платежей</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Основная навигация">
        {navigation.map(({ key, href, short, icon: Icon }) => (
          <a
            href={href}
            aria-label={short}
            aria-current={active === key ? 'page' : undefined}
            key={key}
          >
            <Icon size={21} />
            <span>{short}</span>
          </a>
        ))}
      </nav>
      <div className="mobile-add">
        <ExpenseForm iconOnly />
      </div>
    </SidebarProvider>
  );
}
