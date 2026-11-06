import type { usePrivy } from '@privy-io/expo';

type PrivyUser = NonNullable<ReturnType<typeof usePrivy>['user']>;
type Account = { type: string } & Record<string, unknown>;

function str(v: unknown) {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/** Best display name/handle we can get from Privy until the user has a Nostr profile. */
export function describeUser(user: PrivyUser) {
  const accounts = user.linked_accounts as unknown as Account[];
  const google = accounts.find((a) => a.type === 'google_oauth');
  const email = accounts.find((a) => a.type === 'email');

  const handle = str(google?.email) ?? str(email?.address);
  const name = str(google?.name) ?? handle?.split('@')[0] ?? 'You';
  const initials =
    name
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('') || '?';

  return { name, handle, initials };
}
