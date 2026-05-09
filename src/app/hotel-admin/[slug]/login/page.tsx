import LoginClient from './_login-client'

export default async function LoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <LoginClient slug={slug} />
}
