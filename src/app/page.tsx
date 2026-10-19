"use client";

import { useEffect, useState, FormEvent } from "react";
import { supabase, LeaveRequest } from "@/lib/supabase";
import { getAuthErrorMessage } from "@/lib/errorHandler";
import LeaveCalendar from "@/components/LeaveCalendar";
import { calculateWorkdays } from "@/lib/workdayHelper";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // 사용자 역할 상태 ('팀원' | '팀장' | null)
  const [userRole, setUserRole] = useState<"팀원" | "팀장" | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // 좌측 사이드바 메뉴 탭 ('홈' | '내 신청' | '결재함' | '일정' | '설정')
  const [activeNav, setActiveNav] = useState<"홈" | "내 신청" | "결재함" | "일정" | "설정">("결재함");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 상단 필터 탭 ('전체' | '대기' | '완료')
  const [filterTab, setFilterTab] = useState<"전체" | "대기" | "완료">("전체");

  // 새 요청 모달 상태
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // 인증 폼 상태 ('login' | 'signup')
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // 연차 신청 폼 상태
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  // 연차 신청 목록 상태 (RLS가 반환한 데이터를 수신)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // 상태 초기화 헬퍼 (로그아웃 시 모든 데이터 초기화)
  const clearAllUserData = () => {
    setUser(null);
    setUserRole(null);
    setLeaveRequests([]);
    setStartDate("");
    setEndDate("");
    setReason("");
    setRequestError(null);
    setRequestSuccess(null);
    setAuthEmail("");
    setAuthPassword("");
    setAuthError(null);
    setActiveNav("결재함");
    setFilterTab("전체");
    setIsRequestModalOpen(false);
  };

  // 1. 초기 세션 확인 및 인증 상태 구독
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        if (session?.user) {
          setUser(session.user);
        } else {
          clearAllUserData();
        }
        setSessionLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        if (session?.user) {
          setUser(session.user);
        } else {
          clearAllUserData();
        }
        setSessionLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. 로그인한 이메일로 members에서 역할 조회
  const fetchUserRole = async (email: string) => {
    setRoleLoading(true);
    try {
      const { data, error } = await supabase
        .from("members")
        .select("role, 역할")
        .eq("email", email)
        .maybeSingle();

      if (!error && data) {
        const rawRole = (data as any).role || (data as any)["역할"];
        if (rawRole === "팀장") {
          setUserRole("팀장");
        } else if (rawRole === "팀원" || rawRole === "직원") {
          setUserRole("팀원");
        } else {
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
    } catch (err) {
      console.error("역할 조회 예외:", err);
      setUserRole(null);
    } finally {
      setRoleLoading(false);
    }
  };

  // 3. 연차 신청 목록 조회 (RLS 규칙에 따라 DB가 반환한 결과를 그대로 수신)
  const fetchLeaveRequests = async () => {
    setTableLoading(true);
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("목록 조회 실패:", error);
        setLeaveRequests([]);
      } else {
        setLeaveRequests((data as LeaveRequest[]) || []);
      }
    } catch (err) {
      console.error("목록 조회 예외:", err);
      setLeaveRequests([]);
    } finally {
      setTableLoading(false);
    }
  };

  // 전체 데이터 갱신 (역할 + 목록)
  const refreshAll = async () => {
    if (user?.email) {
      await Promise.all([fetchUserRole(user.email), fetchLeaveRequests()]);
    }
  };

  useEffect(() => {
    if (user?.email) {
      fetchUserRole(user.email);
      fetchLeaveRequests();
    } else {
      setUserRole(null);
      setLeaveRequests([]);
    }
  }, [user]);

  // 4. 로그인 / 회원가입 제출 처리
  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const emailTrimmed = authEmail.trim();
    if (!emailTrimmed) {
      setAuthError("이메일을 입력해 주세요.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("비밀번호는 6자 이상으로 해 주세요");
      return;
    }

    setAuthSubmitting(true);
    try {
      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: emailTrimmed,
          password: authPassword,
        });

        if (error) {
          setAuthError(getAuthErrorMessage(error));
        } else if (data.user) {
          setUser(data.user);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: emailTrimmed,
          password: authPassword,
        });

        if (error) {
          setAuthError(getAuthErrorMessage(error));
        } else {
          if (data.session?.user) {
            setUser(data.session.user);
          } else {
            const { data: loginData, error: loginError } =
              await supabase.auth.signInWithPassword({
                email: emailTrimmed,
                password: authPassword,
              });

            if (loginError) {
              setAuthError(getAuthErrorMessage(loginError));
            } else if (loginData.user) {
              setUser(loginData.user);
            }
          }
        }
      }
    } catch (err: any) {
      setAuthError(getAuthErrorMessage(err));
    } finally {
      setAuthSubmitting(false);
    }
  };

  // 5. 로그아웃 (화면에 있던 신청·명단 정보를 모두 완전 초기화)
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    clearAllUserData();
  };

  // 6. 팀원: 연차 신청 제출
  const handleCreateRequest = async (e: FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    if (!user || !user.email) {
      setRequestError("로그인이 필요합니다.");
      return;
    }

    if (userRole !== "팀원") {
      setRequestError("연차 신청 권한이 없습니다.");
      return;
    }

    if (!startDate || !endDate || !reason.trim()) {
      setRequestError("시작일, 종료일, 사유를 모두 입력해 주세요.");
      return;
    }

    if (startDate > endDate) {
      setRequestError("종료일은 시작일보다 이전일 수 없습니다.");
      return;
    }

    const { workdays } = calculateWorkdays(startDate, endDate);
    if (workdays === 0) {
      setRequestError(
        "선택하신 기간은 모두 주말 또는 공휴일이어서 실제 사용할 수 있는 연차가 0일입니다."
      );
      return;
    }

    setRequestSubmitting(true);
    try {
      const { error } = await supabase.from("leave_requests").insert([
        {
          email: user.email,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
          status: "대기",
        },
      ]);

      if (error) {
        setRequestError(`신청 중 오류가 발생했습니다 (${error.message})`);
      } else {
        setRequestSuccess("연차 신청이 완료되었습니다.");
        setStartDate("");
        setEndDate("");
        setReason("");
        await fetchLeaveRequests();
        setTimeout(() => {
          setRequestSuccess(null);
          setIsRequestModalOpen(false);
        }, 1200);
      }
    } catch (err: any) {
      setRequestError(
        `신청 처리 중 예외가 발생했습니다 (${err?.message || err})`
      );
    } finally {
      setRequestSubmitting(false);
    }
  };

  // 7. 팀장: '대기' 건에 대한 승인('처리')/반려('보류') 상태 변경
  const handleUpdateStatus = async (
    id: number,
    newStatus: "승인" | "반려"
  ) => {
    if (userRole !== "팀장") {
      alert("승인 및 반려 권한은 '팀장'에게만 있습니다.");
      return;
    }

    setActionLoadingId(id);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) {
        alert(`상태 변경 중 오류가 발생했습니다 (${error.message})`);
      } else {
        setLeaveRequests((prev) =>
          prev.map((req) =>
            req.id === id ? { ...req, status: newStatus } : req
          )
        );
      }
    } catch (err: any) {
      alert(`상태 변경 실패 (${err?.message || err})`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 이름 추출 헬퍼 (이메일 앞부분)
  const getUserDisplayName = (email?: string | null) => {
    return email ? email.split("@")[0] : "";
  };

  // 아바타 원형 첫 글자 이니셜
  const getInitial = (email?: string | null) => {
    const name = getUserDisplayName(email);
    return name ? name.charAt(0).toUpperCase() : "U";
  };

  // 날짜 간결 포맷 (예: 10월 21일)
  const formatDateDisplay = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        return `${month}월 ${day}일`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // 로딩 화면
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f4]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-solid border-[#0075de] border-r-transparent"></div>
          <p className="mt-3 text-sm text-[#615d59]">
            사용자 인증 정보를 확인하는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  // A. 비로그인 상태 (로그인/가입 화면)
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f4] px-4 py-12">
        <div className="w-full max-w-md rounded-[16px] bg-[#ffffff] p-8 border border-[#e6e6e6] notion-shadow-elevated">
          <div className="text-center mb-6">
            <span className="text-3xl">🌴</span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#000000]">
              업무 포털 · 연차 신청함
            </h1>
            <p className="mt-1 text-sm text-[#615d59]">
              연차 신청 및 승인·반려 관리를 위해 로그인해 주세요.
            </p>
          </div>

          {/* 모드 전환 탭 */}
          <div className="flex rounded-[8px] bg-[#f6f5f4] p-1 mb-6 border border-[#e6e6e6]">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
              className={`flex-1 rounded-[6px] py-1.5 text-sm font-medium transition ${
                authMode === "login"
                  ? "bg-[#ffffff] text-[#000000] notion-shadow-soft"
                  : "text-[#615d59] hover:text-[#000000]"
              }`}
            >
              로그인
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setAuthError(null);
              }}
              className={`flex-1 rounded-[6px] py-1.5 text-sm font-medium transition ${
                authMode === "signup"
                  ? "bg-[#ffffff] text-[#000000] notion-shadow-soft"
                  : "text-[#615d59] hover:text-[#000000]"
              }`}
            >
              회원가입
            </button>
          </div>

          {authError && (
            <div className="mb-4 rounded-[8px] bg-[#dd5b00]/10 border border-[#dd5b00]/25 p-3 text-xs text-[#793400] flex items-start gap-2">
              <span className="text-[#dd5b00] font-bold shrink-0">⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#615d59] mb-1.5">
                이메일 주소
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-[4px] border border-[#e6e6e6] bg-[#ffffff] px-3 py-2 text-sm text-[#000000] placeholder:text-[#a39e98] focus:border-[#0075de] focus:outline-none focus:ring-1 focus:ring-[#0075de] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#615d59] mb-1.5">
                비밀번호
              </label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="6자 이상 입력"
                className="w-full rounded-[4px] border border-[#e6e6e6] bg-[#ffffff] px-3 py-2 text-sm text-[#000000] placeholder:text-[#a39e98] focus:border-[#0075de] focus:outline-none focus:ring-1 focus:ring-[#0075de] transition"
              />
              <p className="mt-1 text-xs text-[#a39e98]">
                * 비밀번호는 6자 이상이어야 합니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full rounded-full bg-[#0075de] py-2.5 text-sm font-medium text-[#ffffff] hover:bg-[#005bab] active:scale-[0.99] transition disabled:opacity-50"
            >
              {authSubmitting
                ? "처리 중..."
                : authMode === "login"
                ? "로그인하기"
                : "가입하고 시작하기"}
            </button>
          </form>

          <div className="mt-6 border-t border-[#e6e6e6] pt-4 text-center">
            <p className="text-xs text-[#a39e98]">
              확인 메일 설정이 해제되어 있어 가입 즉시 자동으로 로그인됩니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // members에 없는 사용자인 경우 안내
  if (!roleLoading && !userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f4] px-4">
        <div className="w-full max-w-md rounded-[16px] border border-[#e6e6e6] bg-[#ffffff] p-8 text-center notion-shadow-soft">
          <span className="text-4xl">🚫</span>
          <h2 className="mt-4 text-lg font-bold text-[#000000]">
            명단에 없습니다. 관리자에게 등록을 요청하세요
          </h2>
          <p className="mt-2 text-xs text-[#615d59]">
            접속 계정: {user.email}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={refreshAll}
              disabled={roleLoading}
              className="rounded-[8px] border border-[#e6e6e6] bg-white px-4 py-2 text-xs font-medium text-[#31302e] hover:bg-[#f6f5f4] transition"
            >
              🔄 새로고침
            </button>
            <button
              onClick={handleSignOut}
              className="rounded-[8px] bg-[#18181b] px-4 py-2 text-xs font-medium text-white hover:bg-[#27272a] transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 역할에 따른 데이터 세트 구성
  // 팀원이면 본인 신청건 기준 ("내 신청"), 팀장이면 DB에서 전달받은 전체 신청건 표시
  const baseRequests =
    userRole === "팀원" && activeNav === "내 신청"
      ? leaveRequests.filter((item) => item.email === user.email)
      : leaveRequests;

  // 상단 3개 요약 카운트 계산
  const pendingCount = baseRequests.filter((r) => r.status === "대기").length;
  const approvedCount = baseRequests.filter((r) => r.status === "승인").length;
  const rejectedCount = baseRequests.filter((r) => r.status === "반려").length;

  // 탭 필터링 ('전체' | '대기' | '완료')
  const filteredRequests = baseRequests.filter((item) => {
    if (filterTab === "대기") return item.status === "대기";
    if (filterTab === "완료") return item.status === "승인" || item.status === "반려";
    return true;
  });

  const navMenuItems: Array<"홈" | "내 신청" | "결재함" | "일정" | "설정"> = [
    "홈",
    "내 신청",
    "결재함",
    "일정",
    "설정",
  ];

  return (
    <div className="min-h-screen bg-[#f6f5f4] text-[#000000] flex flex-col md:flex-row">
      {/* ─────────────────────────────────────────────────────────────
          1. 좌측 다크 사이드바 (캡쳐 레이아웃 완벽 반영)
      ───────────────────────────────────────────────────────────── */}
      {/* 모바일 상단 바 */}
      <div className="md:hidden flex items-center justify-between bg-[#191919] text-white px-4 py-3 border-b border-[#262626]">
        <span className="font-bold text-base tracking-tight">업무 포털</span>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="text-xs text-[#a1a1aa] border border-[#3f3f46] px-2.5 py-1 rounded-[6px]"
        >
          {isMobileMenuOpen ? "닫기" : "메뉴"}
        </button>
      </div>

      <aside
        className={`${
          isMobileMenuOpen ? "block" : "hidden"
        } md:flex flex-col justify-between w-full md:w-56 md:min-h-screen bg-[#191919] text-white p-5 border-r border-[#262626] shrink-0 z-20`}
      >
        <div>
          {/* 상단 포털 로고/명칭 */}
          <div className="mb-8 hidden md:block">
            <h1 className="text-xl font-bold tracking-tight text-white">
              업무 포털
            </h1>
          </div>

          {/* 사이드바 메뉴 목록 */}
          <nav className="space-y-1.5">
            {navMenuItems.map((item) => {
              const isActive = activeNav === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setActiveNav(item);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-[8px] text-sm transition font-medium ${
                    isActive
                      ? "bg-[#27272a] text-white shadow-sm"
                      : "text-[#9ca3af] hover:text-white hover:bg-white/5 font-normal"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 사이드바 하단 프로필 영역 (김하늘 · 경영지원팀 형태) */}
        <div className="pt-6 border-t border-[#262626] mt-6">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">
                {getUserDisplayName(user.email)} · {userRole}
              </p>
              <p className="text-[11px] text-[#71717a] truncate mt-0.5">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              title="로그아웃"
              className="text-[11px] text-[#a1a1aa] hover:text-white transition px-2 py-1 rounded-[4px] hover:bg-white/10 shrink-0 ml-1"
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. 우측 메인 컨텐츠 영역
      ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 p-6 sm:p-10 max-w-6xl overflow-y-auto">
        {/* 상단 헤더: 타이틀 + 설명 + 우측 '새 요청' 버튼 */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#000000] tracking-tight">
              {activeNav === "결재함"
                ? "결재함"
                : activeNav === "내 신청"
                ? "내 신청"
                : activeNav === "일정"
                ? "일정"
                : activeNav === "홈"
                ? "업무 포털"
                : "설정"}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#71717a]">
              {activeNav === "결재함"
                ? "팀원이 올린 요청을 확인하고 처리합니다"
                : activeNav === "내 신청"
                ? "본인이 제출한 연차 신청 내역을 확인합니다"
                : activeNav === "일정"
                ? "팀원들의 승인된 연차 일정을 확인합니다"
                : activeNav === "홈"
                ? "전체 업무 현황과 휴가 일정을 한눈에 확인합니다"
                : "계정 및 포털 환경 설정을 확인합니다"}
            </p>
          </div>

          <div className="flex items-center gap-3 self-start">
            {/* 권한 뱃지 표기 */}
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-[#e6e6e6] text-xs text-[#52525b]">
              <span>{user.email}</span>
              <span className="font-bold text-[#000000]">「{userRole}」</span>
            </div>

            {/* 새 요청 버튼 */}
            <button
              type="button"
              onClick={() => {
                if (userRole === "팀원") {
                  setIsRequestModalOpen(true);
                } else {
                  alert("팀장은 결재 및 승인 권한자입니다. 연차 신청은 팀원 계정으로 가능합니다.");
                }
              }}
              className="rounded-[8px] bg-[#18181b] hover:bg-[#27272a] px-4 py-2 text-sm font-medium text-white transition active:scale-[0.98] shadow-sm flex items-center gap-1"
            >
              새 요청
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────
            뷰 1: '일정' (승인된 연차 캘린더 전용 뷰)
        ───────────────────────────────────────────────────────── */}
        {activeNav === "일정" && (
          <div className="space-y-6">
            <LeaveCalendar leaveRequests={leaveRequests} />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────
            뷰 2: '설정' (계정 및 환경 정보)
        ───────────────────────────────────────────────────────── */}
        {activeNav === "설정" && (
          <div className="space-y-6">
            <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft max-w-xl">
              <h3 className="text-base font-bold text-[#000000] mb-4">계정 정보</h3>
              <div className="space-y-3 text-sm text-[#31302e]">
                <div className="flex justify-between py-2 border-b border-[#e6e6e6]">
                  <span className="text-[#71717a]">이메일</span>
                  <span className="font-medium text-[#000000]">{user.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#e6e6e6]">
                  <span className="text-[#71717a]">현재 권한</span>
                  <span className="font-semibold text-[#0075de]">「{userRole}」</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[#e6e6e6]">
                  <span className="text-[#71717a]">데이터베이스 연결</span>
                  <span className="text-[#1aae39] font-medium">● 정상 작동 중</span>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-[#e6e6e6] flex justify-end">
                <button
                  onClick={handleSignOut}
                  className="rounded-[8px] bg-[#18181b] px-4 py-2 text-xs font-medium text-white hover:bg-[#27272a] transition"
                >
                  로그아웃
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────
            뷰 3: '홈' (대시보드: 요약 지표 + 캘린더 + 최근 내역)
        ───────────────────────────────────────────────────────── */}
        {activeNav === "홈" && (
          <div className="space-y-8">
            {/* 요약 메트릭 카드 3개 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft">
                <p className="text-xs font-medium text-[#71717a]">처리 대기</p>
                <p className="mt-2 text-3xl font-extrabold text-[#000000]">{pendingCount}</p>
              </div>
              <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft">
                <p className="text-xs font-medium text-[#71717a]">이번 달 처리</p>
                <p className="mt-2 text-3xl font-extrabold text-[#000000]">{approvedCount}</p>
              </div>
              <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft">
                <p className="text-xs font-medium text-[#71717a]">반려</p>
                <p className="mt-2 text-3xl font-extrabold text-[#000000]">{rejectedCount}</p>
              </div>
            </div>

            {/* 승인 일정 캘린더 */}
            <LeaveCalendar leaveRequests={leaveRequests} />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────
            뷰 4 & 5: '결재함' / '내 신청' (캡쳐 화면 레이아웃과 100% 동일)
        ───────────────────────────────────────────────────────── */}
        {(activeNav === "결재함" || activeNav === "내 신청") && (
          <div>
            {/* 3대 요약 카드 (처리 대기 / 이번 달 처리 / 반려) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
              <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft">
                <p className="text-xs font-medium text-[#71717a]">처리 대기</p>
                <p className="mt-2 text-3xl font-extrabold text-[#000000]">
                  {pendingCount}
                </p>
              </div>

              <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft">
                <p className="text-xs font-medium text-[#71717a]">이번 달 처리</p>
                <p className="mt-2 text-3xl font-extrabold text-[#000000]">
                  {approvedCount}
                </p>
              </div>

              <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft">
                <p className="text-xs font-medium text-[#71717a]">반려</p>
                <p className="mt-2 text-3xl font-extrabold text-[#000000]">
                  {rejectedCount}
                </p>
              </div>
            </div>

            {/* 필터 탭 (전체 | 대기 | 완료) */}
            <div className="flex items-center gap-6 border-b border-[#e6e6e6] mb-6">
              {(["전체", "대기", "완료"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={`pb-3 text-sm transition relative ${
                    filterTab === tab
                      ? "font-bold text-[#000000]"
                      : "font-medium text-[#a1a1aa] hover:text-[#000000]"
                  }`}
                >
                  {tab}
                  {filterTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#000000]" />
                  )}
                </button>
              ))}

              <div className="ml-auto pb-3 text-xs text-[#a1a1aa] flex items-center gap-2">
                <button
                  onClick={refreshAll}
                  disabled={tableLoading}
                  className="hover:text-black transition"
                  title="새로고침"
                >
                  🔄 {tableLoading ? "조회 중" : "새로고침"}
                </button>
              </div>
            </div>

            {/* 요청 카드 목록 (캡쳐 화면 리스트 카드 형태 완벽 구현) */}
            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="rounded-[16px] border border-[#e6e6e6] bg-white p-12 text-center notion-shadow-soft">
                  <p className="text-sm text-[#a1a1aa]">
                    {tableLoading
                      ? "데이터를 불러오는 중입니다..."
                      : "해당 내역이 없습니다."}
                  </p>
                </div>
              ) : (
                filteredRequests.map((item) => {
                  const { workdays } = calculateWorkdays(
                    item.start_date,
                    item.end_date
                  );
                  const isActing = actionLoadingId === item.id;
                  const displayName = getUserDisplayName(item.email);
                  const initial = getInitial(item.email);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[16px] border border-[#e6e6e6] bg-white p-4 sm:px-6 sm:py-4 notion-shadow-soft transition hover:border-[#d4d4d8]"
                    >
                      {/* 좌측: 원형 아바타 + 요청 제목 및 상세 */}
                      <div className="flex items-center gap-4">
                        {/* 원형 이니셜 아바타 */}
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f4f4f5] border border-[#e4e4e7] text-sm font-bold text-[#52525b]">
                          {initial}
                        </div>

                        {/* 상세 정보 */}
                        <div>
                          <h3 className="text-sm sm:text-base font-bold text-[#000000]">
                            {displayName} · 연차
                          </h3>
                          <p className="mt-0.5 text-xs text-[#71717a]">
                            <span>
                              {formatDateDisplay(item.start_date)} ~{" "}
                              {formatDateDisplay(item.end_date)}
                            </span>
                            <span className="ml-1 font-semibold text-[#0075de]">
                              ({workdays}일간)
                            </span>
                            <span className="mx-1.5 text-[#d4d4d8]">·</span>
                            <span>{item.reason}</span>
                          </p>
                        </div>
                      </div>

                      {/* 우측: 상태 뱃지 + 처리/보류 액션 버튼 */}
                      <div className="flex items-center gap-2.5 self-end sm:self-auto">
                        {/* 상태 뱃지 */}
                        {item.status === "대기" ? (
                          <span className="rounded-[6px] border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-1 text-xs font-medium text-[#52525b]">
                            대기
                          </span>
                        ) : item.status === "승인" ? (
                          <span className="rounded-[6px] border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-1 text-xs font-medium text-[#52525b]">
                            완료
                          </span>
                        ) : (
                          <span className="rounded-[6px] border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-1 text-xs font-medium text-[#71717a]">
                            반려
                          </span>
                        )}

                        {/* 팀장 전용: 대기 건에 대해 '처리'(승인), '보류'(반려) 버튼 노출 */}
                        {userRole === "팀장" && item.status === "대기" && (
                          <div className="flex items-center gap-1.5 ml-1">
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleUpdateStatus(item.id, "승인")}
                              className="rounded-[6px] bg-[#18181b] hover:bg-[#27272a] px-3.5 py-1.5 text-xs font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
                              title="승인 처리"
                            >
                              {isActing ? "..." : "처리"}
                            </button>
                            <button
                              type="button"
                              disabled={isActing}
                              onClick={() => handleUpdateStatus(item.id, "반려")}
                              className="rounded-[6px] border border-[#e4e4e7] bg-white hover:bg-[#f4f4f5] px-3.5 py-1.5 text-xs font-medium text-[#52525b] transition active:scale-[0.98] disabled:opacity-50"
                              title="반려 보류"
                            >
                              {isActing ? "..." : "보류"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* ─────────────────────────────────────────────────────────────
          3. 새 요청 (연차 신청) 모달 다이얼로그 (팀원 전용)
      ───────────────────────────────────────────────────────────── */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[16px] border border-[#e6e6e6] bg-white p-6 notion-shadow-elevated animate-in fade-in zoom-in-95 duration-150">
            {/* 모달 상단 헤더 */}
            <div className="flex items-center justify-between border-b border-[#e6e6e6] pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#000000]">새 연차 신청</h3>
                <p className="text-xs text-[#71717a]">
                  휴가 기간과 사유를 입력하여 연차를 신청합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRequestModalOpen(false);
                  setRequestError(null);
                  setRequestSuccess(null);
                }}
                className="text-[#a1a1aa] hover:text-[#000000] p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* 에러 및 성공 안내 */}
            {requestError && (
              <div className="mb-4 rounded-[8px] bg-[#dd5b00]/10 border border-[#dd5b00]/25 p-3 text-xs text-[#793400] flex items-start gap-2">
                <span className="text-[#dd5b00] font-bold">⚠️</span>
                <span>{requestError}</span>
              </div>
            )}

            {requestSuccess && (
              <div className="mb-4 rounded-[8px] bg-[#1aae39]/10 border border-[#1aae39]/25 p-3 text-xs text-[#0f6b23] flex items-start gap-2">
                <span className="text-[#1aae39] font-bold">✅</span>
                <span>{requestSuccess}</span>
              </div>
            )}

            {/* 입력 폼 */}
            <form onSubmit={handleCreateRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#52525b] mb-1.5">
                    시작일 <span className="text-[#dd5b00]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-[4px] border border-[#e6e6e6] bg-white px-3 py-2 text-sm text-[#000000] focus:border-[#0075de] focus:outline-none focus:ring-1 focus:ring-[#0075de] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#52525b] mb-1.5">
                    종료일 <span className="text-[#dd5b00]">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-[4px] border border-[#e6e6e6] bg-white px-3 py-2 text-sm text-[#000000] focus:border-[#0075de] focus:outline-none focus:ring-1 focus:ring-[#0075de] transition"
                  />
                </div>
              </div>

              {/* 영업일 및 주말/공휴일 제외 계산 미리보기 */}
              {startDate && endDate && startDate <= endDate && (() => {
                const result = calculateWorkdays(startDate, endDate);
                return (
                  <div className="rounded-[8px] bg-[#f6f5f4] border border-[#e6e6e6] p-3 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 font-bold text-[#000000]">
                      <span>📅 신청 기간:</span>
                      <span>{startDate} ~ {endDate}</span>
                      <span className="rounded-full bg-[#0075de] text-white px-2.5 py-0.5 text-[11px] font-medium">
                        실제 연차 {result.workdays}일 차감
                      </span>
                    </div>

                    {(result.weekendDays > 0 || result.holidayDays > 0) && (
                      <p className="text-[#615d59] text-[11px] font-normal pt-0.5">
                        * {result.weekendDays > 0 ? `주말 ${result.weekendDays}일` : ""}
                        {result.weekendDays > 0 && result.holidayDays > 0 ? " 및 " : ""}
                        {result.holidayDays > 0 ? `공휴일 ${result.holidayDays}일(${result.holidayNames.join(", ")})` : ""}
                        은 연차 일수에서 자동 제외되었습니다.
                      </p>
                    )}

                    {result.workdays === 0 && (
                      <p className="font-semibold text-[#dd5b00] text-[11px] pt-0.5">
                        ⚠️ 선택하신 기간은 주말/공휴일만 포함되어 있어 실제 사용할 수 있는 연차가 0일입니다.
                      </p>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-[#52525b] mb-1.5">
                  사유 <span className="text-[#dd5b00]">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="연차 사유를 작성해 주세요 (예: 개인 사유, 가족 행사, 휴식 등)"
                  className="w-full rounded-[4px] border border-[#e6e6e6] bg-white px-3 py-2 text-sm text-[#000000] placeholder:text-[#a39e98] focus:border-[#0075de] focus:outline-none focus:ring-1 focus:ring-[#0075de] transition"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#e6e6e6]">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-[8px] border border-[#e6e6e6] bg-white px-4 py-2 text-xs font-medium text-[#52525b] hover:bg-[#f6f5f4] transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={requestSubmitting}
                  className="rounded-[8px] bg-[#18181b] hover:bg-[#27272a] px-5 py-2 text-xs font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  {requestSubmitting ? "신청 중..." : "신청하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
