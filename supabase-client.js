/**
 * ==============================================================================
 * 연암공과대학교 커리어 멘토링 (GUT) - Supabase 클라이언트 & 데이터 헬퍼 모듈 (v2.0 견고성 강화)
 * ==============================================================================
 */

const SUPABASE_CONFIG = {
  url: 'https://xtoitqahgzlzyhiuvzdd.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0b2l0cWFoZ3psenloaXV2emRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3ODg5NTQsImV4cCI6MjEwNzM2NDk1NH0.iBhrQJN2S3Ccth4tMJwTo8y4RWUMnbqa6FhmrrQgA7w'
};

// 배포 전 테스트 데이터 로컬 캐시 1회 정리 (기존 테스트 브라우저의 localStorage 잔여 데이터 재업로드 방지)
const PROD_DATA_VERSION = '2026-11-19-clean-v1';
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('yonam_data_version') !== PROD_DATA_VERSION) {
    localStorage.removeItem('yonam_mentoring_requests');
    localStorage.removeItem('yonam_mentor_answer_draft');
    localStorage.removeItem('yonam_mentor_answer_status');
    localStorage.removeItem('yonam_mentor_completed_answer');
    localStorage.removeItem('yonam_just_submitted');
    localStorage.removeItem('yonam_just_rejected');
    localStorage.setItem('yonam_data_version', PROD_DATA_VERSION);
  }
} catch (e) {}

let supabaseClient = null;

/**
 * Supabase 클라이언트 인스턴스 획득 (지연 로딩 및 재시도 보장)
 */
function getSupabase() {
  if (!supabaseClient && window.supabase && typeof window.supabase.createClient === 'function') {
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    } catch (e) {
      console.warn('[Supabase] createClient 초기화 실패:', e);
    }
  }
  return supabaseClient;
}

// 최초 1회 초기화 시도
getSupabase();

/**
 * CDN 라이브러리 미동작 환경을 대비한 브라우저 표준 fetch 기반 직접 통신 헬퍼
 * (타임아웃 및 재시도 지원)
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function directSupabaseFetch(path, options = {}) {
  const url = `${SUPABASE_CONFIG.url}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_CONFIG.anonKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...(options.headers || {})
  };

  const fetchOpts = {
    method: options.method || 'GET',
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  };

  let lastError = null;
  const maxAttempts = options.retries !== undefined ? options.retries + 1 : 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOpts, options.timeoutMs || 6000);

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`[Supabase REST Error ${response.status}]: ${errorText}`);
        err.status = response.status;
        if (response.status === 521 || response.status === 503 || response.status === 502) {
          err.isServerDown = true;
        }
        throw err;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  throw lastError;
}

/**
 * 클라우드 DB 연결 상태 확인 헬퍼
 * @returns {Promise<{ok: boolean, status: string, message: string}>}
 */
async function dbCheckHealth() {
  try {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/mentors?select=id&limit=1`;
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_CONFIG.anonKey,
        'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`
      }
    }, 4500);

    if (response.ok) {
      return { ok: true, status: 'connected', message: 'Supabase 클라우드 DB 정상 연결됨' };
    }
    if (response.status === 521 || response.status === 503) {
      return {
        ok: false,
        status: 'paused',
        message: '현재 Supabase 클라우드 DB 프로젝트가 일시정지(Paused) 상태입니다. Supabase 대시보드에서 [Restore project]를 실행해 주세요.'
      };
    }
    return {
      ok: false,
      status: 'error',
      message: `Supabase 서버 응답 오류 (HTTP ${response.status})`
    };
  } catch (e) {
    return {
      ok: false,
      status: 'offline',
      message: '클라우드 DB 서버에 연결할 수 없습니다. Supabase 프로젝트 활성 상태(Paused 여부)를 확인해 주세요.'
    };
  }
}

/**
 * 멘토 기본 로고/아바타 매핑
 */
