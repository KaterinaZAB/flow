import {
  groupItemsIntoLines,
  type PdfTextItem,
} from '../../lib/import/pdf/layout.ts';

const formatMoney = (minor: number, signed = false) => {
  const absolute = Math.abs(minor);
  const major = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${signed ? '+' : ''}${major},${String(absolute % 100).padStart(2, '0')}`;
};

export function anonymizedSberModernFixture() {
  const income = [1_000_000, 1_200_000, 800_000, 930_100, 1_000_000];
  const expenses = [...Array.from({ length: 103 }, () => 50_000), 226_255];
  const operations = [
    ...income.map((amount, index) => ({
      amount,
      income: true,
      merchant: `ANON INCOME ${index + 1}`,
    })),
    ...expenses.map((amount, index) => ({
      amount,
      income: false,
      merchant:
        [
          'VK*VK MUSIC MOSCOW RUS',
          'YANDEX*5815*PLUS',
          'YM*OKKO MOSCOW RUS',
          'CP* START.RU MOSKVA RUS',
          'TUTU4 MOSCOW RUS',
          'YM*URENT MOSCOW RUS',
        ][index] ?? `ANON MERCHANT ${index + 1}`,
    })),
  ];
  const pages: PdfTextItem[][] = Array.from({ length: 6 }, () => []);
  pages[0].push(
    { text: 'Выписка по счёту дебетовой карты', x: 35, y: 790, width: 220 },
    { text: 'Расшифровка операций', x: 35, y: 770, width: 160 },
    { text: 'Начальный остаток', x: 35, y: 748, width: 105 },
    { text: formatMoney(507_575), x: 500, y: 748, width: 70 },
    { text: 'Пополнение', x: 35, y: 732, width: 75 },
    { text: formatMoney(4_930_100), x: 500, y: 732, width: 80 },
    { text: 'Списание', x: 35, y: 716, width: 65 },
    { text: formatMoney(5_376_255), x: 500, y: 716, width: 80 },
    { text: 'Конечный остаток', x: 35, y: 700, width: 105 },
    { text: formatMoney(61_420), x: 500, y: 700, width: 60 },
  );
  let balance = 507_575;
  let offset = 0;
  const perPage = [19, 18, 18, 18, 18, 18];
  for (let page = 0; page < pages.length; page++) {
    const headerY = page === 0 ? 680 : 760;
    pages[page].push(
      { text: 'ДАТА ОПЕРАЦИИ', x: 35, y: headerY, width: 85 },
      { text: 'КАТЕГОРИЯ', x: 145, y: headerY, width: 65 },
      { text: 'СУММА В ВАЛЮТЕ СЧЁТА', x: 390, y: headerY, width: 105 },
      { text: 'ОСТАТОК СРЕДСТВ', x: 500, y: headerY, width: 90 },
    );
    for (let local = 0; local < perPage[page]; local++, offset++) {
      const operation = operations[offset];
      const y = headerY - 24 - local * 24;
      const day = String((offset % 27) + 1).padStart(2, '0');
      const month = String(5 + Math.floor(offset / 54)).padStart(2, '0');
      const date = `${day}.${month}.2026`;
      const processedDate = offset === income.length ? '07.05.2026' : date;
      balance += operation.income ? operation.amount : -operation.amount;
      pages[page].push(
        { text: date, x: 35, y, width: 58 },
        {
          text: `${String(offset % 24).padStart(2, '0')}:16`,
          x: 98,
          y,
          width: 30,
        },
        {
          text: operation.income ? 'Пополнение' : 'Прочие операции',
          x: 145,
          y,
          width: 100,
        },
        {
          text: formatMoney(operation.amount, operation.income),
          x: 390,
          y,
          width: 75,
        },
        { text: formatMoney(balance), x: 500, y, width: 75 },
        { text: processedDate, x: 35, y: y - 11, width: 58 },
        { text: String(100000 + offset), x: 98, y: y - 11, width: 38 },
        {
          text: `${operation.merchant}. Операция по карте ****0000`,
          x: 145,
          y: y - 11,
          width: 230,
        },
      );
    }
    pages[page].push({
      text: `Страница ${page + 1} из 6`,
      x: 500,
      y: 40,
      width: 70,
    });
  }
  return pages.map((items) => groupItemsIntoLines(items));
}
