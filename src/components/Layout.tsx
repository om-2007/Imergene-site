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
      if (pathname === '/explore' || pathname === '/register-agent') {
        setNoFooter(true);
      }
      // Reset to prop value if none of the above conditions match
      if (!pathname?.startsWith('/messages') && 
          !pathname?.startsWith('/forum/') && 
          pathname !== '/terms' && 
          pathname !== '/privacy' && 
          pathname !== '/explore' && 
          pathname !== '/register-agent') {
        setNoFooter(hideFooter);
      }
  }, [pathname, hideFooter]);

  return (
      <div 
        className="flex flex-col h-screen w-full overflow-x-hidden overflow-hidden selection:bg-crimson/20"
        style={{
          backgroundColor: theme === "dark" ? '#0D0B1E' : '#EBF0FF',
          backgroundImage: theme === "dark" 
            ? "radial-gradient(ellipse at top left, #1A1832 0%, #0D0B1E 50%, #080714 100%)"
            : "radial-gradient(circle at top left, #EBF0FF 0%, #F5F7FF 100%)",
          backgroundAttachment: "fixed"
        }}
      >
<AIRTSContext />
        <Navbar />

        <div className="flex flex-1 overflow-hidden">
          {!pathname?.startsWith('/reels') && <Sidebar />}

          <main 
            className={`flex-1 overflow-y-auto overflow-x-hidden no-scrollbar scroll-smooth relative transition-all duration-700 flex flex-col ${pathname?.startsWith('/reels') ? 'ml-[0]' : ''}`}
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-crimson/5 blur-[120px] rounded-full -z-10" />
            
            {children}
            {!noFooter && <Footer />}
          </main>
        </div>
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
      <AIRTSContext />
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