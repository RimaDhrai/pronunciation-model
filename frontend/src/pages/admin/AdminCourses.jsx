import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { useLanguage } from '../../context/LanguageContext';
import {
  Plus, Search, Trash2, Video, Pencil,
  Eye, LayoutGrid, List, Loader2, X, Upload,
  ChevronLeft, AlertTriangle, Check, BookOpen,
  FilePlus2, PlayCircle, ImageIcon
} from 'lucide-react';
import {
  adminGetAllCourses, createCourse, updateCourse, createLesson,
  updateLesson, uploadLessonVideo, deleteCourse, deleteLesson,
  adminGetCourseDetail, adminGetCourseLessons
} from '../../api/courses';
import { getStoredToken } from '../../api/keycloakAuth';

const ADMIN_UI = {
  fr: {
    pageTitle: 'Gestion des Cours',
    searchPlaceholder: 'Rechercher un cours...',
    coursesCount: (n) => `${n} cours`,
    newCourse: 'Nouveau Cours',
    thTitle: 'Titre & Langue',
    thLevel: 'Niveau',
    thDesc: 'Description',
    thStatus: 'Statut',
    thActions: 'Actions',
    active: '● Actif',
    inactive: '○ Inactif',
    noCourse: 'Aucun cours trouvé',
    noCourseSub: 'Créez votre premier cours via le bouton ci-dessus.',
    createCourse: 'Créer un cours',
    addCourseTitle: 'Ajouter un Cours Vidéo',
    courseTitle: 'Titre du cours *',
    courseDesc: 'Description',
    courseLang: 'Langue du cours *',
    courseLevel: 'Niveau CEFR *',
    coverImage: 'Image de couverture',
    coverOptional: '— optionnel',
    clickOrDragImage: 'Cliquez ou glissez une image',
    imageFormats: 'JPG, PNG, WebP — miniature du cours',
    clickToChange: 'Cliquer pour changer',
    firstVideo: 'Vidéo 1ère leçon',
    videoOptional: '— optionnel, vous pourrez en ajouter après',
    clickOrDragVideo: 'Cliquez ou glissez une vidéo ici',
    videoFormats: 'MP4, WebM, AVI — max 500 MB',
    cancel: 'Annuler',
    creating: 'Création en cours...',
    saveCourse: 'Enregistrer le cours',
    viewLessons: 'Voir les leçons',
    edit: 'Modifier',
    delete: 'Supprimer',
    view: 'Voir',
    noDesc: 'Aucune description',
    lessons: 'Leçons',
    noLessons: 'Aucune leçon pour ce cours.',
    addLesson: 'Ajouter une leçon',
    lessonTitle: 'Titre de la leçon *',
    lessonTitlePlaceholder: 'Ex: Introduction aux sons...',
    lessonVideo: 'Vidéo de la leçon *',
    dragHere: 'Glissez la vidéo ici ou cliquez pour sélectionner',
    uploading: 'Upload en cours...',
    addLessonBtn: 'Ajouter la leçon',
    confirmDelete: 'Confirmer la suppression',
    confirmDeleteMsg: (t) => `Êtes-vous sûr de vouloir supprimer le cours "${t}" ? Cette action est irréversible.`,
    confirmDeleteLesson: (t) => `Supprimer la leçon "${t}" ? Cette action est irréversible.`,
    deleting: 'Suppression...',
    editCourse: 'Modifier le cours',
    saving: 'Enregistrement...',
    saveChanges: 'Sauvegarder',
    editLesson: 'Modifier la leçon',
    newVideo: 'Nouvelle vidéo (optionnel)',
    videoInaccessible: 'Vidéo inaccessible (403/404)',
    securingStream: 'Sécurisation du flux...',
    titleRequired: 'Le titre de la leçon est requis.',
    selectVideo: 'Veuillez sélectionner un fichier vidéo.',
  },
  en: {
    pageTitle: 'Courses',
    searchPlaceholder: 'Search a course...',
    coursesCount: (n) => `${n} course${n > 1 ? 's' : ''}`,
    newCourse: 'New Course',
    thTitle: 'Title & Language',
    thLevel: 'Level',
    thDesc: 'Description',
    thStatus: 'Status',
    thActions: 'Actions',
    active: '● Active',
    inactive: '○ Inactive',
    noCourse: 'No course found',
    noCourseSub: 'Create your first course using the button above.',
    createCourse: 'Create a course',
    addCourseTitle: 'Add a Video Course',
    courseTitle: 'Course title *',
    courseDesc: 'Description',
    courseLang: 'Course language *',
    courseLevel: 'CEFR Level *',
    coverImage: 'Cover image',
    coverOptional: '— optional',
    clickOrDragImage: 'Click or drag an image',
    imageFormats: 'JPG, PNG, WebP — course thumbnail',
    clickToChange: 'Click to change',
    firstVideo: '1st lesson video',
    videoOptional: '— optional, you can add more later',
    clickOrDragVideo: 'Click or drag a video here',
    videoFormats: 'MP4, WebM, AVI — max 500 MB',
    cancel: 'Cancel',
    creating: 'Creating...',
    saveCourse: 'Save course',
    viewLessons: 'View lessons',
    edit: 'Edit',
    delete: 'Delete',
    view: 'View',
    noDesc: 'No description',
    lessons: 'Lessons',
    noLessons: 'No lessons for this course.',
    addLesson: 'Add a lesson',
    lessonTitle: 'Lesson title *',
    lessonTitlePlaceholder: 'Ex: Introduction to sounds...',
    lessonVideo: 'Lesson video *',
    dragHere: 'Drag the video here or click to select',
    uploading: 'Uploading...',
    addLessonBtn: 'Add lesson',
    confirmDelete: 'Confirm deletion',
    confirmDeleteMsg: (t) => `Are you sure you want to delete the course "${t}"? This action is irreversible.`,
    confirmDeleteLesson: (t) => `Delete lesson "${t}"? This action is irreversible.`,
    deleting: 'Deleting...',
    editCourse: 'Edit course',
    saving: 'Saving...',
    saveChanges: 'Save',
    editLesson: 'Edit lesson',
    newVideo: 'New video (optional)',
    videoInaccessible: 'Video inaccessible (403/404)',
    securingStream: 'Securing stream...',
    titleRequired: 'Lesson title is required.',
    selectVideo: 'Please select a video file.',
  },
};

