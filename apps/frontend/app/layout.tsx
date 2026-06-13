import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PersonaConflictModal } from "@/components/settings/PersonaConflictModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Hub",
  description: "AI Hub — Multimodal AI platform with GPT-4o, Claude, Groq, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full dark" data-theme="dark" suppressHydrationWarning>
      <body className={`${inter.className} h-full`}>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <PersonaConflictModal />
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
