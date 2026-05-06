import React, { createContext, useContext, useState, useCallback } from 'react';
import { Brand, ContractKind, DealType, Genre, MovieType, PlotArc, Rating, CastRole, ReleaseStrategy } from './types';

export type DraftCastSlot = { role: CastRole; talentId?: string; dealType: DealType; contractKind: ContractKind };

export interface MovieDraft {
  type: MovieType;
  genre: Genre;
  arc: PlotArc;
  rating: Rating;
  runtime: number;
  marketing: number;
  brand: Brand;
  franchiseId?: string;
  parentMovieId?: string;
  crossoverIds: string[];
  writerId?: string;
  directorId?: string;
  customTitle: string;
  customFranchiseName: string;
  targetWeek: number | null;
  targetYear: number | null;
  cast: DraftCastSlot[];
  castRoleNames: string[];
  castDescriptions: string[];
  releaseStrategy: ReleaseStrategy;
  streamingTargetServiceId?: string;
  streamingTargetTierIds: string[];
  streamingWindowWeeks?: number;
  // Last picker context — used so /talent can return data back here
  lastPickerKind?: 'writer' | 'director' | 'cast';
  lastPickerCastIdx?: number;
  // Whether the draft is "active" (true after entering create-movie at least once)
  active: boolean;
}

const defaultDraft = (): MovieDraft => ({
  type: 'Action',
  genre: 'Action',
  arc: 'Man in a Hole',
  rating: 'PG-13',
  runtime: 120,
  marketing: 20,
  brand: 'Original',
  crossoverIds: [],
  customTitle: '',
  customFranchiseName: '',
  targetWeek: null,
  targetYear: null,
  cast: [
    { role: 'lead_actor', dealType: 'middle', contractKind: 'single' },
    { role: 'lead_actor', dealType: 'middle', contractKind: 'single' },
    { role: 'support_actor', dealType: 'middle', contractKind: 'single' },
    { role: 'support_actor', dealType: 'middle', contractKind: 'single' },
    { role: 'support_actor', dealType: 'middle', contractKind: 'single' },
    { role: 'support_actor', dealType: 'middle', contractKind: 'single' },
  ],
  castRoleNames: ['', '', '', '', '', ''],
  castDescriptions: ['', '', '', '', '', ''],
  releaseStrategy: 'theatrical',
  streamingTargetTierIds: [],
  active: false,
});

type Ctx = {
  draft: MovieDraft;
  setDraft: (patch: Partial<MovieDraft>) => void;
  resetDraft: () => void;
  initFromParams: (init: Partial<MovieDraft>) => void;
};

const DraftCtx = createContext<Ctx | null>(null);

export function MovieDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraftState] = useState<MovieDraft>(defaultDraft());

  const setDraft = useCallback((patch: Partial<MovieDraft>) => {
    setDraftState(prev => ({ ...prev, ...patch }));
  }, []);
  const resetDraft = useCallback(() => setDraftState(defaultDraft()), []);
  const initFromParams = useCallback((init: Partial<MovieDraft>) => {
    setDraftState(prev => ({ ...defaultDraft(), ...init, active: true } as MovieDraft));
  }, []);

  return <DraftCtx.Provider value={{ draft, setDraft, resetDraft, initFromParams }}>{children}</DraftCtx.Provider>;
}

export function useMovieDraft(): Ctx {
  const c = useContext(DraftCtx);
  if (!c) throw new Error('useMovieDraft outside provider');
  return c;
}
