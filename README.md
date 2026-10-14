# 🎓 GUT (연암공과대학교 동문 커리어 멘토링 플랫폼)

> **연암공과대학교 학생들과 현업 동문 선배들을 연결하는 1:1 맞춤형 커리어 멘토링 웹 서비스**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Web-orange.svg)
![Backend](https://img.shields.io/badge/database-Supabase-emerald.svg)

---

## 📌 프로젝트 소개 (Overview)

**GUT(Good Mentoring for Yonam Univ. of Technology)**는 연암공과대학교 재학생(멘티)들이 취업 준비, 자격증, 학점 관리, 직무 적합성 등 진로 고민을 등록하고, LG 계열사 등 다양한 산업 현장에 진출해 있는 동문 멘토 선배들로부터 진솔하고 전문적인 조언을 얻을 수 있는 멘토링 플랫폼입니다.

---

## ✨ 주요 기능 (Key Features)

1. **동문 멘토 탐색 및 프로필 상세 보기** (`index.html`)
   - 직무별(설비/공정/생산기술/품질 등) 동문 멘토 필터링
   - 멘토의 합격 스펙, 취업 전략, 후배를 위한 팁 열람
2. **1:1 멘토링 신청 (질문 등록)**
   - 멘티 학생 정보(학번, 이름, 학과 등)와 핵심 질문 1, 2 작성
   - 자신이 노력한 과정(스펙 준비 상황)을 함께 작성하여 밀도 높은 질의응답 유도
3. **실시간 멘토링 현황 게시판** (`requests.html`)
   - 접수된 모든 멘토링 질문 목록 및 실시간 상태(대기중, 답변완료, 거절) 조회
   - 멘토 선배의 상세 답변 보기 및 멘티의 후속 확인
4. **멘토 전용 답변/수정 및 정중한 거절 인터페이스** (`mentor-answer.html`)
   - 멘토의 정성 어린 답변 작성 및 임시저장 기능
   - 작성 완료 후 답변 수정 모드 지원
   - 일정 또는 직무 사유로 인한 정중한 거절 처리 기능
5. **Supabase 클라우드 데이터베이스 연동** (`supabase-client.js`)
   - 회원, 멘토 프로필, 질문 요청, 답변 데이터 영구 저장 및 동기화
   - 네트워크 단절 시 LocalStorage 폴백 지원

---

## 📂 프로젝트 구조 (Project Structure)

```plaintext
GUT/
├── .env.example          # 환경 변수 템플릿 파일
├── .gitignore            # Git 관리 제외 목록 (.env, IDE 파일 등)
├── index.html            # 메인 홈, 멘토 목록 및 1:1 멘토링 신청 화면
├── requests.html         # 멘토링 요청 및 답변 현황 게시판
├── mentor-answer.html    # 멘토 전용 답변 작성 / 수정 / 거절 인터페이스
├── supabase-client.js    # Supabase REST API & JavaScript 연동 헬퍼
├── supabase_schema.sql   # PostgreSQL 기반 테이블 DDL 및 초기 데이터 셋업 스크립트
├── logo.png              # 플랫폼 및 학교 로고 이미지
└── README.md             # 프로젝트 안내 문서
```

---

## 🚀 빠른 시작 (Getting Started)

### 1. 로컬 환경에서 실행
GUT는 별도의 복잡한 빌드 과정 없이 정적 웹 브라우저 환경에서 즉시 실행할 수 있습니다.
- `index.html` 파일을 더블 클릭하여 브라우저에서 실행하거나,
- VS Code의 **Live Server** 확장 프로그램을 사용하여 실행할 수 있습니다.

```bash
# 또는 간단한 로컬 HTTP 서버 실행
npx serve .
# 또는 Python 내장 웹서버
python -m http.server 8080
```

### 2. 데이터베이스 설정 (Supabase)
1. [Supabase](https://supabase.com/)에서 새 프로젝트를 생성합니다.
2. 프로젝트의 **SQL Editor**로 이동하여 `supabase_schema.sql` 파일의 내용을 붙여넣고 실행(Run)합니다.
3. `supabase-client.js` 파일의 상단 `SUPABASE_CONFIG`에 프로젝트의 **URL**과 **Anon Public Key**를 입력합니다.
   ```javascript
   const SUPABASE_CONFIG = {
     url: 'https://your-project-id.supabase.co',
     anonKey: 'your-public-anon-key'
   };
   ```

---

## 🔒 보안 및 환경 변수 가이드

- `SUPABASE_SERVICE_ROLE_KEY`와 같은 관리자 비밀 키는 클라이언트에 절대 노출되어서는 안 되며, `.gitignore`를 통해 Git 추적에서 제외됩니다.
- 공개된 저장소에는 `anonKey`(공개 클라이언트 키)만 안전한 RLS(Row-Level Security) 규칙과 함께 사용됩니다.

---

## 🤝 라이선스 (License)

This project is licensed under the MIT License.
