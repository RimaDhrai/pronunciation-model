import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import ProtectedRoute from "./components/ProtectedRoute";
import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";

// ── Fallback spinner ──────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="w-10 h-10 animate-spin text-primary" />
  </div>
);

// ── Pages publiques (static imports – petit bundle) ───────────────────────────
import Landing       from "./pages/Landing";
import Login         from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound      from "./pages/NotFound";

// ── Pages utilisateur (lazy – divisées en chunks séparés) ─────────────────────
const Courses      = React.lazy(() => import("./pages/Courses"));     // /courses   → Catalogue vidéo
const CourseDetail = React.lazy(() => import("./pages/CourseDetail"));
const CEFRTest     = React.lazy(() => import("./pages/CEFRTest"));    // /cefr-test → Test + exercices
const Reports      = React.lazy(() => import("./pages/Reports"));
const Profile      = React.lazy(() => import("./pages/Profile"));
const ExerciseSelection = React.lazy(() => import("./pages/admin/Exercises"));
const ExerciseSession   = React.lazy(() => import("./pages/Exercisesession"));
const ExerciseRevision  = React.lazy(() => import("./pages/ExerciseRevision"));

const ChatbotPage       = React.lazy(() => import("./pages/ChatbotPage"));
const MasterCoach       = React.lazy(() => import("./pages/MasterCoach"));
const Settings          = React.lazy(() => import("./pages/Settings"));
const Battle            = React.lazy(() => import("./pages/Battle"));



// ── Pages admin (lazy) ────────────────────────────────────────────────────────
const AdminLogin        = React.lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard    = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers        = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminCourses      = React.lazy(() => import("./pages/admin/AdminCourses"));
const AdminMailSettings = React.lazy(() => import("./pages/admin/AdminMailSettings"));
const AdminSettings     = React.lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdminAuthed = sessionStorage.getItem("sc_admin_auth") === "1";
  
  // Security check: if the admin session flag is set, allow access.
  const hasAccess = isAdminAuthed;

  if (!hasAccess) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LanguageProvider>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ── Public ───────────────────────────────────────────────── */}
              <Route path="/"                element={<Landing />} />
              <Route path="/login"           element={<Login />} />
              <Route path="/reset-password"  element={<ResetPassword />} />

              {/* ── Utilisateur ──────────────────────────────────────────── */}
              <Route path="/dashboard"      element={<Navigate to="/master" replace />} />

              {/* Catalogue cours vidéo */}
              <Route path="/courses"        element={<ProtectedRoute><Courses /></ProtectedRoute>} />
              <Route path="/courses/:id"    element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
             
              {/* Test CEFR + exercices personnalisés post-test */}
              <Route path="/cefr-test"      element={<ProtectedRoute><CEFRTest /></ProtectedRoute>} />


              <Route path="/reports"        element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/profile"        element={<ProtectedRoute><Profile /></ProtectedRoute>} />

              {/* Exercices de prononciation — Style Duolingo */}
              <Route path="/exercises"           element={<ProtectedRoute><ExerciseSelection /></ProtectedRoute>} />
              <Route path="/exercises/:level"    element={<ProtectedRoute><ExerciseSession /></ProtectedRoute>} />
              <Route path="/exercises/revision"  element={<ProtectedRoute><ExerciseRevision /></ProtectedRoute>} />
              <Route path="/chatbot"            element={<ProtectedRoute><ChatbotPage /></ProtectedRoute>} />
              <Route path="/master"             element={<ProtectedRoute><MasterCoach /></ProtectedRoute>} />
              <Route path="/settings"           element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/battle"             element={<ProtectedRoute><Battle /></ProtectedRoute>} />


              {/* ── Admin ────────────────────────────────────────────────── */}
              <Route path="/admin/login"   element={<Suspense fallback={<PageLoader />}><AdminLogin /></Suspense>} />
              <Route path="/admin"         element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense></AdminRoute>} />
              <Route path="/admin/users"   element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminUsers /></Suspense></AdminRoute>} />
              <Route path="/admin/courses"        element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminCourses /></Suspense></AdminRoute>} />
              <Route path="/admin/mail-settings" element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminMailSettings /></Suspense></AdminRoute>} />
              <Route path="/admin/settings"      element={<AdminRoute><Suspense fallback={<PageLoader />}><AdminSettings /></Suspense></AdminRoute>} />

              {/* ── Fallback ─────────────────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
