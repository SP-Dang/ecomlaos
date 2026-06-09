import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/context/LanguageContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ຮ້ານຄ້າອອນລາຍ ລາວ | Lao Online Marketplace",
  description: "ເວທີຊື້-ຂາຍສິນຄ້າອອນລາຍພາສາລາວ - ຄຸນນະພາບດີ, ລາຄາປະຢັດ",
  keywords: ["ecommerce", "laos", "online shopping", "ຊື້ເຄື່ອງອອນລາຍ", "ຕະຫຼາດອອນລາຍ", "ຮ້ານຄ້າລາວ"],
  authors: [{ name: "EcomLao Team" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "lo_LA",
    url: "https://ecomlaos.com",
    title: "ຮ້ານຄ້າອອນລາຍ ລາວ | Lao Online Marketplace",
    description: "ເວທີຊື້-ຂາຍສິນຄ້າອອນລາຍພາສາລາວ - ຄຸນນະພາບດີ, ລາຄາປະຢັດ",
    siteName: "EcomLao",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lo" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <meta charSet="UTF-8" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@100..900&display=swap" 
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <Navbar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}