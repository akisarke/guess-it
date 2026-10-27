import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Admin } from './Admin';
import { api } from '../lib/api';

function renderAdmin() {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<p>Landing page</p>} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Admin access', () => {
  it('sends a signed-in player who is not the owner back to the landing page', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: { id: 'u1', isOwner: false } } as never);
    renderAdmin();
    expect(await screen.findByText('Landing page')).toBeInTheDocument();
  });

  it('sends a signed-out visitor back to the landing page', async () => {
    vi.spyOn(api, 'getMe').mockRejectedValue(new Error('Not authenticated'));
    renderAdmin();
    expect(await screen.findByText('Landing page')).toBeInTheDocument();
  });

  it('shows the panel to the owner', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: { id: 'u1', isOwner: true } } as never);
    renderAdmin();
    expect(await screen.findByRole('button', { name: /search/i })).toBeInTheDocument();
    expect(screen.queryByText('Landing page')).not.toBeInTheDocument();
  });
});
