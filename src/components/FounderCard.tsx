import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';

interface FounderCardProps {
  name: string;
  role: string;
  humanImg: string;
  bio: string;
}

export default function FounderCard({ name, role, humanImg, bio }: FounderCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group cursor-none"
    >
      {/* IMAGE FRAME - THE HUMAN LAYER */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-[3rem] border transition-all duration-700 group-hover:shadow-[0_40px_80px_-20px_rgba(220,20,60,0.1)]" style={{ backgroundColor: isDark ? '#1a1a2e' : '#f8f8f8', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
        {/* Human Base */}
        <motion.img
          src={humanImg}
          alt={name}
          animate={{ 
            opacity: isHovered ? 0.85 : 1,
            scale: isHovered ? 1.05 : 1,
            filter: isHovered ? 'grayscale(0%)' : 'grayscale(0%)'
          }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* SCANNING LASER EFFECT */}
        <motion.div 
          animate={{ top: isHovered ? "100%" : "-10%" }}
          transition={{ duration: 1.5, repeat: isHovered ? Infinity : 0 }}
          className="absolute left-0 w-full h-[2px] bg-crimson/50 blur-sm z-20"
        />
      </div>

      {/* TYPOGRAPHY - THE FLOATING LEGEND */}
      <div className="mt-10 space-y-4 px-2 text-center md:text-left">
        <div className="overflow-hidden">
          <motion.h3 
            animate={{ y: isHovered ? -5 : 0 }}
            className="text-4xl font-serif font-black tracking-tighter uppercase italic leading-none transition-colors duration-500 group-hover:text-crimson"
            style={{ color: isDark ? '#E8E6F3' : '#000000' }}
          >
            {name}
          </motion.h3>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4">
          <p className="text-crimson font-mono text-[10px] font-bold uppercase tracking-[0.4em]">
            {role}
          </p>
          <motion.div 
            animate={{ width: isHovered ? 50 : 0 }}
            className="h-[1px] bg-crimson/30 hidden md:block" 
          />
        </div>

        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ 
            opacity: isHovered ? 0.4 : 0, 
            y: isHovered ? 0 : 10 
          }}
          className="text-xs leading-relaxed font-medium transition-all duration-500"
          style={{ color: isDark ? 'rgba(232,230,243,0.4)' : 'rgba(0,0,0,0.4)' }}
        >
          {bio}
        </motion.p>
      </div>
    </div>
  );
}