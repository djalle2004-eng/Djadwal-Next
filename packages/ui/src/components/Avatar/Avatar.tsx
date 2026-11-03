import React, { useState } from 'react';
import { cn } from '../../utils/cn';

export interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  className?: string;
}

export function Avatar({
  src,
  name,
  size = 'md',
  status,
  className,
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  // Extract up to 2 initials in Arabic or Latin
  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2);
    return (parts[0][0] || '') + (parts[parts.length - 1][0] || '');
  };

  const sizeStyles = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-base',
  };

  const statusColors = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-400',
    busy: 'bg-rose-500',
    away: 'bg-amber-500',
  };

  return (
    <div className={cn('relative inline-flex shrink-0 select-none', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50',
          sizeStyles[size]
        )}
      >
        {src && !imageFailed ? (
          <img
            src={src}
            alt={name}
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {status && (
        <span
          className={cn(
            'absolute bottom-0 end-0 block rounded-full ring-2 ring-white dark:ring-slate-900',
            size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5',
            statusColors[status]
          )}
          aria-label={`الحالة: ${status}`}
        />
      )}
    </div>
  );
}
