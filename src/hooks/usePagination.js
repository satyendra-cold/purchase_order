import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to render data in batches of 50 items for fast performance.
 * Loads the next batch automatically when user scrolls near the end of the container.
 *
 * @param {Array} items - Full list of filtered items
 * @param {number} batchSize - Number of items to render per batch (default: 50)
 * @returns { object } { visibleItems, hasMore, loadMore, containerRef }
 */
export function usePagination(items = [], batchSize = 50) {
  const [displayCount, setDisplayCount] = useState(batchSize);
  const containerRef = useRef(null);

  // Reset count whenever filters or items array changes
  useEffect(() => {
    setDisplayCount(batchSize);
  }, [items, batchSize]);

  const visibleItems = useMemo(() => {
    return items.slice(0, Math.min(displayCount, items.length));
  }, [items, displayCount]);

  const hasMore = displayCount < items.length;

  const loadMore = useCallback(() => {
    if (displayCount < items.length) {
      setDisplayCount((prev) => Math.min(prev + batchSize, items.length));
    }
  }, [displayCount, items.length, batchSize]);

  // Scroll listener for table container / window
  useEffect(() => {
    const el = containerRef.current || window;

    const handleScroll = () => {
      if (!hasMore) return;

      let isNearBottom = false;
      if (el === window) {
        const scrollPosition = window.innerHeight + window.scrollY;
        const threshold = document.documentElement.offsetHeight - 300;
        isNearBottom = scrollPosition >= threshold;
      } else {
        const { scrollTop, scrollHeight, clientHeight } = el;
        isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;
      }

      if (isNearBottom) {
        loadMore();
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [hasMore, loadMore]);

  return {
    visibleItems,
    hasMore,
    loadMore,
    totalCount: items.length,
    displayedCount: visibleItems.length,
    containerRef,
  };
}
