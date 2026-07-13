import { useState } from 'react';
import { PRESETS, MENUOPTION_GUIDES, DEFAULT_FORM, pick } from '../data/presets';
import { S } from '../data/styles';

// type → 헤더 라벨. App의 도구 그리드와 동일한 표기.
const LABELS = {
  intro:      '가게소개 생성',
  notice:     '사장님공지 생성',
  menuname:   '메뉴명 SEO',
  menudesc:   '메뉴설명 후킹',
  reply:      '리뷰답변 생성',
  orderguide: '주문안내 생성',
  menuoption: '메뉴 옵션 설계',
};

// 순수 무로그인 폼. 로그인·매장·aiCache·히스토리 없음. 생성은 100% 폼 입력 기반.
export default function AiForm({ type, tool }) {
  const [form, setForm]       = useState({ ...DEFAULT_FORM });
  const [preset, setPreset]   = useState('');
  const [flash, setFlash]     = useState(0);
  const [result, setResult]   = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function applyPresetWithRandom(key) {
    if (!key) return;
    const p = PRESETS[key]?.[type];
    if (!p) return;
    const next = {};
    Object.entries(p).forEach(([k, v]) => { next[k] = pick(v); });
    setForm(f => ({ ...f, ...next }));
    setFlash(n => n + 1);
  }
  function onPresetChange(key) { setPreset(key); applyPresetWithRandom(key); }
  function reroll() {
    if (!preset) { alert('먼저 업종을 선택해주세요.'); return; }
    applyPresetWithRandom(preset);
  }

  async function generate() {
    const required = {
      intro:      ['category','mainMenu'],
      orderguide: ['storeName','firstLine'],
      notice:     ['storeName','story'],
      menuname:   ['currentName','category'],
      menudesc:   ['menuName','taste'],
      menuoption: form.mode === 'board' ? ['menuBoard'] : ['menuName','basePrice'],
      reply:      ['storeName','review','rating'],
    }[type] || [];
    if (required.some(k => !form[k])) { alert('필수 항목(*)을 모두 입력해주세요.'); return; }
    setLoading(true); setResult('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, storeInfo: form }),
      });
      if (res.status === 429) {
        setResult('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setResult(data.result || data.error || '오류가 발생했습니다.');
    } catch { setResult('서버 연결 오류가 발생했습니다.'); }
    setLoading(false);
  }

  function copy() {
    navigator.clipboard.writeText(result);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const showPreset = ['intro','notice','menuname','menudesc'].includes(type);
  const flashStyle = { background: flash ? 'rgba(232,168,56,.18)' : '#0d0f10', transition: 'background .4s' };
  const showIdentityHint = ['intro','orderguide','notice','menuname','menudesc','menuoption'].includes(type);
  const isMenuoption = type === 'menuoption';

  return (
    <div style={s.page}>
      <div style={s.head}>
        <div style={s.title}>{tool?.emoji} {LABELS[type]}</div>
        <div style={s.sub}>가게 정보를 입력하면 AI가 문구를 생성해드립니다</div>
      </div>

      <div style={{ ...S.mbody, padding: 0 }}>
        {isMenuoption && (
          <div style={S.aphorismBox}>
            <span style={S.aphorismIcon}>💡</span>
            <span style={S.aphorismText}>
              메뉴 리스트는 <strong style={S.aphorismHighlight}>12,000원</strong>으로 보이고,
              결제는 <strong style={S.aphorismHighlight}>25,000원</strong>으로 끝난다
            </span>
          </div>
        )}

        {showPreset && (
          <div style={S.presetWrap}>
            <label style={S.presetLabel}>⚡ 업종 프리셋 <span style={{color:'#607570',fontWeight:400}}>(선택 시 자동 채움 · 🎲로 다른 조합)</span></label>
            <div style={S.presetRow}>
              <select style={S.presetSel} value={preset} onChange={e => onPresetChange(e.target.value)}>
                <option value=''>직접 입력</option>
                {Object.entries(PRESETS).map(([k,v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button style={S.rerollBtn} onClick={reroll} title='같은 업종의 다른 예시로 다시 채우기' className='rerollBtn'>
                <span className='diceIcon' style={{display:'inline-block',transition:'transform .4s'}}>🎲</span>
                <span style={{fontSize:'13px',fontWeight:600}}>다시</span>
              </button>
            </div>
          </div>
        )}

        {type==='intro' && <>
          <div style={S.row}>
            <Field label="업종 *" placeholder="예: 제육볶음 전문점, 치킨집" value={form.category} onChange={v=>set('category',v)} flash={flashStyle} />
            <Field label="대표 메뉴 *" placeholder="예: 직화 제육볶음, 후라이드" value={form.mainMenu} onChange={v=>set('mainMenu',v)} flash={flashStyle} />
          </div>
          <Field label="특징/차별점" placeholder="예: 직화 불맛, 15년 전통, 국내산 재료" value={form.feature} onChange={v=>set('feature',v)} flash={flashStyle} />
          <Field label="운영 특이사항" placeholder="예: 1인분 주문 가능, 새벽 영업, 단체 주문 환영" value={form.style} onChange={v=>set('style',v)} flash={flashStyle} />
        </>}

        {type==='notice' && <>
          <Field label="가게명·업종 *" placeholder="예: 영일이아구찜 김해점 (아구찜 전문점)" value={form.storeName} onChange={v=>set('storeName',v)} flash={flashStyle} />
          <Field label="매장 스토리·비법·정성 *" placeholder="예: 15년 경력 사장님이 매일 새벽 어시장에서 직접 손질한 국산 아구만 사용" value={form.story} onChange={v=>set('story',v)} textarea flash={flashStyle} />
          <Field label="진행 중인 이벤트" placeholder="예: 리뷰이벤트 (수제만두 4개 증정), 첫 주문 2,000원 쿠폰" value={form.event} onChange={v=>set('event',v)} textarea flash={flashStyle} />
          <Field label="강조할 대표메뉴" placeholder="예: 된장술밥+제육 세트, 아구찜 中" value={form.featuredMenu} onChange={v=>set('featuredMenu',v)} flash={flashStyle} />
          <Field label="추가 안내사항" placeholder="예: 매주 월요일 정기휴무, 배달 지연 양해 부탁" value={form.extraNotice} onChange={v=>set('extraNotice',v)} textarea flash={flashStyle} />
        </>}

        {type==='menuname' && <>
          <div style={S.row}>
            <Field label="현재 메뉴명 *" placeholder="예: 제육볶음" value={form.currentName} onChange={v=>set('currentName',v)} flash={flashStyle} />
            <Field label="업종/음식 종류 *" placeholder="예: 한식, 볶음류" value={form.category} onChange={v=>set('category',v)} flash={flashStyle} />
          </div>
          <div style={S.row}>
            <Field label="조리 방식·특징" placeholder="예: 직화, 수제, 당일 손질" value={form.feature} onChange={v=>set('feature',v)} flash={flashStyle} />
            <Field label="주요 재료" placeholder="예: 국내산 돼지고기, 청양고추" value={form.ingredient} onChange={v=>set('ingredient',v)} flash={flashStyle} />
          </div>
        </>}

        {type==='menudesc' && <>
          <Field label="메뉴명 *" placeholder="예: 직화 불향 제육볶음" value={form.menuName} onChange={v=>set('menuName',v)} flash={flashStyle} />
          <Field label="맛·식감 *" placeholder="예: 불향 가득한 촉촉한 제육, 매콤달콤" value={form.taste} onChange={v=>set('taste',v)} flash={flashStyle} />
          <Field label="구성·용량" placeholder="예: 공기밥 포함, 350g, 1~2인분" value={form.compose} onChange={v=>set('compose',v)} flash={flashStyle} />
        </>}

        {type==='orderguide' && <>
          <Field label="가게명·업종 *" placeholder="예: 영일이아구찜 (아구찜 전문점)" value={form.storeName} onChange={v=>set('storeName',v)} flash={flashStyle} />
          <Field label="첫 줄 후크 *" placeholder="예: 「배달팁 0원 + 리뷰 사이드 4종」 30년 비법 시그니처" value={form.firstLine} onChange={v=>set('firstLine',v)} flash={flashStyle} />
          <Field label="진행 중인 이벤트·할인" placeholder="예: 즉시할인 5,000원, 첫 주문 쿠폰, 리뷰 이벤트" value={form.event} onChange={v=>set('event',v)} flash={flashStyle} />
          <Field label="강조할 대표메뉴" placeholder="예: 30년 비법 시그니처 아구찜, 된장술밥 세트" value={form.featuredMenu} onChange={v=>set('featuredMenu',v)} flash={flashStyle} />
          <Field label="시즌·운영 특이사항" placeholder="예: 겨울 한정 굴 추가, 새벽 영업, 단체 주문 환영" value={form.extraNotice} onChange={v=>set('extraNotice',v)} textarea flash={flashStyle} />
        </>}

        {type==='menuoption' && <>
          <div style={S.modeTabs}>
            <button style={{...S.modeTab, ...(form.mode !== 'board' ? S.modeTabActive : {})}} onClick={() => set('mode', 'single')} className='modeTab'>단일 메뉴</button>
            <button style={{...S.modeTab, ...(form.mode === 'board' ? S.modeTabActive : {})}} onClick={() => set('mode', 'board')} className='modeTab'>📋 메뉴판 전체 ★</button>
          </div>

          {form.mode !== 'board' && <>
            <div style={S.row}>
              <Field label="메뉴명 *" placeholder="예: 불향차돌떡볶이" value={form.menuName} onChange={v=>set('menuName',v)} flash={flashStyle} />
              <Field label="기본 가격 *" placeholder="예: 18,000원 또는 18000" value={form.basePrice} onChange={v=>set('basePrice',v)} flash={flashStyle} />
            </div>
            <Field label="기본 인분" placeholder="예: 1~2인분, 2인분" value={form.basePortion} onChange={v=>set('basePortion',v)} flash={flashStyle} />
            <Field label="토핑 후보 (쉼표로 구분)" placeholder="예: 차돌박이, 모짜렐라치즈, 통새우 5마리" value={form.toppings} onChange={v=>set('toppings',v)} textarea flash={flashStyle} />
            <Field label="사이드 후보 (쉼표로 구분)" placeholder="예: 볶음밥, 군만두, 김말이튀김, 라면사리" value={form.sides} onChange={v=>set('sides',v)} flash={flashStyle} />
            <Field label="음료 후보 (쉼표로 구분)" placeholder="예: 콜라, 사이다, 청포도에이드" value={form.drinks} onChange={v=>set('drinks',v)} flash={flashStyle} />
            <div style={S.row}>
              <Field label="객단가 목표" placeholder="예: +5,000원, +30%" value={form.targetAOV} onChange={v=>set('targetAOV',v)} flash={flashStyle} />
              <SelectField label="운영 시기" value={form.stage} onChange={v=>set('stage',v)} options={['오픈 초기','성장기','안정기']} />
            </div>
          </>}

          {form.mode === 'board' && <>
            <Field
              label="메뉴판 전체 *"
              placeholder={`메뉴판을 그대로 붙여넣으세요. 예:

1. 불향차돌떡볶이 18,000원 (2인분)
2. 로제떡볶이 16,000원 (2인분)
3. 매운국물떡볶이 15,000원
4. 김말이튀김 5,000원
5. 군만두 5,000원
6. 콜라 2,000원
7. 청포도에이드 4,000원

* 메뉴 카테고리·옵션 트리·리뷰이벤트·객단가 시뮬레이션까지 한꺼번에 분석`}
              value={form.menuBoard}
              onChange={v=>set('menuBoard',v)}
              textarea
              flash={flashStyle}
            />
            <Field label="업종/매장 분위기" placeholder="예: 분식·야식 / 캐주얼 / 가족 외식형" value={form.atmosphere} onChange={v=>set('atmosphere',v)} flash={flashStyle} />
            <div style={S.row}>
              <Field label="객단가 목표" placeholder="예: +5,000원, +30%" value={form.targetAOV} onChange={v=>set('targetAOV',v)} flash={flashStyle} />
              <SelectField label="운영 시기" value={form.stage} onChange={v=>set('stage',v)} options={['오픈 초기','성장기','안정기']} />
            </div>
          </>}
        </>}

        {type==='reply' && <>
          <Field label="가게명 *" placeholder="예: 영일이아구찜 창원점" value={form.storeName} onChange={v=>set('storeName',v)} />
          <Field label="고객 리뷰 *" placeholder="리뷰 본문을 붙여넣으세요" value={form.review} onChange={v=>set('review',v)} textarea />
          <SelectField label="별점 *" value={form.rating} onChange={v=>set('rating',v)} options={['1','2','3','4','5']} />
        </>}

        <button style={{ ...S.genBtn, opacity: loading ? 0.6 : 1 }} onClick={generate} disabled={loading}>
          {loading ? '생성 중...' : '✨ 문구 생성하기'}
        </button>

        {result && (
          <div style={S.resultWrap}>
            <div style={S.resultLabel}>생성된 문구</div>
            <pre style={S.resultText}>{result}</pre>
            {showIdentityHint && (
              <div style={S.resultHint}>💡 이 제안에서 영감과 힌트를 얻어 사장님만의 정체성을 더해주세요</div>
            )}
            <div style={S.resultActions}>
              <button style={S.copyBtn} onClick={copy}>{copied ? '✓ 복사됨' : '복사하기'}</button>
              <button style={S.regenBtn} onClick={generate}>다시 생성</button>
            </div>
          </div>
        )}

        {isMenuoption && (
          <div style={S.guideWrap}>
            <button style={S.guideToggle} onClick={() => setGuideOpen(o => !o)} className='guideToggle'>
              <span>📚 옵션 설계 6가지 핵심 가이드</span>
              <span style={{ transform: guideOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .25s', fontSize: '11px' }}>▼</span>
            </button>
            {guideOpen && (
              <div style={S.guideList}>
                {MENUOPTION_GUIDES.map((g) => (
                  <div key={g.n} style={S.guideItem}>
                    <div style={S.guideTitle}><span style={S.guideNum}>{g.n}</span><span>{g.title}</span></div>
                    <div style={S.guideDesc}>{g.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .rerollBtn:hover { background: rgba(232,168,56,.12) !important; }
        .rerollBtn:hover .diceIcon { transform: rotate(180deg); }
        .rerollBtn:active { transform: scale(0.95); }
        .guideToggle:hover { background: rgba(232,168,56,.12) !important; }
      `}</style>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, textarea, flash }) {
  const inputStyle = { ...S.finput, ...(flash || {}) };
  return (
    <div style={S.field}>
      <label style={S.flabel}>{label}</label>
      {textarea
        ? <textarea style={{ ...inputStyle, height:'80px', resize:'vertical' }} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
        : <input style={inputStyle} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      }
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={S.field}>
      <label style={S.flabel}>{label}</label>
      <select style={S.finput} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

const s = {
  page: { maxWidth:'640px', margin:'0 auto', padding:'22px 16px 32px' },
  head: { padding:'0 4px 16px', marginBottom:'18px' },
  title: { fontFamily:"'Nanum Myeongjo', serif", fontSize:'21px', fontWeight:800, color:'#f2f0ea', lineHeight:1.25 },
  sub: { fontSize:'12.5px', color:'#9a8f78', marginTop:'7px' },
};
