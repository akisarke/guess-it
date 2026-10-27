import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

  it('shows the notification bell with a sign-in prompt for anonymous sessions', async () => {
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
    const getNotifications = vi.spyOn(api, 'getNotifications');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    const bell = await screen.findByRole('button', { name: /notifications/i });
    expect(getNotifications).not.toHaveBeenCalled();

    await user.click(bell);

    expect(screen.getByRole('dialog', { name: 'Notifications' })).toHaveTextContent('Sign in to get');
  });

  it('shows the notification button for a signed-in Hack Club member', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        id: 'hackclub-user',
        displayName: 'hackclub-abc12345',
        email: 'member@example.com',
        authProvider: 'hackclub',
        hackclubId: 'hc-1',
        bio: null,
        avatarUrl: null,
        usernameChosen: false,
        isDeveloper: false,
        isOwner: false,
        createdAt: new Date().toISOString(),
      },
    });
    vi.spyOn(api, 'getNotifications').mockResolvedValue({ notifications: [], unreadCount: 0 });

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /notifications/i })).toBeInTheDocument();
  });

  it('never shows the anon account name as the profile label', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        id: 'anonymous-user',
        displayName: 'anon-c112bbd5-1f7a-4e2b',
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

    const { container } = render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    await screen.findByText('Guess It!');
    expect(container.textContent).not.toContain('anon-');
    expect(screen.getAllByText('Profile').length).toBeGreaterThan(0);
  });

  it('sends you to the landing page after logging out', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: { id: 'u1', displayName: 'Ada', authProvider: 'password' } } as never);
    vi.spyOn(api, 'logout').mockResolvedValue(undefined as never);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <Header />
        <Routes>
          <Route path="/" element={<p>Landing page</p>} />
          <Route path="/profile" element={<p>Profile page</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click((await screen.findAllByRole('button', { name: /log out/i }))[0]!);
    expect(await screen.findByText('Landing page')).toBeInTheDocument();
  });
});
