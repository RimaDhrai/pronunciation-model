/**
 * src/pages/CourseDetail.jsx
 * Détail d'un cours avec suivi par leçon (style Udemy).
 * - Leçon suivante verrouillée jusqu'à validation de la précédente
 * - Vidéo doit être visionnée à 90% pour activer "Valider"
 * - Progression persistée dans Postgres via Spring Boot
 */
import React, { useState, useEffect, useRef } from 'react';
import Layout from '../components/layout/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCourseDetail, getCourseLessons, enrollCourse,
  updateCourseProgress, getLessonProgress, completeLessonProgress,
} from '../api/courses';
import {
  ArrowLeft, BookOpen, CheckCircle2, Lock,
  PlayCircle, Trophy, Loader2, Video, AlertTriangle,
} from 'lucide-react';
import { getStoredToken } from '../api/keycloakAuth';

const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean.startsWith('/storage') ? clean : `/storage${clean}`;
};

// ── Lecteur vidéo authentifié ─────────────────────────────────────────────────
function AuthenticatedVideo({ src, onWatchedEnough, onEnded }) {
  const videoRef = useRef(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    notifiedRef.current = false;
  }, [src]);

  const handleTimeUpdate = (e) => {
    if (notifiedRef.current) return;
    const v = e.target;
    if (v.duration && v.currentTime / v.duration >= 0.9) {
      notifiedRef.current = true;
      onWatchedEnough?.();
    }
  };

  const handleEnded = () => {
    notifiedRef.current = true;
    onWatchedEnough?.();
    onEnded?.();
  };

  if (!src) return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900 text-white min-h-[200px]">
      <p className="text-sm opacity-60">Source vidéo manquante.</p>
    </div>
  );

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      className="w-full h-full"
      src={src}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      playsInline
    />
  );
}

