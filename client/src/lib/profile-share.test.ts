import { describe, expect, it, vi } from 'vitest';
import { ProfileShareError, shareProfile } from './profile-share';

describe('shareProfile', () => {
  it('uses Web Share with profile title, text, and URL', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });

    await expect(shareProfile({ displayName: 'Ada' }, 'https://guessit.game/profile/ada')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: "Ada's Guess It! profile",
      text: "See Ada's Guess It! profile.",
      url: 'https://guessit.game/profile/ada',
    });
  });

  it('uses the clipboard when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(shareProfile({ displayName: 'Ada' }, 'https://guessit.game/profile/ada')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://guessit.game/profile/ada');
  });

  it('treats Web Share cancellation as a completed action', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
    vi.stubGlobal('navigator', { share });

    await expect(shareProfile({ displayName: 'Ada' }, 'https://guessit.game/profile/ada')).resolves.toBe('shared');
  });

  it('returns a typed failure when clipboard writing fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    await expect(shareProfile({ displayName: 'Ada' }, 'https://guessit.game/profile/ada'))
      .rejects.toBeInstanceOf(ProfileShareError);
  });
});
