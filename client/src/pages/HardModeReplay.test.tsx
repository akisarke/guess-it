import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HardModePuzzleResponse } from 'shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../lib/api';
import { readLatestHardModeRun } from '../lib/hard-mode-history';
import { HardModeReplay } from './HardModeReplay';

function randomPuzzle(puzzleNumber: number, questionIds = ['q1', 'q2', 'q3']): HardModePuzzleResponse {
  return {
    puzzleNumber,
    puzzleDate: '2026-10-01T00:00:00.000Z',
    questions: questionIds.map((id, index) => ({
      id,
      prompt: `Random question ${index + 1}?`,
      unit: 'm',
    })),
  };
}

function renderReplay() {
  return render(
    <MemoryRouter initialEntries={['/hard-mode']}>
      <Routes>
        <Route path="/hard-mode" element={<HardModeReplay />} />
        <Route path="/summary" element={<p>Summary page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HardModeReplay', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('scores a random puzzle guess and moves to the next question', async () => {
    vi.spyOn(api, 'getHardModePuzzle').mockResolvedValue(randomPuzzle(43));
    const submitGuess = vi.spyOn(api, 'submitHardModeGuess').mockResolvedValue({
      score: 2,
      answer: 10,
      direction: 'Too Low',
      scoreBand: 'medium',
      distribution: { bins: [{ low: 5, high: 20, count: 3 }], userGuess: 5, medianGuess: 8, answer: 10, napkinMath: 'Ten metres', sourceTitle: 'Source', sourceUrl: 'https://example.com' },
    });

    renderReplay();

    expect(await screen.findByText(/Puzzle #43/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Guess in m'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));

    expect(await screen.findByText('The answer')).toBeInTheDocument();
    expect(screen.getByTitle('2×')).toHaveTextContent('2×');
    expect(screen.getByText('How everyone guessed')).toBeInTheDocument();
    expect(submitGuess).toHaveBeenCalledWith({ questionId: 'q1', value: 5 });

    fireEvent.click(screen.getByRole('button', { name: 'Next question' }));
    expect(screen.getByText('Random question 2?')).toBeInTheDocument();
  });

  it('loads another random puzzle after a round', async () => {
    const getPuzzle = vi.spyOn(api, 'getHardModePuzzle')
      .mockResolvedValueOnce(randomPuzzle(43, ['q1']))
      .mockResolvedValueOnce(randomPuzzle(44, ['q9']));
    vi.spyOn(api, 'submitHardModeGuess').mockResolvedValue({
      score: 1,
      answer: 10,
      direction: 'Exact',
      scoreBand: 'close',
      distribution: { bins: [{ low: 5, high: 20, count: 3 }], userGuess: 10, medianGuess: 8, answer: 10, napkinMath: 'Ten metres', sourceTitle: 'Source', sourceUrl: 'https://example.com' },
    });

    renderReplay();

    expect(await screen.findByText(/Puzzle #43/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Guess in m'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
    await screen.findByText('The answer');
    await waitFor(() => expect(readLatestHardModeRun()).toMatchObject({
      puzzleNumber: 43,
      results: [{ guess: 10, answer: 10, score: 1 }],
    }));

    fireEvent.click(screen.getByRole('button', { name: 'See hard mode score' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play another random puzzle' }));

    expect(await screen.findByText(/Puzzle #44/)).toBeInTheDocument();
    expect(getPuzzle).toHaveBeenCalledTimes(2);
    expect(getPuzzle.mock.calls[0]?.[0]).toEqual([]);
    expect(getPuzzle.mock.calls[0]?.[1]).toEqual([]);
    expect(getPuzzle.mock.calls[1]?.[0]).toEqual([43]);
    expect(getPuzzle.mock.calls[1]?.[1]).toEqual(['q1']);
  });

  it('shows an all-caught-up screen instead of an error when every past puzzle is played', async () => {
    vi.spyOn(api, 'getHardModePuzzle').mockRejectedValue(new ApiError(404, "You've played every past puzzle.", undefined, 'NOT_FOUND'));

    renderReplay();

    expect(await screen.findByText("You've played every past puzzle")).toBeInTheDocument();
    expect(screen.queryByText('Hard mode unavailable')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See your last run' })).toHaveAttribute('href', '/summary?mode=hard');
  });
});
