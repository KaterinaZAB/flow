import {requireChatGPTUser} from '../chatgpt-auth';
import {Shell} from '@/components/product/shell';
import {ExpenseForm} from '@/components/product/expense-form';
import {ExpenseList} from '@/components/product/expense-list';
import {listExpenses} from '@/lib/server/expenses';
export const dynamic='force-dynamic';
export default async function Expenses(){const u=await requireChatGPTUser('/expenses');const expenses=await listExpenses(u.userId);return <Shell active="expenses" userName={u.displayName}><div className="page-heading"><div><h1>Регулярные расходы</h1><p>Все повторяющиеся платежи под вашим контролем.</p></div><ExpenseForm/></div><ExpenseList expenses={expenses}/></Shell>}