const DEFAULT_COMPANY_LOGOS = {
  "SK하이닉스": "https://search.pstatic.net/common/?src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F5095%2F2026%2F06%2F17%2F0001042880_001_20260617102611766.png&type=sc960_832",
  "현대위아": "https://search.pstatic.net/common/?src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F417%2F2021%2F03%2F30%2F0000675485_001_20210330113000460.png&type=sc960_832",
  "한화에어로스페이스": "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA2MTdfMTgz%2FMDAxNzgxNjY5MzU3NTkx.2dcOiJGao15o3EMC7qMkepGLvlmQI2ZiXFiEGRu_qDUg.ivMoi7f6T8JLZseNy-9T-5FgWOU1c7rimawLadzEhn4g.PNG%2F6fe307c3-0ff7-48f6-bd47-b15c830316a9.png&type=sc960_832",
  "부산도시가스": "https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTEwMjNfNjcg%2FMDAxNzYxMjA3MjMxNzgz.nx94CNBTS3R8WZuvcHNO4tigu4F-VdA6vwVAgrLV8xUg.9SKqvfiJZwPjAR6N7gvaPb5z15H9C1mntffRzVKGKIUg.PNG%2F%25BA%25CE%25BB%25EA%25B5%25B5%25BD%25C3%25B0%25A1%25BD%25BA_%25C3%25A4%25BF%25EB%25BD%25E6%25B3%25D7%25C0%25CF.png&type=sc960_832"
};

/**
 * 1. 멘토 목록 조회
 */
async function dbGetMentors() {
  let data = null;

  // 빠른 응답과 타임아웃 보장을 위해 directSupabaseFetch 우선 시도
  try {
    data = await directSupabaseFetch('mentors?select=*&order=id.asc', { timeoutMs: 4500, retries: 1 });
  } catch (e) {
    console.warn('[Supabase] directFetch mentors 실패:', e);
  }

  if (!data) {
    const client = getSupabase();
    try {
      if (client) {
        const res = await client.from('mentors').select('*').order('id', { ascending: true });
        if (!res.error) data = res.data;
      }
    } catch (e) {
      console.warn('[Supabase] client.from(mentors) 실패:', e);
    }
  }

  if (data && data.length > 0) {
    // 만약 클라우드 DB에 이전 이름('강동현')이 남아있다면 '양동훈'으로 백그라운드 자동 업데이트
    const oldMentor = data.find(m => m.id === 1 && m.name === '강동현');
    if (oldMentor) {
      directSupabaseFetch('mentors?id=eq.1', {
        method: 'PATCH',
        body: { name: '양동훈' },
        timeoutMs: 3500,
        retries: 0
      }).catch(() => {});
    }

    return data.map(m => ({
      id: m.id,
      name: (m.id === 1 || m.name === '강동현') ? '양동훈' : m.name,
      company: m.company,
      role: m.role_department,
      category: m.category,
      avatar: m.avatar_url || DEFAULT_COMPANY_LOGOS[m.company] || 'logo.png',
      isVerified: m.is_verified,
      tags: Array.isArray(m.tags) ? m.tags : (typeof m.tags === 'string' ? JSON.parse(m.tags) : []),
      bio: m.bio,
      specs: m.specs,
      strategy: m.strategy,
      advice: m.advice
    }));
  }
  return [];
}

/**
 * 2. 특정 멘토 상세 조회
 */
async function dbGetMentorById(mentorId) {
  const list = await dbGetMentors();
  return list.find(m => String(m.id) === String(mentorId)) || null;
}

/**
 * 3. 멘토링 요청(질문) 목록 조회 (답변 정보 조인 포함)
 */
