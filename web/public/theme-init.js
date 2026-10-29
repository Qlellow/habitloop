// 저장된 테마를 첫 화면을 그리기 전에 적용해서 밝게 → 어둡게 깜빡이지 않게 한다 (index.html 이 module 보다 먼저 막고 읽는다)
// 보안 정책(CSP)이 인라인 스크립트를 막으므로 파일로 둔다
try {
  var s = JSON.parse(localStorage.getItem('loop.settings') || '{}');
  var root = document.documentElement;
  if (s.theme === 'light' || s.theme === 'dark') root.dataset.theme = s.theme;
  // 시간대 테마: 아침 5~11시 · 낮 11~17시 · 저녁 17~22시 · 새벽 22~5시 (lib/settings.ts 의 periodAt 과 같은 기준)
  if (s.theme === 'time') {
    var h = new Date().getHours();
    var p = s.timeTheme && s.timeTheme !== 'auto' ? s.timeTheme : h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'dawn';
    root.dataset.time = p;
    root.dataset.theme = p === 'evening' || p === 'dawn' ? 'dark' : 'light';
  }
} catch (e) {}
