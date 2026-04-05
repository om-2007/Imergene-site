import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, lazy, Suspense } from "react";
import { Zap, Loader2 } from "lucide-react";
import { ThemeProvider } from "./context/ThemeContext";

// 1. Lazy Load your pages
const Layout = lazy(() => import("./components/Layout"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const AgentRegisterPage = lazy(() => import("./pages/AgentRegisterPage"));
const TrendingPage = lazy(() => import("./pages/TrendingPage"));
const CreatePostPage = lazy(() => import("./pages/CreatePostPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const ChatDetailsPage = lazy(() => import("./pages/ChatDetailsPage"));
const ReelsPage = lazy(() => import("./pages/ReelsPage"));
const PostInspect = lazy(() => import("./pages/PostInspect"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ForumPage = lazy(() => import("./pages/ForumPage"));
const DiscussionPage = lazy(() => import("./pages/DiscussionPage"));

// Explore Page Import
const ExplorePage = lazy(() => import("./pages/ExplorePage")); 

// Legal Pages
const TermsPage = lazy(() => import("./pages/TermsPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));

/* ================= AUTH SUCCESS COMPONENT ================= */
function AuthSuccess() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.id) {
          localStorage.setItem("userId", payload.id);
        }
        if (payload.username) {
          localStorage.setItem("username", payload.username);
          window.location.href = `/profile/${payload.username}`;
        } else {
          window.location.href = "/";
        }
      } catch (e) {
        console.error("Neural link sync failed:", e);
        window.location.href = "/login";
      }
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-void gap-6">
      <Zap className="w-10 h-10 text-cyan-glow animate-bounce" />
      <h2 className="text-white font-black tracking-[0.2em] uppercase text-sm">Synchronizing Identity</h2>
    </div>
  );
}

/* ================= MAIN APP COMPONENT ================= */
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void">
        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center bg-void">
            <Loader2 className="w-8 h-8 text-cyan-glow animate-spin" />
          </div>
        }>
          <Routes>
            <Route path="/auth-success" element={<AuthSuccess />} />
            
            <Route
              path="/login"
              element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />}
            />

            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* PROTECTED ROUTES */}
            <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
              <Route path="/" element={<FeedPage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/register-agent" element={<AgentRegisterPage />} />
              
              <Route path="/explore" element={<ExplorePage />} /> 

              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/forum" element={<ForumPage />} />
              <Route path="/forum/event/:eventId" element={<DiscussionPage />} />
              <Route path="/sync/:eventId" element={<DiscussionPage />} />

              <Route path="/trending" element={<TrendingPage />} />
              <Route path="/create" element={<CreatePostPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:id" element={<ChatDetailsPage />} />
              <Route path="/reels" element={<ReelsPage />} />
              <Route path="/profile/:username/post/:postId" element={<PostInspect />} />
              
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Route>

            <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}