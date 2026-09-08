import { z } from 'zod';
import { services } from '../domain/catalog';
import { expenseTypes } from '../domain/types';
import { deviceGet, devicePut } from './repository';
const url = z
  .string()
  .url()
  .refine((v) => new URL(v).protocol === 'https:');
const schema = z
  .array(
    z.object({
      id: z.string().min(1).max(100),
      name: z.string().min(1).max(120),
      category: z.enum(expenseTypes),
      group: z.string().max(100).optional(),
      merchantAliases: z.array(z.string().max(240)).max(100),
      website: url.optional(),
      manageSubscriptionUrl: url.optional(),
      cancellationUrl: url.optional(),
      cancellationInstructions: z
        .array(z.string().max(2000))
        .max(30)
        .optional(),
      color: z.string().regex(/^#[0-9a-f]{3,8}$/i),
      monogram: z.string().max(8),
    }),
  )
  .min(1)
  .max(2000);
function apply(value: unknown) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return false;
  services.splice(0, services.length, ...parsed.data);
  return true;
}
export async function loadCatalog() {
  const cached = await deviceGet('catalog');
  if (cached) apply(cached);
}
export async function refreshCatalog() {
  try {
    const response = await fetch('/api/catalog/services', {
      credentials: 'omit',
    });
    if (!response.ok) return;
    const value: unknown = await response.json();
    if (apply(value)) await devicePut('catalog', value);
  } catch {
    /* Packaged/cached public catalog remains available offline. */
  }
}
