import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GeneratedSetsDisclosure } from './GeneratedSetsDisclosure';

describe('GeneratedSetsDisclosure', () => {
  it('shows an empty state when the profile has no generated sets', () => {
    render(<MemoryRouter><GeneratedSetsDisclosure sets={[]} /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Question sets you made' })).toBeVisible();
    expect(screen.getByText(/No generated sets yet/i)).toBeVisible();
  });

  it('lists sets in API order with metadata and summary links', () => {
    render(
      <MemoryRouter>
        <GeneratedSetsDisclosure sets={[
          { id: 'set one', title: 'Ocean estimates', topic: 'oceans', difficulty: 'medium', createdAt: '2026-09-12T00:00:00Z', completed: true },
          { id: 'set-two', title: 'City scale', topic: 'cities', difficulty: null, createdAt: '2026-09-11T00:00:00Z', completed: false },
        ]} />
      </MemoryRouter>,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Ocean estimates');
    expect(links[0]).toHaveAttribute('href', '/sets/set%20one/summary');
    expect(links[0]).toHaveTextContent('Completed');
    expect(links[1]).toHaveTextContent('Any difficulty');
    expect(links[1]).toHaveTextContent('In progress');
  });
});
