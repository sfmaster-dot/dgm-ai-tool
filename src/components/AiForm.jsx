import { useState, useEffect } from 'react';
import { PRESETS, MENUOPTION_GUIDES, DEFAULT_FORM, pick } from '../data/presets';

// ── menuoption 구조화 결과 파서 ──
// 본문 뒤 <<<JSON>>> 구분자 이후의 JSON을 분리. 실패 시 전체를 텍스트로 폴백.
function splitStructured(raw) {
  const M = '<<<JSON>>>';
  const i = raw.lastIndexOf(M);
  if (i === -1) return { text: raw, json: null };
  const text = raw.slice(0, i).trim();
  let t = raw.slice(i + M.length).replace(/```json|```/g, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a === -1 || b === -1) return { text: raw, json: null };
  try {
    const json = JSON.parse(t.slice(a, b + 1));
    if (!json || !Array.isArray(json.optionGroups)) return { text: raw, json: null };
    return { text, json };
  } catch { return { text: raw, json: null }; }
}

const won = (n) => (typeof n === 'number' ? n.toLocaleString('ko-KR') : (n ?? ''));

function groupToText(g) {
  const head = `【${g.name}】 ${g.required ? '필수' : '선택'} · 최소 ${g.min ?? 0}개 ~ 최대 ${g.max ?? 1}개`;
  const rows = (g.options || []).map(o => `- ${o.name}  +${won(o.price)}원${o.note ? `  (${o.note})` : ''}`);
  return [head, ...rows].join('\n');
}
function allGroupsText(json) {
  return (json.optionGroups || []).map(groupToText).join('\n\n');
}

// ── AI 문구 메이커: 다안·개선·다듬기 ──
const IMPROVABLE = new Set(['intro', 'notice', 'menudesc', 'orderguide']);
const CHIP_TYPES = IMPROVABLE;
const CHIPS = [
  { label: '더 짧게',       instr: '전체 길이를 30% 이상 줄여 더 짧고 임팩트 있게.' },
  { label: '더 정감있게',   instr: '말투를 더 따뜻하고 정감 있게.' },
  { label: '더 전문적으로', instr: '말투를 더 전문적이고 신뢰감 있게.' },
  { label: '이모지 빼기',   instr: '이모지를 모두 제거.' },
  { label: '이모지 넣기',   instr: '과하지 않게 이모지를 몇 개만 추가.' },
];

// <<<안|톤>>> 구분자로 3안 파싱. 2개 미만이면 null(단일 텍스트 폴백)
function parseVariants(raw) {
  const re = /<<<안\|(.+?)>>>/g;
  const marks = []; let m;
  while ((m = re.exec(raw))) marks.push({ label: m[1].trim(), start: m.index, end: re.lastIndex });
  if (marks.length < 2) return null;
  const out = [];
  for (let i = 0; i < marks.length; i++) {
    const text = raw.slice(marks[i].end, i + 1 < marks.length ? marks[i + 1].start : raw.length).trim();
    if (text) out.push({ label: marks[i].label, text });
  }
  return out.length >= 2 ? out : null;
}

// 개선 모드 결과에서 교정본만 추출 (복사·다듬기·글자수 대상)
function extractFinal(raw) {
  const M = '【교정본】';
  const i = raw.indexOf(M);
  if (i === -1) return raw.trim();
  return raw.slice(i + M.length).replace(/^[\s:]+/, '').trim();
}

// ── 캡처 업로드: 폭 1100px 정규화 + 긴 캡처 자동 세로 분할(경계 60px 겹침) ──
function processCapture(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const W = Math.min(img.width, 1100);
      const scale = W / img.width;
      const H = Math.round(img.height * scale);
      const chunkH = Math.round(W * 2);
      const overlap = 60;
      const pieces = [];
      let y = 0;
      while (y < H && pieces.length < 6) {
        const h = Math.min(chunkH, H - y);
        const c = document.createElement('canvas');
        c.width = W; c.height = h;
        c.getContext('2d').drawImage(img, 0, y / scale, img.width, h / scale, 0, 0, W, h);
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        pieces.push({ media_type: 'image/jpeg', data: dataUrl.split(',')[1], preview: dataUrl });
        if (y + h >= H) break;
        y += chunkH - overlap;
      }
      resolve(pieces);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 읽기 실패')); };
    img.src = url;
  });
}

