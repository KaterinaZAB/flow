# Security / threat model

## Проверяемое обещание

Браузер шифрует финансовый сейф до сетевого запроса. Сервер не получает ключ расшифровки. Утечка новой PostgreSQL базы или её резервной копии не раскрывает содержание ciphertext при сохранности клиента и recovery secret.

## Crypto protocol v1

- Master secret: 32 случайных байта Web Crypto getRandomValues.
- HKDF-SHA-256, salt potok:v1:<vault UUID>, отдельные info vault-encryption и vault-auth.
- AES-256-GCM, 128-bit tag, случайный 96-bit IV на каждой операции.
- AAD связывает vault ID, encryptionVersion, algorithm и schemaVersion.
- Auth secret: отдельный HKDF output 256 bit, только в Authorization: Bearer по HTTPS. Сервер хранит SHA-256 verifier и сравнивает constant-time. Это высокоэнтропийный секрет, не пароль пользователя.
- Recovery: POTOK1:<UUID>:<64 hex symbols in groups of four>. Это представление случайного секрета, не самодельный mnemonic/KDF. Проверка структуры + GCM tag выявляют ошибку.
- Non-extractable CryptoKey хранится structured-clone в IndexedDB; это ограничивает exportKey, но не злоупотребление decrypt/encrypt вредоносным кодом.

Основания: [Web Crypto deriveKey/HKDF](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [AES-GCM IV](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams), [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).

## Metadata exposure

Сервер видит IP, user-agent на уровне HTTP, timestamp, vault ID, размеры ciphertext, частоту запросов, версии и verifier. Application log пишет request ID, обобщённый path, status и duration; query, bodies, Authorization, recovery и финансовые значения не логируются. Reverse proxy access log не включён. Настройки внешнего TLS-прокси также должны исключать чувствительные заголовки.

## Что не защищено

Malware, вредоносные расширения, XSS в origin, переданный другому человеку recovery key, полностью скомпрометированный браузер. Оператор, способный подменить JavaScript/PWA update, способен атаковать будущий клиент; zero-knowledge storage не означает доверие к вредоносной поставке кода. Независимый аудит и контроль цепочки сборки необходимы для более сильной модели угроз.

Локальный workspace не шифруется at rest. Потеря устройства/очистка браузера без сохранённого recovery/backup невосстановимы. Whole-vault sync не объединяет изменения автоматически; злонамеренный сервер может удалить/откатить ciphertext. Passkeys, QR, key rotation/device revocation и защита от rollback — не реализованы.

## XSS / PWA review

- Production launcher назначает nonce CSP: scripts self + nonce; unsafe-eval отсутствует; object-src none, base-uri none, frame-ancestors none, connect-src self. Vinext получает nonce через request CSP.
- Inline styles разрешены для существующих React chart/layout компонентов. Trusted Types пока не включены: требуется совместимость с React/Vinext/PDF. Это ограничение, не выполненная защита.
- Неиспользуемый ChartStyle с dangerouslySetInnerHTML удалён. Финансовые строки отображаются React как текст. Внешние письма не загружаются; отключённый Gmail parser удалён.
- Аналитические/сторонние scripts отсутствуют. Ссылки из публичного каталога валидируются как HTTPS. Каталог — недоверенные данные, не исполняемый код.
- Service worker кеширует только публичный shell и build assets. API, decrypted state, blobs, recovery и auth не входят в Cache Storage. При офлайн-загрузке используются header/HTML одной публичной shell response.
- npm audit: четыре moderate advisory относятся к dev-only цепочке drizzle-kit → esbuild-kit → esbuild. Уязвимость dev server не устраняется принудительным downgrade Drizzle; development tooling не публикуется. Production-only audit проверяется отдельно.

## Backend

HTTPS same-origin, Origin validation на writes; Bearer не использует cookie. Strict envelope schema/streamed size limit 9 MiB, parameterized SQL, atomic version CAS. In-memory rate limiting для single process, healthcheck и graceful shutdown. Создание vault ограничено 5 запросами/IP/час, общий API — 180/IP/мин, память limiter ограничена 10 000 ключей. Лимиты сбрасываются при restart; Caddy переписывает X-Real-IP, backend не должен быть доступен напрямую. Распределённый abuse может расходовать диск: перед открытым публичным сервисом нужны операционные квоты/мониторинг диска; это не решается шифрованием.

Gmail удалён. Нет Google login, email профиля, LLM financial requests или OpenAI frontend secret. Никаких утверждений о неприменимости законодательства не сделано.

## Восстановление и импорт

Если recovery key потерян, сервер не может восстановить данные. Пока устройство доступно, ключ можно повторно сохранить из настроек; при потере всех устройств и recovery данные невосстановимы. Храните ключ отдельно от encrypted backup.

CSV/XLSX ограничены 2 MiB, PDF — 5 MiB и 30 страницами; parsing ограничивает строки и распакованный XLSX. Формулы XLSX, DTD и malformed input отклоняются. CSV не исполняется; CSV-export отсутствует (backup — encrypted JSON), поэтому новые экспорты должны отдельно экранировать spreadsheet formulas. Исходный File не сохраняется в IndexedDB/сервере.
