export interface ShareableProfile {
  readonly displayName: string;
}

export class ProfileShareError extends Error {
  readonly code = 'clipboard-failed' as const;

  constructor() {
    super('Unable to copy the profile link.');
    this.name = 'ProfileShareError';
  }
}

export async function shareProfile(profile: ShareableProfile, url: string): Promise<'shared' | 'copied'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `${profile.displayName}'s Guess It! profile`,
        text: `See ${profile.displayName}'s Guess It! profile.`,
        url,
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
      throw error;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    throw new ProfileShareError();
  }
}
