export type BankStatementProfile = {
  id: string;
  detect(text: string): number;
  knownCategoryLabels: string[];
  balanceLabels: string[];
  merchantColumnHints: string[];
  amountColumnHints: string[];
};

export const genericBankProfile: BankStatementProfile = {
  id: 'generic',
  detect: () => 0.1,
  knownCategoryLabels: [
    'прочие операции',
    'транспорт',
    'путешествия',
    'супермаркеты',
    'продукты',
    'развлечения',
    'рестораны',
    'кафе',
    'здоровье',
    'красота',
    'одежда',
    'переводы',
    'оплата товаров и услуг',
    'оплата покупки',
    'other',
    'transport',
    'travel',
    'restaurants',
    'groceries',
    'entertainment',
  ],
  balanceLabels: [
    'остаток',
    'баланс',
    'доступно',
    'хотелки',
    'на счёте',
    'на счете',
    'balance',
    'available',
    'остаток на начало',
    'остаток на конец',
    'входящий остаток',
    'исходящий остаток',
  ],
  merchantColumnHints: [
    'описание',
    'получатель',
    'merchant',
    'детали',
    'операция',
    'назначение',
  ],
  amountColumnHints: ['сумма', 'amount'],
};

export const bankStatementProfiles: BankStatementProfile[] = [
  genericBankProfile,
];

export function selectBankProfile(text: string): BankStatementProfile {
  return [...bankStatementProfiles].sort(
    (a, b) => b.detect(text) - a.detect(text),
  )[0];
}
