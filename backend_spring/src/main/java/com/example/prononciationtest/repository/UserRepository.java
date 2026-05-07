package com.example.prononciationtest.repository;


import com.example.prononciationtest.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    // ✅ Champ réel dans User
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    // ✅ FIX "No property 'username' found for type 'User'"
    // @Query évite que Spring Data cherche un champ "username" inexistant
    @Query("SELECT u FROM User u WHERE u.email = :username")
    Optional<User> findByUsername(@Param("username") String username);
}






