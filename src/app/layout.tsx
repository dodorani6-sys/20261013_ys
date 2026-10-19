import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "연차 신청함",
  description: "직원 연차 신청 및 승인·반려 관리 도구",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-screen bg-[#f6f5f4] text-[#000000] antialiased">
        {children}
      </body>
    </html>
  );
}
