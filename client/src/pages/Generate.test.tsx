import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Generate } from './Generate';
import { ApiError, api } from '../lib/api';
import { parseGeneratedQuestionSetId, parseQuestionId, type GenerateQuestionSetResponse } from 'shared';

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

const generatedSetResponse: GenerateQuestionSetResponse = {
  set: {
    id: parseGeneratedQuestionSetId('set-1'),
    title: 'Space',
    topic: 'space',
    difficulty: 'medium',
    createdAt: '2026-09-12T00:00:00Z',
    completed: false,
    questions: [
      { id: parseQuestionId('question-1'), prompt: 'How many moons does Mars have?', unit: 'moons' },
      { id: parseQuestionId('question-2'), prompt: 'How far is the Moon from Earth?', unit: 'kilometers' },
      { id: parseQuestionId('question-3'), prompt: 'How old is the Sun?', unit: 'years' },
    ],
  },
  questions: [
    { id: parseQuestionId('question-1'), prompt: 'How many moons does Mars have?', unit: 'moons' },
    { id: parseQuestionId('question-2'), prompt: 'How far is the Moon from Earth?', unit: 'kilometers' },
    { id: parseQuestionId('question-3'), prompt: 'How old is the Sun?', unit: 'years' },
  ],
  remainingGenerations: 2,
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe('Generate auth gate', () => {
  it('renders the signed-out state at mount when auth returns 401', async () => {
    // Given: the initial auth check returns 401.
    vi.spyOn(api, 'getMe').mockRejectedValue(new ApiError(401, 'Not authenticated'));

    // When: Generate mounts.
    render(
      <MemoryRouter>
        <Generate />
      </MemoryRouter>,
    );

    // Then: the reusable signed-out state is shown without the generation form.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Not Logged In' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Generate a Question' })).not.toBeInTheDocument();
  });

  it.each([
    ['network failure', new Error('Network unavailable')],
    ['server failure', new ApiError(500, 'Auth service unavailable')],
  ])('shows a retryable unavailable state for %s during auth check', async (_label, authError) => {
    // Given: the initial auth check fails without proving that the visitor is signed out.
    vi.spyOn(api, 'getMe').mockRejectedValueOnce(authError).mockResolvedValue({ user: authenticatedUser });

    // When: Generate mounts and the visitor retries the auth check.
    render(
      <MemoryRouter>
        <Generate />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Authentication unavailable' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Then: the retry re-enters checking and restores the protected page after auth succeeds.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Generate a Question' })).toBeInTheDocument());
  });
});

describe('Generate question sets', () => {
  it('shows three remaining attempts before the first generation', async () => {
    // Given: an authenticated visitor has opened Generate.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });

    // When: Generate mounts and authentication completes.
    render(<MemoryRouter><Generate /></MemoryRouter>);

    // Then: the initial daily quota is visible before any generation.
    await waitFor(() => expect(screen.getByText('3 attempts remaining today')).toBeInTheDocument());
  });

  it('renders three ordered answer-free previews and the remaining attempts after success', async () => {
    // Given: an authenticated visitor and a generated set response.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    const generateQuestionSet = vi.spyOn(api, 'generateQuestionSet').mockResolvedValue(generatedSetResponse);
    render(<MemoryRouter><Generate /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Generate a Question' })).toBeInTheDocument());

    // When: the visitor submits a topic and difficulty.
    await userEvent.type(screen.getByLabelText('Topic'), '  space  ');
    await userEvent.selectOptions(screen.getByLabelText('Difficulty (optional)'), 'medium');
    await userEvent.click(screen.getByRole('button', { name: 'Generate set' }));

    // Then: the request is normalized and exactly three ordered previews are shown without answers.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Question 3' })).toBeInTheDocument());
    expect(generateQuestionSet).toHaveBeenCalledWith({ topic: 'space', difficulty: 'medium' });
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Question 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Question 2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Question 3' })).toBeInTheDocument();
    expect(screen.getByText('2 attempts remaining today')).toBeInTheDocument();
    expect(screen.getByText('Generated set')).toBeVisible();
    expect(screen.getByText('Space')).toBeVisible();
    expect(screen.getByText(/space · medium · 3 questions/)).toBeVisible();
    expect(screen.queryByText(/napkin|answer|Mars has 2/iu)).not.toBeInTheDocument();
  });

  it('retains the entered inputs and recoverable error after generation fails', async () => {
    // Given: an authenticated visitor and a recoverable provider failure.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'generateQuestionSet').mockRejectedValue(new ApiError(503, 'Question generation is temporarily unavailable'));
    render(<MemoryRouter><Generate /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Generate a Question' })).toBeInTheDocument());

    // When: the visitor submits the form.
    await userEvent.type(screen.getByLabelText('Topic'), 'history');
    await userEvent.selectOptions(screen.getByLabelText('Difficulty (optional)'), 'hard');
    await userEvent.click(screen.getByRole('button', { name: 'Generate set' }));

    // Then: the inputs remain available and the error explains recovery.
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Question generation is temporarily unavailable'));
    expect(screen.getByLabelText('Topic')).toHaveValue('history');
    expect(screen.getByLabelText('Difficulty (optional)')).toHaveValue('hard');
    expect(screen.getByRole('button', { name: 'Generate set' })).toBeEnabled();
  });

  it('disables generation when the response reports no remaining attempts', async () => {
    // Given: an authenticated visitor whose generated set uses the final attempt.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'generateQuestionSet').mockResolvedValue({ ...generatedSetResponse, remainingGenerations: 0 });
    render(<MemoryRouter><Generate /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Generate a Question' })).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Topic'), 'space');

    // When: the visitor generates a set.
    await userEvent.click(screen.getByRole('button', { name: 'Generate set' }));

    // Then: the quota state is visible and generation is disabled.
    await waitFor(() => expect(screen.getByText('No attempts remaining today')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Generate set' })).toBeDisabled();
  });

  it('sets the quota to zero from the stable quota code regardless of message copy', async () => {
    // Given: an authenticated visitor and the API quota exhaustion contract.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'generateQuestionSet').mockRejectedValue(new ApiError(429, 'Quota copy changed', undefined, 'GENERATION_QUOTA_EXCEEDED'));
    render(<MemoryRouter><Generate /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Generate a Question' })).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Topic'), 'space');

    // When: the visitor submits after the server reports quota exhaustion.
    await userEvent.click(screen.getByRole('button', { name: 'Generate set' }));

    // Then: the quota is exhausted and the entered topic remains available for context.
    await waitFor(() => expect(screen.getByText('No attempts remaining today')).toBeInTheDocument());
    expect(screen.getByLabelText('Topic')).toHaveValue('space');
    expect(screen.getByRole('alert')).toHaveTextContent('Quota copy changed');
  });

  it('navigates once to the first question when Play set is activated', async () => {
    // Given: a generated set is ready to play.
    vi.spyOn(api, 'getMe').mockResolvedValue({ user: authenticatedUser });
    vi.spyOn(api, 'generateQuestionSet').mockResolvedValue(generatedSetResponse);
    render(<MemoryRouter><Routes><Route path="*" element={<><Generate /><LocationProbe /></>} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Generate a Question' })).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Topic'), 'space');
    await userEvent.click(screen.getByRole('button', { name: 'Generate set' }));

    // When: the visitor chooses the set-level Play action.
    await waitFor(() => expect(screen.getByRole('link', { name: 'Play set' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('link', { name: 'Play set' }));

    // Then: navigation targets the first question and carries the encoded generated-set source.
    expect(screen.getByTestId('location')).toHaveTextContent('/sets/set-1/play/0');
  });
});
