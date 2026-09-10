import type { Service } from './types.ts';
export const services: Service[] = [
  {
    id: 'yandex-plus',
    name: 'Яндекс Плюс',
    category: 'subscription',
    group: 'bundle',
    merchantAliases: ['YANDEX PLUS', 'YA PLUS', 'ЯНДЕКС ПЛЮС'],
    aliases: [
      {
        pattern: 'YANDEX PLUS',
        matchType: 'exact',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'YA PLUS',
        matchType: 'exact',
        provenance: 'heuristic',
        confidence: 0.95,
      },
      {
        pattern: 'YM YANDEX PLUS',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: '^YANDEX\\s*\\*\\s*\\d{3,8}\\s*\\*\\s*PLUS(?:\\s|$)',
        matchType: 'regex',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'ЯНДЕКС ПЛЮС',
        matchType: 'exact',
        provenance: 'user-example',
        confidence: 0.98,
      },
    ],
    merchantClass: 'subscription',
    manageSubscriptionUrl: 'https://plus.yandex.ru/ru/my/payments',
    cancellationUrl: 'https://yandex.ru/support/plus/ru/manage/unsubscribe',
    color: '#ef5165',
    monogram: 'Я',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    category: 'software',
    group: 'ai',
    merchantAliases: ['OPENAI CHATGPT', 'CHATGPT', 'OPENAI PLUS'],
    website: 'https://chatgpt.com',
    cancellationUrl:
      'https://help.openai.com/en/articles/7232927-how-do-i-cancel-my-chatgpt-subscription',
    color: '#4c8d7e',
    monogram: 'G',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['NETFLIX', 'NETFLIX COM'],
    cancellationUrl: 'https://help.netflix.com/en/node/407',
    color: '#e3444a',
    monogram: 'N',
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'subscription',
    group: 'music',
    merchantAliases: ['SPOTIFY', 'SPOTIFY PREMIUM'],
    cancellationUrl: 'https://support.spotify.com/us/article/cancel-premium/',
    color: '#37a86a',
    monogram: 'S',
  },
  {
    id: 'ivi',
    name: 'Иви',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['IVI', 'IVI RU', 'ИВИ'],
    aliases: [
      {
        pattern: 'IVI',
        matchType: 'exact',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'IVI RU',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
    ],
    merchantClass: 'subscription',
    color: '#e65591',
    monogram: 'ivi',
  },
  {
    id: 'kinopoisk',
    name: 'Кинопоиск',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['KINOPOISK', 'КИНОПОИСК'],
    color: '#ef8a42',
    monogram: 'К',
  },
  {
    id: 'okko',
    name: 'Okko',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['OKKO', 'OKKO TV'],
    aliases: [
      {
        pattern: 'OKKO',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'YM OKKO',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'Y M OKKO',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'SBER 7841 OKKO LOYALTY',
        matchType: 'exact',
        provenance: 'observed-sber',
        confidence: 0.98,
      },
    ],
    merchantClass: 'subscription',
    color: '#8c6dce',
    monogram: 'О',
  },
  {
    id: 'rostelecom',
    name: 'Ростелеком',
    category: 'internet',
    merchantAliases: ['ROSTELECOM', 'РОСТЕЛЕКОМ', 'ROSTELECOM RUS'],
    merchantClass: 'regular_bill',
    color: '#8775ba',
    monogram: 'Р',
  },
  {
    id: 'mts',
    name: 'МТС',
    category: 'mobile',
    merchantAliases: ['MTS', 'МТС'],
    aliases: [
      {
        pattern:
          '^(?:(?:YM|CP|SBER)[\\s*._-]+)?MTS(?:[\\s*._-]+(?:PAY|RUS))?(?:[\\s*._-]|$)',
        matchType: 'regex',
        provenance: 'official-merchant-list',
        confidence: 0.97,
      },
      {
        pattern: 'МТС',
        matchType: 'exact',
        provenance: 'official-merchant-list',
        confidence: 0.95,
      },
    ],
    merchantClass: 'regular_bill',
    color: '#e05a60',
    monogram: 'М',
  },
  {
    id: 'beeline',
    name: 'Билайн',
    category: 'mobile',
    merchantAliases: ['BEELINE', 'БИЛАЙН', 'VIMPELCOM', 'VIMPEL COM'],
    merchantClass: 'regular_bill',
    color: '#c9a343',
    monogram: 'Б',
  },
  {
    id: 'icloud',
    name: 'iCloud',
    category: 'cloud',
    merchantAliases: ['ICLOUD', 'APPLE ICLOUD'],
    color: '#5e9ed4',
    monogram: 'i',
  },
  {
    id: 'adobe',
    name: 'Adobe',
    category: 'software',
    merchantAliases: ['ADOBE', 'ADOBE SYSTEMS'],
    color: '#d85b60',
    monogram: 'A',
  },
  {
    id: 'start',
    name: 'START',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['CP START RU', 'START RU'],
    merchantClass: 'subscription',
    aliases: [
      {
        pattern: 'CP START RU',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'START RU',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.98,
      },
    ],
    color: '#e25353',
    monogram: 'S',
  },
  {
    id: 'premier',
    name: 'PREMIER',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['YM PREMIER', 'PREMIER'],
    merchantClass: 'subscription',
    aliases: [
      {
        pattern: 'YM PREMIER',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'Y M PREMIER',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.99,
      },
      {
        pattern: 'YM STAT PREMIER',
        matchType: 'prefix',
        provenance: 'observed-sber',
        confidence: 0.98,
      },
      {
        pattern: 'PREMIER',
        matchType: 'exact',
        provenance: 'observed-sber',
        confidence: 0.95,
      },
    ],
    color: '#7556b8',
    monogram: 'P',
  },
  {
    id: 'vk-music',
    name: 'VK Музыка',
    category: 'subscription',
    group: 'music',
    merchantAliases: ['VK VK MUSIC', 'VK MUSIC'],
    merchantClass: 'subscription',
    aliases: [
      {
        pattern: 'VK VK MUSIC',
        matchType: 'prefix',
        provenance: 'user-example',
        confidence: 0.99,
      },
      {
        pattern: 'VK MUSIC',
        matchType: 'prefix',
        provenance: 'user-example',
        confidence: 0.98,
      },
    ],
    color: '#397bd8',
    monogram: 'VK',
  },
  {
    id: 'wink',
    name: 'Wink',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['WINK', 'ROSTELECOM WINK'],
    merchantClass: 'subscription',
    color: '#7054c7',
    monogram: 'W',
  },
  {
    id: 'kion',
    name: 'KION',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['KION', 'ООО КИОН', 'MTS ECOSYSTEM'],
    merchantClass: 'subscription',
    color: '#df4545',
    monogram: 'K',
  },
  {
    id: 'viju',
    name: 'viju',
    category: 'subscription',
    group: 'video',
    merchantAliases: ['CP VIJU'],
    merchantClass: 'subscription',
    color: '#7254c9',
    monogram: 'V',
  },
  {
    id: 'sberprime',
    name: 'СберПрайм',
    category: 'subscription',
    group: 'bundle',
    merchantAliases: ['СБЕРПРАЙМ', 'СБЕРПРАЙМ ПЛАТА ЗА ТАРИФ'],
    merchantClass: 'subscription',
    color: '#39a36d',
    monogram: 'С',
  },
  ...[
    ['megafon', 'МегаФон', ['МЕГАФОН', 'MEGAFON']],
    ['yota', 'Yota', ['YOTA', 'ЙОТА']],
    ['tele2', 'T2', ['T2', 'TELE2']],
    ['tinkoff-mobile', 'Тинькофф Мобайл', ['ТИНЬКОФФ МОБАЙЛ', 'TINKOFF MOBILE']],
    ['sbermobile', 'СберМобайл', ['СБЕРМОБАЙЛ', 'SBERMOBILE', 'SBER MOBILE']],
  ].map(([id, name, merchantAliases]) => ({
    id: id as string,
    name: name as string,
    category: 'mobile' as const,
    merchantAliases: merchantAliases as string[],
    merchantClass: 'regular_bill' as const,
    color: '#4d8f77',
    monogram: (name as string).slice(0, 1),
  })),
  ...[
    ['domru', 'Дом.ру', ['DOM RU', 'ДОМ РУ', 'ER TELECOM', 'ER-TELECOM']],
    ['mgts', 'МГТС', ['МГТС', 'MGTS']],
    ['ttk', 'ТТК', ['ТТК', 'TRANSTELECOM', 'TRANS TELE COM']],
  ].map(([id, name, merchantAliases]) => ({
    id: id as string,
    name: name as string,
    category: 'internet' as const,
    merchantAliases: merchantAliases as string[],
    merchantClass: 'regular_bill' as const,
    color: '#5484bb',
    monogram: (name as string).slice(0, 1),
  })),
  ...[
    ['mosenergo', 'Мосэнергосбыт', ['МОСЭНЕРГОСБЫТ', 'ЭЛЕКТРОЭНЕРГИЯ', 'ЭЛЕКТРИЧЕСТВО']],
    ['mosobleirc', 'МосОблЕИРЦ', ['МОСОБЛЕИРЦ']],
    ['eirc', 'ЕИРЦ', ['ЕИРЦ']],
    ['mosvodokanal', 'Мосводоканал', ['МОСВОДОКАНАЛ', 'ВОДОКАНАЛ', 'ВОДА']],
    ['gazprom-gas', 'Газпром межрегионгаз', ['ГАЗПРОМ МЕЖРЕГИОНГАЗ']],
    ['housing', 'ЖКХ', ['ЖКХ', 'КОММУНАЛЬНЫЕ УСЛУГИ', 'КВАРТПЛАТА', 'УПРАВЛЯЮЩАЯ КОМПАНИЯ', 'УК', 'ТСЖ', 'КАПРЕМОНТ', 'КАПИТАЛЬНЫЙ РЕМОНТ', 'ТЕПЛОСЕТЬ', 'ОТОПЛЕНИЕ', 'ВЫВОЗ МУСОРА', 'ДОМОФОН', 'ГАЗ']],
  ].map(([id, name, merchantAliases]) => ({
    id: id as string,
    name: name as string,
    category: 'utility' as const,
    merchantAliases: merchantAliases as string[],
    merchantClass: 'regular_bill' as const,
    color: '#5b8c72',
    monogram: (name as string).slice(0, 1),
  })),
  {
    id: 'rent-payment',
    name: 'Аренда жилья',
    category: 'rent',
    merchantAliases: ['АРЕНДА', 'RENT', 'RENTAL', 'НАЕМ', 'НАЁМ', 'ОПЛАТА ЖИЛЬЯ'],
    merchantClass: 'regular_bill',
    color: '#8b7355',
    monogram: 'А',
  },
  {
    id: 'whoosh-pass',
    name: 'Whoosh Pass',
    category: 'subscription',
    merchantAliases: ['WHOOSH PASS'],
    merchantClass: 'subscription',
    color: '#ffd234',
    monogram: 'W',
  },
  ...[
    ['yandex-go', 'Яндекс Go', ['YANDEX GO', 'ЯНДЕКС GO']],
    ['yandex-scooters', 'Яндекс Самокаты', ['ЯНДЕКС САМОКАТЫ', 'YANDEX SCOOTERS']],
    ['whoosh', 'Whoosh', ['WHOOSH']],
    ['urent', 'МТС Юрент', ['URENT', 'ЮРЕНТ', 'МТС ЮРЕНТ', 'MTS URENT', 'YM URENT']],
    ['yandex-drive', 'Яндекс Драйв', ['ЯНДЕКС ДРАЙВ', 'YANDEX DRIVE']],
    ['delimobil', 'Делимобиль', ['ДЕЛИМОБИЛЬ', 'DELIMOBIL']],
    ['citydrive', 'Ситидрайв', ['СИТИДРАЙВ', 'CITYDRIVE']],
    ['moscow-metro', 'Московский транспорт', ['MOSCOW METRO', 'МОСКОВСКОЕ МЕТРО', 'МЕТРО', 'ТРОЙКА', 'МОСГОРТРАНС']],
  ].map(([id, name, merchantAliases]) => ({
    id: id as string,
    name: name as string,
    category: 'service' as const,
    merchantAliases: merchantAliases as string[],
    merchantClass: 'usage_based' as const,
    color: '#527f91',
    monogram: (name as string).slice(0, 1),
  })),
  ...[
    ['sogaz', 'СОГАЗ', ['СОГАЗ']],
    ['sber-insurance', 'СберСтрахование', ['СБЕРСТРАХОВАНИЕ']],
    ['ingos', 'Ингосстрах', ['ИНГОССТРАХ']],
    ['alfa-insurance', 'АльфаСтрахование', ['АЛЬФАСТРАХОВАНИЕ']],
    ['reso', 'РЕСО', ['РЕСО']],
  ].map(([id, name, merchantAliases]) => ({
    id: id as string,
    name: name as string,
    category: 'insurance' as const,
    merchantAliases: merchantAliases as string[],
    merchantClass: 'regular_bill' as const,
    color: '#6a7992',
    monogram: (name as string).slice(0, 1),
  })),
  {
    id: 'mobile-bank-fee',
    name: 'Мобильный банк',
    category: 'bank_service',
    merchantAliases: ['MOBILE BANK KOMISSIYA'],
    merchantClass: 'bank_service',
    color: '#657487',
    monogram: 'Б',
  },
];
export function normalizedText(merchant: string) {
  return merchant
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
export function matchService(merchant: string) {
  const normalized = normalizedText(merchant);
  const normalizedVariants = [
    normalized,
    normalized.replace(/^(?:YM|Y M|CP|SBER|PAYMENT)\s+/, ''),
  ];
  for (const service of services) {
    if (service.aliases) {
      const alias = service.aliases.find((candidate) => {
        const pattern =
          candidate.matchType === 'regex'
            ? candidate.pattern
            : normalizedText(candidate.pattern);
        if (candidate.matchType === 'regex')
          return new RegExp(pattern, 'i').test(merchant);
        if (candidate.matchType === 'exact')
          return normalizedVariants.some((value) => value === pattern);
        if (candidate.matchType === 'contains')
          return normalizedVariants.some((value) => value.includes(pattern));
        return normalizedVariants.some(
          (value) => value === pattern || value.startsWith(pattern + ' '),
        );
      });
      if (alias) return { service, confidence: alias.confidence, alias };
      continue;
    }
    const alias = service.merchantAliases.find((candidate) => {
      const pattern = normalizedText(candidate);
      return normalizedVariants.some(
        (value) => value === pattern || value.startsWith(pattern + ' '),
      );
    });
    if (alias) return { service, confidence: 0.9, alias: undefined };
  }
  return undefined;
}

export function findService(merchant: string) {
  return matchService(merchant)?.service;
}

export function merchantBehavior(merchant: string) {
  const normalized = normalizedText(merchant);
  if (
    /(?:ПЕРЕВОД|SBP|СБП|P2P)/.test(normalized) &&
    !/(?:АРЕНДА|RENT|RENTAL|НАЕМ|НАЁМ|ОПЛАТА ЖИЛЬЯ)/.test(normalized)
  )
    return 'transfer' as const;
  if (
    /\b(?:TUTU|TUTU4|RUSSIAN RAILWAYS|METRO|MOS TRANSPORT|STRELKA|URENT|YANDEX GO|YANDEX MARKET|OZON|WILDBERRIES|ALIEXPRESS)\b/.test(
      normalized,
    )
  )
    return 'usage_based' as const;
  if (
    /\b(?:TAXI|ТАКСИ|RESTAURANT|РЕСТОРАН|SUPERMARKET|СУПЕРМАРКЕТ|MARKETPLACE|АЗС|FUEL|PARKING|ПАРКОВК)\b/.test(
      normalized,
    )
  )
    return 'retail' as const;
  return findService(merchant)?.merchantClass ?? ('unknown' as const);
}
export function normalizeMerchant(merchant: string) {
  const service = findService(merchant);
  if (service) return 'service:' + service.id;
  return normalizedText(merchant)
    .replace(/\s+(?:MOSCOW|МОСКВА|RUS|RUSSIA)$/, '')
    .replace(/\s+(?:ORDER|ЗАКАЗ|REF)\s+\d+$/, '')
    .trim();
}
export function serviceById(id: string | null | undefined) {
  return services.find((s) => s.id === id);
}
