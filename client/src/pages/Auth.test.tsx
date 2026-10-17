import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Auth } from './Auth';
import { api } from '../lib/api';

const user = { id: 'u1', displayName: 'Player', email: 'player@example.com', authProvider: 'password', hackclubId: null, bio: null, avatarUrl: null, usernameChosen: false, isDeveloper: false, isOwner: false, createdAt: '' };

describe('Auth pending verification', () => {
  it.each(['signup', 'login'] as const)('replaces the %s form with pending verification', async (mode) => {
    if (mode === 'signup') vi.spyOn(api, 'signup').mockResolvedValue({ user, migratedFromAnonymous: false, pendingVerification: true });
    else vi.spyOn(api, 'login').mockResolvedValue({ user, pendingVerification: true });
    render(<MemoryRouter><Auth mode={mode} /></MemoryRouter>);
    const email = screen.getByLabelText('Email address');
    await userEvent.type(email, 'player@example.com');
    if (mode === 'signup') {
      await userEvent.type(screen.getByLabelText('Display name'), 'Player');
      await userEvent.type(screen.getByLabelText('Password'), 'password123');
      await userEvent.type(screen.getByLabelText('Confirm password'), 'password123');
    } else await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getAllByRole('button', { name: mode === 'signup' ? /create account/i : /^sign in$/i })[0]);
    expect(await screen.findByRole('heading', { name: /verify your email/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with hack club/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: mode === 'signup' ? /create account/i : /sign in/i })).not.toBeInTheDocument();
  });
});
