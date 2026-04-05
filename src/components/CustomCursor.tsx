import { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'motion/react';

export default function CustomCursor() {
  const [isHovering, setIsHovering] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 200 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.founder-face')) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999] flex items-center justify-center"
      style={{
        x: cursorX,
        y: cursorY,
        translateX: '-50%',
        translateY: '-50%',
      }}
    >
      <motion.div
        animate={{
          width: isHovering ? 120 : 24,
          height: isHovering ? 120 : 24,
          backgroundColor: isHovering ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.5)',
          borderColor: isHovering ? '#ff0000' : 'rgba(255, 255, 255, 0.8)',
          borderWidth: isHovering ? 2 : 1,
        }}
        className="rounded-full backdrop-blur-sm transition-colors duration-300 flex items-center justify-center"
      >
        {isHovering && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full h-full rounded-full border border-red-500/30 flex items-center justify-center"
          >
            <div className="w-1 h-1 bg-red-500 rounded-full" />
            <div className="absolute inset-0 border-t border-red-500/50 rounded-full animate-spin" />
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
