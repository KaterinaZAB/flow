import {
  workspaceSchema,
  workspaceV1Schema,
  type Workspace,
} from './schema.ts';
export const CURRENT_WORKSPACE_VERSION = 2;
/** Pure sequential migrations. Input is never mutated; unknown future formats fail closed. */
export function migrateV1ToV2(raw: unknown): Workspace {
  const old = workspaceV1Schema.parse(raw);
  return workspaceSchema.parse({ ...old, schemaVersion: 2 });
}
export function migrateWorkspace(raw: unknown): Workspace {
  if (!raw || typeof raw !== 'object' || !('schemaVersion' in raw))
    throw new Error('Неизвестный формат данных. Исходная копия сохранена.');
  let value: unknown = raw,
    version = raw.schemaVersion;
  if (version === 1) {
    value = migrateV1ToV2(value);
    version = 2;
  }
  if (version !== CURRENT_WORKSPACE_VERSION)
    throw new Error(
      'Для этих данных нужна другая версия приложения. Исходная копия сохранена.',
    );
  return workspaceSchema.parse(value);
}
