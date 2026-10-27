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

    render(
      <MemoryRouter initialEntries={['/u/Ada']}>
        <Routes>
          <Route path="/u/:handle" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(api.getProfileByHandle).toHaveBeenCalledWith('Ada'));
    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByText('Loves puzzles')).toBeInTheDocument();
  });

  it('renders account actions for an unauthenticated own profile', async () => {

    vi.spyOn(api, 'getMyProfile').mockRejectedValue(new ApiError(401, 'Not authenticated'));

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Not Logged In' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('asks an anonymous session to sign up instead of showing a raw error', async () => {
    vi.spyOn(api, 'getMyProfile').mockRejectedValue(new ApiError(403, 'Create an account to use this feature.'));

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Not Logged In' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /create account/i })).toHaveAttribute('href', '/signup');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('keeps a public profile not-found error distinct from signed-out state', async () => {

    vi.spyOn(api, 'getProfile').mockRejectedValue(new ApiError(404, 'User not found'));

    render(
      <MemoryRouter initialEntries={['/profile/missing-user']}>
        <Routes>
          <Route path="/profile/:userId" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('User not found')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Not Logged In' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('keeps a server error distinct from signed-out state', async () => {

    vi.spyOn(api, 'getMyProfile').mockRejectedValue(new ApiError(500, 'Profile service unavailable'));

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Profile service unavailable')).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Not Logged In' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('leads with guessing skill and offers a visitor the add-friend action', async () => {
    vi.spyOn(api, 'getProfileByHandle').mockResolvedValue({
      user: { id: 'grace', displayName: 'Grace', bio: null, avatarUrl: null, isDeveloper: false, createdAt: '2026-01-01T00:00:00.000Z' },
      streak: { currentStreak: 0, longestStreak: 5, lastPlayedOn: '2026-10-20T00:00:00.000Z' },
      skill: { questionsPlayed: 9, averageMiss: 1.84, bestMiss: 1.02, recentDays: [{ date: '2026-10-20T00:00:00.000Z', averageMiss: 1.5 }] },
      badges: [{ badgeId: 'bullseye', isPinned: true, grantedAt: '2026-10-01T00:00:00.000Z', badge: { id: 'bullseye', name: 'Bullseye', description: 'Land within 1.05x', isSecret: false } }],
      pinnedBadges: [],
      generatedSets: [],
    } as never);
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: { id: 'me' } } as never);
    vi.spyOn(api, 'getFriends').mockResolvedValue({ friends: [], incoming: [], outgoing: [] });
    const sendFriendRequest = vi.spyOn(api, 'sendFriendRequest').mockResolvedValue({ success: true });

    render(
      <MemoryRouter initialEntries={['/u/Grace']}>
        <Routes>
          <Route path="/u/:handle" element={<Profile />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('1.84×')).toBeInTheDocument();
    expect(screen.getByText('1.02×')).toBeInTheDocument();
    expect(screen.getByText('Best streak')).toBeInTheDocument();
    expect(screen.queryByText(/Play today/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Question sets/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'About badge Bullseye' }));
    expect(screen.getByText(/Land within 1.05x/)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Add friend' }));
    await waitFor(() => expect(sendFriendRequest).toHaveBeenCalledWith('Grace'));
    expect(await screen.findByRole('button', { name: 'Friend request sent' })).toBeDisabled();
  });
});
