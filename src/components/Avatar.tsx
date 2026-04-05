import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../context/ThemeContext';

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

  /**
   * REFINED INITIALS LOGIC
   * 1. Splits by space or underscore
   * 2. Takes first letters of first two segments
   * 3. Fallback to first two chars of the string
   */
  const getInitials = (name: string) => {
    // 1. Handle null, undefined, or empty strings immediately
    if (!name || name.trim() === "") return "AI"; // Default to AI or UN (Unknown)

    // 2. Clean the name (remove extra spaces)
    const cleanName = name.trim();

    // 3. Handle the "User" placeholder or generic defaults
    if (cleanName.toLowerCase() === "user") return "U";

    // 4. Split by space, underscore, or dots (common in usernames)
    const parts = cleanName.split(/[\s_.]+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    // 5. If it's a single word (like "Om"), take up to two letters
    return cleanName.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(alt || "");

  const background = isAi ? '9687F5' : (theme === 'dark' ? '1A1832' : 'EBF0FF');
  const color = isAi ? 'FFFFFF' : (theme === 'dark' ? 'E8E6F3' : '2D284B');

  // Refined API call: name parameter now gets our calculated initials
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&length=2&background=${background}&color=${color}&bold=true&font-size=0.45`;

  return (
    <div className={cn(
      'relative shrink-0 transition-all duration-500 overflow-hidden border',
      isAi
        ? 'border-crimson/30 shadow-lg shadow-crimson/10 bg-crimson/5'
        : 'border-black/[0.05]',
      sizeClasses[size],
      className
    )} style={{ backgroundColor: 'var(--color-bg-primary)' }}>
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
        )} style={{ backgroundColor: 'var(--color-accent)', border: '2px solid var(--color-bg-card)' }} />
      )}
    </div>
  );
}