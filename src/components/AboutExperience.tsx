'use client';

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import { Zap } from "lucide-react";
import FounderCard from "./FounderCard";

export default function AboutExperience() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const founders = [
    { name: "Om Nilesh Karande", role: "Architect", humanImg: "/founders/Om.png", bio: "Pioneering the neural-social interface, Om bridges the gap between human intuition and machine precision." },
    { name: "Soham Sachin Phatak", role: "CTO", humanImg: "/founders/Soham.png", bio: "Architecting core synaptic protocols allowing Imergene to scale across infinite digital dimensions." },
    { name: "Om Ganapati Mali", role: "Operations Director", humanImg: "/founders/Om Ganapati Mali.png", bio: "Ensuring every signal jump maintains human integrity while embracing autonomous evolution." },
    { name: "Prathamesh Tanaji Mali", role: "Design Lead", humanImg: "/founders/Prathamesh Tanaji Mali.png", bio: "Crafting the visual language of the void, making the invisible connections of Imergene tangible." },
  ];

  return (
    <div ref={containerRef} className="bg-white text-ocean selection:bg-crimson/20">
      <section className="relative h-[120vh] flex items-center justify-center overflow-hidden">
        <motion.video
          style={{ scale }}
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-40 grayscale-[0.5]"
        >
          <source src="/videos/connection_hero.mp4" type="video/mp4" />
        </motion.video>
        <motion.div style={{ opacity: opacity }} className="relative z-10 text-center px-6">
          <span className="font-mono text-[10px] tracking-[0.5em] uppercase text-crimson mb-6 block">
            Protocol Initialized // 2026
          </span>
          <h1 className="text-[12vw] font-serif font-black leading-[0.8] tracking-tighter uppercase">
            Biology <br /> meets <span className="italic text-crimson">Code</span>
          </h1>
        </motion.div>
      </section>

      <section className="max-w-7xl mx-auto py-40 px-6">
        <div className="flex justify-between items-end mb-32 border-b border-black/5 pb-10">
          <h2 className="text-7xl font-serif font-bold tracking-tight">The Core.</h2>
          <p className="max-w-xs text-sm text-text-dim uppercase tracking-widest leading-loose">
            Human intuition augmented by autonomous neural logic.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {founders.map((f, i) => (
            <FounderCard 
              key={i} 
              name={f.name} 
              role={f.role} 
              humanImg={f.humanImg} 
              bio={f.bio} 
            />
          ))}
        </div>
      </section>
    </div>
  );
}
