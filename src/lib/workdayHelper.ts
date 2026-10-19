// 대한민국 공휴일 목록 (2025 ~ 2027년)
const KOREAN_HOLIDAYS: Record<string, string> = {
  // 2025년
  "2025-01-01": "신정",
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  "2025-03-01": "삼일절",
  "2025-03-03": "대체공휴일(삼일절)",
  "2025-05-05": "어린이날",
  "2025-05-06": "대체공휴일(부처님오신날)",
  "2025-06-06": "현충일",
  "2025-08-15": "광복절",
  "2025-10-03": "개천절",
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  "2025-10-08": "대체공휴일(추석)",
  "2025-10-09": "한글날",
  "2025-12-25": "기독탄신일(성탄절)",

  // 2026년
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일(삼일절)",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일(개천절)",
  "2026-10-09": "한글날",
  "2026-12-25": "기독탄신일(성탄절)",

  // 2027년
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "대체공휴일(설날)",
  "2027-03-01": "삼일절",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-06-07": "대체공휴일(현충일)",
  "2027-08-15": "광복절",
  "2027-08-16": "대체공휴일(광복절)",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절",
  "2027-10-04": "대체공휴일(개천절)",
  "2027-10-09": "한글날",
  "2027-10-11": "대체공휴일(한글날)",
  "2027-12-25": "기독탄신일(성탄절)",
};

/**
 * 특정 날짜가 주말(토/일)인지 여부 반환
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0: 일요일, 6: 토요일
}

/**
 * 특정 날짜 문자열(YYYY-MM-DD)이 공휴일인지 여부 및 공휴일명 반환
 */
export function getHolidayName(dateStr: string): string | null {
  return KOREAN_HOLIDAYS[dateStr] || null;
}

/**
 * 특정 날짜가 영업일(평일이자 공휴일이 아님)인지 확인
 */
export function isWorkday(date: Date, dateStr: string): boolean {
  if (isWeekend(date)) return false;
  if (getHolidayName(dateStr)) return false;
  return true;
}

export interface WorkdayCalculationResult {
  totalCalendarDays: number; // 전체 달력 일수
  workdays: number;           // 실제 영업일(연차 차감 일수)
  weekendDays: number;        // 제외된 주말 일수
  holidayDays: number;        // 제외된 공휴일 일수
  holidayNames: string[];     // 제외된 공휴일 명칭 목록
  formattedSummary: string;   // 화면 표시용 요약 문구
}

/**
 * 시작일과 종료일(YYYY-MM-DD) 사이의 실제 영업일수 및 제외 내역 계산
 */
export function calculateWorkdays(
  startDateStr: string,
  endDateStr: string
): WorkdayCalculationResult {
  if (!startDateStr || !endDateStr || startDateStr > endDateStr) {
    return {
      totalCalendarDays: 0,
      workdays: 0,
      weekendDays: 0,
      holidayDays: 0,
      holidayNames: [],
      formattedSummary: "0일",
    };
  }

  const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split("-").map(Number);

  const start = new Date(sYear, sMonth - 1, sDay);
  const end = new Date(eYear, eMonth - 1, eDay);

  let current = new Date(start);
  let totalCalendarDays = 0;
  let workdays = 0;
  let weekendDays = 0;
  let holidayDays = 0;
  const holidayNames: string[] = [];

  while (current <= end) {
    totalCalendarDays++;

    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    const holiday = getHolidayName(dateStr);
    const weekend = isWeekend(current);

    if (weekend) {
      weekendDays++;
    } else if (holiday) {
      holidayDays++;
      if (!holidayNames.includes(holiday)) {
        holidayNames.push(holiday);
      }
    } else {
      workdays++;
    }

    // 다음 날로 이동
    current.setDate(current.getDate() + 1);
  }

  // 안내 요약 문자열 생성
  let summary = `${workdays}일`;
  const excludedParts: string[] = [];
  if (weekendDays > 0) excludedParts.push(`주말 ${weekendDays}일`);
  if (holidayDays > 0) excludedParts.push(`공휴일 ${holidayDays}일(${holidayNames.join(", ")})`);

  if (excludedParts.length > 0) {
    summary += ` (실제 차감, ${excludedParts.join(" 및 ")} 제외)`;
  }

  return {
    totalCalendarDays,
    workdays,
    weekendDays,
    holidayDays,
    holidayNames,
    formattedSummary: summary,
  };
}
