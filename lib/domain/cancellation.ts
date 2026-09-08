import type { Service, CancellationStrategy } from './types.ts';
export function cancellationStrategy(
  service: Service | undefined,
): CancellationStrategy {
  if (!service) return { type: 'unsupported' };
  const url = service.manageSubscriptionUrl ?? service.cancellationUrl;
  if (url && url.startsWith('https://')) return { type: 'external-url', url };
  if (service.cancellationInstructions?.length)
    return { type: 'instructions', steps: service.cancellationInstructions };
  return { type: 'unsupported' };
}
