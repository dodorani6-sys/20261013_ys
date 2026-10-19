"use client";

import { useState } from "react";
import { LeaveRequest } from "@/lib/supabase";
import { getHolidayName, isWeekend } from "@/lib/workdayHelper";

interface LeaveCalendarProps {
  leaveRequests: LeaveRequest[];
}

export default function LeaveCalendar({ leaveRequests }: LeaveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 ~ 11

  // 이전 달로 이동
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  // 다음 달로 이동
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // 오늘 날짜로 이동
  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // 승인된 연차 목록만 필터링 (신청 사유는 일체 표기하지 않음)
  const approvedLeaves = leaveRequests.filter((req) => req.status === "승인");

  // 이번 달 1일의 요일 (0: 일요일 ~ 6: 토요일)
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  // 이번 달 마지막 날짜
  const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
  // 지난 달 마지막 날짜
  const lastDateOfPrevMonth = new Date(year, month, 0).getDate();

  // 달력 날짜 셀 타입
  type CalendarCell = {
    day: number;
    date: Date;
    dateStr: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    holidayName: string | null;
    isWeekendDay: boolean;
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: CalendarCell[] = [];

  // 1. 지난 달 날짜 채우기
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = lastDateOfPrevMonth - i;
    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(prevYear, prevMonth - 1, d);
    cells.push({
      day: d,
      date: dateObj,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      holidayName: getHolidayName(dateStr),
      isWeekendDay: isWeekend(dateObj),
    });
  }

  // 2. 이번 달 날짜 채우기
  for (let d = 1; d <= lastDateOfMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(year, month, d);
    cells.push({
      day: d,
      date: dateObj,
      dateStr,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      holidayName: getHolidayName(dateStr),
      isWeekendDay: isWeekend(dateObj),
    });
  }

  // 3. 다음 달 날짜 채우기 (7의 배수 맞춤: 35 또는 42일)
  const remainingCells = (7 - (cells.length % 7)) % 7;
  const nextMonthPadding = cells.length + remainingCells < 35 ? remainingCells + 7 : remainingCells;
  for (let d = 1; d <= nextMonthPadding; d++) {
    const nextMonth = month === 11 ? 1 : month + 2;
    const nextYear = month === 11 ? year + 1 : year;
    const dateStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(nextYear, nextMonth - 1, d);
    cells.push({
      day: d,
      date: dateObj,
      dateStr,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      holidayName: getHolidayName(dateStr),
      isWeekendDay: isWeekend(dateObj),
    });
  }

  // 특정 날짜에 포함되는 승인 연차 찾기 (영업일에만 표기)
  const getLeavesForDate = (dateStr: string, isWeekendDay: boolean, isHoliday: boolean) => {
    if (isWeekendDay || isHoliday) return [];
    return approvedLeaves.filter((leave) => {
      return leave.start_date <= dateStr && dateStr <= leave.end_date;
    });
  };

  // 이메일 앞부분 추출 헬퍼 (예: test2@example.com -> test2)
  const getUsername = (email: string) => {
    return email ? email.split("@")[0] : "";
  };

  // 스티커 팔레트 색상 분배
  const getBadgeColor = (email: string) => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      "bg-[#62aef0]/15 text-[#005bab] border-[#62aef0]/30",
      "bg-[#2a9d99]/15 text-[#1b6b68] border-[#2a9d99]/30",
      "bg-[#d6b6f6]/30 text-[#391c57] border-[#d6b6f6]/50",
      "bg-[#dd5b00]/15 text-[#793400] border-[#dd5b00]/30",
      "bg-[#1aae39]/15 text-[#0f6b23] border-[#1aae39]/30",
      "bg-[#ff64c8]/15 text-[#9e196e] border-[#ff64c8]/30",
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <section className="rounded-[12px] border border-[#e6e6e6] bg-white p-6 notion-shadow-soft">
      {/* 캘린더 상단 헤더: 년월 표시 및 이동 버튼 */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e6e6e6] pb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">📅</span>
          <div>
            <h2 className="text-lg font-bold text-[#000000] tracking-tight">
              {year}년 {month + 1}월 연차 일정
            </h2>
            <p className="text-xs text-[#615d59]">
              승인 완료된 연차 일정만 캘린더에 표시됩니다 (주말·공휴일 제외, 사유 비공개).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="rounded-[8px] border border-[#e6e6e6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#31302e] hover:bg-[#f6f5f4] hover:text-[#000000] transition active:scale-[0.98]"
            title="이전 달"
          >
            ◀ 이전 달
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="rounded-[8px] border border-[#e6e6e6] bg-white px-3 py-1.5 text-xs font-medium text-[#31302e] hover:bg-[#f6f5f4] hover:text-[#000000] transition active:scale-[0.98]"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="rounded-[8px] border border-[#e6e6e6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#31302e] hover:bg-[#f6f5f4] hover:text-[#000000] transition active:scale-[0.98]"
            title="다음 달"
          >
            다음 달 ▶
          </button>
        </div>
      </div>

      {/* 캘린더 본체 */}
      <div className="overflow-hidden rounded-[8px] border border-[#e6e6e6] bg-white">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-[#e6e6e6] bg-[#f6f5f4] text-center text-xs font-semibold py-2">
          <div className="text-[#dd5b00]">일</div>
          <div className="text-[#615d59]">월</div>
          <div className="text-[#615d59]">화</div>
          <div className="text-[#615d59]">수</div>
          <div className="text-[#615d59]">목</div>
          <div className="text-[#615d59]">금</div>
          <div className="text-[#0075de]">토</div>
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[#e6e6e6] bg-white">
          {cells.map((cell, idx) => {
            const dayOfWeek = idx % 7;
            const isRedDay = dayOfWeek === 0 || !!cell.holidayName;
            const leavesOnCell = getLeavesForDate(
              cell.dateStr,
              cell.isWeekendDay,
              !!cell.holidayName
            );

            return (
              <div
                key={cell.dateStr + idx}
                className={`min-h-[85px] sm:min-h-[96px] p-1.5 transition flex flex-col bg-white ${
                  !cell.isCurrentMonth
                    ? "bg-[#f6f5f4]/50 text-[#a39e98]"
                    : cell.isWeekendDay || cell.holidayName
                    ? "bg-[#f6f5f4]/25"
                    : ""
                } hover:bg-[#f6f5f4]/40`}
              >
                {/* 날짜 번호 및 공휴일 명칭 표시 */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      cell.isToday
                        ? "bg-[#0075de] text-white font-bold"
                        : cell.isCurrentMonth
                        ? isRedDay
                          ? "text-[#dd5b00] font-semibold"
                          : dayOfWeek === 6
                          ? "text-[#0075de] font-semibold"
                          : "text-[#31302e]"
                        : "text-[#a39e98]"
                    }`}
                  >
                    {cell.day}
                  </span>

                  {cell.holidayName && cell.isCurrentMonth && (
                    <span className="text-[10px] font-semibold text-[#dd5b00] truncate max-w-[55px] sm:max-w-[70px]">
                      {cell.holidayName}
                    </span>
                  )}
                </div>

                {/* 해당 날짜 승인 연차 목록 표기 (영업일에만 표기, 사유는 표기하지 않음) */}
                <div className="flex-1 space-y-1 overflow-y-auto max-h-[64px] scrollbar-thin">
                  {leavesOnCell.map((leave) => {
                    const username = getUsername(leave.email);
                    const badgeColor = getBadgeColor(leave.email);

                    return (
                      <div
                        key={leave.id + "-" + cell.dateStr}
                        title={`${username} (${leave.start_date} ~ ${leave.end_date})`}
                        className={`truncate rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium border ${badgeColor} transition hover:opacity-90`}
                      >
                        {username} (연차)
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
