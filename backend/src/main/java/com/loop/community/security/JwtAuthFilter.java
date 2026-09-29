package com.loop.community.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private static final String BEARER = "Bearer ";

    private final JwtProvider jwtProvider;
    private final UserExistenceChecker userExistenceChecker;

    public JwtAuthFilter(JwtProvider jwtProvider, UserExistenceChecker userExistenceChecker) {
        this.jwtProvider = jwtProvider;
        this.userExistenceChecker = userExistenceChecker;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER)) {
            // 서명이 맞아도 사용자가 없으면(예: DB 초기화 뒤 남은 토큰) 비로그인으로 본다 → 쓰기 요청은 401
            jwtProvider.parse(header.substring(BEARER.length()))
                    .filter(user -> userExistenceChecker.exists(user.id()))
                    .ifPresent(user -> SecurityContextHolder.getContext().setAuthentication(
                            new UsernamePasswordAuthenticationToken(user, null, List.of())));
        }
        chain.doFilter(request, response);
    }
}
