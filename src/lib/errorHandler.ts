export function getAuthErrorMessage(error: any): string {
  if (!error) return "";
  const rawMsg = typeof error === "string" ? error : error?.message || JSON.stringify(error);

  const lower = rawMsg.toLowerCase();

  // 1. 이메일 또는 비밀번호 불일치
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid_credentials") ||
    lower.includes("invalid password") ||
    lower.includes("invalid username or password")
  ) {
    return "이메일 또는 비밀번호가 맞지 않습니다";
  }

  // 2. 이미 가입된 이메일
  if (
    lower.includes("user already registered") ||
    lower.includes("already registered") ||
    lower.includes("user already exists") ||
    lower.includes("identity already exists")
  ) {
    return "이미 가입된 이메일입니다. 로그인으로 들어오세요";
  }

  // 3. 비밀번호 6자 미만
  if (
    lower.includes("password should be at least 6 characters") ||
    lower.includes("password is too short") ||
    lower.includes("weak_password")
  ) {
    return "비밀번호는 6자 이상으로 해 주세요";
  }

  // 4. 이메일 미인증
  if (
    lower.includes("email not confirmed") ||
    lower.includes("email address is unconfirmed")
  ) {
    return "확인 메일 설정이 켜져 있습니다. 강사에게 알려 주세요";
  }

  // 기타 오류: 한국어 안내 옆에 원문 병기
  return `오류가 발생했습니다: ${rawMsg}`;
}
