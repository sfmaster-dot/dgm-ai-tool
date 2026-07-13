import { useState, useEffect, useLayoutEffect } from 'react';
import AiForm from './components/AiForm';

// 노출 도구 7종. name=긴 이름(그리드/헤더), tab=짧은 이름(탭바)
const TOOLS = [
  { type: 'intro',      emoji: '🏪', name: '가게소개 생성',   tab: '가게소개', desc: '200~400자 · 스토리형' },
  { type: 'notice',     emoji: '📢', name: '사장님공지 생성', tab: '공지',     desc: '이벤트·휴무·신메뉴' },
  { type: 'menuname',   emoji: '🍽️', name: '메뉴명 SEO',      tab: '메뉴명',   desc: '검색 키워드 최적화 3종' },
  { type: 'menudesc',   emoji: '📝', name: '메뉴설명 후킹',   tab: '메뉴설명', desc: '60자 이내 · 후킹+구성' },
  { type: 'orderguide', emoji: '📌', name: '주문안내 생성',   tab: '주문안내', desc: '첫 줄 후크 + 본문' },
  { type: 'menuoption', emoji: '🧩', name: '메뉴 옵션 설계',  tab: '옵션설계', desc: '객단가 +20~40% 레버' },
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
  const initial = (() => {
    const t = new URLSearchParams(window.location.search).get('type');
    return t && VALID.has(t) ? t : null;
  })();
  const [active, setActive] = useState(initial);

  useReportHeight(active);
  useEffect(() => { window.scrollTo(0, 0); }, [active]);

  return (
    <div style={s.wrap}>
      {/* 상단 고정 네비게이터 */}
      <div style={s.nav}>
        <button style={s.brand} onClick={() => setActive(null)} className='brandBtn'>
          단꿈 <span style={{ color: "#f0b942" }}>AI 문구</span> 메이커
        </button>
        <div style={s.tabBarWrap}>
          <div style={s.tabBar} className='tabBar'>
            {TOOLS.map(t => {
              const on = active === t.type;
              return (
                <button
                  key={t.type}
                  onClick={() => setActive(t.type)}
                  style={{ ...s.tab, ...(on ? s.tabOn : {}) }}
                  className='navTab'
                >
                  <span style={{ fontSize: '13px' }}>{t.emoji}</span>
                  <span>{t.tab}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 본문 */}
      {active
        ? <AiForm type={active} tool={TOOLS.find(t => t.type === active)} />
        : <Home tools={TOOLS} onPick={setActive} />
      }

      <style>{`
        .brandBtn:hover { opacity: .85; }
        .navTab:hover { border-color: rgba(232,168,56,.5) !important; color: #f2f0ea !important; }
        .toolCard:hover { border-color: rgba(232,168,56,.45) !important; background: #1c1811 !important; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.35); }
        .toolCard:hover .cardLine { background: linear-gradient(180deg,#eeb040,#e0972a) !important; }
        .toolCard:hover .cardArrow { transform: translateX(3px); color:#f0b942 !important; }
        .tabBar::-webkit-scrollbar { height: 0; }
      `}</style>
    </div>
  );
}

function Home({ tools, onPick }) {
  return (
    <div style={s.body}>
      <div style={s.hero}>
        <div style={s.heroLabel}>단꿈 장사도구</div>
        <div style={s.heroTitle}>AI 문구 메이커</div>
        <div style={s.heroSub}>가게소개 · 공지 · 메뉴명 · 메뉴설명 · 주문안내 · 옵션설계 — 6가지 문구를 한 곳에서</div>
      </div>
      <div style={s.grid}>
        {tools.map(t => (
          <button key={t.type} style={s.card} onClick={() => onPick(t.type)} className='toolCard'>
            <span style={s.cardLine} className='cardLine' />
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
    </div>
  );
}

const SERIF = "'Nanum Myeongjo', serif";

const s = {
  wrap: { minHeight:'100%', boxSizing:'border-box', color:'#e8ede8' },

  nav: {
    position:'sticky', top:0, zIndex:20,
    background:'rgba(16,13,11,.92)', backdropFilter:'blur(8px)',
    borderBottom:'1px solid #2a251f',
    padding:'34px 16px 0',
  },
  brand: {
    display:'block', margin:'0 auto', maxWidth:'760px', width:'100%',
    background:'none', border:'none', cursor:'pointer', textAlign:'center',
    fontFamily:SERIF, fontSize:'24px', fontWeight:800, color:'#f2f0ea', letterSpacing:'-.01em',
    padding:0, transition:'opacity .15s',
  },
  tabBarWrap: { maxWidth:'760px', margin:'16px auto 0', overflow:'hidden' },
  tabBar: {
    display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'12px',
    scrollbarWidth:'none', msOverflowStyle:'none',
  },
  tab: {
    flex:'1 1 0', minWidth:'max-content',
    display:'inline-flex', alignItems:'center', justifyContent:'center', gap:'5px',
    padding:'8px 12px', borderRadius:'999px', whiteSpace:'nowrap',
    background:'#191614', border:'1px solid #33302a', color:'#9a8f78',
    fontSize:'12.5px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
    transition:'all .15s',
  },
  tabOn: {
    background:'linear-gradient(180deg,#eeb040,#e0972a)', border:'1px solid #e8a838',
    color:'#1a1408', fontWeight:700, boxShadow:'0 3px 10px rgba(232,168,56,.28)',
  },

  body: { padding:'26px 16px 32px' },
  hero: { maxWidth:'640px', margin:'0 auto 26px', textAlign:'center' },
  heroLabel: { fontSize:'12px', fontWeight:700, letterSpacing:'.06em', color:'#f0b942', marginBottom:'10px' },
  heroTitle: { fontFamily:SERIF, fontSize:'32px', fontWeight:800, color:'#f2f0ea', lineHeight:1.25 },
  heroSub: { fontSize:'13px', color:'#9a8f78', marginTop:'12px' },

  grid: { maxWidth:'640px', margin:'0 auto', display:'flex', flexDirection:'column', gap:'11px' },
  card: {
    position:'relative', display:'flex', alignItems:'center', gap:'14px', width:'100%', textAlign:'left',
    background:'#16130f', border:'1px solid #29251e', borderRadius:'12px',
    padding:'17px 18px', cursor:'pointer', fontFamily:'inherit', overflow:'hidden',
    transition:'all .18s',
  },
  cardLine: {
    position:'absolute', top:0, bottom:0, left:0, width:'3px',
    background:'transparent', transition:'background .18s',
  },
  cardEmoji: {
    fontSize:'22px', flexShrink:0, width:'44px', height:'44px', borderRadius:'11px',
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'rgba(232,168,56,.08)',
  },
  cardBody: { display:'flex', flexDirection:'column', gap:'3px', flex:1 },
  cardName: { fontSize:'15px', fontWeight:700, color:'#f2f0ea' },
  cardDesc: { fontSize:'12px', color:'#9a8f78' },
  cardArrow: { fontSize:'16px', color:'#6e6455', flexShrink:0, transition:'all .18s' },
  foot: { maxWidth:'640px', margin:'24px auto 0', textAlign:'center', fontSize:'11.5px', color:'#5a5145', lineHeight:1.6 },
};
