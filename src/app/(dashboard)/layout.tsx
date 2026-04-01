import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { SplashScreen } from '@/components/splash-screen'
import { PushPrompt } from '@/components/push-prompt'
import { InstallBanner } from '@/components/install-banner'
import { ErrorBoundaryWrapper } from '@/components/error-boundary-wrapper'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, wpp_phone, created_at, updated_at')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  return (
    <>
      <SplashScreen />
      <PushPrompt />
      <InstallBanner />
      <div className="flex min-h-screen">
        <AppSidebar profile={profile} />
        <div className="flex flex-1 flex-col md:pl-[260px]">
          <Header profile={profile} />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <ErrorBoundaryWrapper>{children}</ErrorBoundaryWrapper>
          </main>
        </div>
      </div>
    </>
  )
}
