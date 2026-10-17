import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import { api, type NotificationItem } from '../lib/api';

const badgeNotification: NotificationItem = {
  id: 'badge-1',
  type: 'badge_awarded',
  title: 'New badge earned',
  message: 'You earned the Exact badge.',
  actionUrl: '/profile',
  actionLabel: 'View profile',
  readAt: null,
  createdAt: '2026-09-27T12:00:00.000Z',
};

describe('NotificationBell', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows a popup when a new badge notification arrives after initial load', async () => {
    vi.useFakeTimers();
    const getNotifications = vi.spyOn(api, 'getNotifications')
      .mockResolvedValueOnce({ notifications: [], unreadCount: 0 })
      .mockResolvedValue({ notifications: [badgeNotification], unreadCount: 1 });

    render(<MemoryRouter><NotificationBell /></MemoryRouter>);
    await act(async () => undefined);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(getNotifications).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('guessit:notifications-changed'));
    });

    expect(screen.getByRole('status')).toHaveTextContent('New badge earned');
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute('href', '/profile');
  });
});
