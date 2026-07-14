import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: '捏脸工坊 - 创建你的专属可爱形象',
  description: '自由捏脸，创造属于你的卡通形象！支持调整脸型、眼睛、发型等丰富的自定义选项。',
  keywords: ['捏脸', '角色创建', '卡通形象', '头像生成'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
