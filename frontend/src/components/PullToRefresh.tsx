import { useState, useRef, useEffect, type ReactNode, type TouchEvent } from "react";

interface PullToRefreshProps {
  onRefresh: () => void;
  children: ReactNode;
  isLoading?: boolean;
}

export default function PullToRefresh({ onRefresh, children, isLoading }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const startScrollTop = useRef(0);

  const threshold = 80;

  useEffect(() => {
    if (refreshing && !isLoading) {
      setRefreshing(false);
    }
  }, [isLoading, refreshing]);

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    startY.current = e.touches[0].clientY;
    startScrollTop.current = e.currentTarget.scrollTop;
    setPulling(false);
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (startScrollTop.current > 0 || diff <= 0) {
      setPullDistance(0);
      setPulling(false);
      return;
    }

    setPulling(true);
    setPullDistance(Math.min(diff * 0.5, threshold * 1.5));
  }

  function handleTouchEnd() {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      onRefresh();
    }
    setPulling(false);
    setPullDistance(0);
  }

  const spinnerSize = Math.max(20, Math.min(pullDistance, 36));

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pulling || refreshing) && (
        <div
          className="flex items-center justify-center transition-all"
          style={{
            height: refreshing ? 48 : Math.max(0, pullDistance),
            overflow: "hidden",
          }}
        >
          <div
            className="rounded-full border-2 border-primary border-t-transparent"
            style={{
              width: refreshing ? 24 : spinnerSize,
              height: refreshing ? 24 : spinnerSize,
              animation: refreshing ? "spin 0.6s linear infinite" : "none",
              transition: "width 0.2s, height 0.2s",
            }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
