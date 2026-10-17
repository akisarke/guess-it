import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { Leaderboard } from './Leaderboard';

describe('Leaderboard', () => {
  it('renders public avatars, profile links, flags, pinned badges, and compact scores', async () => {
    vi.spyOn(api, 'getLeaderboard').mockResolvedValue([
      {
        userId: 'ada',
        displayName: 'Ada',
        avatarUrl: '/avatars/ada.png',
        score: 1_250_000,
        rank: 1,
        isHackClubMember: true,
        pinnedBadges: [{ badgeId: 'first', badge: { name: 'First Guess' } }],
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/leaderboard']}>
        <Routes>
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/u/Ada'));
    expect(screen.getByRole('img', { name: "Ada's profile picture" })).toHaveAttribute('src', 'http://localhost:3000/avatars/ada.png');
    expect(screen.getByText('First Guess')).toBeInTheDocument();
    expect(screen.getByTitle('1,250,000×')).toHaveTextContent('1.25M×');
    expect(screen.getByRole('img', { name: /Hack Club/i })).toBeInTheDocument();
  });
});
