# Linux / Docker deployment

## Предварительно

Docker Engine + Compose plugin, домен, DNS A (и корректный AAAA при IPv6) на сервер; входящие TCP 80/443. Не открывайте PostgreSQL/3000 наружу. Caddy получает и обновляет TLS сертификат. Нужен исходящий доступ registry/npm при сборке.

## Переменные

- APP_DOMAIN: например app.example.com, без scheme/path.
- APP_ORIGIN: https://app.example.com в production (Compose задаёт из APP_DOMAIN).
- POSTGRES_PASSWORD: случайный hex пароль. DATABASE_URL для локальных скриптов/разработки.
- NODE_ENV, PORT: runtime defaults в Docker.

GOOGLE_CLIENT_ID/SECRET, OAUTH_TOKEN_ENCRYPTION_KEY, SESSION_SECRET и OPENAI_API_KEY больше не нужны. Сервер не получает recovery/master/encryption key через env.

## Первый запуск

    cp .env.example .env
    openssl rand -hex 32

Запишите полученный пароль в POSTGRES_PASSWORD и DATABASE_URL, задайте домен. Не публикуйте .env. Для прежнего deployment сначала прочитайте MIGRATION.md.

    docker compose config --quiet
    docker compose build
    docker compose up -d --wait
    docker compose ps
    curl --fail https://app.example.com/health

Backend entrypoint выполняет checksum migrations с advisory lock, затем seed только публичного service catalog, затем Node server. Postgres 17, отдельный persistent volume vault_postgres_data. Caddy — сервис frontend/reverse proxy; assets и SSR shell обслуживает Node, потому что существующий Vinext использует RSC. Frontend с нуля на SPA framework не переписан.

## Local development with server sync

    npm ci
    npm ci --prefix backend
    cp .env.example .env
    docker compose -f docker-compose.dev.yml up -d
    npm run db:migrate
    npm run db:seed
    npm run dev

Для production/offline preview: npm run build, затем node --env-file=.env scripts/server.mjs. NODE_ENV=development и localhost APP_ORIGIN допустимы только локально; production требует HTTPS. Web Crypto/Web Locks/IndexedDB должны поддерживаться браузером.

## Проверка сервера и базы

    docker compose exec postgres psql -U potok -d potok -c '\dt'
    docker compose exec postgres psql -U potok -d potok -c 'SELECT id,version,schema_version,octet_length(encrypted_blob) FROM vaults;'

Ожидаемые таблицы: vaults, services, service_aliases, app_migrations. В vaults нет name/email/amount/payment_date. Не выводите auth header/recovery в терминал. Для проверки отсутствия plaintext используйте искусственное уникальное название расхода и проверьте encrypted_blob после sync.

На отдельном тестовом deployment с тем же APP_ORIGIN и доступной DATABASE_URL:

    RUN_VAULT_E2E=yes node --env-file=.env --experimental-strip-types scripts/test-vault.mjs

Скрипт создаёт только случайный тестовый vault, проверяет реальную PostgreSQL запись, AES recovery, конкурентные PUT → один 200 и один 409, отсутствие plaintext/raw auth secret и удаляет свой vault.

## Browser verification

1. Чистый browser profile: / открывается, нет Google login/demo расходов как личных.
2. Добавить расход → перезагрузить → значение сохранено.
3. После готовности service worker отключить сеть: list/details/edit/import/recommendations работают.
4. CSV/XLSX/PDF: в Network нет multipart/financial POST. Подтверждение кандидатов меняет Dashboard локально.
5. Settings → sync → сохранить recovery. В Network POST/PUT содержат только ID/version/envelope; имена/суммы не видны.
6. Второй browser profile → recovery → те же расходы.
7. Оба устройства изменить офлайн; sync A, затем B → конфликт, явный выбор.
8. Удалить cloud → локальные данные остаются. Удалить local → cloud не удаляется. Encrypted backup + отдельный ключ восстанавливаются локально.

## Backup / restore PostgreSQL

    docker compose exec -T postgres pg_dump -U potok -d potok -Fc > potok-vaults.dump

Восстановление — на отдельную подготовленную базу, при остановленном backend:

    docker compose stop backend
    docker compose exec -T postgres pg_restore -U potok -d potok --clean --if-exists < potok-vaults.dump
    docker compose up -d backend

Restore перезаписывает целевую базу: проверьте имя и сохраните её backup заранее. Dump содержит ciphertext и verifier/метаданные, поэтому храните его с ограниченными правами.


## Миграции и обновления

Единый источник: migrations/vault. npm run db:generate использует Drizzle snapshot/journal в этой же директории; runner применяет SQL по имени, проверяет checksum и использует advisory lock. Не редактируйте уже применённый SQL. Новая схема → новая миграция → review → backup → deployment.

Docker использует отдельные build, production-dependencies и runtime stages. В runtime копируются dist, production npm dependencies, pg и необходимые server/migration/catalog scripts; тесты, .git, .env и host node_modules не копируются.

Храните backup вне сервера, с ограниченным доступом и шифрованием носителя; регулярно проверяйте восстановление. Шифрование не защищает от удаления диска, повреждения или ошибочного deployment. PostgreSQL backup не заменяет recovery key: без него ciphertext не расшифровать.
