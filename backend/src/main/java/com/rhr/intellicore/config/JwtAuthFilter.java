package com.rhr.intellicore.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Accepts the JWT from the Authorization header, or from an {@code access_token} query parameter
 * for requests the browser makes without custom headers (EventSource streams, file downloads).
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    public JwtAuthFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = null;
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) token = header.substring(7);
        else if (req.getParameter("access_token") != null) token = req.getParameter("access_token");

        if (token != null) {
            jwt.parse(token).ifPresent(claims -> {
                var auth = new UsernamePasswordAuthenticationToken(claims.getSubject(), null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + claims.get("role", String.class))));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        chain.doFilter(req, res);
    }
}
