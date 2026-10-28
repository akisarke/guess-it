import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PuzzleResponse } from 'shared';
import { Landing } from './Landing';
import { saveHardModeRun } from '../lib/hard-mode-history';
import { ApiError, api } from '../lib/api';

const authenticatedUser = {
  id: 'user-1',
  displayName: 'Player One',
  email: null,
  authProvider: 'password',
  hackclubId: null,
  bio: null,
  avatarUrl: null,
  usernameChosen: true,
  isDeveloper: false,
  isOwner: false,
  createdAt: '2026-09-12T00:00:00Z',
};

function puzzleWithScores(scores: readonly number[]): PuzzleResponse {
  const questions = scores.map((score, index) => ({
    id: `question-${index + 1}`,
    prompt: `Question ${index + 1}`,
    unit: 'items',
  }));

  return {
    source: { kind: 'daily', id: 'puzzle-1' },
    puzzle: {
      id: 'puzzle-1',
      puzzleNumber: 1,
      puzzleDate: '2026-09-12',
      questionIds: questions.map((question) => question.id),
      questions,
    },
    questions,
    userGuesses: Object.fromEntries(questions.map((question, index) => [question.id, scores[index] ?? 0])),
  };
}

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
      <LocationProbe />
    </MemoryRouter>,
  );
}

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('Landing progress rehydration', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('hard-mode');
  });
  it('keeps fresh visitor state after an unauthenticated mount without creating a session', async () => {

    const getMe = vi.spyOn(api, 'getMe').mockRejectedValue(new ApiError(401, 'Not authenticated'));
    const loginAnonymous = vi.spyOn(api, 'loginAnonymous');

    renderLanding();

    await waitFor(() => expect(screen.getByRole('button', { name: /play today/i })).toBeInTheDocument());
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(loginAnonymous).not.toHaveBeenCalled();
    expect(screen.getByText('0 of 3 solved')).toBeInTheDocument();
  });

  it('restores partial progress after an auth-change remount', async () => {

    vi.spyOn(api, 'getMe')
      .mockRejectedValueOnce(new ApiError(401, 'Not authenticated'))
      .mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([2, 0, 0]));

    renderLanding();
    await waitFor(() => expect(screen.getByText('0 of 3 solved')).toBeInTheDocument());
    window.dispatchEvent(new Event('guessit:auth-changed'));

    await waitFor(() => expect(screen.getByText('1 of 3 solved')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /resume puzzle/i })).toBeInTheDocument();
  });

  it('restores complete progress after a fresh remount', async () => {

    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([1, 2, 3]));

    renderLanding();

    await waitFor(() => expect(screen.getByText('3 of 3 solved')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /see your summary/i })).toBeInTheDocument();
  });

  it('shows the daily played in hard mode separately from easy mode', async () => {

    const puzzle = puzzleWithScores([2, 3, 4]);
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue({
      ...puzzle,
      guessesByMode: { easy: puzzle.userGuesses, hard: { 'question-1': 1.5 } },
    });

    renderLanding();

    await waitFor(() => expect(screen.getByText('3 of 3 solved')).toBeInTheDocument());
    expect(screen.getByLabelText('Puzzle 1: off by 2 times')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^hard mode/i }));

    expect(screen.getByText('1 of 3 solved in hard mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Puzzle 1: off by 1.5 times in hard mode')).toBeInTheDocument();
    expect(screen.getByLabelText('Puzzle 2: not answered yet in hard mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume puzzle/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^hard mode/i }));

    expect(screen.getByLabelText('Puzzle 1: off by 2 times')).toBeInTheDocument();
  });

  it('opens hard mode instead of the easy summary after the daily is complete', async () => {

    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([2, 3, 4]));

    renderLanding();

    await waitFor(() => expect(screen.getByText('3 of 3 solved')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^hard mode/i }));

    await userEvent.click(screen.getByRole('button', { name: 'Play Hard Mode' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/hard-mode');
  });

  it('keeps an authenticated session after puzzle rehydration fails', async () => {

    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle')
      .mockRejectedValueOnce(new ApiError(500, 'Puzzle service unavailable'))
      .mockResolvedValue(puzzleWithScores([0, 0, 0]));
    const loginAnonymous = vi.spyOn(api, 'loginAnonymous');

    renderLanding();
    await waitFor(() => expect(screen.getByText('Puzzle service unavailable')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /play today/i }));

    expect(loginAnonymous).not.toHaveBeenCalled();
  });

  it('lets only the newest auth reload update landing progress', async () => {

    const firstMe = deferred<{ user: typeof authenticatedUser }>();
    const secondMe = deferred<{ user: typeof authenticatedUser }>();
    vi.spyOn(api, 'getMe').mockImplementationOnce(() => firstMe.promise).mockImplementationOnce(() => secondMe.promise);
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([1, 0, 0]));

    renderLanding();
    window.dispatchEvent(new Event('guessit:auth-changed'));
    secondMe.resolve({ user: authenticatedUser });
    await waitFor(() => expect(screen.getByText('1 of 3 solved')).toBeInTheDocument());
    firstMe.resolve({ user: authenticatedUser });

    await waitFor(() => expect(screen.getByText('1 of 3 solved')).toBeInTheDocument());
    expect(api.getTodayPuzzle).toHaveBeenCalledTimes(1);
  });

  it('does not continue rehydration after landing unmounts', async () => {

    const me = deferred<{ user: typeof authenticatedUser }>();
    vi.spyOn(api, 'getMe').mockImplementation(() => me.promise);
    const getTodayPuzzle = vi.spyOn(api, 'getTodayPuzzle');

    const view = renderLanding();
    view.unmount();
    me.resolve({ user: authenticatedUser });

    await Promise.resolve();
    expect(getTodayPuzzle).not.toHaveBeenCalled();
  });

  it('blocks Play until initial auth rehydration resolves', async () => {

    const me = deferred<{ user: typeof authenticatedUser }>();
    vi.spyOn(api, 'getMe').mockImplementation(() => me.promise);
    const loginAnonymous = vi.spyOn(api, 'loginAnonymous');

    renderLanding();
    const playButton = screen.getByRole('button', { name: /play today/i });
    await userEvent.click(playButton);

    expect(loginAnonymous).not.toHaveBeenCalled();
  });

  it('continues Play after real anonymous login dispatches auth change', async () => {

    vi.spyOn(api, 'getMe')
      .mockRejectedValueOnce(new ApiError(401, 'Not authenticated'))
      .mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([0, 0, 0]));
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      return Promise.resolve(url.includes('/api/auth/csrf')
        ? Response.json({ csrfToken: 'landing-token' })
        : Response.json({ user: authenticatedUser }));
    });

    render(
      <MemoryRouter>
        <Landing />
        <LocationProbe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /play today/i })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /play today/i }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/play/0'));
    expect(api.getTodayPuzzle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Loading puzzle...')).not.toBeInTheDocument();
  });

  it('offers the hard mode summary once a hard run is done today', async () => {

    saveHardModeRun({
      puzzleNumber: 2,
      puzzleDate: '2026-10-26T00:00:00.000Z',
      completedAt: new Date().toISOString(),
      results: [{ question: { id: 'h1', prompt: 'Hard one?', unit: 'm' }, guess: 9, answer: 10, score: 1.5 }],
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([2, 3, 4]));

    renderLanding();

    await waitFor(() => expect(screen.getByText('3 of 3 solved')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^hard mode/i }));

    expect(screen.getByRole('button', { name: /see your summary/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /play hard mode/i })).not.toBeInTheDocument();
  });

  it('offers the hard mode summary when there is no new hard mode puzzle left', async () => {

    saveHardModeRun({
      puzzleNumber: 2,
      puzzleDate: '2026-10-26T00:00:00.000Z',
      completedAt: '2026-10-20T12:00:00.000Z',
      results: [{ question: { id: 'h1', prompt: 'Hard one?', unit: 'm' }, guess: 9, answer: 10, score: 1.5 }],
    });
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([2, 3, 4]));
    vi.spyOn(api, 'getHardModePuzzle').mockRejectedValue(new ApiError(404, 'none left', undefined, 'NOT_FOUND'));

    renderLanding();

    await waitFor(() => expect(screen.getByText('3 of 3 solved')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /^hard mode/i }));

    expect(await screen.findByRole('button', { name: /see your summary/i })).toBeInTheDocument();
  });
});
