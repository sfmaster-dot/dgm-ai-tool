import { useState, useEffect, useLayoutEffect } from 'react';
import AiForm from './components/AiForm';

// 노출 도구 7종. 카드 진입점이 없으므로 orderguide·menuoption 포함 전부 런처에 노출.
const TOOLS = [
  { type: 'intro',      emoji: '🏪', name: '가게소개 생성',   desc: '200~400자 · 스토리형' },
  { type: 'notice',     emoji: '📢', name: '사장님공지 생성', desc: '이벤트·휴무·신메뉴' },
  { type: 'menuname',   emoji: '🍽️', name: '메뉴명 SEO',      desc: '검색 키워드 최적화 3종' },
  { type: 'menudesc',   emoji: '📝', name: '메뉴설명 후킹',   desc: '60자 이내 · 후킹+구성' },
  { type: 'reply',      emoji: '💬', name: '리뷰답변 생성',   desc: '별점 기반 톤 자동 조정' },
  { type: 'orderguide', emoji: '📌', name: '주문안내 생성',   desc: '첫 줄 후크 + 본문' },
  { type: 'menuoption', emoji: '🧩', name: '메뉴 옵션 설계',  desc: '객단가 +20~40% 레버' },
];

const VALID = new Set(TOOLS.map(t => t.type));

// iframe 임베드 시: 현재 문서 높이를 부모(아임웹)로 전송 → 부모가 iframe height 조정.
function useReportHeight(dep) {
  useLayoutEffect(() => {
    const send = () => {
      const h = Math.ceil(document.documentElement.scrollHeight);
      window.parent?.postMessage({ type: 'dgm-ai-tool:height', height: h }, '*');
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(document.documentElement);
    window.addEventListener('load', send);
    return () => { ro.disconnect(); window.removeEventListener('load', send); };
  }, [dep]);
}

export default function App() {
  // URL ?type= 프리필 지원 (예: iframe src="...?type=reply") — 특정 도구로 바로 진입 가능
  const initial = (() => {
    const t = new URLSearchParams(window.location.search).get('type');
    return t && VALID.has(t) ? t : null;
  })();
  const [active, setActive] = useState(initial);

  useReportHeight(active);
  useEffect(() => { window.scrollTo(0, 0); }, [active]);

  if (active) {
    return (
      <div style={s.wrap}>
        <AiForm type={active} onBack={() => setActive(null)} />
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.brand}>단꿈 AI 문구 도구</div>
        <div style={s.tagline}>배민 사장님을 위한 문구 자동 생성 · 로그인 없이 바로 사용</div>
      </div>
      <div style={s.grid}>
        {TOOLS.map(t => (
          <button key={t.type} style={s.card} onClick={() => setActive(t.type)} className='toolCard'>
            <span style={s.cardEmoji}>{t.emoji}</span>
            <span style={s.cardBody}>
              <span style={s.cardName}>{t.name}</span>
              <span style={s.cardDesc}>{t.desc}</span>
            </span>
            <span style={s.cardArrow}>→</span>
          </button>
        ))}
      </div>
      <div style={s.foot}>
        생성 결과는 참고용 초안입니다. 사장님만의 정체성을 더해 완성하세요.
      </div>
      <style>{`
        .toolCard:hover { border-color: rgba(61,186,111,.5) !important; background: rgba(61,186,111,.06) !important; transform: translateY(-1px); }
        .toolCard:hover .cardArrow { transform: translateX(3px); color:#3dba6f !important; }
      `}</style>
    </div>
  );
}

const s = {
  wrap: { minHeight:'100%', padding:'20px 16px 28px', boxSizing:'border-box', color:'#e8ede8' },
  header: { maxWidth:'580px', margin:'0 auto 20px', textAlign:'center' },
  brand: { fontSize:'20px', fontWeight:800, color:'#e8ede8', letterSpacing:'-.01em' },
  tagline: { fontSize:'12.5px', color:'#607570', marginTop:'6px' },
  grid: { maxWidth:'580px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'10px' },
  card: {
    display:'flex', alignItems:'center', gap:'14px', width:'100%', textAlign:'left',
    background:'#16191a', border:'1px solid #2a2f30', borderRadius:'12px',
    padding:'16px 18px', cursor:'pointer', fontFamily:'inherit',
    transition:'all .18s',
  },
  cardEmoji: { fontSize:'26px', flexShrink:0, width:'34px', textAlign:'center' },
  cardBody: { display:'flex', flexDirection:'column', gap:'3px', flex:1 },
  cardName: { fontSize:'15px', fontWeight:700, color:'#e8ede8' },
  cardDesc: { fontSize:'12px', color:'#9aada6' },
  cardArrow: { fontSize:'16px', color:'#607570', flexShrink:0, transition:'all .18s' },
  foot: { maxWidth:'580px', margin:'22px auto 0', textAlign:'center', fontSize:'11.5px', color:'#4a5754', lineHeight:1.6 },
};
