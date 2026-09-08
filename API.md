# REST API

Все пути same-origin. Финансовые expenses/import/dashboard APIs и Google OAuth routes удалены и возвращают 404.

| Method / path | Назначение | Данные |
|---|---|---|
| GET /health | Readiness: SELECT 1 | status |
| GET /api/catalog/services | Публичный каталог из PostgreSQL | service metadata |
| GET /api/catalog/services/:slug | Публичный сервис | metadata или 404 |
| GET /api/catalog/version | Версия каталога/алгоритма | публичная config |
| GET /api/catalog/detection-rules | Публичные aliases/periods | правила |
| GET /api/config | Formats/feature flags | schemaVersion, formats, limits |
| POST /api/vaults | Создать | {id, envelope} |
| GET /api/vaults/:id | Скачать | {id,version,envelope} |
| PUT /api/vaults/:id | CAS update | {expectedVersion,envelope} |
| DELETE /api/vaults/:id | Удалить облачную копию | {deleted:true} |

Vault endpoints требуют Authorization: Bearer <derived auth secret>. Write requests требуют Origin=APP_ORIGIN. Не ставить секрет в URL. GET/PUT/DELETE проверяют verifier. 401 неверный секрет, 404 неизвестный/удалённый vault, 409 stale version/повтор id, 400 неверный пакет, 413 превышение размера, 503 недоступная база. Ответ ошибки: {error: string, code: string}. Все vault responses no-store.

Envelope v1: {encryptionVersion:1, algorithm:'AES-256-GCM', schemaVersion:2, iv:base64url, ciphertext:base64url}. База хранит эту оболочку как text и version. Сервер не выполняет дешифрование.

Encrypted envelope schemaVersion 1 также принимается для восстановления старых backups. POST /api/vaults: 5/IP/час; /api/*: 180/IP/мин. HTTP 429 содержит Retry-After.
