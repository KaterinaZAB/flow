# Архитектура

Browser PWA → localCommand / repositories → IndexedDB workspace → domain analytics/detection/recommendations → UI.

Optional: workspace → Web Crypto encrypt → HTTPS REST → Node vault module → PostgreSQL ciphertext.
Restore: recovery package → HKDF locally → authenticated download → AES-GCM decrypt → Zod validation → IndexedDB transaction.

## Локальные модули

- lib/local/schema.ts: версия 2, строгая проверка расходов/операций/кандидатов/импортов/настроек.
- lib/local/repository.ts: отдельная база potok-local-v1; stores workspace и device. Чтение/запись состояния в одной IndexedDB readwrite transaction, уведомления вкладок через BroadcastChannel.
- lib/local/actions.ts: совместимый адаптер существующих форм; Response — локальный результат, не fetch. Финансовых HTTP endpoints больше нет.
- lib/import: CSV/XLSX/PDF parser. Исходный File и расшифрованные строки не покидают браузер.
- lib/domain: деньги в integer minor units, календарный detection weekly/monthly/quarterly/yearly, прогнозы и рекомендации. Производные значения пересчитываются локально.
- lib/local/catalog.ts: проверенный публичный каталог из API/IndexedDB; bundled catalog остаётся fallback для offline.
- lib/vault/crypto.ts: Web Crypto; lib/vault/sync.ts: отдельный sync coordinator.

## Сервер

Node/Vinext обслуживает публичный shell, REST каталога и vault. SSR не читает финансовое хранилище. PostgreSQL: vaults, services, service_aliases, app_migrations. Инструкции отмены входят в публичный JSON metadata сервисов; версии правил/config — версионированный код. Старые User/Session/financial репозитории и маршруты удалены из runtime.

## Sync

Полный snapshot, debounce 1.5 сек после commit; sync при открытии, online event и вручную. Web Locks сериализуют sync между вкладками одного origin. Незасинхронизированная локальная revision сохраняется при ошибке. При новой облачной версии и локальных изменениях — 409/conflict UI. Выбор cloud/local требует подтверждения; даже явная перезапись использует свежую expectedVersion и не обходит CAS.

Ключи устройства: non-extractable AES CryptoKey и отдельный auth secret в IndexedDB device. Master secret не хранится открыто; recovery representation хранится обёрнутым AES-GCM под локальным CryptoKey для повторного показа. Финансовый workspace локально открыт: это не защита от захвата устройства.

## Миграции workspace

migrateWorkspace последовательно переводит v1 → v2, проверяет строгую схему и не изменяет входной объект. IndexedDB хранит исходную pre-migration копию и новый current атомарно. Неизвестная/повреждённая версия блокирует запись без очистки. Явный сброс устройства удаляет также migration backups. Decrypt старого vault использует его schemaVersion в AAD, затем ту же миграцию.

LocalApp компонует страницы; hooks/use-local-workspace.ts управляет жизненным циклом IndexedDB/catalog/sync. Domain не зависит от React. localCommand возвращает Response только как совместимый локальный результат, не выполняет HTTP.
