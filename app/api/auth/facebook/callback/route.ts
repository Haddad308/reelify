import { NextRequest, NextResponse } from 'next/server';

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const REDIRECT_URI = `${BASE_URL}/api/auth/facebook/callback`;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for OAuth errors
    if (error) {
      console.error('Facebook OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        new URL(`/editor?auth_error=${encodeURIComponent(errorDescription || error)}`, request.url)
      );
    }

    // Verify state to prevent CSRF
    const storedState = request.cookies.get('facebook_oauth_state')?.value;
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

    // Exchange code for access token
    const tokenUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', FACEBOOK_APP_ID!);
    tokenUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET!);
    tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Facebook token error:', tokenData.error);
      return NextResponse.redirect(
        new URL(`/editor?auth_error=${encodeURIComponent(tokenData.error.message)}`, request.url)
      );
    }

    const { access_token, expires_in } = tokenData;

    if (!access_token) {
      return NextResponse.redirect(
        new URL('/editor?auth_error=no_access_token', request.url)
      );
    }

    // Exchange for a long-lived token (60 days instead of 1-2 hours)
    const longLivedUrl = new URL('https://graph.facebook.com/v18.0/oauth/access_token');
    longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longLivedUrl.searchParams.set('client_id', FACEBOOK_APP_ID!);
    longLivedUrl.searchParams.set('client_secret', FACEBOOK_APP_SECRET!);
    longLivedUrl.searchParams.set('fb_exchange_token', access_token);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    const longLivedData = await longLivedResponse.json();

    const finalToken = longLivedData.access_token || access_token;
    const finalExpiry = longLivedData.expires_in || expires_in;

    // Get user's pages to allow posting Reels
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${finalToken}`
    );
    const pagesData = await pagesResponse.json();

    // Create redirect response
    const response = NextResponse.redirect(
      new URL('/editor?auth_success=facebook', request.url)
    );

    // Store user access token in httpOnly cookie
    response.cookies.set('facebook_access_token', finalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: finalExpiry || 60 * 60 * 24 * 60, // Default 60 days
      path: '/',
    });

    // If user has pages, store the first page's access token
    // (In production, you'd let the user select a page)
    if (pagesData.data && pagesData.data.length > 0) {
      const firstPage = pagesData.data[0];
      
      response.cookies.set('facebook_page_access_token', firstPage.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 60, // 60 days (page tokens don't expire if derived from long-lived user token)
        path: '/',
      });

      response.cookies.set('facebook_page_id', firstPage.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 60,
        path: '/',
      });
    }

    // Clear the state cookie
    response.cookies.delete('facebook_oauth_state');

    return response;
  } catch (error) {
    console.error('Facebook callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/editor?auth_error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
