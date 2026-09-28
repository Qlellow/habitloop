package com.loop.community.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtProvider {

    private final SecretKey key;
    private final JwtParser parser;
    private final JwtProperties properties;

    public JwtProvider(JwtProperties properties) {
        this.properties = properties;
        this.key = Keys.hmacShaKeyFor(properties.secret().getBytes(StandardCharsets.UTF_8));
        // 파서는 thread-safe 하므로 한 번만 만들어 재사용
        this.parser = Jwts.parser().verifyWith(key).build();
    }

    public String issue(Long userId, String nickname) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim("nickname", nickname)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.ttl())))
                .signWith(key)
                .compact();
    }

    public Optional<AuthUser> parse(String token) {
        try {
            Claims claims = parser.parseSignedClaims(token).getPayload();
            return Optional.of(new AuthUser(Long.valueOf(claims.getSubject()), claims.get("nickname", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
