import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { writeHardMode } from '../lib/hard-mode';
import { saveHardModeRun } from '../lib/hard-mode-history';
import { Summary } from './Summary';

describe('Summary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

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

  it('labels the daily score with the mode it was played in', async () => {
    writeHardMode(true);
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({
      puzzle: { id: 'p12', puzzleDate: '2026-10-21', puzzleNumber: 12, questionIds: ['q1', 'q2', 'q3'] },
      source: { kind: 'daily', id: 'p12' },
      questions: [
        { id: 'q1', prompt: 'how many', unit: 'x' },
        { id: 'q2', prompt: 'how much', unit: 'y' },
        { id: 'q3', prompt: 'how far', unit: 'z' },
      ],
      userGuesses: { q1: 2, q2: 3, q3: 4 },
      guessesByMode: { easy: { q1: 2, q2: 3, q3: 4 }, hard: { q1: 7 } },
    });

    render(
      <MemoryRouter initialEntries={['/summary']}>
        <Routes>
          <Route path="/summary" element={<Summary />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Hard mode score')).toBeInTheDocument();
    expect(screen.getByText('1/3 Answered')).toBeInTheDocument();
  });

  it('shows the latest saved hard mode practice run', async () => {
    saveHardModeRun({
      puzzleNumber: 43,
      puzzleDate: '2026-10-01T00:00:00.000Z',
      completedAt: '2026-10-27T12:00:00.000Z',
      results: [
        {
          question: { id: 'hq1', prompt: 'Hard question?', unit: 'm' },
          guess: 10,
          answer: 20,
          score: 2,
        },
      ],
    });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({
      puzzle: { id: 'p12', puzzleDate: '2026-10-21', puzzleNumber: 12, questionIds: ['q1'] },
      source: { kind: 'daily', id: 'p12' },
      questions: [{ id: 'q1', prompt: 'how many', unit: 'x' }],
      userGuesses: {},
    });

    render(
      <MemoryRouter initialEntries={['/summary']}>
        <Routes>
          <Route path="/summary" element={<Summary />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Hard mode' }));
    expect(screen.getByText('Latest hard mode practice')).toBeInTheDocument();
    expect(screen.getByText('Puzzle #43')).toBeInTheDocument();
    expect(screen.getByText('Hard question?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
    expect(screen.getByText('how many')).toBeInTheDocument();
    expect(screen.queryByText('Hard question?')).not.toBeInTheDocument();
  });

  it('opens on the hard mode run when coming back from hard mode', async () => {
    saveHardModeRun({
      puzzleNumber: 44,
      puzzleDate: '2026-10-02T00:00:00.000Z',
      completedAt: '2026-10-27T12:00:00.000Z',
      results: [{ question: { id: 'hq9', prompt: 'Back from hard mode?', unit: 'm' }, guess: 10, answer: 10, score: 1 }],
    });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({
      puzzle: { id: 'p12', puzzleDate: '2026-10-21', puzzleNumber: 12, questionIds: ['q1'] },
      source: { kind: 'daily', id: 'p12' },
      questions: [{ id: 'q1', prompt: 'how many', unit: 'x' }],
      userGuesses: {},
    });

    render(
      <MemoryRouter initialEntries={['/summary?mode=hard']}>
        <Routes>
          <Route path="/summary" element={<Summary />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Back from hard mode?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hard mode' })).toHaveAttribute('aria-pressed', 'true');
  });
});
