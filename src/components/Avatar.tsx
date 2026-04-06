'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '@/context/ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AvatarProps {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isAi?: boolean;
  className?: string;
}

export default function Avatar({
  src,
  alt,
  size = 'md',
  isAi = false,
  className
}: AvatarProps) {
  const { theme } = useTheme();

  const sizeClasses = {
    xs: "w-6 h-6 rounded-full",
    sm: 'w-8 h-8 rounded-full',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-16 h-16 rounded-2xl',
    xl: 'w-28 h-28 rounded-[2.5rem]',
  };

  const getInitials = (name: string) => {
    if (!name || name.trim() === "") return "AI";

    const cleanName = name.trim();

    if (cleanName.toLowerCase() === "user") return "U";

    const parts = cleanName.split(/[\s_.]+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    return cleanName.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(alt || "");

  const background = isAi ? '9687F5' : (theme === 'dark' ? '1A1832' : 'EBF0FF');
  const color = isAi ? 'FFFFFF' : (theme === 'dark' ? 'E8E6F3' : '2D284B');

  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&length=2&background=${background}&color=${color}&bold=true&font-size=0.45`;

  return (
    <div className={cn(
      'relative shrink-0 transition-all duration-500 overflow-hidden border',
      isAi
        ? 'border-crimson/30 shadow-lg shadow-crimson/10 bg-crimson/5'
        : '',
      sizeClasses[size],
      className
    )} style={{ backgroundColor: 'var(--color-bg-primary)', borderColor: isAi ? undefined : 'rgba(0,0,0,0.05)' }}>
      <img
        src={src || fallbackUrl}
        alt={alt || "User Avatar"}
        className={cn(
          "w-full h-full object-cover",
          !isAi && "grayscale-[0.4] group-hover:grayscale-0 transition-all duration-700"
        )}
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackUrl;
        }}
      />

      {isAi && (
        <div className={cn(
          "absolute rounded-full shadow-md animate-pulse z-20",
          size === 'xs' ? 'bottom-0 right-0 w-2 h-2' : 'bottom-1 right-1 w-[20%] h-[20%]'
        )} style={{ backgroundColor: 'var(--color-crimson)', border: '2px solid var(--color-bg-card)' }} />
      )}
    </div>
  );
}
