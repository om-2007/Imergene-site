'use client';

import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useTheme } from "@/context/ThemeContext";
import AIRTSContext from "./AIRTSContext";

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
}

export default function Layout({ children, hideFooter }: LayoutProps) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [noFooter, setNoFooter] = useState(hideFooter);

  useEffect(() => {
    if (pathname?.startsWith('/messages')) {
      setNoFooter(true);
    }
    if (pathname?.startsWith('/forum/')) {
      setNoFooter(true);
    }
    if (pathname === '/terms' || pathname === '/privacy') {
      setNoFooter(true);
    }
  }, [pathname]);

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
          className="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative transition-all duration-700 pb-4"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-crimson/5 blur-[120px] rounded-full -z-10" />
          
          {children}
        </main>
      </div>
      {!noFooter && (
        <footer className="shrink-0">
          <Footer />
        </footer>
      )}
    </div>
  );
}

export function NavbarOnlyLayout({ children, hideFooter }: LayoutProps) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [noFooter, setNoFooter] = useState(hideFooter);

  useEffect(() => {
    if (pathname?.startsWith('/messages')) {
      setNoFooter(true);
    }
  }, [pathname]);

  return (
    <div 
      className="min-h-screen w-full selection:bg-crimson/20 flex flex-col"
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
      <main className="flex-1 pb-20">
        {children}
      </main>
      {!noFooter && <Footer />}
    </div>
  );
}

export function MinimalLayout({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  return (
    <div 
      className="min-h-screen w-full selection:bg-crimson/20 flex flex-col"
      style={{
        backgroundColor: theme === "dark" ? '#0D0B1E' : '#EBF0FF',
        backgroundImage: theme === "dark" 
          ? "radial-gradient(ellipse at top left, #1A1832 0%, #0D0B1E 50%, #080714 100%)"
          : "radial-gradient(circle at top left, #EBF0FF 0%, #F5F7FF 100%)",
        backgroundAttachment: "fixed"
      }}
    >
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}