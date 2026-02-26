// ─── URL Content Scraper ───
// Fetches article content from a URL and extracts readable text

const URL_REGEX = /^https?:\/\/[^\s]+$/;

export function isUrl(text: string): boolean {
  return URL_REGEX.test(text.trim());
}

export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export async function scrapeUrl(url: string): Promise<{ title: string; content: string; url: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InvestorFBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "タイトル不明";

    // Extract main content - remove scripts, styles, and HTML tags
    let content = html
      // Remove script tags and content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Remove style tags and content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Remove nav, header, footer, aside
      .replace(/<(nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, "")
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Convert br and p tags to newlines
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      // Remove remaining HTML tags
      .replace(/<[^>]+>/g, "")
      // Decode common HTML entities
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      // Clean up whitespace
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .trim();

    // Truncate to avoid LLM token limits (keep first ~3000 chars)
    if (content.length > 3000) {
      content = content.slice(0, 3000) + "\n\n...(以下省略)";
    }

    return { title, content, url };
  } catch (e: any) {
    console.error(`[Scraper] Failed to scrape ${url}:`, e.message);
    throw new Error(`記事の取得に失敗しました: ${e.message}`);
  }
}
