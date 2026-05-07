import api from './axios';
import adminApi from './adminAxios';

// CourseController routes → /api/courses/...

export const getAllCourses = (lang = 'fr') => 
  api.get('/api/courses', { params: { lang } });

export const getRecommendedCourses = (lang = 'fr') => 
  api.get('/api/courses/recommended', { params: { lang } });

export const getCoursesByLevel = (cefrLevel, lang = 'fr') => 
  api.get(`/api/courses/level/${cefrLevel}`, { params: { lang } });

export const getCourseDetail = (courseId) => 
  api.get(`/api/courses/${courseId}`);

export const getCourseLessons = (courseId) => 
  api.get(`/api/courses/${courseId}/lessons`);

export const enrollCourse = (courseId) => 
  api.post(`/api/courses/${courseId}/enroll`);

export const updateCourseProgress = (courseId, percent) => 
  api.put(`/api/courses/${courseId}/progress`, null, { params: { percent } });

export const getMyCourses = () => 
  api.get('/api/courses/my-courses');

// ── Admin routes (utilisent adminApi → header X-Admin-Key) ──

// Lecture admin (GET avec X-Admin-Key)
export const adminGetAllCourses = (lang = 'fr') =>
  adminApi.get('/api/courses', { params: { lang } });

export const adminGetCourseLessons = (courseId) =>
  adminApi.get(`/api/courses/${courseId}/lessons`);

export const adminGetCourseDetail = (courseId) =>
  adminApi.get(`/api/courses/${courseId}`);


export const createCourse = (formData) =>
  adminApi.post('/api/courses', formData, {
    headers: { 'Content-Type': undefined }
  });

export const updateCourse = (courseId, formData) =>
  adminApi.put(`/api/courses/${courseId}`, formData, {
    headers: { 'Content-Type': undefined }
  });

export const deleteCourse = (courseId) =>
  adminApi.delete(`/api/courses/${courseId}`);

export const createLesson = (courseId, formData) =>
  adminApi.post(`/api/courses/${courseId}/lessons`, formData, {
    headers: { 'Content-Type': undefined }
  });

export const updateLesson = (courseId, lessonId, formData) =>
  adminApi.put(`/api/courses/${courseId}/lessons/${lessonId}`, formData, {
    headers: { 'Content-Type': undefined }
  });

export const deleteLesson = (courseId, lessonId) =>
  adminApi.delete(`/api/courses/${courseId}/lessons/${lessonId}`);

export const uploadLessonVideo = (courseId, lessonId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return adminApi.post(`/api/courses/${courseId}/lessons/${lessonId}/upload-video`, formData, {
    headers: { 'Content-Type': undefined }
  });
};

export const uploadLessonAudio = (courseId, lessonId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return adminApi.post(`/api/courses/${courseId}/lessons/${lessonId}/upload-audio`, formData, {
    headers: { 'Content-Type': undefined }
  });
};

// ── Suivi de progression par leçon ──
// Spring Boot : PUT  /api/courses/{courseId}/lessons/{lessonId}/complete
// Spring Boot : GET  /api/courses/{courseId}/lesson-progress  → { lessonId: true/false }
export const completeLessonProgress = (courseId, lessonId) =>
  api.put(`/api/courses/${courseId}/lessons/${lessonId}/complete`);

export const getLessonProgress = (courseId) =>
  api.get(`/api/courses/${courseId}/lesson-progress`);
