import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Chat Bethel CS',
  description: 'Chat com seu especialista Bethel CS',
  manifest: '/manifest-chat.json',
  themeColor: '#001321',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Bethel Chat',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/icon-192x192.png',
  },
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
