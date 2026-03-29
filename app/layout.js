import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { CallProvider } from '@/context/CallContext';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

export const metadata = {
  title: 'SkillConnect — Connect Through Skills',
  description: 'A WhatsApp-style networking app to showcase your skills and connect with others',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#25D366',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#25D366" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SkillConnect" />
      </head>
      <body>
        <AuthProvider>
          <CallProvider>
            {children}
            <ServiceWorkerRegister />
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#16213e',
                  color: '#f0f0f5',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '10px',
                  fontSize: '14px',
                },
                success: { iconTheme: { primary: '#25D366', secondary: '#000' } },
              }}
            />
          </CallProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
