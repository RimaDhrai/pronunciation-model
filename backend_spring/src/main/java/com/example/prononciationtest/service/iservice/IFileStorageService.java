package com.example.prononciationtest.service.iservice;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface IFileStorageService {

    /**
     * Sauvegarde une vidéo de leçon.
     *
     * @param file     vidéo (mp4, webm, …)
     * @param courseId identifiant du cours
     * @return chemin relatif stocké (ex : /storage/videos/course_1/uuid.mp4)
     */
    String saveVideo(MultipartFile file, Long courseId) throws IOException;

    /**
     * Sauvegarde un audio de leçon.
     *
     * @param file     audio (mp3, wav, …)
     * @param courseId identifiant du cours
     * @return chemin relatif stocké
     */
    String saveLessonAudio(MultipartFile file, Long courseId) throws IOException;

    /**
     * Sauvegarde un enregistrement audio utilisateur.
     *
     * @param file   audio de prononciation
     * @param userId identifiant de l'utilisateur
     * @return chemin relatif stocké
     */
    String saveAudio(MultipartFile file, Long userId) throws IOException;

    /**
     * Sauvegarde une image / vignette de cours.
     *
     * @param file     image (jpg, png, webp)
     * @param courseId identifiant du cours
     * @return chemin relatif stocké
     */
    String saveImage(MultipartFile file, Long courseId) throws IOException;

    /**
     * Supprime un fichier à partir de son chemin relatif.
     *
     * @param relativePath chemin relatif depuis la racine du serveur
     */
    void deleteFile(String relativePath);
}
