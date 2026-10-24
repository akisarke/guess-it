import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { Summary } from './Summary';

describe('Summary', () => {
  it('renders summary bars with sensible heights for a mixed score day', async () => {
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({
      puzzle: { id: 'p12', puzzleDate: '2026-10-21', puzzleNumber: 12, questionIds: ['q1', 'q2', 'q3'] },
      source: { kind: 'daily', id: 'p12' },
      questions: [
        { id: 'q1', prompt: 'how many', unit: 'x' },
        { id: 'q2', prompt: 'how much', unit: 'y' },
        { id: 'q3', prompt: 'how far', unit: 'z' },
      ],
      userGuesses: { q1: 1800, q2: 4.21, q3: 1.03 },
    });

    render(
      <MemoryRouter initialEntries={['/summary']}>
        <Routes>
          <Route path="/summary" element={<Summary />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Scores by question')).toBeInTheDocument());

    const bars = document.querySelectorAll('.summary-bar');
    expect(bars.length).toBe(3);
    const heights = Array.from(bars).map((el) => (el as HTMLSpanElement).style.height);
    expect(heights).toEqual(['19%', '84%', '100%']);
  });

  it('shows small height for unanswered questions', async () => {
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({
      puzzle: { id: 'p3', puzzleDate: '2026-10-21', puzzleNumber: 3, questionIds: ['q1', 'q2'] },
      source: { kind: 'daily', id: 'p3' },
      questions: [
        { id: 'q1', prompt: 'a', unit: 'x' },
        { id: 'q2', prompt: 'b', unit: 'y' },
      ],
      userGuesses: {},
    });

    render(
      <MemoryRouter initialEntries={['/summary']}>
        <Routes>
          <Route path="/summary" element={<Summary />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Play to score')).toBeInTheDocument());
    const bars = document.querySelectorAll('.summary-bar');
    expect(bars.length).toBe(2);
    expect((bars[0] as HTMLSpanElement).style.height).toBe('12%');
    expect((bars[1] as HTMLSpanElement).style.height).toBe('12%');
  });
});
