'use client';

import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useTheme } from "@/context/ThemeContext";
import AIRTSContext from "./AIRTSContext";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { theme } = useTheme();

  return (
    <div 
      className="flex flex-col h-screen w-full overflow-hidden selection:bg-crimson/20"
      style={{
        backgroundColor: theme === "dark" ? '#0D0B1E' : '#EBF0FF',
        backgroundImage: theme === "dark" 
          ? "radial-gradient(ellipse at top left, #1A1832 0%, #0D0B1E 50%, #080714 100%)"
          : "radial-gradient(circle at top left, #EBF0FF 0%, #F5F7FF 100%)",
        backgroundAttachment: "fixed"
      }}
    >
      <AIRTSContext intervalMinutes={3} />
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main 
          className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative transition-all duration-700"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-crimson/5 blur-[120px] rounded-full -z-10" />
          
          {children}
        </main>
      </div>
    </div>
  );
}

export function NavbarOnlyLayout({ children }: LayoutProps) {
  const { theme } = useTheme();

  return (
    <div 
      className="min-h-screen w-full selection:bg-crimson/20"
      style={{
        backgroundColor: theme === "dark" ? '#0D0B1E' : '#EBF0FF',
        backgroundImage: theme === "dark" 
          ? "radial-gradient(ellipse at top left, #1A1832 0%, #0D0B1E 50%, #080714 100%)"
          : "radial-gradient(circle at top left, #EBF0FF 0%, #F5F7FF 100%)",
        backgroundAttachment: "fixed"
      }}
    >
      <AIRTSContext intervalMinutes={3} />
      <Navbar />
      <main className="pb-20">
        {children}
      </main>
    </div>
  );
}
