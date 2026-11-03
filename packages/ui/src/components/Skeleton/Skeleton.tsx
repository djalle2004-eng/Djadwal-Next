import React from 'react';
import { cn } from '../../utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'rounded';
}

export function Skeleton({ className, variant = 'rounded', ...props }: SkeletonProps) {
  const variantStyles = {
    rectangular: 'rounded-none',
    circular: 'rounded-full',
    rounded: 'rounded-xl',
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-slate-200 dark:bg-slate-800',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}