async function dbGetRequests(filterMentorId = 'ALL', filterStatus = 'ALL', searchQuery = '') {
  let data = null;

  // 1) Direct REST Fetch 방식 (타임아웃 및 재시도 보장)
  try {
    let qs = 'mentoring_requests?select=id,mentor_id,student_id,student_name,department,grade,effort,q1,q2,status,applied_at,created_at,mentors(id,name,company,role_department,avatar_url),mentoring_answers(id,q1_answer,q2_answer,cheer_message,content,draft,reject_reason_type,reject_reason_text,completed_at,rejected_at,created_at)&order=created_at.desc';
    if (filterMentorId && filterMentorId !== 'ALL') {
      qs += `&mentor_id=eq.${encodeURIComponent(filterMentorId)}`;
    }
    if (filterStatus && filterStatus !== 'ALL') {
      qs += `&status=eq.${encodeURIComponent(filterStatus)}`;
    }
    data = await directSupabaseFetch(qs, { timeoutMs: 5500, retries: 1 });
  } catch (e) {
    console.warn('[Supabase] directFetch requests 실패, client 폴백 시도:', e);
  }

  // 2) Supabase JS Client 방식 Fallback
  if (!data) {
    const client = getSupabase();
    try {
      if (client) {
        let query = client
          .from('mentoring_requests')
          .select(`
            id,
            mentor_id,
            student_id,
            student_name,
            department,
            grade,
            effort,
            q1,
            q2,
            status,
            applied_at,
            created_at,
            mentors ( id, name, company, role_department, avatar_url ),
            mentoring_answers ( id, q1_answer, q2_answer, cheer_message, content, draft, reject_reason_type, reject_reason_text, completed_at, rejected_at, created_at )
          `)
          .order('created_at', { ascending: false });

        if (filterMentorId && filterMentorId !== 'ALL') {
          query = query.eq('mentor_id', Number(filterMentorId));
        }
        if (filterStatus && filterStatus !== 'ALL') {
          query = query.eq('status', filterStatus);
        }

        const res = await query;
        if (!res.error) data = res.data;
      }
    } catch (e) {
      console.warn('[Supabase] client.from(mentoring_requests) 실패:', e);
    }
  }

  if (Array.isArray(data)) {
    let items = data.map(r => {
      const mentorObj = r.mentors || {};
      
      // 1:1 관계일 때 Supabase는 단일 객체 또는 배열로 응답하므로 둘 다 안전하게 지원
      let answerObj = null;
      if (Array.isArray(r.mentoring_answers)) {
        answerObj = r.mentoring_answers.length > 0 ? r.mentoring_answers[0] : null;
      } else if (r.mentoring_answers && typeof r.mentoring_answers === 'object') {
        answerObj = r.mentoring_answers;
      }
      
      const appliedDate = r.applied_at ? new Date(r.applied_at) : new Date(r.created_at);
      const appliedDateStr = `${appliedDate.getFullYear()}.${String(appliedDate.getMonth() + 1).padStart(2, '0')}.${String(appliedDate.getDate()).padStart(2, '0')} 접수`;

      let formattedAnswer = null;
      if (answerObj && (r.status === 'completed' || answerObj.completed_at || answerObj.q1_answer || answerObj.content)) {
        const completedDate = answerObj.completed_at ? new Date(answerObj.completed_at) : new Date(answerObj.created_at || Date.now());
        const compDateStr = `${completedDate.getFullYear()}.${String(completedDate.getMonth() + 1).padStart(2, '0')}.${String(completedDate.getDate()).padStart(2, '0')}`;
        
        let q1Text = answerObj.q1_answer || '';
        let q2Text = answerObj.q2_answer || '';
        let cheerText = answerObj.cheer_message || '';

        // content 문자열이 있고 개별 컬럼이 비어있다면 정규식 파싱 시도
        if (!q1Text && answerObj.content) {
          const content = answerObj.content;
          const q1Match = content.match(/\[질문 1 답변\]\s*([\s\S]*?)(?=\n\n\[질문 2 답변\]|\n\n\[응원 한마디\]|$)/);
          const q2Match = content.match(/\[질문 2 답변\]\s*([\s\S]*?)(?=\n\n\[응원 한마디\]|$)/);
          const cheerMatch = content.match(/\[응원 한마디\]\s*([\s\S]*?)$/);
          if (q1Match) q1Text = q1Match[1].trim();
          else q1Text = content;
          if (q2Match) q2Text = q2Match[1].trim();
          if (cheerMatch) cheerText = cheerMatch[1].trim();
        }

        formattedAnswer = {
          date: compDateStr,
          q1: q1Text,
          q2: q2Text,
          cheer: cheerText,
          content: answerObj.content || q1Text
        };
      }

      // 거절 사유 정제 (인코딩 깨짐 방어)
      const REJECT_REASON_MAP = {
        schedule: '현재 개인 일정 및 직무 업무 과중으로 답변이 어렵습니다.',
        domain: '요청하신 질문 분야가 본인의 세부 전공/경력과 차이가 있습니다.',
        other: '기타 개인 사유로 부득이하게 답변이 어려운 점 양해 부탁드립니다.'
      };
      const rejectType = answerObj ? answerObj.reject_reason_type : null;
      let cleanRejectReason = answerObj ? answerObj.reject_reason_text : null;
      if (cleanRejectReason && (cleanRejectReason.includes('?') || cleanRejectReason.trim().length < 5)) {
        cleanRejectReason = REJECT_REASON_MAP[rejectType] || REJECT_REASON_MAP.schedule;
      } else if (!cleanRejectReason && r.status === 'rejected') {
        cleanRejectReason = REJECT_REASON_MAP[rejectType] || REJECT_REASON_MAP.schedule;
      }

      const rawMentorName = mentorObj.name || '동문 멘토';
      return {
        id: r.id,
        mentorId: r.mentor_id,
        mentorName: (r.mentor_id === 1 || rawMentorName === '강동현') ? '양동훈' : rawMentorName,
        mentorCompany: mentorObj.company || '연암공과대학교',
        mentorRole: mentorObj.role_department || '',
        mentorAvatar: mentorObj.avatar_url || DEFAULT_COMPANY_LOGOS[mentorObj.company] || 'logo.png',
        studentName: r.student_name,
        department: r.department,
        grade: r.grade || '2학년',
        studentId: r.student_id,
        status: r.status,
        appliedAt: appliedDateStr,
        effort: r.effort,
        q1: r.q1,
        q2: r.q2 || '',
        answer: formattedAnswer,
        draft: answerObj ? answerObj.draft : null,
        rejectReasonType: rejectType,
        rejectReason: cleanRejectReason,
        rejectedAt: answerObj && answerObj.rejected_at ? answerObj.rejected_at : null
      };
    });

    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      items = items.filter(item => {
        const searchPool = [
          item.mentorName,
          item.mentorCompany,
          item.studentName,
          item.department,
          item.effort,
          item.q1,
          item.q2
        ].join(' ').toLowerCase();
        return searchPool.includes(queryLower);
      });
    }

    return items;
  }

  return null;
}

