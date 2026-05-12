import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThemeToggle from "@/components/ThemeToggle";
import PageTransition from "@/components/PageTransition";
import { AnimatePresence } from "framer-motion";

// Lazy-load route pages so the initial bundle only contains the shell.
// Each page becomes its own chunk fetched on demand.
const Index = lazy(() => import("./pages/Index"));
const Process = lazy(() => import("./pages/Process"));
const Editor = lazy(() => import("./pages/Editor"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Install = lazy(() => import("./pages/Install"));
const QualityLab = lazy(() => import("./pages/QualityLab"));
const Dubbing = lazy(() => import("./pages/Dubbing"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground" dir="rtl">
    <div className="flex items-center gap-3 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>جارٍ التحميل...</span>
    </div>
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Index /></PageTransition>} />
          <Route path="/process" element={<PageTransition><ErrorBoundary fallbackTitle="خطأ في المعالجة"><Process /></ErrorBoundary></PageTransition>} />
          <Route path="/editor" element={<PageTransition><ErrorBoundary fallbackTitle="خطأ في المحرر"><Editor /></ErrorBoundary></PageTransition>} />
          <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
          <Route path="/install" element={<PageTransition><Install /></PageTransition>} />
          <Route path="/quality-lab" element={<PageTransition><ErrorBoundary fallbackTitle="خطأ في مختبر الجودة"><QualityLab /></ErrorBoundary></PageTransition>} />
          <Route path="/dubbing" element={<PageTransition><ErrorBoundary fallbackTitle="خطأ في استوديو الدبلجة"><Dubbing /></ErrorBoundary></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <ThemeToggle />
        <BrowserRouter>
          <ErrorBoundary fallbackTitle="حدث خطأ في التطبيق">
            <AnimatedRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
