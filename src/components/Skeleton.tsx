import type { JSX } from 'react';

export function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}
