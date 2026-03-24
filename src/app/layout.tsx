import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { cn } from '@/lib/utils'
import './globals.css'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
  weight: '100 900',
})

export const metadata: Metadata = {
  title: 'Bethel CS',
  description: 'Sistema de Customer Success para Mentoria Elite Premium',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={cn('font-sans', geistSans.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
