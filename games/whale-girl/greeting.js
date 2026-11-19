const lines = [
  '晚上好，我叫溟月。你是搭末班船来的吗？我刚才在窗边，看见船灯慢慢靠了岸。',
  '我喜欢把海边捡来的小东西夹进书里。船票、海草……还有一张小时候画的鲸。那条尾巴，我画歪了三次呢。',
  '窗边那个位子给你留着。要是想听故事，就陪我去书架前挑一本吧。',
];

export function welcomeDialogue(onFinish) {
  const panel = document.querySelector('#greeting');
  const next = panel.querySelector('.greeting-next');
  const cue = next.querySelector('.greeting-cue');
  const printed = next.querySelector('.greeting-line');
  const announcement = panel.querySelector('[role="status"]');
  let index = 0;
  let letters = 0;
  function reveal(count) {
    letters = Math.min(lines[index].length, count);
    const text = lines[index].slice(0, Math.floor(letters));
    if (printed.textContent !== text) printed.textContent = text;
  }
  function startLine(instant) {
    const last = index === lines.length - 1;
    cue.textContent = last ? '进入书房' : '继续';
    next.setAttribute('aria-label', last ? '结束自我介绍，进入书房' : '继续对话');
    announcement.textContent = '溟月：' + lines[index];
    reveal(instant ? lines[index].length : 1);
  }
  next.addEventListener('click', () => {
    if (letters < lines[index].length) reveal(lines[index].length);
    else if (index + 1 < lines.length) {
      index++;
      startLine(matchMedia('(prefers-reduced-motion: reduce)').matches);
    } else onFinish();
  });
  panel.querySelector('.greeting-skip').addEventListener('click', onFinish);
  return {
    show(instant) {
      panel.hidden = false;
      startLine(instant);
      next.focus({ preventScroll: true });
    },
    update(dt, instant) {
      if (letters < lines[index].length) reveal(instant ? lines[index].length : letters + dt * 30);
    },
    hide() { panel.hidden = true; },
  };
}
