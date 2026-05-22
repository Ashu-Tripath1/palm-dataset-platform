import './globals.css';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'Palm Research Study — Dataset Collection Platform',
  description: 'Contribute to AI research on the relationship between palm features and profession.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
