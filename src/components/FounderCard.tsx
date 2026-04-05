import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FounderCardProps {
  name: string;
  role: string;
  humanImg: string;
  robotImg: string;
  bio: string;
}

export default function FounderCard({ name, role, humanImg, robotImg, bio }: FounderCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group cursor-none"
    >
      {/* IMAGE FRAME - THE HYBRID REVEAL */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-[3rem] bg-[#f8f8f8] border border-black/5 transition-all duration-700 group-hover:shadow-[0_40px_80px_-20px_rgba(220,20,60,0.1)]">
        
        {/* Human Base */}
        <motion.img
          src={humanImg}
          alt={name}
          animate={{ 
            opacity: isHovered ? 0 : 1,
            scale: isHovered ? 1.1 : 1,
            filter: isHovered ? 'grayscale(100%)' : 'grayscale(0%)'
          }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Robot Synthetic Layer */}
        <motion.img
          src={robotImg}
          alt={`${name} Synthetic`}
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: isHovered ? 1 : 0,
            scale: isHovered ? 1 : 0.95
          }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* SCANNING LASER EFFECT */}
        <AnimatePresence>
          {isHovered && (
            <>
              <motion.div
                initial={{ top: '-10%' }}
                animate={{ top: '110%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-[2px] bg-crimson z-30 shadow-[0_0_20px_rgba(220,20,60,1)]"
              />
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.05 }}
                className="absolute inset-0 bg-crimson z-20 pointer-events-none"
              />
            </>
          )}
        </AnimatePresence>
      </div>

      {/* TYPOGRAPHY - THE FLOATING LEGEND */}
      <div className="mt-10 space-y-4 px-2 text-center md:text-left">
        <div className="overflow-hidden">
          <motion.h3 
            animate={{ y: isHovered ? -5 : 0 }}
            className="text-4xl font-serif font-black tracking-tighter text-black uppercase italic leading-none group-hover:text-crimson transition-colors duration-500"
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
          className="text-black text-xs leading-relaxed font-medium transition-all duration-500"
        >
          {bio}
        </motion.p>
      </div>
    </div>
  );
}