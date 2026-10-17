import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { GeneratedGameSourceResponse, PuzzleResponse } from 'shared';
import { api, ApiError } from '../lib/api';

export function useSoloRoute() {
  const { setId, questionIndex } = useParams();
  const [searchParams] = useSearchParams();
  const puzzleParam = searchParams.get('puzzle');
  const archivePuzzleNumber = puzzleParam !== null && /^\d+$/.test(puzzleParam) ? Number.parseInt(puzzleParam, 10) : null;
  const query = archivePuzzleNumber === null ? '' : `?puzzle=${archivePuzzleNumber}`;
  const prefix = setId === undefined ? '' : `/sets/${encodeURIComponent(setId)}`;
  const idx = Number(questionIndex ?? '0');
  return { setId, idx, archivePuzzleNumber, prefix, query };
}

export function useSoloGame() {
  const route = useSoloRoute();
  const { setId, archivePuzzleNumber } = route;
  const [state, setState] = useState<{
    readonly key: string;
    readonly puzzle: PuzzleResponse | GeneratedGameSourceResponse | null;
    readonly error: Error | null;
  } | null>(null);
  const key = JSON.stringify([setId, archivePuzzleNumber]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (setId !== undefined) return api.getQuestionSetPlay(setId);
      if (archivePuzzleNumber === null) return api.getTodayPuzzle();
      try {
        return await api.getPuzzle(archivePuzzleNumber);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        await api.loginAnonymous();
        return api.getPuzzle(archivePuzzleNumber);
      }
    };
    load().then((puzzle) => {
      if (active) setState({ key, puzzle, error: null });
    }).catch((error: unknown) => {
      if (active) setState({ key, puzzle: null, error: error instanceof Error ? error : new Error('Unable to load game.') });
    });
    return () => { active = false; };
  }, [setId, archivePuzzleNumber, key]);

  const current = state?.key === key ? state : null;
  return { ...route, puzzle: current?.puzzle ?? null, error: current?.error ?? null, loading: current === null };
}
