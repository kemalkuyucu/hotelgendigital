import GroupLoginClient from './_login-client'

export default async function GroupLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return <GroupLoginClient slug={slug} />
}
