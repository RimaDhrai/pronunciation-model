package com.example.prononciationtest.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KeycloakAdminServiceTest {

    @Mock
    private RestTemplate rest;

    @InjectMocks
    private KeycloakAdminService keycloakAdminService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(keycloakAdminService, "rest", rest);
        ReflectionTestUtils.setField(keycloakAdminService, "keycloakUrl", "http://localhost:8090");
        ReflectionTestUtils.setField(keycloakAdminService, "realm", "talan");
        ReflectionTestUtils.setField(keycloakAdminService, "masterRealm", "master");
        ReflectionTestUtils.setField(keycloakAdminService, "adminUsername", "admin");
        ReflectionTestUtils.setField(keycloakAdminService, "adminPassword", "Admin1234!");
        ReflectionTestUtils.setField(keycloakAdminService, "clientId", "talan-frontend");
        ReflectionTestUtils.setField(keycloakAdminService, "frontendUrl", "http://localhost:8081");
    }

    private void mockAdminToken() {
        Map<String, Object> tokenBody = new HashMap<>();
        tokenBody.put("access_token", "mocked-admin-token");
        ResponseEntity<Map<String, Object>> response = new ResponseEntity<>(tokenBody, HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/realms/master/protocol/openid-connect/token"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(response);
    }

    @Test
    void createUser_success_withRoleAssignment() {
        mockAdminToken();

        // 1. Mock user creation POST (returns void/201)
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Void.class)
        )).thenReturn(new ResponseEntity<>(HttpStatus.CREATED));

        // 2. Mock search user GET (returns List of users)
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", "user-id-123");
        userMap.put("username", "test@example.com");
        ResponseEntity<List<Map<String, Object>>> listResponse = new ResponseEntity<>(List.of(userMap), HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users?username=test@example.com"),
            eq(HttpMethod.GET),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(listResponse);

        // 3. Mock role retrieval GET
        Map<String, Object> roleMap = new HashMap<>();
        roleMap.put("name", "collaborateur");
        roleMap.put("id", "role-id-999");
        ResponseEntity<Map<String, Object>> roleResponse = new ResponseEntity<>(roleMap, HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/roles/collaborateur"),
            eq(HttpMethod.GET),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(roleResponse);

        // 4. Mock role assignment POST
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users/user-id-123/role-mappings/realm"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Void.class)
        )).thenReturn(new ResponseEntity<>(HttpStatus.NO_CONTENT));

        keycloakAdminService.createUser("test@example.com", "securePassword1", "John Doe");

        // Verify that exchange is called for admin token, search user, role retrieval, and role mapping
        verify(rest, atLeastOnce()).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), any(ParameterizedTypeReference.class));
        verify(rest, atLeastOnce()).exchange(anyString(), eq(HttpMethod.POST), any(HttpEntity.class), eq(Void.class));
    }

    @Test
    void createUser_whenConflictException_throwsIllegalArgumentException() {
        mockAdminToken();

        // Mock user creation POST throwing Conflict
        HttpClientErrorException.Conflict conflictEx = (HttpClientErrorException.Conflict) HttpClientErrorException.create(
            HttpStatus.CONFLICT, "Conflict", HttpHeaders.EMPTY, null, StandardCharsets.UTF_8
        );
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Void.class)
        )).thenThrow(conflictEx);

        assertThatThrownBy(() -> keycloakAdminService.createUser("test@example.com", "pw", "John"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Email déjà utilisé");
    }

    @Test
    void createUser_whenUserNotFoundAfterCreation_throwsRuntimeException() {
        mockAdminToken();

        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users"),
            eq(HttpMethod.POST),
            any(HttpEntity.class),
            eq(Void.class)
        )).thenReturn(new ResponseEntity<>(HttpStatus.CREATED));

        // Mock search user returning empty list
        ResponseEntity<List<Map<String, Object>>> emptyResponse = new ResponseEntity<>(Collections.emptyList(), HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users?username=test@example.com"),
            eq(HttpMethod.GET),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(emptyResponse);

        assertThatThrownBy(() -> keycloakAdminService.createUser("test@example.com", "pw", "John"))
            .isInstanceOf(RuntimeException.class)
            .hasMessageContaining("introuvable dans Keycloak");
    }

    @Test
    void sendResetPasswordEmail_success() {
        mockAdminToken();

        // 1. Mock search user
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", "user-id-123");
        ResponseEntity<List<Map<String, Object>>> listResponse = new ResponseEntity<>(List.of(userMap), HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users?email=test@example.com&exact=true"),
            eq(HttpMethod.GET),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(listResponse);

        // 2. Mock execute actions email PUT
        when(rest.exchange(
            contains("/execute-actions-email"),
            eq(HttpMethod.PUT),
            any(HttpEntity.class),
            eq(Void.class)
        )).thenReturn(new ResponseEntity<>(HttpStatus.NO_CONTENT));

        keycloakAdminService.sendResetPasswordEmail("test@example.com");

        verify(rest, times(1)).exchange(contains("/execute-actions-email"), eq(HttpMethod.PUT), any(HttpEntity.class), eq(Void.class));
    }

    @Test
    void sendResetPasswordEmail_whenNoUserFound_throwsIllegalArgumentException() {
        mockAdminToken();

        ResponseEntity<List<Map<String, Object>>> emptyResponse = new ResponseEntity<>(Collections.emptyList(), HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users?email=test@example.com&exact=true"),
            eq(HttpMethod.GET),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(emptyResponse);

        assertThatThrownBy(() -> keycloakAdminService.sendResetPasswordEmail("test@example.com"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Aucun compte associé");
    }

    @Test
    void updateUserPassword_success() {
        mockAdminToken();

        // 1. Mock search user
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", "user-id-123");
        ResponseEntity<List<Map<String, Object>>> listResponse = new ResponseEntity<>(List.of(userMap), HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users?email=test@example.com&exact=true"),
            eq(HttpMethod.GET),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(listResponse);

        // 2. Mock password reset PUT
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users/user-id-123/reset-password"),
            eq(HttpMethod.PUT),
            any(HttpEntity.class),
            eq(Void.class)
        )).thenReturn(new ResponseEntity<>(HttpStatus.NO_CONTENT));

        keycloakAdminService.updateUserPassword("test@example.com", "newPassword99");

        verify(rest, times(1)).exchange(eq("http://localhost:8090/admin/realms/talan/users/user-id-123/reset-password"), eq(HttpMethod.PUT), any(HttpEntity.class), eq(Void.class));
    }

    @Test
    void updateUserPassword_whenNoUserFound_throwsIllegalArgumentException() {
        mockAdminToken();

        ResponseEntity<List<Map<String, Object>>> emptyResponse = new ResponseEntity<>(Collections.emptyList(), HttpStatus.OK);
        when(rest.exchange(
            eq("http://localhost:8090/admin/realms/talan/users?email=test@example.com&exact=true"),
            eq(HttpMethod.GET),
            any(HttpEntity.class),
            any(ParameterizedTypeReference.class)
        )).thenReturn(emptyResponse);

        assertThatThrownBy(() -> keycloakAdminService.updateUserPassword("test@example.com", "newPassword"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Aucun compte associé");
    }
}