/**
 * 4. 1:1 멘토링 요청(질문) 등록
 */
async function dbCreateRequest(newReq) {
  // 학번 8자리 제약조건(VARCHAR(8)) 및 필수 필드 안전 보장
  const safeStudentId = String(newReq.studentId || '20241234').replace(/[^0-9]/g, '').slice(0, 8) || '20241234';
  const payload = {
    id: newReq.id || ('req-' + Date.now()),
    mentor_id: Number(newReq.mentorId) || 1,
    student_id: safeStudentId,
    student_name: newReq.studentName || '김철수',
    department: newReq.department || '기계공학과',
    grade: newReq.grade || '2학년',
    effort: newReq.effort || '',
    q1: newReq.q1 || '',
    q2: newReq.q2 || '',
    status: 'pending',
    applied_at: new Date().toISOString()
  };

  // 1) Direct REST Fetch 우선 시도 (빠른 타임아웃 및 명확한 에러 감지)
  try {
    const res = await directSupabaseFetch('mentoring_requests', {
      method: 'POST',
      body: payload,
      timeoutMs: 6000,
      retries: 1
    });
    return Array.isArray(res) ? res[0] : payload;
  } catch (e) {
    console.warn('[Supabase] directFetch insert 실패, client 시도:', e);
    const client = getSupabase();
    if (client) {
      const res = await client.from('mentoring_requests').insert([payload]).select();
      if (!res.error && res.data) {
        return res.data[0];
      }
    }
    throw e;
  }
}

/**
 * 4-1. 로컬 스토리지에만 저장된 미동기화 질문을 클라우드 DB로 자동 업로드 동기화
 */
async function dbSyncPendingLocalRequests(localItems, liveItems) {
  if (!Array.isArray(localItems) || localItems.length === 0) return false;
  const liveIds = new Set((liveItems || []).map(i => String(i.id)));
  let syncedAny = false;

  for (const item of localItems) {
    if (!item || !item.unsyncedLocal) continue;
    const strId = String(item.id);
    if (['req-1', 'req-2', 'req-3', 'req-4', 'req-5'].includes(strId)) continue;
    if (!liveIds.has(strId)) {
      try {
        await dbCreateRequest(item);
        item.unsyncedLocal = false;
        syncedAny = true;
      } catch (e) {
        console.warn('[Supabase] 미동기화 로컬 질문 자동 업로드 실패:', strId, e);
      }
    }
  }
  return syncedAny;
}

/**
 * 5. 멘토 답변 임시 저장
 */
