const books = [
  {
    title: '海峡航路志',
    item: '一张旧船票',
    leaf: '二十七',
    line: '两页航线图之间，露出半截蓝边的硬纸。左下角已经被检票钳咬掉了一口。',
    note: '第一次自己坐船。船摇得好厉害，我还是把给你的那颗糖带到了对岸。',
    signature: '溟月，靠窗的六号座',
  },
  {
    title: '浅滩植物志',
    item: '一枚海草标本',
    leaf: '四十三',
    line: '翻到浅滩那一章，她放慢了动作。一枝海草被两条细纸带固定在薄薄的衬纸上。',
    note: '退潮以后，在左脚雨靴里找到的。原来那天跟我回家的，还有一小片海。',
    signature: '溟月，晾在窗边的第三天',
  },
  {
    title: '鲸的图画书',
    item: '一幅蜡笔画',
    leaf: '九',
    line: '一张折过两次的小纸片滑到书脊边。她伸手按住它，等你把画展开。',
    note: '这是我。旁边留给你画。',
    signature: '小溟月',
  },
];

// Draw directly on the little slip so the ink and the pressed plant stay crisp offline.
function illustrate(canvas, index) {
  const c = canvas.getContext('2d');
  const w = (canvas.width = 720),
    h = (canvas.height = 396);
  c.clearRect(0, 0, w, h);
  c.save();
  c.scale(2, 2);
  c.lineJoin = c.lineCap = 'round';
  const stroke = (points, color, width) => {
    c.beginPath();
    c.moveTo(...points[0]);
    for (const point of points.slice(1)) c.lineTo(...point);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
  };
  if (index === 0) {
    c.strokeStyle = '#426b7a';
    c.lineWidth = 1.4;
    c.strokeRect(9, 9, 342, 180);
    c.fillStyle = '#385d71';
    c.font = 'bold 22px serif';
    c.fillText('月 湾 渡 轮', 24, 43);
    c.font = '12px monospace';
    c.fillText('MOON BAY FERRY', 25, 62);
    c.fillStyle = '#597e87';
    c.beginPath();
    c.moveTo(40, 117);
    c.lineTo(172, 117);
    c.lineTo(154, 136);
    c.lineTo(57, 136);
    c.fill();
    c.fillRect(70, 100, 63, 15);
    c.fillRect(85, 89, 30, 11);
    c.fillRect(100, 78, 6, 12);
    for (let i = 0; i < 5; i++) {
      c.fillStyle = '#f6ecd6';
      c.fillRect(74 + 11 * i, 104, 7, 5);
    }
    for (let i = 0; i < 3; i++)
      stroke(
        [
          [28 + i * 7, 142 + i * 5],
          [88, 141 + i * 5],
          [125, 144 + i * 5],
          [182 - i * 6, 142 + i * 5],
        ],
        '#71929a',
        1
      );
    stroke(
      [
        [212, 19],
        [212, 178],
      ],
      '#9f9a85',
      1
    );
    c.fillStyle = '#395866';
    c.font = 'bold 19px serif';
    c.fillText('灯塔码头', 227, 70);
    c.fillText('雾岛', 227, 122);
    c.font = '13px monospace';
    c.fillText('↓', 231, 96);
    c.fillText('NO. 006', 229, 157);
    c.font = '12px serif';
    c.fillText('单程   ·   靠窗', 26, 174);
  } else if (index === 1) {
    const stem = '#72724c';
    stroke(
      [
        [113, 160],
        [148, 123],
        [166, 101],
        [196, 72],
        [232, 38],
      ],
      stem,
      3
    );
    for (let i = 0; i < 9; i++) {
      const t = i / 9,
        x = 135 + 95 * t,
        y = 137 - 96 * t,
        side = i % 2 ? 1 : -1;
      c.save();
      c.translate(x, y);
      c.rotate(side > 0 ? 0.93 : -0.4);
      const length = 40 - 13 * t;
      c.beginPath();
      c.moveTo(0, 0);
      c.bezierCurveTo(-13, -11, 5, -length + 9, -2, -length);
      c.bezierCurveTo(15, -length + 8, 12, -12, 0, 0);
      c.fillStyle = i % 3 ? '#838964' : '#a19b6c';
      c.fill();
      stroke(
        [
          [0, 0],
          [2, -length * 0.6],
          [-2, -length],
        ],
        '#626e52',
        0.8
      );
      c.restore();
    }
    c.fillStyle = '#d4bd93bc';
    for (const [x, y] of [[135, 140], [202, 66]]) {
      c.save();
      c.translate(x, y);
      c.rotate(0.62);
      c.fillRect(-18, -5, 36, 10);
      c.restore();
    }
    c.fillStyle = '#78664c';
    c.font = 'italic 14px serif';
    c.fillText('湾口 · 小潮', 223, 169);
  } else {
    c.save();
    c.translate(32, 15);
    c.beginPath();
    c.moveTo(55, 100);
    c.bezierCurveTo(56, 57, 113, 40, 157, 69);
    c.quadraticCurveTo(194, 91, 210, 67);
    c.quadraticCurveTo(207, 48, 231, 44);
    c.quadraticCurveTo(235, 61, 222, 69);
    c.quadraticCurveTo(236, 69, 245, 62);
    c.quadraticCurveTo(241, 88, 216, 84);
    c.bezierCurveTo(179, 139, 68, 151, 55, 100);
    c.fillStyle = '#8aa7c9';
    c.fill();
    c.strokeStyle = '#506ca4';
    c.lineWidth = 3.5;
    c.stroke();
    c.beginPath();
    c.arc(77, 87, 3.6, 0, Math.PI * 2);
    c.fillStyle = '#364766';
    c.fill();
    stroke(
      [
        [58, 99],
        [67, 104],
        [79, 103],
      ],
      '#536d97',
      2
    );
    stroke(
      [
        [123, 107],
        [137, 120],
        [147, 110],
      ],
      '#607fab',
      3
    );
    stroke(
      [
        [89, 57],
        [84, 46],
        [78, 44],
      ],
      '#78a6c3',
      3
    );
    stroke(
      [
        [91, 57],
        [95, 44],
        [102, 42],
      ],
      '#78a6c3',
      3
    );
    for (let i = 0; i < 5; i++)
      stroke(
        [
          [17 + i * 53, 146],
          [28 + i * 53, 151],
          [42 + i * 53, 146],
        ],
        '#91b2c1',
        2.5
      );
    c.restore();
    c.save();
    c.translate(303, 38);
    c.rotate(0.13);
    c.strokeStyle = '#cba966';
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2,
        r = i % 2 ? 5 : 13;
      c.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    c.stroke();
    c.restore();
  }
  c.restore();
}

export function keepsakeReader(onReturn) {
  const dialog = document.querySelector('#keepsake');
  const card = dialog.querySelector('.slip');
  const caption = dialog.querySelector('.flip-caption');
  const note = dialog.querySelector('.handwritten');
  function turn(back) {
    card.dataset.back = String(back);
    card.setAttribute('aria-pressed', String(back));
    note.hidden = !back;
    caption.textContent = back ? '翻回正面' : '翻到背面';
  }
  card.onclick = () => turn(card.dataset.back !== 'true');
  dialog.addEventListener('close', onReturn);
  return {
    count: books.length,
    get open() {
      return dialog.open;
    },
    show(index) {
      const current = books[index];
      dialog.querySelector('h2').textContent = current.title;
      dialog.querySelector('.leaf').textContent = '第' + current.leaf + '页';
      dialog.querySelector('.find-line').textContent = current.line;
      dialog.querySelector('.item-name').textContent = current.item;
      note.querySelector('span').textContent = current.note;
      note.querySelector('cite').textContent = current.signature;
      card.dataset.item = index;
      illustrate(card.querySelector('canvas'), index);
      turn(false);
      dialog.showModal();
      card.focus();
    },
  };
}
