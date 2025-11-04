import { auth } from "@/app/(auth)/auth";

export default auth((req) => {
  // req.auth is available here
});

export const config = {
  matcher: ["/", "/:id", "/api/:path*", "/login", "/register"],
};
