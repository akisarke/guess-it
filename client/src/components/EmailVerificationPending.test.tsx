import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EmailVerificationPending } from './EmailVerificationPending';
import { api } from '../lib/api';

describe('EmailVerificationPending', () => {
  it('resends verification without exposing account enumeration', async () => {
    vi.spyOn(api, 'resendVerification').mockResolvedValue({ message: 'If an account is eligible, a verification email is on its way.' });
    render(<MemoryRouter><EmailVerificationPending email="player@example.com" /></MemoryRouter>);
    await userEvent.click(screen.getByRole('button', { name: /resend verification/i }));
    expect(await screen.findByText(/if an account is eligible/i)).toBeInTheDocument();
    expect(screen.queryByText('player@example.com')).not.toBeInTheDocument();
  });
});
