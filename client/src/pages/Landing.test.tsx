import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PuzzleResponse } from 'shared';
import { Landing } from './Landing';
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
  it('keeps fresh visitor state after an unauthenticated mount without creating a session', async () => {
    // Given: no authenticated session exists.
    const getMe = vi.spyOn(api, 'getMe').mockRejectedValue(new ApiError(401, 'Not authenticated'));
    const loginAnonymous = vi.spyOn(api, 'loginAnonymous');

    // When: landing mounts.
    renderLanding();

    // Then: the fresh CTA remains and no anonymous account is created.
    await waitFor(() => expect(screen.getByRole('button', { name: /play today/i })).toBeInTheDocument());
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(loginAnonymous).not.toHaveBeenCalled();
    expect(screen.getByText('0 of 3 solved')).toBeInTheDocument();
  });

  it('restores partial progress after an auth-change remount', async () => {
    // Given: auth changes from signed out to an account with one answered question.
    vi.spyOn(api, 'getMe')
      .mockRejectedValueOnce(new ApiError(401, 'Not authenticated'))
      .mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([2, 0, 0]));

    // When: landing mounts, then receives the auth-change event.
    renderLanding();
    await waitFor(() => expect(screen.getByText('0 of 3 solved')).toBeInTheDocument());
    window.dispatchEvent(new Event('guessit:auth-changed'));

    // Then: the partial progress marker is restored without clicking Play.
    await waitFor(() => expect(screen.getByText('1 of 3 solved')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /resume puzzle/i })).toBeInTheDocument();
  });

  it('restores complete progress after a fresh remount', async () => {
    // Given: the authenticated visitor has completed all three questions.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([1, 2, 3]));

    // When: landing mounts again.
    renderLanding();

    // Then: the summary CTA and complete progress are visible immediately after loading.
    await waitFor(() => expect(screen.getByText('3 of 3 solved')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /see your summary/i })).toBeInTheDocument();
  });

  it('keeps an authenticated session after puzzle rehydration fails', async () => {
    // Given: authentication succeeds but the puzzle request fails with a server error.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'getTodayPuzzle')
      .mockRejectedValueOnce(new ApiError(500, 'Puzzle service unavailable'))
      .mockResolvedValue(puzzleWithScores([0, 0, 0]));
    const loginAnonymous = vi.spyOn(api, 'loginAnonymous');

    // When: landing rehydrates and the visitor chooses Play after the failure.
    renderLanding();
    await waitFor(() => expect(screen.getByText('Puzzle service unavailable')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /play today/i }));

    // Then: the authenticated session is retained and anonymous login is not attempted.
    expect(loginAnonymous).not.toHaveBeenCalled();
  });

  it('lets only the newest auth reload update landing progress', async () => {
    // Given: the first auth check is slower than a later auth-change reload.
    const firstMe = deferred<{ user: typeof authenticatedUser }>();
    const secondMe = deferred<{ user: typeof authenticatedUser }>();
    vi.spyOn(api, 'getMe').mockImplementationOnce(() => firstMe.promise).mockImplementationOnce(() => secondMe.promise);
    vi.spyOn(api, 'getTodayPuzzle').mockResolvedValue(puzzleWithScores([1, 0, 0]));

    // When: a newer auth reload completes before the original request.
    renderLanding();
    window.dispatchEvent(new Event('guessit:auth-changed'));
    secondMe.resolve({ user: authenticatedUser });
    await waitFor(() => expect(screen.getByText('1 of 3 solved')).toBeInTheDocument());
    firstMe.resolve({ user: authenticatedUser });

    // Then: the stale request cannot replace the newer progress state.
    await waitFor(() => expect(screen.getByText('1 of 3 solved')).toBeInTheDocument());
    expect(api.getTodayPuzzle).toHaveBeenCalledTimes(1);
  });

  it('does not continue rehydration after landing unmounts', async () => {
    // Given: the initial auth check has not completed.
    const me = deferred<{ user: typeof authenticatedUser }>();
    vi.spyOn(api, 'getMe').mockImplementation(() => me.promise);
    const getTodayPuzzle = vi.spyOn(api, 'getTodayPuzzle');

    // When: landing unmounts before authentication resolves.
    const view = renderLanding();
    view.unmount();
    me.resolve({ user: authenticatedUser });

    // Then: no puzzle request is started after unmount.
    await Promise.resolve();
    expect(getTodayPuzzle).not.toHaveBeenCalled();
  });

  it('blocks Play until initial auth rehydration resolves', async () => {
    // Given: authentication is still being checked.
    const me = deferred<{ user: typeof authenticatedUser }>();
    vi.spyOn(api, 'getMe').mockImplementation(() => me.promise);
    const loginAnonymous = vi.spyOn(api, 'loginAnonymous');

    // When: the visitor tries to play before authentication finishes.
    renderLanding();
    const playButton = screen.getByRole('button', { name: /play today/i });
    await userEvent.click(playButton);

    // Then: no anonymous session is created while the auth result is unknown.
    expect(loginAnonymous).not.toHaveBeenCalled();
  });

  it('continues Play after real anonymous login dispatches auth change', async () => {
    // Given: the visitor is signed out and the real anonymous login API succeeds.
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

    // When: the visitor clicks Play and loginAnonymous dispatches its real auth-change event.
    render(
      <MemoryRouter>
        <Landing />
        <LocationProbe />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /play today/i })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /play today/i }));

    // Then: puzzle navigation happens once and Play loading clears instead of stalling.
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/play/0'));
    expect(api.getTodayPuzzle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Loading puzzle…')).not.toBeInTheDocument();
  });
});
