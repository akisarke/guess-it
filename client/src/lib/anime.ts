import { animate, stagger, type AnimationParams, type TargetsParam } from 'animejs';

export function animateSafe(targets: TargetsParam | null | undefined, params: AnimationParams) {
  if (targets === null || targets === undefined) return null;
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return null;
  }
  return animate(targets, params);
}

export { stagger };
