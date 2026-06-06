import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '../lib/auth-context';

export const metadata: Metadata = {
  title: 'DBM Construction Portal',
  description: 'Building with certainty from the first bid to the final punchlist',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow users to pinch-zoom (accessibility); the layout itself is responsive.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
