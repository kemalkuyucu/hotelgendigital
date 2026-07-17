const MANAGER_TOKEN_BY_SLUG: Record<string, string | undefined> = {
  'v5-pro-test-oteli': process.env.TELEGRAM_MANAGER_BOT_TOKEN_V5,
};

export function getManagerBotTokenForHotel(hotelSlug: string): string {
  if (hotelSlug in MANAGER_TOKEN_BY_SLUG) {
    const t = MANAGER_TOKEN_BY_SLUG[hotelSlug];
    if (!t) throw new Error(`Manager bot token missing for slug: ${hotelSlug}`);
    return t;   // SESSIZ FALLBACK YASAK -> yanlis bottan cevap gitmesin
  }
  const fallback = process.env.TELEGRAM_MANAGER_BOT_TOKEN_DEMO;
  if (!fallback) throw new Error('TELEGRAM_MANAGER_BOT_TOKEN_DEMO missing');
  return fallback;
}
