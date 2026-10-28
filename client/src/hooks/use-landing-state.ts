import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GuessMode, PuzzleResponse } from 'shared';
import { errorMessage, ApiError, api } from '../lib/api';
import { derivePuzzleProgress } from '../lib/puzzle-progress';
import { withMode } from '../lib/daily-mode';

type LandingAuthState = 'checking' | 'authenticated' | 'signed-out' | 'anonymous' | 'unavailable';

export function useLandingState(mode: GuessMode = 'easy') {
  const navigate = useNavigate();
  const [puzzle, setPuzzle] = useState<PuzzleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<LandingAuthState>('checking');
  const [reloadKey, setReloadKey] = useState(0);
  const generationRef = useRef(0);
  const activePlayRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    let activeController: AbortController | null = null;

    const loadProgress = async () => {
      if (activePlayRef.current) return;
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      setPuzzle(null);
      setError(null);
      setAuthState('checking');
      let authenticated = false;

      try {
        await api.getMe(controller.signal);
        if (controller.signal.aborted || generationRef.current !== generation) return;
        authenticated = true;
        setAuthState('authenticated');
        const todayPuzzle = await api.getTodayPuzzle(controller.signal);
        if (controller.signal.aborted || generationRef.current !== generation) return;
        setPuzzle(todayPuzzle);
      } catch (requestError: unknown) {
        if (controller.signal.aborted || generationRef.current !== generation) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          setAuthState('signed-out');
        } else {
          setAuthState(authenticated ? 'authenticated' : 'unavailable');
          setError(errorMessage(requestError, 'Unable to restore puzzle progress.'));
        }
      } finally {
        if (activeController === controller) activeController = null;
      }
    };

    loadProgress();
    window.addEventListener('guessit:auth-changed', loadProgress);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      activeController?.abort();
      window.removeEventListener('guessit:auth-changed', loadProgress);
    };
  }, [reloadKey]);

  const handlePlay = async () => {
    if (loading || activePlayRef.current || authState === 'checking' || authState === 'unavailable') return;

    const playGeneration = generationRef.current;
    activePlayRef.current = true;
    setLoading(true);
    setError(null);
    try {
      if (authState === 'signed-out') {
        await api.loginAnonymous();
        if (generationRef.current !== playGeneration || !mountedRef.current) return;
        setAuthState('anonymous');
      }
      const todayPuzzle = await api.getTodayPuzzle();
      if (generationRef.current !== playGeneration || !mountedRef.current) return;
      setPuzzle(todayPuzzle);
      const scores = withMode(todayPuzzle, mode).userGuesses;
      const nextQuestion = todayPuzzle.questions.findIndex((question) => !scores[question.id]);
      navigate(nextQuestion === -1 ? '/summary' : `/play/${nextQuestion}`);
    } catch (requestError: unknown) {
      if (generationRef.current !== playGeneration || !mountedRef.current) return;
      setError(errorMessage(requestError, 'We could not start the puzzle.'));
    } finally {
      activePlayRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const progress = puzzle ? derivePuzzleProgress(withMode(puzzle, mode)) : { answeredCount: 0, firstUnansweredIndex: -1, isComplete: false };
  const ctaLabel = progress.isComplete
    ? 'See Your Summary'
    : progress.answeredCount > 0
      ? `Resume Puzzle (Question ${progress.firstUnansweredIndex + 1})`
      : "Play Today's Puzzle";

  return {
    puzzle,
    loading,
    error,
    authState,
    ctaLabel,
    progress,
    handlePlay,
    retryAuth: () => setReloadKey((key) => key + 1),
  };
}
