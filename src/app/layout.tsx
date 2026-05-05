import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HotelGen',
  description: 'Hotel Automation SaaS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
