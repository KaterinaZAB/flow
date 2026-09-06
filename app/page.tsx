import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
import {listExpenses,listTransactions} from '@/lib/server/expenses';
import {listCandidates} from '@/lib/server/candidates';
import {Dashboard} from '@/components/product/dashboard';
import {today} from '@/lib/domain/calendar';
import { Shell } from '@/components/product/shell';
import { UploadCloud, ArrowUpRight, ShieldCheck, ScanLine, CheckCheck, ChartNoAxesCombined } from 'lucide-react';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await getChatGPTUser();
  if(user){const [expenses,transactions,candidates]=await Promise.all([listExpenses(user.userId),listTransactions(user.userId),listCandidates(user.userId)]);if(expenses.length||candidates.length)return <Shell active="overview" userName={user.displayName}><Dashboard expenses={expenses} transactions={transactions} pending={candidates.length} asOf={today()}/></Shell>;}
  return <Shell active="overview" userName={user?.displayName}>
    <div className="page-heading"><div><div className="eyebrow">БОЛЬШЕ ЯСНОСТИ. МЕНЬШЕ СЮРПРИЗОВ.</div><h1>Ваши регулярные расходы</h1><p>Всё, что предстоит оплатить — в одном месте.</p></div><span className="date-chip">Личный обзор</span></div>
    <section className="welcome panel"><div className="welcome-copy"><span className="pill"><ScanLine size={15}/> Начните с одной выписки</span><h2>Узнайте, куда деньги<br/>собираются уйти.</h2><p>Подписки, связь, квартира и сервисы.<br/>Поток найдёт повторяющиеся платежи<br/>и соберёт понятный прогноз.</p><a className="primary-button" href={user ? '/import' : chatGPTSignInPath('/import')} target={user ? undefined : '_top'}>{user ? 'Найти мои регулярные расходы' : 'Войти через ChatGPT'}<ArrowUpRight size={18}/></a><span className="welcome-note">Без ручного ввода десятков расходов</span></div><div className="upload-preview"><div className="scan-icon"><UploadCloud size={36}/></div><strong>Одна выписка — полная картина</strong><p>Загрузите операции за 3–6 месяцев</p><div className="format-tags"><span>PDF</span><span>CSV</span><span>XLSX</span></div><div className="privacy-inline"><ShieldCheck size={17}/> Исходный файл не сохраняется</div></div></section>
    <div className="steps-grid">{[{Icon:UploadCloud,n:'01',title:'Загрузите выписку',desc:'Подойдёт PDF-выписка по счёту карты, CSV или XLSX.'},{Icon:CheckCheck,n:'02',title:'Проверьте найденное',desc:'Подтвердите расходы или исправьте результат.'},{Icon:ChartNoAxesCombined,n:'03',title:'Посмотрите вперёд',desc:'Суммы, ближайшие списания и идеи для экономии.'}].map(({Icon,n,title,desc})=><div className="step panel" key={n}><div className="step-top"><Icon size={23}/><span>{n}</span></div><h3>{title}</h3><p>{desc}</p></div>)}</div>
    <div className="quiet-note"><ShieldCheck size={18}/><p>Вы управляете данными. Каждый найденный расход требует вашего подтверждения.</p></div>
  </Shell>;
}