// ── Composant image authentifiée ──────────────────────────────────────────────
function AuthenticatedImage({ src, className, alt = '' }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevRef = useRef(null);
  useEffect(() => {
    if (!src) { setLoading(false); return; }
    if (src.startsWith('blob:') || src.startsWith('data:')) { setBlobUrl(src); setLoading(false); return; }
    const token   = getStoredToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(src, { headers })
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => { const u = URL.createObjectURL(blob); if (prevRef.current) URL.revokeObjectURL(prevRef.current); prevRef.current = u; setBlobUrl(u); })
      .catch(() => setBlobUrl(null))
      .finally(() => setLoading(false));
    return () => { if (prevRef.current) URL.revokeObjectURL(prevRef.current); };
  }, [src]);
  if (!src) return null;
  if (loading) return <div className={`bg-muted animate-pulse ${className}`} />;
  if (!blobUrl) return <div className={`bg-muted flex items-center justify-center ${className}`}><Video className="opacity-10 w-8 h-8" /></div>;
  return <img src={blobUrl} alt={alt} className={className} />;
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function CourseDetail() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [course,        setCourse]        = useState(null);
  const [lessons,       setLessons]       = useState([]);
  const [lessonDone,    setLessonDone]    = useState({}); // { [lessonId]: true }
  const [loading,       setLoading]       = useState(true);
  const [errorMsg,      setErrorMsg]      = useState(null);
  const [activeLesson,  setActiveLesson]  = useState(null); // {lesson, idx}
  const [watchedEnough, setWatchedEnough] = useState(false);
  const [validating,    setValidating]    = useState(false);

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Course data
      let courseData = null;
      let lessonsData = [];
      try {
        const res  = await getCourseDetail(id);
        const data = res.data;
        courseData  = data.course || (data.id ? data : null);
        lessonsData = data.lessons || courseData?.lessons || [];
      } catch {}

      if (!courseData) {
        try { await enrollCourse(id); const r2 = await getCourseDetail(id); courseData = r2.data.course || (r2.data.id ? r2.data : null); lessonsData = r2.data.lessons || []; } catch {}
      }
      if (courseData && !lessonsData.length) {
        try { const lr = await getCourseLessons(id); lessonsData = Array.isArray(lr.data) ? lr.data : []; } catch {}
      }

      if (!courseData) { navigate('/courses', { replace: true }); return; }
      setCourse(courseData);
      setLessons(lessonsData);

      // Per-lesson completion from Postgres
      try {
        const pr = await getLessonProgress(id);
        setLessonDone(pr.data || {});
      } catch {
        // Endpoint pas encore implémenté en Spring Boot : fallback percent-based
        setLessonDone({});
      }
    } catch (e) {
      setErrorMsg('Erreur de chargement.');
    }
    setLoading(false);
  };

  // Is a lesson completed?
  const isLessonDone = (lessonId) => !!lessonDone[lessonId];

  // Is a lesson accessible? First lesson always yes; others need previous done
  const isLessonUnlocked = (idx) => {
    if (idx === 0) return true;
    return isLessonDone(lessons[idx - 1]?.id);
  };

  // Overall progress = lessons done / total
  const totalDone = lessons.filter(l => isLessonDone(l.id)).length;
  const overallPct = lessons.length ? Math.round((totalDone / lessons.length) * 100) : 0;

  const openLesson = (lesson, idx) => {
    setActiveLesson({ lesson, idx });
    setWatchedEnough(false);
  };

  const closeLesson = () => {
    setActiveLesson(null);
    setWatchedEnough(false);
  };

  const handleValidate = async (autoNext = false) => {
    if (!activeLesson) return;
    setValidating(true);
    const { lesson, idx } = activeLesson;
    try {
      // Mark lesson complete in Postgres
      await completeLessonProgress(id, lesson.id);
      // Update overall course progress
      const newDone = { ...lessonDone, [lesson.id]: true };
      setLessonDone(newDone);
      const newPct = Math.round((Object.keys(newDone).length / lessons.length) * 100);
      await updateCourseProgress(id, newPct).catch(() => {});
    } catch {
      // Si endpoint pas encore dispo, mise à jour locale uniquement
      setLessonDone(prev => ({ ...prev, [lesson.id]: true }));
    }
    setValidating(false);
    
    if (autoNext && idx + 1 < lessons.length) {
      openLesson(lessons[idx + 1], idx + 1);
    } else {
      closeLesson();
    }
  };

  const handleVideoEnded = async () => {
    setWatchedEnough(true);
    if (!isLessonDone(activeLesson.lesson.id)) {
      await handleValidate(true);
    } else if (activeLesson.idx + 1 < lessons.length) {
      openLesson(lessons[activeLesson.idx + 1], activeLesson.idx + 1);
    } else {
      closeLesson();
    }
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) return (
    <Layout title="Cours">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse">Chargement du contenu…</p>
      </div>
    </Layout>
  );
  if (!course) return (
    <Layout title="Erreur">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-xl text-muted-foreground font-bold">{errorMsg || 'Cours introuvable.'}</p>
        <button onClick={() => navigate('/courses')} className="gradient-primary text-white px-6 py-2.5 rounded-xl font-bold">
          ← Retour aux cours
        </button>
      </div>
    </Layout>
  );

  const thumbnailPath = course.thumbnailUrl || course.thumbnail || course.imageUrl || course.image || course.imagePath;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto pb-16 space-y-8 animate-fade-up">

        {/* Back */}
        <button onClick={() => navigate('/courses')}
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" /> Retour aux cours
        </button>

        {/* Hero */}
        <div className="sneat-card p-8 relative overflow-hidden border-t-8 border-t-primary">
          {thumbnailPath && (
            <div className="absolute inset-0 z-0">
              <AuthenticatedImage src={getMediaUrl(thumbnailPath)} alt="" className="w-full h-full object-cover opacity-10 blur-sm" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            </div>
          )}
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start justify-between">
            <div className="space-y-3 max-w-2xl">
              <span className="px-3 py-1 bg-white text-primary text-xs font-bold rounded-full uppercase tracking-widest shadow-sm">
                Niveau {course.cefrLevel || course.cefr_level || course.level}
              </span>
              <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground">{course.title}</h1>
              <p className="text-muted-foreground leading-relaxed">{course.description || ''}</p>
            </div>

            {/* Progress ring */}
            <div className="shrink-0 w-full md:w-56 bg-white p-6 rounded-2xl shadow-lg border border-border space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-muted-foreground">Progression</span>
                <span className="text-2xl font-extrabold text-primary">{overallPct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${overallPct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground font-semibold text-center">
                {totalDone} / {lessons.length} leçons complétées
              </p>
              {overallPct === 100 && (
                <div className="flex items-center justify-center gap-2 text-success font-bold text-sm bg-success/10 py-2 rounded-lg">
                  <Trophy className="w-4 h-4" /> Cours complété !
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Video player */}
        {activeLesson && (
          <div className="sneat-card border-2 border-primary overflow-hidden shadow-2xl animate-fade-up">
            {/* Header */}
            <div className="p-4 bg-primary text-primary-foreground flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <PlayCircle className="w-5 h-5" />
                Leçon {activeLesson.idx + 1} : {activeLesson.lesson.title}
              </h3>
              <button onClick={closeLesson} className="text-primary-foreground/70 hover:text-white font-bold text-sm">
                Fermer
              </button>
            </div>

            {/* Video */}
            <div className="bg-black aspect-video relative">
              {(() => {
                const path = activeLesson.lesson.contentPath || activeLesson.lesson.videoUrl || activeLesson.lesson.content || '';
                const url  = getMediaUrl(path);
                if (!url) return (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-8">
                    <BookOpen className="w-16 h-16 opacity-40 mb-4" />
                    <p className="font-bold text-xl mb-1">Aucune vidéo disponible</p>
                    <p className="text-sm opacity-60">Contenu texte uniquement pour cette leçon.</p>
                  </div>
                );
                return (
                  <AuthenticatedVideo
                    src={url}
                    onWatchedEnough={() => setWatchedEnough(true)}
                    onEnded={handleVideoEnded}
                  />
                );
              })()}
            </div>

            {/* Validation bar */}
            {!isLessonDone(activeLesson.lesson.id) && (
              <div className="p-5 bg-slate-50 border-t border-border flex items-center justify-between gap-4">
                <div>
                  {watchedEnough ? (
                    <p className="text-primary font-bold text-sm">✓ Vidéo visionnée — tu peux valider</p>
                  ) : (
                    <p className="text-muted-foreground text-sm font-semibold">
                      👀 Regarde la vidéo jusqu'à 90% pour valider
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleValidate(true)}
                  disabled={!watchedEnough || validating}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed
                             bg-primary text-primary-foreground shadow-md hover:opacity-90 active:scale-95">
                  {validating
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><CheckCircle2 className="w-4 h-4" /> Valider la leçon</>
                  }
                </button>
              </div>
            )}
          </div>
        )}

        {/* Lesson list */}
        <div className={`space-y-6 transition-all ${activeLesson ? 'opacity-40 pointer-events-none' : ''}`}>
          <h2 className="font-heading font-bold text-2xl text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Programme du cours
          </h2>

          <div className="space-y-3">
            {lessons.length === 0 ? (
              <div className="sneat-card p-12 text-center border-dashed border-2">
                <Video className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="font-bold text-muted-foreground">Aucune leçon disponible pour l'instant.</p>
              </div>
            ) : lessons.map((lesson, idx) => {
              const done     = isLessonDone(lesson.id);
              const unlocked = isLessonUnlocked(idx);

              return (
                <div key={lesson.id}
                     className={`sneat-card border-l-4 transition-all ${
                       done      ? 'border-l-success bg-success/5' :
                       unlocked  ? 'border-l-primary hover:shadow-md' :
                                   'border-l-muted opacity-55'
                     }`}>
                  <div className="flex items-center gap-4 p-2">
                    {/* Index / status */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border-2 ${
                      done     ? 'bg-success text-white border-success' :
                      unlocked ? 'bg-primary/10 text-primary border-primary/30' :
                                 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {done ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>

                    {/* Title */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold flex items-center gap-2 truncate ${done ? 'text-success/90' : 'text-foreground'}`}>
                        {lesson.title}
                        {!unlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </h3>
                      {lesson.type === 'video' && (
                        <p className="text-xs font-semibold text-primary/70 mt-0.5 flex items-center gap-1">
                          <Video className="w-3 h-3" /> Leçon vidéo
                        </p>
                      )}
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                      {done ? (
                        <button onClick={() => openLesson(lesson, idx)}
                          className="px-4 py-2 border-2 border-success text-success rounded-lg font-bold text-sm hover:bg-success/5 flex items-center gap-1.5">
                          <PlayCircle className="w-4 h-4" /> Revoir
                        </button>
                      ) : unlocked ? (
                        <button onClick={() => openLesson(lesson, idx)}
                          className="px-5 py-2 gradient-primary text-primary-foreground rounded-lg font-bold text-sm shadow-md hover:opacity-90 flex items-center gap-1.5">
                          <PlayCircle className="w-4 h-4" /> Démarrer
                        </button>
                      ) : (
                        <button disabled className="px-4 py-2 bg-muted text-muted-foreground rounded-lg font-semibold text-sm flex items-center gap-1.5">
                          <Lock className="w-4 h-4" /> Verrouillé
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
