import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { api, ApiError } from '../lib/api';
import { daily, generated } from '../test/solo-fixtures';

vi.mock('../components/Header', () => ({ Header: () => null }));
vi.mock('../components/BackgroundLayer', () => ({ BackgroundLayer: () => null }));
vi.mock('../lib/sounds', () => ({ playClick: vi.fn(), playChime: vi.fn() }));

function open(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

beforeEach(() => {
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
    // Given a daily source whose UUID differs from its puzzle number.
    const submit = vi.spyOn(api, 'submitGuess').mockRejectedValue(new ApiError(409, 'Already guessed'));
    open(path);
    // When the estimate is locked.
    await userEvent.type(await screen.findByLabelText('Guess in fish'), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
    // Then the response source is retained verbatim.
    expect(submit).toHaveBeenCalledWith({ source: daily.source, questionId: 'q1', value: 50 });
  });

  it('loads generated play without revealing private details and submits its source', async () => {
    // Given a public generated source.
    vi.spyOn(api, 'getQuestionSetPlay').mockResolvedValue(generated);
    const submit = vi.spyOn(api, 'submitGuess').mockRejectedValue(new ApiError(500, 'Try again'));
    open('/sets/set%20one/play/0');
    // When loading and locking an estimate.
    await userEvent.type(await screen.findByLabelText('Guess in fish'), '50');
    expect(screen.getByText('Ocean estimates')).toBeVisible();
    expect(screen.getByText(/oceans.*medium/i)).toBeVisible();
    expect(screen.getByText(/Generated set/)).toBeVisible();
    expect(screen.queryByText(/correct answer|napkin math|score band/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lock it in' }));
    // Then no daily fallback occurs and failed submission remains playable.
    expect(submit).toHaveBeenCalledWith({ source: generated.source, questionId: 'q1', value: 50 });
    expect(api.getTodayPuzzle).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
  });

  it('rehydrates generated reveals and ends the third round at its summary', async () => {
    // Given a completed generated set and authorized distribution.
    vi.spyOn(api, 'getQuestionSetPlay').mockResolvedValue({ ...generated, userGuesses: { q1: 2, q2: 1, q3: 3 } });
    vi.spyOn(api, 'getDistribution').mockResolvedValue({ bins: [], answer: 100, userGuess: 50, medianGuess: 50, napkinMath: 'Count the coastlines.' });
    vi.spyOn(api, 'getQuestionSetSummary').mockResolvedValue({ ...generated, userGuesses: { q1: 2, q2: 1, q3: 3 }, completed: true, averageScore: 2 });
    open('/sets/set%20one/reveal/2');
    // When the final reveal advances.
    await userEvent.click(await screen.findByRole('link', { name: 'See Summary' }));
    // Then summary belongs to this set and there is no fourth question.
    expect(await screen.findByRole('heading', { name: 'Generated Summary' })).toBeVisible();
    expect(window.location.pathname).toBe('/sets/set%20one/summary');
    expect(screen.getByText('Answered 3/3')).toBeVisible();
    expect(screen.queryByRole('link', { name: /question 4/i })).not.toBeInTheDocument();
  });

  it('redirects an unanswered generated reveal back to the first due round', async () => {
    // Given no saved estimate.
    vi.spyOn(api, 'getQuestionSetPlay').mockResolvedValue(generated);
    const distribution = vi.spyOn(api, 'getDistribution');
    // When opening a reveal directly.
    open('/sets/set%20one/reveal/1');
    // Then private data is never requested and the round guard wins.
    await screen.findByLabelText('Guess in fish');
    expect(window.location.pathname).toBe('/sets/set%20one/play/0');
    expect(distribution).not.toHaveBeenCalled();
  });

  it('redirects a URL jump past an unanswered round back to the next due question', async () => {
    // Given only the first round answered.
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({ ...daily, userGuesses: { q1: 50 } });
    // When the URL jumps straight to question 3.
    open('/play/2');
    // Then it lands on question 2 instead of skipping the round.
    await waitFor(() => expect(window.location.pathname).toBe('/play/1'));
    expect(await screen.findByLabelText('Guess in meters')).toBeVisible();
    expect(screen.queryByLabelText('Guess in islands')).not.toBeInTheDocument();
  });

  it.each([401, 403, 404, 500])('keeps generated load failure %i distinct', async (status) => {
    // Given an endpoint failure.
    vi.spyOn(api, 'getQuestionSetPlay').mockRejectedValue(new ApiError(status, `Failure ${status}`));
    // When loading the generated route.
    open('/sets/set%20one/play/0');
    // Then 401 offers authentication; other failures stay errors.
    if (status === 401) expect(await screen.findByRole('heading', { name: 'Not Logged In' })).toBeVisible();
    else expect(await screen.findByRole('alert')).toHaveTextContent(`Failure ${status}`);
    await waitFor(() => expect(api.getTodayPuzzle).not.toHaveBeenCalled());
  });
});
