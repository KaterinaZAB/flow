# Flow / Поток — local-first PWA

Управление регулярными расходами без регистрации. CSV, XLSX и PDF разбираются на устройстве; расходы, операции и настройки хранятся в IndexedDB. Детерминированный detection engine и рекомендации работают без LLM. Исходная выписка не отправляется серверу.

Необязательный encrypted vault синхронизирует полный workspace: браузер шифрует его AES-256-GCM, Node/Vinext сохраняет ciphertext в PostgreSQL. Сервер не получает ключ расшифровки. Публичный каталог работает с локальным offline fallback. Google/Gmail/OAuth отсутствуют. Пример данных изолирован от личного workspace.

## Разработка

Node 22.13+ (проверено Node 24), npm:

    npm ci
    npm ci --prefix backend
    npm run dev

PostgreSQL не нужен для локального режима. Для серверной синхронизации — [deployment](DEPLOYMENT.md). Для offline preview:

    npm run build
    npm start

Production требует HTTPS; локальный localhost работает как secure context. Service worker формируется production сборкой.

## Проверки

    npm run typecheck
    npm test
    npm run lint
    npm run build

[Архитектура](ARCHITECTURE.md) · [Безопасность](SECURITY.md) · [API](API.md) · [Миграции](MIGRATION.md) · [Deployment/backup](DEPLOYMENT.md).

Benchmark: tests/fixtures/detection содержит только синтетические данные. Метрики в tests/detection-benchmark.ts считают TP/FP/FN/precision/recall по точному набору evidence и периоду. Порог 0.8 даёт на маленьком fixture precision 1, recall 0.6; при 0.7 — 1/1. Это регрессионный пример, не оценка качества на реальных банках.

Текущий Vinext — beta. Production bundle и unit/integration checks не заменяют проверку Linux image и браузерных сценариев перед релизом.

[Технический отчёт проверки и оставшиеся ограничения](PRODUCTION_REVIEW.md).
