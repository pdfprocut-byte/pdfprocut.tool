import { useLayoutEffect, useRef } from 'react';

const revealThreshold = 0.14;

export function useScrollReveal(selector) {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver !== 'function') return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.intersectionRatio < revealThreshold) continue;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -24px 0px', threshold: revealThreshold });

    const observeNewItems = () => {
      for (const item of container.querySelectorAll(selector)) {
        if (item.classList.contains('is-revealed')) continue;
        item.classList.add('tool-scroll-reveal');
        observer.observe(item);
      }
    };
    observeNewItems();
    const mutationObserver = typeof MutationObserver === 'function' ? new MutationObserver(observeNewItems) : null;
    mutationObserver?.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver?.disconnect();
    };
  }, [selector]);

  return containerRef;
}