const LEVELS = ['A1','A2','B1','B2','C1','C2'];
const LEVEL_COLORS = {
  A1: 'bg-emerald-100 text-emerald-700',
  A2: 'bg-teal-100 text-teal-700',
  B1: 'bg-blue-100 text-blue-700',
  B2: 'bg-indigo-100 text-indigo-700',
  C1: 'bg-purple-100 text-purple-700',
  C2: 'bg-rose-100 text-rose-700',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  if (path.startsWith('blob:')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // Force /storage prefix if missing
  return cleanPath.startsWith('/storage') ? cleanPath : `/storage${cleanPath}`;
};

// ── Authenticated Image Component ──────────────────────────────────────────
function AuthenticatedImage({ src, className, alt = "" }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const prevBlobRef = useRef(null);

  useEffect(() => {
    if (!src) { setLoading(false); return; }
    if (src.startsWith('blob:') || (src.startsWith('http') && !src.includes('192.168.1.12') && !src.includes('localhost'))) {
      setBlobUrl(src);
      setLoading(false);
      return;
    }
    const token = getStoredToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(src, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = url;
        setBlobUrl(url);
      })
      .catch(() => setBlobUrl(null))
      .finally(() => setLoading(false));
    return () => { if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current); };
  }, [src]);

  if (!src) return null;
  if (loading) return <div className={`bg-muted animate-pulse ${className}`} />;
  if (!blobUrl) return <div className={`bg-muted flex items-center justify-center ${className}`}><BookOpen className="opacity-10 w-8 h-8" /></div>;
  return <img src={blobUrl} alt={alt} className={className} />;
}

