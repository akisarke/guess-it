import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';
import { api } from '../lib/api';

describe('Header mobile navigation', () => {
  it('keeps primary navigation behind an accessible mobile menu', async () => {
    vi.spyOn(api, 'getMe').mockRejectedValue(new Error('Not authenticated'));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    const menuButton = await screen.findByRole('button', { name: 'Open menu' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Mobile navigation' })).not.toBeInTheDocument();

    await user.click(menuButton);

    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Mobile navigation' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Mobile navigation' })).toHaveTextContent('Leaderboard');
  });

  it('does not request registered-user notifications for anonymous sessions', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        id: 'anonymous-user',
        displayName: 'Guest',
        email: null,
        authProvider: 'anonymous',
        hackclubId: null,
        bio: null,
        avatarUrl: null,
        usernameChosen: false,
        isDeveloper: false,
        isOwner: false,
        createdAt: new Date().toISOString(),
      },
    });

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Guess It!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
  });
});
