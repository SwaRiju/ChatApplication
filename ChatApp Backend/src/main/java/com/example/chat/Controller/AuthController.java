package com.example.chat.Controller;

import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.chat.DTO.LoginRequestDTO;
import com.example.chat.DTO.LoginResponseDTO;
import com.example.chat.Model.User;
import com.example.chat.Repository.UserRepo;
import com.example.chat.Service.JwtService;
import com.example.chat.Service.UserService;
import com.example.chat.Utils.ImageUtils;
import com.nimbusds.jwt.SignedJWT;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.Data;

@RestController
@RequestMapping("/auth")
@CrossOrigin(origins = "${cors.allowed-origins}")
public class AuthController {

    private final UserRepo userRepo;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Value("${cookie.secure}")
    private boolean cookieSecure;

    @Value("${cookie.same-site}")
    private String cookieSameSite;

    public AuthController(UserRepo userRepo, UserService userService, PasswordEncoder passwordEncoder,
            JwtService jwtService) {
        this.userRepo = userRepo;
        this.userService = userService;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody @Valid LoginRequestDTO req,
            HttpServletResponse response) {
        var userOpt = userRepo.findByEmail(req.getEmail());
        if (userOpt.isEmpty())
            return ResponseEntity.status(401).body("User Not Found!");

        User user = userOpt.get();
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body("Invalid credentials");
        }

        userService.setStatusOnline(user.getId());

        // Generate Tokens
        String access = jwtService.createAccessToken(user, Set.of("USER"));
        String refresh = jwtService.createRefreshToken(user);

        ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", refresh)
                .httpOnly(true)
                .secure(cookieSecure) // in production set true
                .path("/auth/refresh") // cookie sent only for refresh API
                .maxAge(7 * 24 * 3600)
                .sameSite(cookieSameSite)
                .build();

        response.addHeader("Set-Cookie", refreshCookie.toString());

        ResponseCookie accessCookie = ResponseCookie.from("access_token", access)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/") // sent for all backend APIs
                .maxAge(15 * 60) // 15 minutes
                .sameSite(cookieSameSite)
                .build();

        response.addHeader("Set-Cookie", accessCookie.toString());

        // Return ONLY ACCESS TOKEN
        return ResponseEntity.ok(new LoginResponseDTO(
                user.getId(),
                access,
                user.getUsername(),
                user.getEmail(),
                ImageUtils.getProfilePicture(user.getProfilePicture()),
                user.getStatus()));
    }

    @Transactional
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request,
            HttpServletResponse response) {

        String oldRefresh = null;
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if (c.getName().equals("refresh_token")) {
                    oldRefresh = c.getValue();
                    break;
                }
            }
        }

        if (oldRefresh == null) {
            return ResponseEntity.status(401).body("Refresh token missing");
        }

        try {
            // Rotate refresh token
            String newRefresh = jwtService.rotateRefreshToken(oldRefresh);

            // Parse old token to get user id
            var jwt = com.nimbusds.jwt.SignedJWT.parse(oldRefresh);
            String subject = jwt.getJWTClaimsSet().getSubject();
            var user = userRepo.findById(Long.valueOf(subject)).orElseThrow();

            String newAccess = jwtService.createAccessToken(user, Set.of("USER"));

            ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", newRefresh)
                    .httpOnly(true)
                    .secure(cookieSecure)
                    .path("/auth/refresh")
                    .maxAge(7 * 24 * 3600)
                    .sameSite(cookieSameSite)
                    .build();
            response.addHeader("Set-Cookie", refreshCookie.toString());

            ResponseCookie accessCookie = ResponseCookie.from("access_token", newAccess)
                    .httpOnly(true)
                    .secure(cookieSecure)
                    .path("/")
                    .maxAge(15 * 60)
                    .sameSite(cookieSameSite)
                    .build();

            response.addHeader("Set-Cookie", accessCookie.toString());

            return ResponseEntity.ok(Map.of("accessToken", newAccess));
        } catch (Exception ex) {
            try {
                var jwt = SignedJWT.parse(oldRefresh);
                Long id = Long.valueOf(jwt.getJWTClaimsSet().getSubject());
                userService.setStatusOffline(id);
            } catch (Exception ignoredException) {
            }
            return ResponseEntity.status(401).body("Invalid refresh token");
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication) {
        String refresh = null;
        Long userId = null;

        // 1. Extract refresh_token from cookies first
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if (c.getName().equals("refresh_token")) {
                    refresh = c.getValue();
                    break;
                }
            }
        }

        // 2. Identify the user (either from the Access Token OR the Refresh Token)
        try {
            if (authentication != null) {
                // Access token is still valid
                userId = Long.valueOf(authentication.getName());
            } else if (refresh != null) {
                // Access token expired, but we can get the ID from the refresh token
                var jwt = SignedJWT.parse(refresh);
                userId = Long.valueOf(jwt.getJWTClaimsSet().getSubject());
            }
        } catch (Exception e) {
            // If parsing fails, we proceed anyway to clear the cookies
        }

        // 3. Backend Cleanup: Revoke token and set status offline
        if (refresh != null) {
            jwtService.revokeRefreshToken(refresh);
        }

        if (userId != null) {
            userService.setStatusOffline(userId);
        }

        // 4. Clear Cookies: Ensure browser deletes them
        ResponseCookie clearRefresh = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(cookieSecure) // Set true in production
                .path("/auth/refresh")
                .maxAge(0)
                .sameSite(cookieSameSite)
                .build();

        ResponseCookie clearAccess = ResponseCookie.from("access_token", "")
                .httpOnly(true)
                .secure(cookieSecure) // Set true in production
                .path("/")
                .maxAge(0)
                .sameSite(cookieSameSite)
                .build();

        response.addHeader("Set-Cookie", clearRefresh.toString());
        response.addHeader("Set-Cookie", clearAccess.toString());

        return ResponseEntity.ok(Map.of(
                "message", "Logged out successfully",
                "status", "success"));
    }

    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestHeader("Authorization") String authHeader) {
        try {
            String token = authHeader.substring(7); // Remove "Bearer "
            String username = jwtService.extractUsername(token);

            if (username != null && jwtService.validateAccessToken(token)) {
                return ResponseEntity.ok().body(Map.of("valid", true));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valid", false));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("valid", false));
    }

    @Data
    static class LoginRequest {
        private String username;
        private String password;
    }

    @Data
    static class RefreshRequest {
        private String refreshToken;

        private String getRefreshToken() {
            throw new UnsupportedOperationException("Not supported yet.");
        }
    }

    @Data
    static class LoginResponse {
        private final String accessToken;
        private final String refreshToken;
    }
}
