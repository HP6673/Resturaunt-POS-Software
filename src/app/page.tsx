export default function Home() {
  // Middleware always redirects "/" to /login or the signed-in user's home page,
  // so this is just a safe fallback in case that ever doesn't run.
  return null;
}
