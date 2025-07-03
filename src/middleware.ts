import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// const isPublicRoute = createRouteMatcher([
//   '/sign-in(.*)',
//   '/',
//   '/blog/[id]',
//   '/api/clerk/webhook'
// ])

const isProtectedRoute = createRouteMatcher([
  '/blog/new',
  '/blog/[id]/edit',
  '/code-diff(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  // Protect specific routes that require authentication
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // Protect POST, PUT, DELETE API routes (except webhook)
  if (req.nextUrl.pathname.startsWith('/api/blog') && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    await auth.protect()
  }

  // Protect code-diff API routes
  if (req.nextUrl.pathname.startsWith('/api/code-diff')) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}