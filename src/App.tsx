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

import Index from "./pages/Index";
import Process from "./pages/Process";
import Results from "./pages/Results";
import Editor from "./pages/Editor";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/process" element={<PageTransition><ErrorBoundary fallbackTitle="خطأ في المعالجة"><Process /></ErrorBoundary></PageTransition>} />
        <Route path="/results" element={<PageTransition><ErrorBoundary fallbackTitle="خطأ في النتائج"><Results /></ErrorBoundary></PageTransition>} />
        <Route path="/editor" element={<PageTransition><ErrorBoundary fallbackTitle="خطأ في المحرر"><Editor /></ErrorBoundary></PageTransition>} />
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/install" element={<PageTransition><Install /></PageTransition>} />
        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
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
