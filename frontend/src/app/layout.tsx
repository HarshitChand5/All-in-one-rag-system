import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { Shell } from "@/components/layout/Shell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DocuRAG — Document Intelligence",
  description: "AI-powered document analysis and research workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} antialiased dark`}>
      <body className="h-screen bg-black">
        <Shell>
          {children}
        </Shell>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1d1d1f',
              color: '#f5f5f7',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '13px',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: '#34c759',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ff453a',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
