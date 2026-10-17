import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { VerifyEmail } from './VerifyEmail';
import { api } from '../lib/api';

describe('VerifyEmail', () => {
  it('does not consume a one-time verification token more than once in StrictMode', async () => {
    const verifyEmail = vi.spyOn(api, 'verifyEmail').mockResolvedValue(undefined);

    render(<StrictMode><MemoryRouter initialEntries={['/verify-email?token=fresh-token']}><VerifyEmail /></MemoryRouter></StrictMode>);

    await waitFor(() => expect(verifyEmail).toHaveBeenCalledTimes(1));
  });
});