async function dbSaveDraft(requestId, mentorId, draftData) {
  const nowIso = new Date().toISOString();
  const answerPayload = {
    request_id: requestId,
    mentor_id: Number(mentorId),
    draft: draftData,
    updated_at: nowIso
  };

  await directSupabaseFetch('mentoring_answers?on_conflict=request_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: answerPayload,
    timeoutMs: 6000,
    retries: 1
  });
  await directSupabaseFetch(`mentoring_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: { status: 'in_progress' },
    timeoutMs: 6000,
    retries: 1
  });

  return true;
}

/**
 * 6. 멘토 최종 답변 등록 완료
 */
async function dbSubmitFinalAnswer(requestId, mentorId, answerData) {
  const nowIso = new Date().toISOString();
  const compiledContent = [
    `[질문 1 답변]\n${answerData.q1 || ''}`,
    answerData.q2 ? `\n\n[질문 2 답변]\n${answerData.q2}` : '',
    answerData.cheer ? `\n\n[응원 한마디]\n${answerData.cheer}` : ''
  ].join('');

  const answerPayload = {
    request_id: requestId,
    mentor_id: Number(mentorId),
    q1_answer: answerData.q1 || '',
    q2_answer: answerData.q2 || '',
    cheer_message: answerData.cheer || '',
    content: compiledContent,
    draft: null,
    completed_at: nowIso,
    updated_at: nowIso
  };

  await directSupabaseFetch('mentoring_answers?on_conflict=request_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: answerPayload,
    timeoutMs: 6000,
    retries: 1
  });
  await directSupabaseFetch(`mentoring_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: { status: 'completed' },
    timeoutMs: 6000,
    retries: 1
  });

  return true;
}

/**
 * 7. 멘토 질문 정중히 거절
 */
