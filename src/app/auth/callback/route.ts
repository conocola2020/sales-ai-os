import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check for invite token in user metadata
      const { data: { user } } = await supabase.auth.getUser()
      const inviteToken = user?.user_metadata?.invite_token

      if (inviteToken) {
        try {
          // Look up the invitation
          const { data: invitation } = await supabase
            .from('org_invitations')
            .select('id, org_id, role, expires_at, accepted_at')
            .eq('token', inviteToken)
            .maybeSingle()

          if (
            invitation &&
            !invitation.accepted_at &&
            new Date(invitation.expires_at) > new Date()
          ) {
            // Mark invitation as accepted
            await supabase
              .from('org_invitations')
              .update({ accepted_at: new Date().toISOString() })
              .eq('id', invitation.id)

            // Add user to org_members
            await supabase
              .from('org_members')
              .insert({
                org_id: invitation.org_id,
                user_id: user!.id,
                role: invitation.role,
              })

            // Clear the invite_token from user metadata
            await supabase.auth.updateUser({
              data: { invite_token: null },
            })

            return NextResponse.redirect(`${origin}/dashboard`)
          }
        } catch (e) {
          console.error('Invite token processing error:', e)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
