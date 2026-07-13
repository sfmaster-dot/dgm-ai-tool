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
        <div style={s.brand}>단꿈 <span style={{color:'#f0b942'}}>AI 문구</span> 도구</div>
        <div style={s.tagline}>배민 사장님을 위한 문구 자동 생성 · 로그인 없이 바로 사용</div>
      </div>
      <div style={s.grid}>
        {TOOLS.map(t => (
          <button key={t.type} style={s.card} onClick={() => setActive(t.type)} className='toolCard'>
            <span style={s.cardLine} />
            <span style={s.cardEmoji}>{t.emoji}</span>
            <span style={s.cardBody}>
              <span style={s.cardName}>{t.name}</span>
              <span style={s.cardDesc}>{t.desc}</span>
            </span>
            <span style={s.cardArrow} className='cardArrow'>→</span>
          </button>
        ))}
      </div>
      <div style={s.foot}>
        생성 결과는 참고용 초안입니다. 사장님만의 정체성을 더해 완성하세요.
      </div>
      <style>{`
        .toolCard:hover { border-color: rgba(232,168,56,.55) !important; background: #201a15 !important; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.35); }
        .toolCard:hover .cardArrow { transform: translateX(3px); color:#f0b942 !important; }
      `}</style>
    </div>
  );
}

const s = {
  wrap: { minHeight:'100%', padding:'22px 16px 30px', boxSizing:'border-box', color:'#e8ede8' },
  header: { maxWidth:'580px', margin:'0 auto 22px', textAlign:'center' },
  brand: { fontSize:'21px', fontWeight:800, color:'#f2f0ea', letterSpacing:'-.01em' },
  tagline: { fontSize:'12.5px', color:'#9a8f78', marginTop:'7px' },
  grid: { maxWidth:'580px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'11px' },
  card: {
    position:'relative', display:'flex', alignItems:'center', gap:'14px', width:'100%', textAlign:'left',
    background:'#191614', border:'1px solid #34302a', borderRadius:'13px',
    padding:'17px 18px', cursor:'pointer', fontFamily:'inherit', overflow:'hidden',
    transition:'all .18s',
  },
  cardLine: {
    position:'absolute', top:0, left:0, right:0, height:'3px',
    background:'linear-gradient(90deg,#e8a838,#f5cd6e)',
  },
  cardEmoji: {
    fontSize:'22px', flexShrink:0, width:'44px', height:'44px', borderRadius:'11px',
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'rgba(232,168,56,.14)', border:'1px solid rgba(232,168,56,.28)',
  },
  cardBody: { display:'flex', flexDirection:'column', gap:'3px', flex:1 },
  cardName: { fontSize:'15px', fontWeight:700, color:'#f2f0ea' },
  cardDesc: { fontSize:'12px', color:'#9a8f78' },
  cardArrow: { fontSize:'16px', color:'#6e6455', flexShrink:0, transition:'all .18s' },
  foot: { maxWidth:'580px', margin:'24px auto 0', textAlign:'center', fontSize:'11.5px', color:'#5a5145', lineHeight:1.6 },
};
