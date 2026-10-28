import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { api, ApiError } from '../lib/api';
import { daily, generated } from '../test/solo-fixtures';

vi.mock('../components/Header', () => ({ Header: () => null }));
vi.mock('../lib/sounds', () => ({ play: vi.fn() }));

function open(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(daily);
  vi.spyOn(api, 'getPuzzle').mockResolvedValue(daily);
});

describe('source-aware solo routes', () => {
  it('keeps the root landing page idle until Play is clicked', async () => {
    vi.spyOn(api, 'getMe').mockRejectedValue(new ApiError(401, 'Not authenticated'));
    const getTodayPuzzle = vi.spyOn(api, 'getTodayPuzzle');

    open('/');

    await waitFor(() => expect(screen.getByRole('button', { name: /play today/i })).toBeVisible());
    expect(getTodayPuzzle).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Guess in fish')).not.toBeInTheDocument();
  });

  it.each(['/play/0', '/play/0?puzzle=42'])('submits the canonical daily source from %s', async (path) => {

    const submit = vi.spyOn(api, 'submitGuess').mockRejectedValue(new ApiError(409, 'Already guessed'));
    open(path);

    await userEvent.type(await screen.findByLabelText('Guess in fish'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Lock it in' }));

    expect(submit).toHaveBeenCalledWith({ source: daily.source, questionId: 'q1', value: 50, mode: 'easy' });
  });

  it('locks in the current guess when hard mode runs out', async () => {
    const submit = vi.spyOn(api, 'submitGuess').mockRejectedValue(new ApiError(500, 'Try again'));

    open('/play/0');
    await screen.findByLabelText('Guess in fish');
    fireEvent.change(screen.getByLabelText('Guess in fish'), { target: { value: '50' } });
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /hard mode/i }));

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    vi.useRealTimers();

    expect(submit).toHaveBeenCalledWith({ source: daily.source, questionId: 'q1', value: 50, mode: 'hard' });
  });

  it('loads generated play without revealing private details and submits its source', async () => {

    vi.spyOn(api, 'getQuestionSetPlay').mockResolvedValue(generated);
    const submit = vi.spyOn(api, 'submitGuess').mockRejectedValue(new ApiError(500, 'Try again'));
    open('/sets/set%20one/play/0');

    await userEvent.type(await screen.findByLabelText('Guess in fish'), '50');
    expect(screen.getByText('Ocean estimates')).toBeVisible();
    expect(screen.getByText(/oceans.*medium/i)).toBeVisible();
    expect(screen.getByText(/Generated set/)).toBeVisible();
    expect(document.getElementById('main-content')).not.toHaveTextContent(/correct answer|napkin math|score band/i);
    await userEvent.click(screen.getByRole('button', { name: 'Lock it in' }));

    expect(submit).toHaveBeenCalledWith({ source: generated.source, questionId: 'q1', value: 50 });
    expect(api.getTodayPuzzle).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  });

  it('rehydrates generated reveals and ends the third round at its summary', async () => {

    vi.spyOn(api, 'getQuestionSetPlay').mockResolvedValue({ ...generated, userGuesses: { q1: 2, q2: 1, q3: 3 } });
    vi.spyOn(api, 'getDistribution').mockResolvedValue({ bins: [], answer: 100, userGuess: 50, medianGuess: 50, napkinMath: 'Count the coastlines.' });
    vi.spyOn(api, 'getQuestionSetSummary').mockResolvedValue({ ...generated, userGuesses: { q1: 2, q2: 1, q3: 3 }, completed: true, averageScore: 2 });
    open('/sets/set%20one/reveal/2');

    await userEvent.click(await screen.findByRole('link', { name: 'See summary' }));

    expect(await screen.findByRole('heading', { name: 'Generated Summary' })).toBeVisible();
    expect(window.location.pathname).toBe('/sets/set%20one/summary');
    expect(screen.getByText('Answered 3/3')).toBeVisible();
    expect(screen.queryByRole('link', { name: /question 4/i })).not.toBeInTheDocument();
  });

  it('redirects an unanswered generated reveal back to the first due round', async () => {

    vi.spyOn(api, 'getQuestionSetPlay').mockResolvedValue(generated);
    const distribution = vi.spyOn(api, 'getDistribution');

    open('/sets/set%20one/reveal/1');

    await screen.findByLabelText('Guess in fish');
    expect(window.location.pathname).toBe('/sets/set%20one/play/0');
    expect(distribution).not.toHaveBeenCalled();
  });

  it('redirects a URL jump past an unanswered round back to the next due question', async () => {

    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({ ...daily, userGuesses: { q1: 50 } });

    open('/play/2');

    await waitFor(() => expect(window.location.pathname).toBe('/play/1'));
    expect(await screen.findByLabelText('Guess in meters')).toBeVisible();
    expect(screen.queryByLabelText('Guess in islands')).not.toBeInTheDocument();
  });

  it.each([401, 403, 404, 500])('answers a generated load failure of %i with the shared card or a raw error', async (status) => {

    vi.spyOn(api, 'getQuestionSetPlay').mockRejectedValue(new ApiError(status, `Failure ${status}`));

    open('/sets/set%20one/play/0');

    if (status === 401 || status === 403) expect(await screen.findByRole('heading', { name: 'Not Logged In' })).toBeVisible();
    else expect(await screen.findByRole('alert')).toHaveTextContent(`Failure ${status}`);
    await waitFor(() => expect(api.getTodayPuzzle).not.toHaveBeenCalled());
  });
});
