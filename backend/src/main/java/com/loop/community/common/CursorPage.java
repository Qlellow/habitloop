package com.loop.community.common;

import java.util.List;
import java.util.function.Function;

/**
 * 키셋(커서) 페이지네이션 응답. OFFSET 없이 마지막 id 기준으로 다음 페이지를 조회하므로
 * 페이지가 깊어져도 조회 비용이 일정하다.
 */
public record CursorPage<T>(List<T> items, Long nextCursor) {

    /** size + 1 개를 조회한 결과를 받아 다음 페이지 존재 여부를 판단한다. */
    public static <T> CursorPage<T> of(List<T> fetched, int size, Function<T, Long> idOf) {
        if (fetched.size() <= size) {
            return new CursorPage<>(fetched, null);
        }
        List<T> page = fetched.subList(0, size);
        return new CursorPage<>(List.copyOf(page), idOf.apply(page.get(size - 1)));
    }
}
