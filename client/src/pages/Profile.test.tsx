import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Profile } from './Profile';
import { api, ApiError } from '../lib/api';

describe('Profile', () => {
  it('shares the public profile URL and reports the result inline', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    vi.spyOn(api, 'getProfile').mockResolvedValue({
      user: {
        id: 'ada',
        displayName: 'Ada',
        hackclubId: null,
        bio: null,
        avatarUrl: null,
        authProvider: 'password',
        email: null,
        usernameChosen: true,
        isDeveloper: false,
        isOwner: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      streak: { currentStreak: 2, longestStreak: 4, lastPlayedOn: null },
      badges: [],
      pinnedBadges: [],
      generatedSets: [],
    });

    render(
      <MemoryRouter initialEntries={['/profile/ada']}>
        <Routes>
          <Route path="/profile/:userId" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Share profile' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Share profile' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Profile link copied.'));
    expect(screen.getAllByRole('button', { name: 'Share profile' })).toHaveLength(1);
    expect(writeText).toHaveBeenCalledWith('http://localhost:3000/u/Ada');
    expect(api.getProfile).toHaveBeenCalledWith('ada');
  });

  it('loads a public profile by canonical display name handle', async () => {
    // Given: the canonical handle profile request returns Ada's public profile.
    vi.spyOn(api, 'getProfileByHandle').mockResolvedValue({
      user: {
        id: 'ada',
        displayName: 'Ada',
        hackclubId: null,
        bio: 'Loves puzzles',
        avatarUrl: null,
        authProvider: 'password',
        email: null,
        usernameChosen: true,
        isDeveloper: false,
        isOwner: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      streak: { currentStreak: 2, longestStreak: 4, lastPlayedOn: null },
      badges: [],
      pinnedBadges: [],
      generatedSets: [],
    });

    // When: the canonical handle route is rendered.
    render(
      <MemoryRouter initialEntries={['/u/Ada']}>
        <Routes>
          <Route path="/u/:handle" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    // Then: the handle API is called and Ada's profile is rendered.
    await waitFor(() => expect(api.getProfileByHandle).toHaveBeenCalledWith('Ada'));
    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByText('Loves puzzles')).toBeInTheDocument();
  });

  it('renders account actions for an unauthenticated own profile', async () => {
    // Given: the authenticated profile request returns the API's 401 error.
    vi.spyOn(api, 'getMyProfile').mockRejectedValue(new ApiError(401, 'Not authenticated'));

    // When: the own profile route is rendered.
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    // Then: the signed-out CTA replaces the retry-only error state.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Not Logged In' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('keeps a public profile not-found error distinct from signed-out state', async () => {
    // Given: the requested public profile does not exist.
    vi.spyOn(api, 'getProfile').mockRejectedValue(new ApiError(404, 'User not found'));

    // When: a public profile route is rendered.
    render(
      <MemoryRouter initialEntries={['/profile/missing-user']}>
        <Routes>
          <Route path="/profile/:userId" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    // Then: the not-found message remains a retryable profile error without account CTAs.
    await waitFor(() => expect(screen.getByText('User not found')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Not Logged In' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('keeps a server error distinct from signed-out state', async () => {
    // Given: the profile service returns a server error.
    vi.spyOn(api, 'getMyProfile').mockRejectedValue(new ApiError(500, 'Profile service unavailable'));

    // When: the own profile route is rendered.
    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    // Then: the server message and retry action remain visible.
    await waitFor(() => expect(screen.getByText('Profile service unavailable')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Not Logged In' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
