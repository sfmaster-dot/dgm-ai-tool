import { useState, useEffect, useLayoutEffect } from 'react';
import AiForm from './components/AiForm';

// ── AI 문구 메이커: 문구 5종 (옵션설계 제외) ──
const TOOLS = [
  { type: 'intro',      emoji: '🏪', name: '가게소개 생성',   tab: '가게소개', desc: '200~400자 · 스토리형' },
  { type: 'notice',     emoji: '📢', name: '사장님공지 생성', tab: '공지',     desc: '이벤트·휴무·신메뉴' },
  { type: 'menuname',   emoji: '🍽️', name: '메뉴명 SEO',      tab: '메뉴명',   desc: '검색 키워드 최적화 3종' },
  { type: 'menudesc',   emoji: '📝', name: '메뉴설명 후킹',   tab: '메뉴설명', desc: '60자 이내 · 후킹+구성' },
  { type: 'orderguide', emoji: '📌', name: '주문안내 생성',   tab: '주문안내', desc: '첫 줄 후크 + 본문' },
];
const VALID = new Set(TOOLS.map(t => t.type));

// ── 메뉴 옵션 메이커: 독립 도구 (/option 경로) ──
const OPTION_TOOL = { type: 'menuoption', emoji: '🧩', name: '메뉴 옵션 설계' };

// 경로로 모드 판별. /option → 메뉴 옵션 메이커, 그 외 → AI 문구 메이커
function isOptionMode() {
  return window.location.pathname.replace(/\/+$/, '').endsWith('/option');
}

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
  return isOptionMode() ? <OptionMaker /> : <CopyMaker />;
}

// ══ AI 문구 메이커 ══
function CopyMaker() {
  const initial = (() => {
    const t = new URLSearchParams(window.location.search).get('type');
    return t && VALID.has(t) ? t : null;
  })();
  const [active, setActive] = useState(initial);

  useReportHeight(active);
  useEffect(() => { window.scrollTo(0, 0); }, [active]);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.hero}>
          <div style={s.heroLabel}>단꿈 장사도구</div>
          <div style={s.heroRow}>
            <span style={s.heroIcon}>✨</span>
            <span style={s.heroTitle}>AI 문구 메이커</span>
          </div>
          <div style={s.heroSub}>배달앱의 가게소개, 공지, 메뉴명 SEO, 메뉴설명까지 문구를 자동으로 만들어드립니다.</div>
        </div>

        <div style={s.divider} />

        <div style={s.tabBar} className='tabBar'>
          {TOOLS.map(t => {
            const on = active === t.type;
            return (
              <button key={t.type} onClick={() => setActive(t.type)}
                style={{ ...s.tab, ...(on ? s.tabOn : {}) }} className='navTab'>
                <span style={{ fontSize: '13px' }}>{t.emoji}</span>
                <span>{t.tab}</span>
              </button>
            );
          })}
        </div>
      </div>

      {active
        ? <AiForm type={active} tool={TOOLS.find(t => t.type === active)} />
        : <Home tools={TOOLS} onPick={setActive} />
      }

      <SharedStyle />
    </div>
  );
}

function Home({ tools, onPick }) {
  return (
    <div style={s.body}>
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
        생성 결과 제안에서 영감과 힌트를 얻어 사장님만의 정체성을 더해주세요
      </div>
    </div>
  );
}

// ══ 메뉴 옵션 메이커 (독립) ══
function OptionMaker() {
  useReportHeight('option');
  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.hero}>
          <div style={s.heroLabel}>단꿈 장사도구</div>
          <div style={s.heroRow}>
            <span style={s.heroIcon}>🧩</span>
            <span style={s.heroTitle}>메뉴 옵션 메이커</span>
          </div>
          <div style={s.heroSub}>메뉴 구성·토핑·사이드·세트를 전략적으로 설계해 객단가를 끌어올립니다.</div>
        </div>
        <div style={s.divider} />
      </div>

      <AiForm type="menuoption" tool={OPTION_TOOL} bare />

      <SharedStyle />
    </div>
  );
}

function SharedStyle() {
  return (
    <style>{`
      .navTab:hover { border-color: rgba(232,168,56,.5) !important; color: #f2f0ea !important; }
      .toolCard:hover { border-color: rgba(232,168,56,.45) !important; background: #1c1811 !important; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.35); }
      .toolCard:hover .cardLine { background: linear-gradient(180deg,#eeb040,#e0972a) !important; }
      .toolCard:hover .cardArrow { transform: translateX(3px); color:#f0b942 !important; }
      .tabBar::-webkit-scrollbar { height: 0; }
    `}</style>
  );
}

const SERIF = "'Nanum Myeongjo', serif";

const s = {
  wrap: { minHeight:'100%', boxSizing:'border-box', color:'#e8ede8' },

  header: { padding:'32px 16px 0' },
  divider: { maxWidth:'640px', margin:'22px auto 18px', height:'1px', background:'#2a251f' },
  tabBar: {
    display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'2px',
    maxWidth:'640px', margin:'0 auto',
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

  body: { padding:'22px 16px 32px' },
  hero: { maxWidth:'640px', margin:'0 auto', textAlign:'left' },
  heroLabel: { fontSize:'12px', fontWeight:700, letterSpacing:'.06em', color:'#f0b942', marginBottom:'12px' },
  heroRow: { display:'flex', alignItems:'center', gap:'14px' },
  heroIcon: {
    fontSize:'26px', flexShrink:0, width:'52px', height:'52px', borderRadius:'13px',
    display:'flex', alignItems:'center', justifyContent:'center',
    background:'rgba(232,168,56,.1)', border:'1px solid rgba(232,168,56,.22)',
  },
  heroTitle: { fontFamily:SERIF, fontSize:'34px', fontWeight:800, color:'#f2f0ea', lineHeight:1.2 },
  heroSub: { fontSize:'13.5px', color:'#9a8f78', marginTop:'14px', lineHeight:1.6 },

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
