import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotLoggedIn } from './NotLoggedIn';

describe('NotLoggedIn', () => {
  it('shows account actions for a protected feature', () => {

    render(
      <MemoryRouter>
        <NotLoggedIn feature="your profile" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Not Logged In' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup');
    expect(screen.getByText(/log in or create account/i)).toBeInTheDocument();
  });
});