// 세션 폼 — 탭을 오가도 입력 유지 (저장 없음, 새로고침 시 초기화)
let sessionForm = null;
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
export default function AiForm({ type, tool, bare }) {
  const [form, setForm]       = useState(() => sessionForm ? { ...sessionForm } : { ...DEFAULT_FORM });
  const [preset, setPreset]   = useState('');
  const [flash, setFlash]     = useState(0);
  const [result, setResult]   = useState('');
  const [structured, setStructured] = useState(null); // menuoption JSON 결과
  const [copiedG, setCopiedG] = useState(null);       // 그룹 복사 상태 (index | 'all')
  const [variants, setVariants] = useState(null);     // 3안 결과
  const [refining, setRefining] = useState(false);    // 다듬기 진행 중
  const [images, setImages]   = useState([]);         // 진단 캡처 (base64 조각)
  const [imgBusy, setImgBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { sessionForm = form; }, [form]);
  useEffect(() => { setResult(''); setStructured(null); setVariants(null); setCopiedG(null); setCopied(false); setImages([]); }, [type]);
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
    const required = (form.workMode === 'improve' && IMPROVABLE.has(type)) ? ['currentCopy'] : ({
      intro:      ['category','mainMenu'],
      orderguide: ['storeName','firstLine'],
      notice:     ['storeName','story'],
      menuname:   ['currentName','category'],
      menudesc:   ['menuName','taste'],
      menuoption: form.mode === 'board' ? ['menuBoard'] : form.mode === 'diagnose' ? [] : ['menuName','basePrice'],
      reply:      ['storeName','review','rating'],
    }[type] || []);
    if (required.some(k => !form[k])) { alert('필수 항목(*)을 모두 입력해주세요.'); return; }
    if (type === 'menuoption' && form.mode === 'diagnose' && !form.currentOptions && images.length === 0) {
      alert('옵션 화면 캡처를 올리거나, 옵션 구성을 텍스트로 붙여넣어 주세요.'); return;
    }
    setLoading(true); setResult(''); setStructured(null); setVariants(null); setCopiedG(null); setCopied(false);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          storeInfo: (type === 'menuoption' && form.mode === 'diagnose')
            ? { ...form, images: images.map(({ media_type, data }) => ({ media_type, data })) }
            : form,
        }),
      });
      if (res.status === 429) {
        setResult('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      const raw = data.result || data.error || '오류가 발생했습니다.';
      if (type === 'menuoption') {
        const { text, json } = splitStructured(raw);
        setResult(text); setStructured(json);
      } else if (IMPROVABLE.has(type) && form.workMode !== 'improve') {
        const v = parseVariants(raw);
        if (v) { setVariants(v); setResult(''); }
        else { setResult(raw); }
        setStructured(null);
      } else { setResult(raw); setStructured(null); }
    } catch { setResult('서버 연결 오류가 발생했습니다.'); }
    setLoading(false);
  }

  function copy() {
    navigator.clipboard.writeText(extractFinal(result));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function refine(instruction) {
    const base = extractFinal(result);
    if (!base || refining) return;
    setRefining(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'refine', storeInfo: { target: type, instruction, text: base } }),
      });
      if (res.status === 429) { alert('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'); setRefining(false); return; }
      const data = await res.json();
      if (data.result) setResult(data.result.trim());
    } catch { /* 유지 */ }
    setRefining(false);
  }

  async function addImages(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setImgBusy(true);
    const added = [];
    for (const file of files) {
      if (images.length + added.length >= 6) break;
      try { added.push(...await processCapture(file)); }
      catch { alert(`${file.name} 처리에 실패했습니다.`); }
    }
    setImages(prev => [...prev, ...added].slice(0, 6));
    setImgBusy(false);
  }

  const showPreset = ['intro','notice','menuname','menudesc'].includes(type) && form.workMode !== 'improve';
  const flashStyle = { background: flash ? 'rgba(232,168,56,.18)' : '#0d0f10', transition: 'background .4s' };
  const showIdentityHint = ['intro','orderguide','notice','menuname','menudesc','menuoption'].includes(type);
  const isMenuoption = type === 'menuoption';

  return (
    <div style={s.page}>
      {!bare && (
        <div style={s.head}>
          <div style={s.title}>{tool?.emoji} {LABELS[type]}</div>
          <div style={s.sub}>가게 정보를 입력하면 AI가 문구를 생성해드립니다</div>
        </div>
      )}

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

        {IMPROVABLE.has(type) && (
          <div style={S.modeTabs}>
            <button style={{...S.modeTab, ...(form.workMode !== 'improve' ? S.modeTabActive : {})}} onClick={() => set('workMode', 'new')} className='modeTab'>✍️ 새로 만들기</button>
            <button style={{...S.modeTab, ...(form.workMode === 'improve' ? S.modeTabActive : {})}} onClick={() => set('workMode', 'improve')} className='modeTab'>✏️ 기존 문구 개선</button>
          </div>
        )}

        {IMPROVABLE.has(type) && form.workMode === 'improve' && <>
          <Field
            label="현재 문구 *"
            placeholder={`지금 배민에 등록돼 있는 문구를 그대로 붙여넣으세요.
약점을 진단하고, 담긴 사실·정체성은 살려서 교정해드립니다.`}
            value={form.currentCopy}
            onChange={v=>set('currentCopy',v)}
            textarea tall
            flash={flashStyle}
          />
          <Field label="강조하고 싶은 점 (선택)" placeholder="예: 국내산 재료를 더 부각, 신메뉴 언급 추가" value={form.emphasis} onChange={v=>set('emphasis',v)} flash={flashStyle} />
        </>}

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

        {type==='intro' && form.workMode !== 'improve' && <>
          <div style={S.row}>
            <Field label="업종 *" placeholder="예: 제육볶음 전문점, 치킨집" value={form.category} onChange={v=>set('category',v)} flash={flashStyle} />
            <Field label="대표 메뉴 *" placeholder="예: 직화 제육볶음, 후라이드" value={form.mainMenu} onChange={v=>set('mainMenu',v)} flash={flashStyle} />
          </div>
          <Field label="특징/차별점" placeholder="예: 직화 불맛, 15년 전통, 국내산 재료" value={form.feature} onChange={v=>set('feature',v)} flash={flashStyle} />
          <Field label="운영 특이사항" placeholder="예: 1인분 주문 가능, 새벽 영업, 단체 주문 환영" value={form.style} onChange={v=>set('style',v)} flash={flashStyle} />
        </>}

        {type==='notice' && form.workMode !== 'improve' && <>
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

        {type==='menudesc' && form.workMode !== 'improve' && <>
          <Field label="메뉴명 *" placeholder="예: 직화 불향 제육볶음" value={form.menuName} onChange={v=>set('menuName',v)} flash={flashStyle} />
          <Field label="맛·식감 *" placeholder="예: 불향 가득한 촉촉한 제육, 매콤달콤" value={form.taste} onChange={v=>set('taste',v)} flash={flashStyle} />
          <Field label="구성·용량" placeholder="예: 공기밥 포함, 350g, 1~2인분" value={form.compose} onChange={v=>set('compose',v)} flash={flashStyle} />
        </>}

        {type==='orderguide' && form.workMode !== 'improve' && <>
          <Field label="가게명·업종 *" placeholder="예: 영일이아구찜 (아구찜 전문점)" value={form.storeName} onChange={v=>set('storeName',v)} flash={flashStyle} />
          <Field label="첫 줄 후크 *" placeholder="예: 「배달팁 0원 + 리뷰 사이드 4종」 30년 비법 시그니처" value={form.firstLine} onChange={v=>set('firstLine',v)} flash={flashStyle} />
          <Field label="진행 중인 이벤트·할인" placeholder="예: 즉시할인 5,000원, 첫 주문 쿠폰, 리뷰 이벤트" value={form.event} onChange={v=>set('event',v)} flash={flashStyle} />
          <Field label="강조할 대표메뉴" placeholder="예: 30년 비법 시그니처 아구찜, 된장술밥 세트" value={form.featuredMenu} onChange={v=>set('featuredMenu',v)} flash={flashStyle} />
          <Field label="시즌·운영 특이사항" placeholder="예: 겨울 한정 굴 추가, 새벽 영업, 단체 주문 환영" value={form.extraNotice} onChange={v=>set('extraNotice',v)} textarea flash={flashStyle} />
        </>}

        {type==='menuoption' && <>
          <div style={S.modeTabs}>
            <button style={{...S.modeTab, ...(form.mode !== 'board' && form.mode !== 'diagnose' ? S.modeTabActive : {})}} onClick={() => set('mode', 'single')} className='modeTab'>단일 메뉴</button>
            <button style={{...S.modeTab, ...(form.mode === 'board' ? S.modeTabActive : {})}} onClick={() => set('mode', 'board')} className='modeTab'>📋 메뉴판 전체 ★</button>
            <button style={{...S.modeTab, ...(form.mode === 'diagnose' ? S.modeTabActive : {})}} onClick={() => set('mode', 'diagnose')} className='modeTab'>🔍 옵션 진단</button>
          </div>

          {form.mode !== 'board' && form.mode !== 'diagnose' && <>
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

          {form.mode === 'diagnose' && <>
            <div style={S.field}>
              <label style={S.flabel}>배민 옵션 화면 캡처 <span style={{color:'#f0b942',fontWeight:700}}>★ 추천</span></label>
              <input id='diagImgInput' type='file' accept='image/*' multiple style={{ display:'none' }}
                onChange={e => { addImages(e.target.files); e.target.value=''; }} />
              <div
                style={{ ...ii.drop, ...(dragOver ? ii.dropOver : {}) }}
                onClick={() => document.getElementById('diagImgInput').click()}
                onDragOver={e => { e.preventDefault(); if (!dragOver) setDragOver(true); }}
                onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
                onDrop={e => {
                  e.preventDefault(); setDragOver(false);
                  const imgs = Array.from(e.dataTransfer.files || []).filter(fl => fl.type.startsWith('image/'));
                  if (imgs.length) addImages(imgs);
                }}
              >
                <div style={ii.dropIcon}>{imgBusy ? '⏳' : '📷'}</div>
                <div style={ii.dropMain}>{imgBusy ? '이미지 처리 중…' : '캡처를 여기로 끌어다 놓거나 클릭해서 업로드'}</div>
                <div style={ii.dropSub}>배민 옵션 화면 캡처 · 최대 6장 · 긴 캡처는 자동 분할</div>
              </div>
              {images.length > 0 && (
                <div style={ii.thumbRow}>
                  {images.map((im, i) => (
                    <div key={i} style={ii.thumb}>
                      <img src={im.preview} alt='' style={ii.thumbImg} />
                      <button style={ii.thumbX} onClick={() => setImages(arr => arr.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Field
              label="옵션 구성 텍스트 (캡처 없이 텍스트만도 가능)"
              placeholder={`배민 셀프서비스(사장님광장) 옵션 화면을 그대로 옮겨 적으세요. 형식 자유. 예:

[필수] 맵기 선택 (1개)
- 순한맛 0원 / 중간맛 0원 / 아주매운맛 0원
[선택] 토핑 추가 (최대 3개)
- 모짜렐라치즈 2,000원
- 차돌박이 3,900원
[선택] 사이드 (최대 2개)
- 군만두 5,000원
- 김말이튀김 5,000원`}
              value={form.currentOptions}
              onChange={v=>set('currentOptions',v)}
              textarea tall
              flash={flashStyle}
            />
            <Field label="메뉴판 (선택)" placeholder="메뉴판도 주시면 빠진 레버를 더 정확히 짚습니다" value={form.menuBoard} onChange={v=>set('menuBoard',v)} textarea flash={flashStyle} />
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

        {variants && (
          <div style={vt.wrap}>
            <div style={vt.title}>3가지 톤 — 마음에 드는 안을 고르세요</div>
            {variants.map((v, i) => (
              <div key={i} style={vt.card}>
                <div style={vt.head}>
                  <span style={vt.vlabel}>{v.label}</span>
                  <span style={vt.count}>{v.text.length}자</span>
                  <button style={vt.btn} className='gcopy' onClick={() => { navigator.clipboard.writeText(v.text); setCopiedG('v' + i); setTimeout(() => setCopiedG(null), 1500); }}>
                    {copiedG === 'v' + i ? '✓ 복사됨' : '복사'}
                  </button>
                  <button style={{ ...vt.btn, ...vt.btnMain }} onClick={() => { setResult(v.text); setVariants(null); }}>
                    이 안으로 다듬기
                  </button>
                </div>
                <pre style={vt.vtext}>{v.text}</pre>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div style={S.resultWrap}>
            <div style={S.resultLabel}>생성된 문구 · {extractFinal(result).length}자</div>
            <pre style={S.resultText}>{result}</pre>
            {showIdentityHint && (
              <div style={S.resultHint}>💡 이 제안에서 영감과 힌트를 얻어 사장님만의 정체성을 더해주세요</div>
            )}
            <div style={S.resultActions}>
              <button style={S.copyBtn} onClick={copy}>{copied ? '✓ 복사됨' : '복사하기'}</button>
              <button style={S.regenBtn} onClick={generate}>다시 생성</button>
            </div>
            {CHIP_TYPES.has(type) && (
              <div style={vt.chipRow}>
                <span style={vt.chipLabel}>다듬기</span>
                {CHIPS.map(c => (
                  <button key={c.label} disabled={refining} style={{ ...vt.chip, opacity: refining ? 0.45 : 1 }} className='gcopy' onClick={() => refine(c.instr)}>
                    {c.label}
                  </button>
                ))}
                {refining && <span style={vt.chipBusy}>다듬는 중…</span>}
              </div>
            )}
          </div>
        )}

        {structured && (
          <div style={st.wrap}>
            <div style={st.secTitle}>📋 배민 입력 규격 — 그대로 옮겨 적으세요</div>
            {(structured.optionGroups || []).map((g, i) => (
              <div key={i} style={st.gcard}>
                <div style={st.ghead}>
                  <span style={{ ...st.badge, ...(g.required ? st.badgeReq : st.badgeOpt) }}>{g.required ? '필수' : '선택'}</span>
                  <span style={st.gname}>{g.name}</span>
                  <span style={st.gminmax}>최소 {g.min ?? 0} ~ 최대 {g.max ?? 1}</span>
                  <button style={st.gcopy} className='gcopy' onClick={() => { navigator.clipboard.writeText(groupToText(g)); setCopiedG(i); setTimeout(() => setCopiedG(null), 1600); }}>
                    {copiedG === i ? '✓ 복사됨' : '복사'}
                  </button>
                </div>
                {g.purpose && <div style={st.gpurpose}>{g.purpose}</div>}
                {(g.options || []).map((o, j) => (
                  <div key={j} style={st.orow}>
                    <span style={st.oname}>{o.name}</span>
                    {o.note && <span style={st.onote}>{o.note}</span>}
                    <span style={st.oprice}>+{won(o.price)}원</span>
                  </div>
                ))}
              </div>
            ))}
            <button style={st.copyAll} className='gcopy' onClick={() => { navigator.clipboard.writeText(allGroupsText(structured)); setCopiedG('all'); setTimeout(() => setCopiedG(null), 1600); }}>
              {copiedG === 'all' ? '✓ 전체 구성 복사됨' : '전체 구성 복사'}
            </button>

            {structured.simulation && Array.isArray(structured.simulation.scenarios) && structured.simulation.scenarios.length > 0 && (
              <div style={st.sim}>
                <div style={st.secTitle}>📊 객단가 시뮬레이션</div>
                {structured.simulation.note && <div style={st.simNote}>{structured.simulation.note}</div>}
                {structured.simulation.scenarios.map((sc, i) => (
                  <div key={i} style={st.simRow}>
                    <div style={st.simTop}>
                      <span style={st.simLabel}>{sc.label}</span>
                      <span style={st.simAov}>{won(sc.aovBefore)}원 → <b style={{ color: '#f0b942' }}>{won(sc.aovAfter)}원</b></span>
                      <span style={st.simLift}>+{sc.liftPct}%</span>
                    </div>
                    {sc.assumption && <div style={st.simAssume}>{sc.assumption}</div>}
                  </div>
                ))}
                <div style={st.simCaution}>* 선택률 가정 기반 추정치입니다. 실제 결과와 다를 수 있습니다.</div>
              </div>
            )}
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

function Field({ label, placeholder, value, onChange, textarea, tall, flash }) {
  const inputStyle = { ...S.finput, ...(flash || {}) };
  return (
    <div style={S.field}>
      <label style={S.flabel}>{label}</label>
      {textarea
        ? <textarea style={{ ...inputStyle, height: tall ? '190px' : '80px', resize:'vertical' }} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
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

// 구조화 결과(배민 규격 카드·시뮬레이션) 전용 스타일
const st = {
  wrap: { marginTop:'16px', display:'flex', flexDirection:'column', gap:'10px' },
  secTitle: { fontSize:'13.5px', fontWeight:800, color:'#f0b942', margin:'6px 0 2px' },
  gcard: { background:'#16130f', border:'1px solid #34302a', borderRadius:'11px', padding:'12px 14px' },
  ghead: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' },
  badge: { fontSize:'10.5px', fontWeight:800, padding:'3px 8px', borderRadius:'999px', flexShrink:0 },
  badgeReq: { background:'rgba(232,90,60,.15)', color:'#f08a6a', border:'1px solid rgba(232,90,60,.3)' },
  badgeOpt: { background:'rgba(232,168,56,.13)', color:'#f0b942', border:'1px solid rgba(232,168,56,.3)' },
  gname: { fontSize:'14px', fontWeight:700, color:'#f2f0ea', flex:1 },
  gminmax: { fontSize:'11px', color:'#9a8f78', flexShrink:0 },
  gcopy: { flexShrink:0, background:'none', border:'1px solid rgba(232,168,56,.4)', color:'#f0b942', fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'7px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  gpurpose: { fontSize:'11.5px', color:'#9a8f78', marginBottom:'8px' },
  orow: { display:'flex', alignItems:'center', gap:'8px', padding:'6px 2px', borderTop:'1px solid #24211b' },
  oname: { fontSize:'13px', color:'#e8ede8', flex:1 },
  onote: { fontSize:'10.5px', color:'#9a8f78', background:'#1e1a14', border:'1px solid #2c281f', padding:'2px 7px', borderRadius:'999px', flexShrink:0 },
  oprice: { fontSize:'13px', fontWeight:700, color:'#f0b942', flexShrink:0, minWidth:'72px', textAlign:'right' },
  copyAll: { width:'100%', background:'rgba(232,168,56,.1)', border:'1px solid rgba(232,168,56,.35)', color:'#f0b942', fontSize:'13px', fontWeight:700, padding:'10px', borderRadius:'9px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  sim: { marginTop:'6px', background:'#16130f', border:'1px solid #34302a', borderRadius:'11px', padding:'12px 14px' },
  simNote: { fontSize:'12px', color:'#9a8f78', marginBottom:'8px', lineHeight:1.55 },
  simRow: { borderTop:'1px solid #24211b', padding:'8px 2px' },
  simTop: { display:'flex', alignItems:'center', gap:'10px' },
  simLabel: { fontSize:'11px', fontWeight:800, color:'#e8ede8', background:'#1e1a14', border:'1px solid #2c281f', padding:'3px 9px', borderRadius:'999px', flexShrink:0 },
  simAov: { fontSize:'13px', color:'#c9c2b4', flex:1 },
  simLift: { fontSize:'13px', fontWeight:800, color:'#f0b942', flexShrink:0 },
  simAssume: { fontSize:'11.5px', color:'#8a8070', marginTop:'4px' },
  simCaution: { fontSize:'10.5px', color:'#6e6455', marginTop:'10px' },
};

// 3안 카드·다듬기 칩 스타일
const vt = {
  wrap: { marginTop:'14px', display:'flex', flexDirection:'column', gap:'10px' },
  title: { fontSize:'13.5px', fontWeight:800, color:'#f0b942' },
  card: { background:'#16130f', border:'1px solid #34302a', borderRadius:'11px', padding:'12px 14px' },
  head: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', flexWrap:'wrap' },
  vlabel: { fontSize:'11px', fontWeight:800, color:'#f0b942', background:'rgba(232,168,56,.12)', border:'1px solid rgba(232,168,56,.3)', padding:'3px 10px', borderRadius:'999px' },
  count: { fontSize:'11px', color:'#9a8f78', flex:1 },
  btn: { background:'none', border:'1px solid rgba(232,168,56,.4)', color:'#f0b942', fontSize:'11px', fontWeight:700, padding:'4px 10px', borderRadius:'7px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  btnMain: { background:'rgba(232,168,56,.12)' },
  vtext: { margin:0, fontSize:'13px', lineHeight:1.7, color:'#e8ede8', whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'inherit' },
  chipRow: { display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginTop:'10px', paddingTop:'10px', borderTop:'1px solid #24211b' },
  chipLabel: { fontSize:'11px', fontWeight:700, color:'#9a8f78', marginRight:'2px' },
  chip: { background:'#1e1a14', border:'1px solid #33302a', color:'#c9c2b4', fontSize:'11.5px', fontWeight:600, padding:'5px 11px', borderRadius:'999px', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  chipBusy: { fontSize:'11px', color:'#f0b942' },
};

// 캡처 업로드 스타일
const ii = {
  drop: { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'5px', textAlign:'center', padding:'22px 16px', background:'rgba(232,168,56,.05)', border:'1.5px dashed rgba(232,168,56,.4)', borderRadius:'11px', cursor:'pointer', transition:'all .15s' },
  dropOver: { background:'rgba(232,168,56,.14)', borderColor:'rgba(232,168,56,.75)' },
  dropIcon: { fontSize:'24px' },
  dropMain: { fontSize:'13px', fontWeight:700, color:'#e8ede8' },
  dropSub: { fontSize:'11px', color:'#9a8f78' },
  thumbRow: { display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'10px' },
  thumb: { position:'relative', width:'64px', height:'96px', borderRadius:'8px', overflow:'hidden', border:'1px solid #34302a', background:'#0d0b09' },
  thumbImg: { width:'100%', height:'100%', objectFit:'cover', objectPosition:'top', display:'block' },
  thumbX: { position:'absolute', top:'3px', right:'3px', width:'18px', height:'18px', borderRadius:'50%', background:'rgba(0,0,0,.65)', border:'none', color:'#f2f0ea', fontSize:'10px', cursor:'pointer', lineHeight:1, padding:0 },
};
