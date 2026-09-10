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

/** Optional vocabulary hints only; transaction assembly never depends on this profile. */
export const modernSberHints: BankStatementProfile = {
  ...genericBankProfile,
  id: 'modern-sber-hints',
  detect: (text) => {
    const normalized = text.toUpperCase();
    const signals = [
      'ВЫПИСКА ПО СЧЁТУ ДЕБЕТОВОЙ КАРТЫ',
      'РАСШИФРОВКА ОПЕРАЦИЙ',
      'ДАТА ОПЕРАЦИИ',
      'СУММА В ВАЛЮТЕ СЧЁТА',
      'ОСТАТОК СРЕДСТВ',
    ];
    return signals.filter((signal) => normalized.includes(signal)).length / 5;
  },
  knownCategoryLabels: [
    ...genericBankProfile.knownCategoryLabels,
    'прочие расходы',
    'перевод с карты',
    'перевод на карту',
    'перевод сбп',
    'пополнение',
  ],
};

export const bankStatementProfiles: BankStatementProfile[] = [
  modernSberHints,
  genericBankProfile,
];

export function selectBankProfile(text: string): BankStatementProfile {
  return [...bankStatementProfiles].sort(
    (a, b) => b.detect(text) - a.detect(text),
  )[0];
}
