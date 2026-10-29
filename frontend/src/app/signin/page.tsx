import { redirect } from "next/navigation";

/** There is no sign-in: old links and bookmarks go straight into the app. */
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ journey?: string }> }) {
  const { journey } = await searchParams;
  redirect(journey && /^[a-z]+$/.test(journey) ? `/app?journey=${journey}` : "/app");
}
