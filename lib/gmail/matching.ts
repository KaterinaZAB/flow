import { services } from '../domain/catalog.ts';
import type { PreparedEmail } from './types.ts';
export const senderMatches = (sender: string, domain: string) => {
  const actual = sender.split('@')[1]?.toLowerCase();
  return !!actual && (actual === domain || actual.endsWith('.' + domain));
};
export function matchEmailService(email: PreparedEmail) {
  const service = services.find(
    (s) =>
      s.emailMatchers?.senderEmails?.includes(email.sender) ||
      s.emailMatchers?.senderDomains?.some((d) =>
        senderMatches(email.sender, d),
      ),
  );
  return service ?? null;
}