// ── Composant vidéo authentifié ──────────────────────────────────────────────
function AuthenticatedVideo({ src, className }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [mimeType, setMimeType] = useState('video/mp4');
  const prevBlobRef = useRef(null);

  useEffect(() => {
    if (!src) { setLoading(false); return; }
    setLoading(true);
    setError(false);
    setBlobUrl(null);

    const token = getStoredToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(src, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get('content-type');
        if (contentType) setMimeType(contentType);
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = url;
        setBlobUrl(url);
      })
      .catch(err => {
        console.error('Chargement vidéo échoué:', err.message, src);
        setError(true);
      })
      .finally(() => setLoading(false));

    return () => {
      if (prevBlobRef.current) {
        URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = null;
      }
    };
  }, [src]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center w-full min-h-[200px] bg-slate-900 text-white gap-2">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-[10px] opacity-60">Sécurisation du flux...</p>
    </div>
  );

  if (error || !blobUrl) return (
    <div className="flex flex-col items-center justify-center w-full min-h-[200px] bg-slate-900 p-6 text-center">
      <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
      <p className="text-white text-xs font-bold">Vidéo inaccessible (403/404)</p>
    </div>
  );

  return (
    <video controls className={className} key={blobUrl} playsInline>
      <source src={blobUrl} type={mimeType} />
    </video>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export default function AdminCourses() {
  const { lang } = useLanguage();
  const t = ADMIN_UI[lang] || ADMIN_UI.fr;
  const [courses, setCourses]   = useState([]);
  const [search, setSearch]     = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [loading, setLoading]   = useState(true);

  // ── Create Course modal ──
  const [showModal, setShowModal]       = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [videoFile, setVideoFile]       = useState(null);
  const [imageFile, setImageFile]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // ── View / Detail modal ──
  const [viewCourse, setViewCourse]     = useState(null);
  const [viewLessons, setViewLessons]   = useState([]);
  const [viewLoading, setViewLoading]   = useState(false);

  // ── Add Lesson modal ──
  const [showAddLesson, setShowAddLesson]         = useState(false);
  const [lessonTitle, setLessonTitle]             = useState('');
  const [lessonVideoFile, setLessonVideoFile]     = useState(null);
  const [addingLesson, setAddingLesson]           = useState(false);
  const [lessonUploadProgress, setLessonUploadProgress] = useState(0);
  const lessonDropRef = useRef(null);

  // ── Delete course ──
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Delete lesson ──
  const [deleteLessonTarget, setDeleteLessonTarget] = useState(null);
  const [deletingLesson, setDeletingLesson]         = useState(false);

  // ── Edit course ──
  const [editTarget,       setEditTarget]       = useState(null);
  const [editFormData,     setEditFormData]     = useState({ title: '', description: '', cefrLevel: 'A1', lang: 'fr' });
  const [editImageFile,    setEditImageFile]    = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const [isEditUploading,  setIsEditUploading]  = useState(false);

  // ── Edit lesson ──
  const [editLessonTarget,    setEditLessonTarget]    = useState(null);
  const [editLessonTitle,     setEditLessonTitle]     = useState('');
  const [editLessonVideoFile, setEditLessonVideoFile] = useState(null);
  const [isEditingLesson,     setIsEditingLesson]     = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', cefrLevel: 'A1', lang: 'fr',
  });

  // ───────────── FETCH ─────────────
  useEffect(() => { fetchCourses(); }, [lang]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await adminGetAllCourses(lang);
      if (res.data && Array.isArray(res.data)) {
        setCourses(res.data);
      } else {
        setCourses([]);
      }
    } catch (err) {
      console.error("Erreur de récupération des cours:", err);
      setCourses([]);
    }
    setLoading(false);
  };

  // ───────────── CREATE COURSE ─────────────
  const resetForm = () => {
    setFormData({ title: '', description: '', cefrLevel: 'A1', lang: 'fr' });
    setVideoFile(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageChange = (file) => {
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      const courseFd = new FormData();
      courseFd.append('title', formData.title);
      courseFd.append('description', formData.description);
      courseFd.append('cefrLevel', formData.cefrLevel);
      courseFd.append('lang', formData.lang);
      if (imageFile) courseFd.append('thumbnail', imageFile);
      
      const resCourse = await createCourse(courseFd);
      const courseId = resCourse.data.id;

      if (videoFile) {
        const lessonFd = new FormData();
        lessonFd.append('title', formData.title);
        lessonFd.append('type', 'video');
        lessonFd.append('file', videoFile);
        try {
          const resLesson = await createLesson(courseId, lessonFd);
          const lessonId = resLesson.data?.id;
          if (lessonId && videoFile) {
            try {
              await uploadLessonVideo(courseId, lessonId, videoFile);
            } catch (uploadErr) {
              console.warn("Upload vidéo séparé échoué:", uploadErr.message);
            }
          }
        } catch (lessonErr) {
          console.warn("Création de leçon échouée:", lessonErr.message);
        }
      }

      setShowModal(false);
      resetForm();
      fetchCourses();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la création du cours : " + (err.response?.data?.message || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  // ───────────── VIEW DETAIL ─────────────
  const handleView = async (course) => {
    setViewCourse(course);
    setViewLessons([]);
    setViewLoading(true);
    try {
      const res = await adminGetCourseLessons(course.id);
      setViewLessons(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn("Impossible de charger les leçons:", err.message);
      try {
        const detailRes = await adminGetCourseDetail(course.id);
        if (detailRes.data?.lessons) {
          setViewLessons(detailRes.data.lessons);
        }
      } catch (e2) {
        console.warn("getCourseDetail aussi échoué:", e2.message);
      }
    }
    setViewLoading(false);
  };

  const refreshLessons = async () => {
    if (!viewCourse) return;
    setViewLoading(true);
    try {
      const res = await adminGetCourseLessons(viewCourse.id);
      setViewLessons(Array.isArray(res.data) ? res.data : []);
    } catch {
      try {
        const detailRes = await adminGetCourseDetail(viewCourse.id);
        if (detailRes.data?.lessons) setViewLessons(detailRes.data.lessons);
      } catch {}
    }
    setViewLoading(false);
  };

  const getVideoUrl = (lesson) => {
    const path = lesson.contentPath || lesson.videoUrl || lesson.content || '';
    return getMediaUrl(path);
  };

  // ───────────── ADD LESSON ─────────────
  const openAddLesson = () => {
    setLessonTitle('');
    setLessonVideoFile(null);
    setLessonUploadProgress(0);
    setShowAddLesson(true);
  };

  const handleLessonDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) setLessonVideoFile(file);
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!viewCourse) return;
    if (!lessonTitle.trim()) return alert("Le titre de la leçon est requis.");
    if (!lessonVideoFile) return alert("Veuillez sélectionner un fichier vidéo.");

    setAddingLesson(true);
    setLessonUploadProgress(10);
    try {
      const lessonFd = new FormData();
      lessonFd.append('title', lessonTitle.trim());
      lessonFd.append('type', 'video');
      lessonFd.append('file', lessonVideoFile);

      setLessonUploadProgress(30);
      const resLesson = await createLesson(viewCourse.id, lessonFd);
      const lessonId = resLesson.data?.id;

      setLessonUploadProgress(60);
      if (lessonId && lessonVideoFile) {
        try {
          await uploadLessonVideo(viewCourse.id, lessonId, lessonVideoFile);
        } catch (uploadErr) {
          console.warn("Upload vidéo séparé échoué (peut-être déjà incluse):", uploadErr.message);
        }
      }

      setLessonUploadProgress(100);
      await new Promise(r => setTimeout(r, 400));
      setShowAddLesson(false);
      setLessonTitle('');
      setLessonVideoFile(null);
      await refreshLessons();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout de la leçon : " + (err.response?.data?.message || err.message));
    } finally {
      setAddingLesson(false);
      setLessonUploadProgress(0);
    }
  };

  // ───────────── DELETE COURSE ─────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCourse(deleteTarget.id);
      setDeleteTarget(null);
      fetchCourses();
    } catch (err) {
      console.error("Erreur de suppression:", err);
      alert("Erreur de suppression : " + (err.response?.data?.message || err.message));
    }
    setDeleting(false);
  };

  // ───────────── DELETE LESSON ─────────────
  const handleDeleteLesson = async () => {
    if (!deleteLessonTarget || !viewCourse) return;
    setDeletingLesson(true);
    try {
      await deleteLesson(viewCourse.id, deleteLessonTarget.id);
      setDeleteLessonTarget(null);
      await refreshLessons();
    } catch (err) {
      console.error("Erreur suppression leçon:", err);
      alert("Erreur : " + (err.response?.data?.message || err.message));
    }
    setDeletingLesson(false);
  };

  // ───────────── EDIT COURSE ─────────────
  const openEditCourse = (course) => {
    setEditTarget(course);
    setEditFormData({
      title:       course.title       || '',
      description: course.description || '',
      cefrLevel:   course.cefrLevel   || 'A1',
      lang:        course.lang        || 'fr',
    });
    setEditImageFile(null);
    const thumb = course.thumbnailUrl || course.thumbnail || course.imageUrl || course.image || course.imagePath;
    setEditImagePreview(thumb ? getMediaUrl(thumb) : null);
  };

  const handleEditImageChange = (file) => {
    if (!file) return;
    setEditImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setEditImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleUpdateCourse = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    setIsEditUploading(true);
    try {
      const fd = new FormData();
      fd.append('title',       editFormData.title);
      fd.append('description', editFormData.description);
      fd.append('cefrLevel',   editFormData.cefrLevel);
      fd.append('lang',        editFormData.lang);
      if (editImageFile) fd.append('thumbnail', editImageFile);
      await updateCourse(editTarget.id, fd);
      setEditTarget(null);
      fetchCourses();
      if (viewCourse?.id === editTarget.id) {
        setViewCourse(prev => prev ? { ...prev, ...editFormData } : prev);
      }
    } catch (err) {
      alert('Erreur modification : ' + (err.response?.data?.message || err.message));
    } finally {
      setIsEditUploading(false);
    }
  };

  // ───────────── EDIT LESSON ─────────────
  const openEditLesson = (lesson) => {
    setEditLessonTarget(lesson);
    setEditLessonTitle(lesson.title || '');
    setEditLessonVideoFile(null);
  };

  const handleUpdateLesson = async (e) => {
    e.preventDefault();
    if (!editLessonTarget || !viewCourse) return;
    if (!editLessonTitle.trim()) return alert('Le titre est requis.');
    setIsEditingLesson(true);
    try {
      const fd = new FormData();
      fd.append('title', editLessonTitle.trim());
      if (editLessonVideoFile) fd.append('file', editLessonVideoFile);
      await updateLesson(viewCourse.id, editLessonTarget.id, fd);
      setEditLessonTarget(null);
      await refreshLessons();
    } catch (err) {
      alert('Erreur modification leçon : ' + (err.response?.data?.message || err.message));
    } finally {
      setIsEditingLesson(false);
    }
  };

  // ───────────── FILTER ─────────────
  const filtered = courses.filter(c =>
    (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title={t.pageTitle}>
      <div className="space-y-6">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder={t.searchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold mr-1">{t.coursesCount(courses.length)}</span>
            <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
              <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-slate-500'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
            >
              <Plus className="w-4 h-4" /> {t.newCourse}
            </button>
          </div>
        </div>

        {loading ? (
           <div className="flex justify-center items-center py-20">
             <Loader2 className="w-8 h-8 animate-spin text-primary" />
           </div>
        ) : (
          <>
            {/* Table */}
            {viewMode === 'table' ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="px-6 py-4">{t.thTitle}</th>
                      <th className="px-6 py-4">{t.thLevel}</th>
                      <th className="px-6 py-4">{t.thDesc}</th>
                      <th className="px-6 py-4">{t.thStatus}</th>
                      <th className="px-6 py-4 text-right">{t.thActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map((course) => (
                      <tr key={course.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Video className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                               <span className="font-bold text-slate-800 block">{course.title}</span>
                               <span className="text-[10px] text-muted-foreground font-bold uppercase">{course.lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${LEVEL_COLORS[course.cefrLevel] || 'bg-slate-100 text-slate-500'}`}>
                            {course.cefrLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs max-w-[200px] truncate">
                          {course.description || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            course.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {course.active !== false ? t.active : t.inactive}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleView(course)}
                              className="p-2 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 text-blue-600 transition-all"
                              title="Voir les leçons"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditCourse(course)}
                              className="p-2 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200 text-amber-500 transition-all"
                              title="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(course)}
                              className="p-2 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 text-rose-500 transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filtered.map((course) => (
                  <div key={course.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group overflow-hidden">
                    <div className="aspect-video bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative overflow-hidden">
                      {/* Thumbnail image if available */}
                      {(course.thumbnailUrl || course.thumbnail || course.imageUrl || course.image || course.imagePath) ? (
                        <AuthenticatedImage 
                          src={getMediaUrl(course.thumbnailUrl || course.thumbnail || course.imageUrl || course.image || course.imagePath)} 
                          alt={course.title}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="scale-150 opacity-20 group-hover:scale-110 transition-transform duration-500">
                          <Video className="w-10 h-10 text-primary" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex gap-1 transform translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => handleView(course)}
                          className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Voir"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditCourse(course)}
                          className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-amber-500 hover:bg-amber-50 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(course)}
                          className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold ${LEVEL_COLORS[course.cefrLevel] || 'bg-slate-100 text-slate-500'}`}>
                        {course.cefrLevel}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-slate-800 text-sm line-clamp-2 leading-snug mb-1">{course.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{course.description || t.noDesc}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{course.lang === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</span>
                        <button 
                          onClick={() => handleView(course)}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> {t.view}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filtered.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-slate-800 font-bold mb-1">{t.noCourse}</h3>
                <p className="text-slate-500 text-sm mb-4">{t.noCourseSub}</p>
                <button onClick={openCreateModal} className="px-4 py-2 gradient-primary text-white rounded-lg text-sm font-bold">
                  <Plus className="w-4 h-4 inline mr-1" /> {t.createCourse}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════ MODAL: CRÉATION COURS ═══════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !isUploading && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
              <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> {t.addCourseTitle}
              </h2>
              <button 
                onClick={() => !isUploading && setShowModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-slate-100 transition-colors"
                disabled={isUploading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCourse} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.courseTitle}</label>
                <input 
                  type="text" required
                  value={formData.title} onChange={e => setFormData(p => ({...p, title: e.target.value}))}
                  className="sneat-input w-full" placeholder="Ex: Articulation des voyelles" 
                  disabled={isUploading}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.courseDesc}</label>
                <textarea 
                  rows={2}
                  value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))}
                  className="sneat-input w-full" placeholder="Explication courte..."
                  disabled={isUploading}
                />
              </div>

              {/* ── Langue + Niveau ── */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-2">{t.courseLang}</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'fr', flag: '🇫🇷', label: 'Français', sub: 'French' },
                    { value: 'en', flag: '🇬🇧', label: 'English',  sub: 'Anglais' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={isUploading}
                      onClick={() => setFormData(p => ({ ...p, lang: opt.value }))}
                      className="relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer"
                      style={{
                        borderColor: formData.lang === opt.value ? '#6366f1' : '#e2e8f0',
                        background:  formData.lang === opt.value ? '#f5f3ff' : '#fff',
                      }}
                    >
                      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{opt.flag}</span>
                      <div className="text-left">
                        <div className="font-bold text-sm" style={{ color: formData.lang === opt.value ? '#4f46e5' : '#1e293b' }}>{opt.label}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{opt.sub}</div>
                      </div>
                      {formData.lang === opt.value && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#6366f1' }}>
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.courseLevel}</label>
                <select
                  value={formData.cefrLevel} onChange={e => setFormData(p => ({...p, cefrLevel: e.target.value}))}
                  className="sneat-input w-full" disabled={isUploading}
                >
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* ── Image de couverture ── */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.coverImage} <span className="text-slate-400 font-normal">{t.coverOptional}</span></label>
                <div className={`relative group border-2 border-dashed rounded-xl overflow-hidden transition-all ${
                  imagePreview ? 'border-primary' : 'border-slate-300 hover:border-primary hover:bg-primary/5'
                }`}>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => handleImageChange(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={isUploading}
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Aperçu" className="w-full h-36 object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-bold">Cliquer pour changer</p>
                      </div>
                      <span className="absolute top-2 right-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {imageFile?.name?.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-primary transition-colors" />
                      <p className="text-sm font-semibold text-slate-600">{t.clickOrDragImage}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{t.imageFormats}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Vidéo de la première leçon ── */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.firstVideo} <span className="text-slate-400 font-normal">{t.videoOptional}</span></label>
                <div className={`relative group border-2 border-dashed rounded-xl p-5 text-center transition-all ${videoFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-primary hover:bg-primary/5'}`}>
                  <input 
                    type="file" 
                    accept="video/*"
                    onChange={e => setVideoFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  {videoFile ? (
                    <>
                      <Check className="w-7 h-7 text-emerald-500 mx-auto mb-1" />
                      <p className="text-sm font-bold text-emerald-700">{videoFile.name}</p>
                      <p className="text-[10px] text-emerald-500 mt-0.5">{(videoFile.size / 1024 / 1024).toFixed(1)} MB — Cliquez pour changer</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-7 h-7 text-slate-400 mx-auto mb-1 group-hover:text-primary transition-colors" />
                      <p className="text-sm font-semibold text-slate-600">{t.clickOrDragVideo}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{t.videoFormats}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                <button type="button" onClick={() => setShowModal(false)} disabled={isUploading} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" disabled={isUploading} className="px-5 py-2.5 gradient-primary text-white rounded-xl font-bold flex items-center justify-center disabled:opacity-50 shadow-lg shadow-primary/20">
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  {isUploading ? t.creating : t.saveCourse}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: VOIR DÉTAILS + LEÇONS ═══════════════ */}
      {viewCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setViewCourse(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            {/* Course thumbnail banner */}
            {(viewCourse.thumbnailUrl || viewCourse.thumbnail || viewCourse.imageUrl || viewCourse.image || viewCourse.imagePath) && (
              <div className="relative h-40 overflow-hidden rounded-t-2xl">
                <AuthenticatedImage 
                  src={getMediaUrl(viewCourse.thumbnailUrl || viewCourse.thumbnail || viewCourse.imageUrl || viewCourse.image || viewCourse.imagePath)}
                  alt={viewCourse.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <span className={`absolute bottom-3 left-4 px-2.5 py-1 rounded-md text-xs font-bold ${LEVEL_COLORS[viewCourse.cefrLevel] || 'bg-slate-100 text-slate-500'}`}>
                  {viewCourse.cefrLevel}
                </span>
              </div>
            )}
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b bg-slate-50/50 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button onClick={() => setViewCourse(null)} className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                  <h2 className="font-heading font-bold text-lg text-foreground">{viewCourse.title}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    {!(viewCourse.thumbnailUrl || viewCourse.thumbnail || viewCourse.imageUrl || viewCourse.image || viewCourse.imagePath) && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${LEVEL_COLORS[viewCourse.cefrLevel] || 'bg-slate-100 text-slate-500'}`}>
                        {viewCourse.cefrLevel}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold">{viewCourse.lang === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* ── ADD LESSON BUTTON ── */}
                <button 
                  onClick={openAddLesson}
                  className="flex items-center gap-1.5 px-3.5 py-2 gradient-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 hover:opacity-90 transition-all"
                >
                  <FilePlus2 className="w-3.5 h-3.5" /> {t.addLesson}
                </button>
                <button onClick={() => setViewCourse(null)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-slate-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Description */}
              {viewCourse.description && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-600">{viewCourse.description}</p>
                </div>
              )}

              {/* Lessons */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" /> 
                    {t.lessons}
                    {viewLessons.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {viewLessons.length}
                      </span>
                    )}
                  </h3>
                  <button 
                    onClick={openAddLesson}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t.addLesson}
                  </button>
                </div>

                {viewLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : viewLessons.length > 0 ? (
                  <div className="space-y-4">
                    {viewLessons.map((lesson, idx) => {
                      const videoUrl = getVideoUrl(lesson);
                      return (
                        <div key={lesson.id || idx} className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                          <div className="p-3 bg-slate-50/50 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <PlayCircle className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-slate-800 truncate">{lesson.title || `${t.lessonTitle.split(' *')[0]} ${idx + 1}`}</p>
                              <p className="text-[10px] text-slate-400 uppercase">{lesson.type || 'video'}</p>
                            </div>
                            {lesson.id && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => openEditLesson(lesson)}
                                  className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-600 transition-colors"
                                  title={t.edit}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteLessonTarget(lesson)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-colors"
                                  title={t.delete}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          {videoUrl ? (
                            <div className="bg-black">
                              <AuthenticatedVideo 
                                src={videoUrl} 
                                className="w-full max-h-[340px]" 
                              />
                            </div>
                          ) : (
                            <div className="px-4 py-6 text-center text-slate-400 text-sm border-t border-slate-50">
                              <Video className="w-6 h-6 mx-auto mb-2 opacity-30" />
                              {t.noLessons.replace('.', '')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                    <Video className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-400 font-semibold">{t.noLessons}</p>
                    <p className="text-[10px] text-slate-300 mt-1 mb-4">{t.videoOptional.replace('— ', '')}</p>
                    <button
                      onClick={openAddLesson}
                      className="inline-flex items-center gap-1.5 px-4 py-2 gradient-primary text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      <FilePlus2 className="w-3.5 h-3.5" /> {t.addLesson}
                    </button>
                  </div>
                )}
              </div>

              {/* Course Info */}
              <div className="grid grid-cols-2 gap-4 text-xs border-t pt-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-slate-400 font-bold block mb-0.5">{lang === 'fr' ? 'ID du cours' : 'Course ID'}</span>
                  <span className="text-slate-700 font-bold">{viewCourse.id}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-slate-400 font-bold block mb-0.5">{t.thStatus}</span>
                  <span className={`font-bold ${viewCourse.active !== false ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {viewCourse.active !== false ? t.active : t.inactive}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: AJOUTER UNE LEÇON VIDÉO ═══════════════ */}
      {showAddLesson && viewCourse && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !addingLesson && setShowAddLesson(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b bg-gradient-to-r from-primary/5 to-blue-50/50">
              <div>
                <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                  <FilePlus2 className="w-5 h-5 text-primary" /> {t.addLesson}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{lang === 'fr' ? 'Cours' : 'Course'} : <span className="font-semibold text-slate-600">{viewCourse.title}</span></p>
              </div>
              <button 
                onClick={() => !addingLesson && setShowAddLesson(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-slate-100 transition-colors"
                disabled={addingLesson}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLesson} className="p-5 space-y-4">
              {/* Lesson title */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.lessonTitle}</label>
                <input 
                  type="text" required
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  className="sneat-input w-full"
                  placeholder={t.lessonTitlePlaceholder}
                  disabled={addingLesson}
                />
              </div>

              {/* Video drop zone */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.lessonVideo} <span className="text-slate-400 font-normal">(MP4, WebM, AVI)</span></label>
                <div
                  ref={lessonDropRef}
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleLessonDrop}
                  className={`relative group border-2 border-dashed rounded-xl transition-all ${
                    lessonVideoFile 
                      ? 'border-emerald-400 bg-emerald-50/50' 
                      : 'border-slate-300 hover:border-primary hover:bg-primary/5'
                  } ${addingLesson ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <input 
                    type="file" 
                    accept="video/*"
                    onChange={e => setLessonVideoFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={addingLesson}
                  />
                  <div className="p-8 text-center pointer-events-none">
                    {lessonVideoFile ? (
                      <>
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Check className="w-6 h-6 text-emerald-600" />
                        </div>
                        <p className="text-sm font-bold text-emerald-700 truncate px-4">{lessonVideoFile.name}</p>
                        <p className="text-[10px] text-emerald-500 mt-1">{(lessonVideoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                        <p className="text-[10px] text-emerald-400 mt-0.5">Cliquez pour changer le fichier</p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 bg-slate-100 group-hover:bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors">
                          <Upload className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-sm font-semibold text-slate-600">{t.clickOrDragVideo}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{t.videoFormats}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Upload progress */}
              {addingLesson && lessonUploadProgress > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-500 font-semibold">
                    <span>{t.uploading}</span>
                    <span>{lessonUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-2 gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${lessonUploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 flex justify-end gap-3 border-t mt-2">
                <button 
                  type="button" 
                  onClick={() => setShowAddLesson(false)} 
                  disabled={addingLesson} 
                  className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
                >
                  {t.cancel}
                </button>
                <button 
                  type="submit" 
                  disabled={addingLesson || !lessonVideoFile || !lessonTitle.trim()} 
                  className="px-5 py-2.5 gradient-primary text-white rounded-xl font-bold flex items-center justify-center disabled:opacity-50 shadow-lg shadow-primary/20 min-w-[160px]"
                >
                  {addingLesson ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t.uploading}</>
                  ) : (
                    <><FilePlus2 className="w-4 h-4 mr-2" /> {t.addLessonBtn}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: SUPPRESSION COURS ═══════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="font-heading font-bold text-lg text-slate-800 mb-2">{t.confirmDelete}</h3>
            <p className="text-sm text-slate-500 mb-1">
              <span className="font-bold text-slate-700">« {deleteTarget.title} »</span>
            </p>
            <p className="text-xs text-slate-400 mb-6">
              {t.confirmDeleteMsg(deleteTarget.title).split(' "')[1] ? t.confirmDeleteMsg(deleteTarget.title).split(' ?')[1] : (lang === 'fr' ? 'Cette action est irréversible. Le cours et toutes ses leçons seront supprimés définitivement.' : 'This action is irreversible. The course and all its lessons will be permanently deleted.')}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteTarget(null)} 
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleDelete} 
                disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? t.deleting : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: MODIFIER COURS ═══════════════ */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !isEditUploading && setEditTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-amber-50/60">
              <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-500" /> {t.editCourse}
              </h2>
              <button onClick={() => !isEditUploading && setEditTarget(null)} disabled={isEditUploading} className="p-1.5 rounded-lg text-muted-foreground hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCourse} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.courseTitle.replace(' *', '')} *</label>
                <input type="text" required value={editFormData.title}
                  onChange={e => setEditFormData(p => ({ ...p, title: e.target.value }))}
                  className="sneat-input w-full" disabled={isEditUploading} />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.courseDesc}</label>
                <textarea rows={2} value={editFormData.description}
                  onChange={e => setEditFormData(p => ({ ...p, description: e.target.value }))}
                  className="sneat-input w-full" disabled={isEditUploading} />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-2">{t.courseLang.replace(' *', '')} *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[{ value: 'fr', flag: '🇫🇷', label: 'Français' }, { value: 'en', flag: '🇬🇧', label: 'English' }].map(opt => (
                    <button key={opt.value} type="button" disabled={isEditUploading}
                      onClick={() => setEditFormData(p => ({ ...p, lang: opt.value }))}
                      className="relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all"
                      style={{ borderColor: editFormData.lang === opt.value ? '#6366f1' : '#e2e8f0', background: editFormData.lang === opt.value ? '#f5f3ff' : '#fff' }}>
                      <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{opt.flag}</span>
                      <span className="font-bold text-sm" style={{ color: editFormData.lang === opt.value ? '#4f46e5' : '#1e293b' }}>{opt.label}</span>
                      {editFormData.lang === opt.value && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#6366f1' }}>
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.courseLevel}</label>
                <select value={editFormData.cefrLevel}
                  onChange={e => setEditFormData(p => ({ ...p, cefrLevel: e.target.value }))}
                  className="sneat-input w-full" disabled={isEditUploading}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  {t.coverImage} <span className="text-slate-400 font-normal">— {lang === 'fr' ? "laisser vide pour conserver l'actuelle" : "leave empty to keep current"}</span>
                </label>
                <div className={`relative group border-2 border-dashed rounded-xl overflow-hidden transition-all ${editImagePreview ? 'border-amber-400' : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/20'}`}>
                  <input type="file" accept="image/*" onChange={e => handleEditImageChange(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isEditUploading} />
                  {editImagePreview ? (
                    <div className="relative">
                      <img src={editImagePreview} alt="Aperçu" className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs font-bold">{t.clickToChange}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 text-center">
                      <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-1 group-hover:text-amber-500 transition-colors" />
                      <p className="text-sm font-semibold text-slate-500">{t.clickToChange.replace('Cliquer', 'Cliquez')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setEditTarget(null)} disabled={isEditUploading} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" disabled={isEditUploading} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-md transition-colors">
                  {isEditUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isEditUploading ? t.saving : t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: MODIFIER LEÇON ═══════════════ */}
      {editLessonTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isEditingLesson && setEditLessonTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-amber-50/60">
              <div>
                <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-amber-500" /> {t.editLesson}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{lang === 'fr' ? 'Cours' : 'Course'} : <span className="font-semibold text-slate-600">{viewCourse?.title}</span></p>
              </div>
              <button onClick={() => !isEditingLesson && setEditLessonTarget(null)} disabled={isEditingLesson} className="p-1.5 rounded-lg text-muted-foreground hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLesson} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t.lessonTitle}</label>
                <input type="text" required value={editLessonTitle}
                  onChange={e => setEditLessonTitle(e.target.value)}
                  className="sneat-input w-full"
                  placeholder={t.lessonTitlePlaceholder}
                  disabled={isEditingLesson} />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  {t.newVideo} <span className="text-slate-400 font-normal">— {lang === 'fr' ? 'optionnel, laisser vide pour conserver' : 'optional, leave empty to keep'}</span>
                </label>
                <div className={`relative group border-2 border-dashed rounded-xl transition-all ${editLessonVideoFile ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/20'} ${isEditingLesson ? 'opacity-60 pointer-events-none' : ''}`}>
                  <input type="file" accept="video/*" onChange={e => setEditLessonVideoFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isEditingLesson} />
                  <div className="p-6 text-center pointer-events-none">
                    {editLessonVideoFile ? (
                      <>
                        <Check className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-emerald-700 truncate px-4">{editLessonVideoFile.name}</p>
                        <p className="text-[10px] text-emerald-500 mt-0.5">{(editLessonVideoFile.size / 1024 / 1024).toFixed(1)} MB — {t.clickToChange}</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1 group-hover:text-amber-500 transition-colors" />
                        <p className="text-sm font-semibold text-slate-500">{lang === 'fr' ? 'Cliquez pour remplacer la vidéo' : 'Click to replace the video'}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">MP4, WebM, AVI</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t">
                <button type="button" onClick={() => setEditLessonTarget(null)} disabled={isEditingLesson} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" disabled={isEditingLesson || !editLessonTitle.trim()} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 shadow-md transition-colors">
                  {isEditingLesson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isEditingLesson ? t.saving : t.saveChanges}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════ MODAL: SUPPRESSION LEÇON ═══════════════ */}
      {deleteLessonTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !deletingLesson && setDeleteLessonTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="font-heading font-bold text-lg text-slate-800 mb-2">{lang === 'fr' ? 'Supprimer cette leçon ?' : 'Delete this lesson?'}</h3>
            <p className="text-sm text-slate-500 mb-1">
              <span className="font-bold text-slate-700">« {deleteLessonTarget.title || (lang === 'fr' ? 'Leçon sans titre' : 'Untitled lesson')} »</span>
            </p>
            <p className="text-xs text-slate-400 mb-6">
              {lang === 'fr' ? 'La leçon et sa vidéo seront supprimées définitivement.' : 'The lesson and its video will be permanently deleted.'}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteLessonTarget(null)} 
                disabled={deletingLesson}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                onClick={handleDeleteLesson} 
                disabled={deletingLesson}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {deletingLesson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deletingLesson ? t.deleting : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
