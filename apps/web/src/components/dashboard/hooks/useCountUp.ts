import { useEffect, useMemo, useState } from 'react';

import gsap from 'gsap';

export function useCountUp(target: number): number {
  const prefersReduced = useMemo(
    () =>
      typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
    []
  );

  const [display, setDisplay] = useState(prefersReduced ? target : 0);

  useEffect(() => {
    if (prefersReduced) return;

    const proxy = { value: 0 };
    const tween = gsap.to(proxy, {
      value: target,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => setDisplay(Math.round(proxy.value)),
    });

    return () => {
      tween.kill();
    };
  }, [target, prefersReduced]);

  return prefersReduced ? target : display;
}