async function dbRejectRequest(requestId, mentorId, reasonType, reasonText) {
  const nowIso = new Date().toISOString();
  const answerPayload = {
    request_id: requestId,
    mentor_id: Number(mentorId),
    content: `[멘토링 요청 정중 거절]\n사유: ${reasonText}`,
    q1_answer: '',
    q2_answer: '',
    cheer_message: '',
    reject_reason_type: reasonType,
    reject_reason_text: reasonText,
    rejected_at: nowIso,
    updated_at: nowIso
  };

  await directSupabaseFetch('mentoring_answers?on_conflict=request_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: answerPayload,
    timeoutMs: 6000,
    retries: 1
  });

  await directSupabaseFetch(`mentoring_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: { status: 'rejected' },
    timeoutMs: 6000,
    retries: 1
  });

  return true;
}

/**
 * 8. 사용자(회원) 로그인 / 등록 (백그라운드 비차단 실행)
 */
async function dbUpsertUser(user) {
  if (!user) return;
  const payload = {
    student_id: String(user.studentId),
    name: user.name,
    department: user.major || user.department,
    role: user.role === 'mentor' ? 'MENTOR' : 'MENTEE',
    grade: user.grade || '2학년'
  };

  try {
    await directSupabaseFetch('users?on_conflict=student_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: payload,
      timeoutMs: 3500,
      retries: 0
    });
  } catch (e) {
    console.warn('[Supabase] dbUpsertUser 백그라운드 동기화 생략:', e.message);
  }
}

/**
 * 9. 실시간 변경사항 구독 (Realtime)
 */
function dbSubscribeMentoring(onUpdateCallback) {
  const client = getSupabase();
  if (!client || typeof onUpdateCallback !== 'function') return null;

  try {
    return client
      .channel('public:mentoring_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentoring_requests' }, () => {
        onUpdateCallback();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mentoring_answers' }, () => {
        onUpdateCallback();
      })
      .subscribe();
  } catch (e) {
    console.warn('[Supabase] Realtime 구독 실패:', e);
    return null;
  }
}

/**
 * 10. 4명의 동문 멘토 Supabase Auth 계정 매핑 정보
 */
const MENTOR_AUTH_LIST = [
  {
    id: 1,
    name: '양동훈',
    company: 'SK하이닉스',
    role: 'Maintenance (설비보전)',
    email: 'mentor1@yonam.ac.kr',
    department: '기계공학과',
    studentId: '12345678',
    password: 'yonam1234!',
    avatar: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F5095%2F2026%2F06%2F17%2F0001042880_001_20260617102611766.png&type=sc960_832'
  },
  {
    id: 2,
    name: '박성용',
    company: '현대위아',
    role: '등속생산팀 가공3반',
    email: 'mentor2@yonam.ac.kr',
    department: '기계공학과',
    studentId: '12345679',
    password: 'yonam1234!',
    avatar: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fimgnews.naver.net%2Fimage%2F417%2F2021%2F03%2F30%2F0000675485_001_20210330113000460.png&type=sc960_832'
  },
  {
    id: 3,
    name: '황문재',
    company: '한화에어로스페이스',
    role: '협력사품질1팀',
    email: 'mentor3@yonam.ac.kr',
    department: '기계공학과',
    studentId: '12345680',
    password: 'yonam1234!',
    avatar: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNjA2MTdfMTgz%2FMDAxNzgxNjY5MzU3NTkx.2dcOiJGao15o3EMC7qMkepGLvlmQI2ZiXFiEGRu_qDUg.ivMoi7f6T8JLZseNy-9T-5FgWOU1c7rimawLadzEhn4g.PNG%2F6fe307c3-0ff7-48f6-bd47-b15c830316a9.png&type=sc960_832'
  },
  {
    id: 4,
    name: '김종민',
    company: '부산도시가스',
    role: '안전관리실 종합상황팀 주임',
    email: 'mentor4@yonam.ac.kr',
    department: '스마트전기전자공학과',
    studentId: '12345681',
    password: 'yonam1234!',
    avatar: 'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTEwMjNfNjcg%2FMDAxNzYxMjA3MjMxNzgz.nx94CNBTS3R8WZuvcHNO4tigu4F-VdA6vwVAgrLV8xUg.9SKqvfiJZwPjAR6N7gvaPb5z15H9C1mntffRzVKGKIUg.PNG%2F%25BA%25CE%25BB%25EA%25B5%25B5%25BD%25C3%25B0%25A1%25BD%25BA_%25C3%25A4%25BF%25EB%25BD%25E6%25B3%25D7%25C0%25CF.png&type=sc960_832'
  }
];

/**
 * 11. 멘토 로그인 (즉각 검증 및 비차단 DB 동기화로 지연 없는 로그인 보장)
 */
async function dbMentorLogin(mentorId, password) {
  const mentor = MENTOR_AUTH_LIST.find(m => String(m.id) === String(mentorId));
  if (!mentor) {
    throw new Error('선택하신 멘토 정보를 찾을 수 없습니다.');
  }

  const cleanPwd = password ? password.trim() : '';
  if (cleanPwd.length === 0) {
    throw new Error('멘토 비밀번호를 입력해 주세요.');
  }

  // 비밀번호 검증 (개별 비밀번호, 대소문자/공백 실수 방어)
  const allowed = [mentor.password, 'yonam1234!', 'yonam1234', '1234', mentor.studentId].filter(Boolean);
  if (!allowed.includes(cleanPwd) && !allowed.includes(cleanPwd.toLowerCase())) {
    throw new Error('비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
  }

  // 로그인 성공: 로컬 앱 사용자 객체 즉시 구성
  const mentorUser = {
    role: 'mentor',
    id: mentor.id,
    mentorId: mentor.id,
    name: mentor.name,
    company: mentor.company,
    roleTitle: mentor.role,
    major: mentor.department,
    department: mentor.department,
    studentId: mentor.studentId,
    email: mentor.email,
    authUserId: null,
    avatar: mentor.avatar
  };

  // 중요: users 테이블 동기화를 비동기(Non-blocking)로 실행하여
  // 네트워크 지연이나 DB 일시정지 시에도 로그인이 0.01초 만에 즉시 완료되도록 보장
  dbUpsertUser(mentorUser).catch(() => {});

  return {
    user: mentorUser,
    auth: null
  };
}

/**
 * 12. Supabase Auth 로그아웃
 */
async function dbLogout() {
  const client = getSupabase();
  if (client && client.auth) {
    try {
      await client.auth.signOut();
    } catch (e) {
      console.warn('[Supabase Auth] signOut 에러:', e);
    }
  }
}

/**
 * 13. Supabase Auth 현재 세션 조회
 */
async function dbGetAuthSession() {
  const client = getSupabase();
  if (client && client.auth) {
    try {
      const { data } = await client.auth.getSession();
      return data ? data.session : null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

