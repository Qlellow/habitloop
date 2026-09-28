package com.loop.community.post;

import jakarta.annotation.PreDestroy;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 조회수 write-behind 버퍼.
 * 조회할 때마다 UPDATE 를 날리면 인기글에 row lock 경합이 생기므로
 * 메모리에 모아 두었다가 주기적으로 한 번에 반영한다.
 */
@Component
public class ViewCountBuffer {

    private static final Logger log = LoggerFactory.getLogger(ViewCountBuffer.class);

    private final ConcurrentHashMap<Long, LongAdder> pending = new ConcurrentHashMap<>();
    private final PostRepository postRepository;
    private final TransactionTemplate tx;

    public ViewCountBuffer(PostRepository postRepository, TransactionTemplate tx) {
        this.postRepository = postRepository;
        this.tx = tx;
    }

    public void increment(Long postId) {
        pending.computeIfAbsent(postId, id -> new LongAdder()).increment();
    }

    /** 아직 DB 에 반영되지 않은 조회수 */
    public long pendingOf(Long postId) {
        LongAdder adder = pending.get(postId);
        return adder == null ? 0 : adder.sum();
    }

    public void discard(Long postId) {
        pending.remove(postId);
    }

    @Scheduled(fixedDelayString = "${app.view-flush-interval:5s}")
    public void flush() {
        if (pending.isEmpty()) {
            return;
        }
        for (Map.Entry<Long, LongAdder> entry : pending.entrySet()) {
            Long postId = entry.getKey();
            // 반영할 만큼만 빼내므로 flush 도중 들어온 증가분은 다음 주기에 반영된다
            long delta = entry.getValue().sumThenReset();
            pending.computeIfPresent(postId, (id, adder) -> adder.sum() == 0 ? null : adder);
            if (delta == 0) {
                continue;
            }
            try {
                tx.executeWithoutResult(status -> postRepository.addViewCount(postId, delta));
            } catch (RuntimeException e) {
                log.warn("조회수 반영 실패 postId={} delta={}", postId, delta, e);
            }
        }
    }

    @PreDestroy
    public void flushOnShutdown() {
        flush();
    }
}
