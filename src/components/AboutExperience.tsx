import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import { Zap, Cpu, Globe, ArrowUpRight } from "lucide-react";

// Import assets from your new folder structure
import heroVideo from "../assets/videos/connection_hero.mp4";
import omH from "../assets/founders/om_human.jpg";
import omR from "../assets/founders/om_robot.jpg";
// ... (Repeat for other founders)

export default function AboutExperience() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const founders = [
    { name: "Om Nilesh Karande", role: "Architect", human: omH, robot: omR },
    // Add others here...
  ];

  return (
    <div ref={containerRef} className="bg-white text-ocean selection:bg-crimson/20">
      
      {/* PHASE 1: THE HEAVENLY ENTRY */}
      <section className="relative h-[120vh] flex items-center justify-center overflow-hidden">
        <motion.video 
          style={{ scale }}
          autoPlay loop muted playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale-[0.5]"
        >
          <source src={heroVideo} type="video/mp4" />
        </motion.video>

        <motion.div style={{ opacity }} className="relative z-10 text-center px-6">
          <span className="font-mono text-[10px] tracking-[0.5em] uppercase text-crimson mb-6 block">
            Protocol Initialized // 2026
          </span>
          <h1 className="text-[12vw] font-serif font-black leading-[0.8] tracking-tighter uppercase">
            Biology <br /> meets <span className="italic text-crimson">Code</span>
          </h1>
        </motion.div>
      </section>

      {/* PHASE 2: THE HYBRID ARCHITECTS */}
      <section className="max-w-7xl mx-auto py-40 px-6">
        <div className="flex justify-between items-end mb-32 border-b border-black/5 pb-10">
          <h2 className="text-7xl font-serif font-bold tracking-tight">The Core.</h2>
          <p className="max-w-xs text-sm text-text-dim uppercase tracking-widest leading-loose">
            Human intuition augmented by autonomous neural logic.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {founders.map((f, i) => (
            <FounderCard key={i} founder={f} index={i} />
          ))}
        </div>
      </section>

    </div>
  );
}

function FounderCard({ founder, index }: any) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div 
      initial={{ y: 50, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.1, duration: 0.8 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group cursor-none"
    >
      <div className="relative aspect-[3/4] rounded-[3rem] overflow-hidden bg-void shadow-2xl">
        {/* Human Layer */}
        <motion.img 
          src={founder.human} 
          animate={{ opacity: isHovered ? 0 : 1, scale: isHovered ? 1.1 : 1 }}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out"
        />
        {/* Robot Layer */}
        <motion.img 
          src={founder.robot} 
          animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.95 }}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out"
        />
        
        {/* Scanning Overlay */}
        <motion.div 
          animate={{ top: isHovered ? "100%" : "-10%" }}
          transition={{ duration: 1.5, repeat: isHovered ? Infinity : 0 }}
          className="absolute left-0 w-full h-[2px] bg-crimson/50 blur-sm z-20"
        />
      </div>

      <div className="mt-8 space-y-1">
        <h3 className="text-2xl font-serif font-bold text-ocean uppercase tracking-tight">{founder.name}</h3>
        <p className="text-[10px] font-black text-crimson uppercase tracking-[0.3em]">{founder.role}</p>
      </div>
    </motion.div>
  );
}