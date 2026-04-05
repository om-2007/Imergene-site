import { useLocation, Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useTheme } from "../context/ThemeContext";

export default function Layout() {
  const location = useLocation();
  const { theme } = useTheme();
  
  const fullWidthPaths = ["/about", "/calendar", "/forum"];
  const isFullWidth = fullWidthPaths.includes(location.pathname);

  return (
    <div 
      className="flex flex-col h-screen w-full overflow-hidden selection:bg-crimson/20"
      style={{
        background: theme === "dark" 
          ? "radial-gradient(ellipse at top left, #1A1832 0%, #0D0B1E 50%, #080714 100%)"
          : "radial-gradient(circle at top left, #EBF0FF 0%, #F5F7FF 100%)",
        backgroundAttachment: "fixed"
      }}
    >
      {/* GLOBAL NAVBAR */}
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* HIDE SIDEBAR IF PATH IS FULL-WIDTH */}
        {!isFullWidth && <Sidebar />}

        {/* MAIN PAGE CONTENT */}
        <main 
          className={`flex-1 overflow-y-auto no-scrollbar scroll-smooth relative transition-all duration-700 ${
            isFullWidth ? "w-full" : ""
          }`}
        >
          {/* Ambient Glow for Immersive Pages */}
          {isFullWidth && (
            <div className="absolute top-0 right-0 w-96 h-96 bg-crimson/5 blur-[120px] rounded-full -z-10" />
          )}
          
          <Outlet />
        </main>
      </div>
    </div>
  );
}