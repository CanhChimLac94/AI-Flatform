import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { I18nProvider } from "@/contexts/I18nContext";
import { PersonaConflictModal } from "@/components/settings/PersonaConflictModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Omni AI Chat",
  description: "Multimodal AI Chat Platform — GPT-4o, Claude, Groq, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        <I18nProvider>
          <AuthProvider>
            {children}
            <PersonaConflictModal />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
