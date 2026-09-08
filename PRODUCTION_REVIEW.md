# Production review — 2026-09-08

## Фактическая архитектура

Browser/PWA → localCommand → local parser/merchant normalization/deterministic detection → IndexedDB → dashboard/recommendations. Optional sync: browser AES-256-GCM → HTTPS/Caddy → Node/Vinext → PostgreSQL ciphertext. Server не получает исходную выписку или encryption/recovery key.

| Функция | Источник | Результат аудита |
|---|---|---|
| Dashboard/expenses/recommendations | IndexedDB + integer minor-unit domain code | Реальная локальная логика |
| CSV/XLSX/PDF | Browser parser, bounded input | Реальный локальный импорт |
| Пример | lib/demo | Только явный пример, не production database |
| Catalog | Public PostgreSQL + bundled/cache fallback | Реальный API, offline fallback |
| Vault | Web Crypto + PostgreSQL | Реальные encrypted operations |
| Gmail/Auth | Отключённые остатки/недостижимые файлы | Удалены, не возвращены |

## Очистка

Удалены 46 недостижимых UI-компонентов, старый chart, отключённый Gmail pipeline/тесты, старые auth screens и financial server modules, старые SQLite/PostgreSQL migrations, неиспользуемый offline.html, устаревшие отчёты и hosting metadata. История Git и локальные базы сохранены. work (34.03 MiB), build/cache/temp runtime copies удалены; текущий dist пересобран.

Удалённые npm packages: @shadcn/react, cmdk, date-fns, embla-carousel-react, htmlparser2, input-otp, pdfjs-dist, react-day-picker, react-resizable-panels, recharts, @cloudflare/vite-plugin, @cloudflare/workers-types, @openai/sites-vite-plugin, wrangler, shadcn. В backend удалена неиспользуемая циклическая potok:file:.. зависимость.

shadcn CLI использовался только для импорта CSS: точная копия этого CSS сохранена в app/ui-variants.css с MIT-лицензией. tw-animate-css и drizzle-orm перенесены в devDependencies. fake-indexeddb добавлен только для теста реальной repository migration.

Проверялись static/dynamic imports, scripts, root Vite/PostCSS config, CSS imports, Vinext peers, server pg resolution, tests и генераторы. scripts/audit-project.mjs — вспомогательный TS-граф; он не заменяет ручную проверку CSS/tooling. Финальный граф не содержит недостижимых TS-компонентов.

Сохранены: React/RSC/Vinext и необходимые Vite peers; @base-ui/react/lucide/class helpers для UI; fflate/fast-xml-parser/unpdf для настоящих parsers; zod для validation; pg для server runtime; TypeScript/Oxlint/Tailwind/Drizzle для build и schema tooling. Корневой pdfjs-dist дублировал встроенный parser unpdf.

Legacy source='gmail' и provider_email сохранены как совместимые значения уже записанных workspace; это не действующая интеграция и они не дают разрешений.

## Исправления

- Workspace v1 → v2: последовательная migration, strict validation, атомарная запись с исходной копией; future/corrupt state не стирается. Reset удаляет также migration backups.
- Старые encrypted envelopes поддерживаются через их AAD/schemaVersion. CAS конфликты не перезаписывают локальные изменения молча.
- migrations/vault — единый каталог generation/runner. Drizzle baseline не повторяет CREATE TABLE. SQL checksum и advisory lock сохранены.
- localAction переименован в localCommand; псевдо-HTTP /api paths убраны из локальных операций. Device lifecycle вынесен из LocalApp в hook.
- Vault creation: 5/IP/час; API: 180/IP/мин; bounded limiter memory, streamed body limit и strict envelope validation. Proxy перезаписывает X-Real-IP.
- Docker stages разделяют build и production dependencies; runtime копирует только требуемые файлы. PostgreSQL без опубликованного порта, persistent volume, Caddy 80/443, readiness SELECT 1, shutdown handling.
- .gitignore/.dockerignore/.gitattributes, env comments, architecture/security/deployment/migration/backup docs приведены к текущему коду.

## Ограничения проверки

Windows Node 24: npm ci, backend npm ci, typecheck, lint, 47 tests и production build проходят. Production-only npm install и отдельный runtime smoke прошли: HTTP 200/CSP, настоящий PostgreSQL 14, ciphertext/recovery, конкурентные PUT 200/409, отсутствие plaintext/auth secret в БД. Drizzle generate: no schema changes. Source maps в build отсутствуют.

Браузер: прежний тестовый workspace сохранился, создание расхода → details → reload сохраняет данные. Этот smoke не является полным cross-browser/device E2E.

npm audit --omit=dev: 0 vulnerabilities. Четыре moderate advisory остаются в dev-only drizzle-kit/esbuild chain. Не применялся небезопасный downgrade через audit fix --force.

Docker compose config прошёл. docker compose build --no-cache остановлен по timeout: установленный Docker Engine возвращает Bad Gateway/не отвечает. Linux build и размер image НЕ подтверждены. Отдельный Windows production-only runtime не заменяет Linux Docker build. Vinext остаётся beta.

SSH и git ls-remote: Permission denied (publickey). Origin настроен на git@github.com:KaterinaZAB/flow.git, master переименован в main, история сохранена. Push не выполнен: нет SSH authentication и не пройден Linux Docker gate. После устранения этих внешних блокеров требуется чистая Docker-сборка и push; удалённый SHA пока сравнить нельзя.

Проверены рабочие файлы и 285 исторических blobs на распространённые token/private-key signatures: совпадений нет; в Git из env-файлов только .env.example. Это эвристическая проверка, не гарантия отсутствия всех возможных секретов.

## Размер

Физический workspace (включая ignored dependencies, build и сохранённые локальные базы): 752.17 → 406.00 MiB. root node_modules: 665.92 → 354.18 MiB; backend node_modules: 0.43 MiB. Сохранённые ignored .local данные/проверочные отчёты: 44.18 MiB. node_modules никогда не был отслеживаемым Git-файлом в текущем дереве и не добавлен в commit. Это размер папки на диске, не git pack/image. Docker image size не измерен из-за недоступного Engine.
