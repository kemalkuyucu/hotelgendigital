/**
 * Raporlama sayfasi (server component)
 * slug'i params'tan cozer, client manager'a prop olarak gecer.
 */

import ReportRecipientsManager from './_report-recipients-manager';

export default async function RaporlamaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ReportRecipientsManager slug={slug} />;
}
