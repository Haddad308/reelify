import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/youtube/callback`
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('YouTube OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/editor?auth_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // Verify state to prevent CSRF
    const storedState = request.cookies.get('youtube_oauth_state')?.value;
    if (!state || state !== storedState) {
      console.error('State mismatch:', { state, storedState });
      return NextResponse.redirect(
        new URL('/editor?auth_error=state_mismatch', request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/editor?auth_error=no_code', request.url)
      );
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL('/editor?auth_error=no_access_token', request.url)
      );
    }

    // Create redirect response
    const response = NextResponse.redirect(
      new URL('/editor?auth_success=youtube', request.url)
    );

    // Store tokens in httpOnly cookies
    response.cookies.set('youtube_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expiry_date 
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600, // Default 1 hour
      path: '/',
    });

    if (tokens.refresh_token) {
      response.cookies.set('youtube_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    // Clear the state cookie
    response.cookies.delete('youtube_oauth_state');

    return response;
  } catch (error) {
    console.error('YouTube callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/editor?auth_error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
