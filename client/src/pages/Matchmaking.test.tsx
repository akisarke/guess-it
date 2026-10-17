import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Matchmaking } from './Matchmaking';
import { ApiError, api } from '../lib/api';

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe('Matchmaking auth gate', () => {
  it('renders the signed-out state at mount when auth returns 401', async () => {
    // Given: the initial auth check returns 401.
    vi.spyOn(api, 'getMe').mockRejectedValue(new ApiError(401, 'Not authenticated'));

    // When: Matchmaking mounts.
    render(
      <MemoryRouter>
        <Matchmaking />
      </MemoryRouter>,
    );

    // Then: the reusable signed-out state is shown without the queue action.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Not Logged In' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Join Queue' })).not.toBeInTheDocument();
  });

  it('announces a recoverable queue failure', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        id: 'user-1',
        displayName: 'Player One',
        email: null,
        authProvider: 'password',
        hackclubId: null,
        bio: null,
        avatarUrl: null,
        usernameChosen: true,
        isDeveloper: false,
        isOwner: false,
        createdAt: '2026-09-12T00:00:00Z',
      },
    });
    vi.spyOn(api, 'joinQueue').mockRejectedValue(new ApiError(503, 'Matchmaking is temporarily unavailable'));

    render(
      <MemoryRouter>
        <Matchmaking />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Join Queue' })).toBeEnabled());
    await screen.getByRole('button', { name: 'Join Queue' }).click();

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Matchmaking is temporarily unavailable'));
  });

  it('enters the duel when queue matching succeeds', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        id: 'user-1', displayName: 'Player One', email: null, authProvider: 'password', hackclubId: null,
        bio: null, avatarUrl: null, usernameChosen: true, isDeveloper: false, isOwner: false,
        createdAt: '2026-09-12T00:00:00Z',
      },
    });
    vi.spyOn(api, 'joinQueue').mockResolvedValue({
      status: 'matched', entryId: 'entry-1', isNewMatch: true, match: { id: 'duel-1' },
    });

    render(
      <MemoryRouter>
        <Matchmaking />
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Join Queue' })).toBeEnabled());
    await screen.getByRole('button', { name: 'Join Queue' }).click();

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/duels/duel-1'));
  });
});
