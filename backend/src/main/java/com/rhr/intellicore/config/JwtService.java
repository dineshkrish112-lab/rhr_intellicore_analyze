package com.rhr.intellicore.config;

import com.rhr.intellicore.domain.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.Optional;

@Service
public class JwtService {

    private final SecretKey key;
    private final int expiryHours;
    private final ZoneId zone;

    public JwtService(AppProperties props) {
        this.key = Keys.hmacShaKeyFor(props.jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.expiryHours = props.jwt().expiryHours();
        this.zone = ZoneId.of(props.timezone());
    }

    public record Issued(String token, LocalDateTime expiresAt) {}

    public Issued issue(AppUser user) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(expiryHours * 3600L);
        String token = Jwts.builder()
                .subject(user.getUsername())
                .claim("role", user.getRole().name())
                .claim("name", user.getFullName())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key)
                .compact();
        return new Issued(token, LocalDateTime.ofInstant(exp, zone));
    }

    public Optional<Claims> parse(String token) {
        try {
            return Optional.of(Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload());
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
