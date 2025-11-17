import { load } from 'cheerio';
import { ParsedEmail } from './emlParser';
import { validateAddendumUrl } from './addendumParser';

export interface ExtractedContractLinks {
  originalContractUrl: string | null;
  addendumUrls: string[];
}

/**
 * Extract actual ProDBX URL from tracking URL
 * Example: https://track.pstmrk.it/3ts/l1.prodbx.com%2Fgo%2Fview%2F%3F33047.426.20250801132906./jrqS/...
 * Returns: https://l1.prodbx.com/go/view/?33047.426.20250801132906
 */
function extractProDBXUrlFromTracking(trackingUrl: string): string | null {
  try {
    // Try to decode URL-encoded parts
    const decoded = decodeURIComponent(trackingUrl);
    
    // Look for ProDBX URL pattern in the decoded string
    // Match the full query string including dots (e.g., ?33047.426.20250801132906)
    const prodbxMatch = decoded.match(/https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s\/"<>\n\r]+/i);
    if (prodbxMatch) {
      return prodbxMatch[0];
    }
    
    // If not found, try to extract from URL-encoded format
    // Match the full query string including dots (e.g., 33047.426.20250801132906)
    // Stop at %2F (encoded /) or end of string
    const encodedMatch = trackingUrl.match(/l1\.prodbx\.com%2Fgo%2Fview%2F%3F([^%\/]+)/i);
    if (encodedMatch) {
      const urlId = encodedMatch[1];
      // Decode the URL-encoded query string
      try {
        const decodedId = decodeURIComponent(urlId);
        return `https://l1.prodbx.com/go/view/?${decodedId}`;
      } catch {
        return `https://l1.prodbx.com/go/view/?${urlId}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract ProDBX URLs from text
 * Handles both direct URLs and tracking URLs
 */
function extractUrlsFromText(text: string): string[] {
  const urls: string[] = [];
  
  // Pattern for direct ProDBX URLs
  // Match the full query string including dots (e.g., ?33047.426.20250801132906)
  // Stop at whitespace, quotes, angle brackets, or line breaks
  const directUrlPattern = /https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s"<>\n\r]+/gi;
  const directMatches = text.match(directUrlPattern);
  if (directMatches) {
    directMatches.forEach(url => {
      // Remove trailing punctuation but keep dots in the query string
      // Only remove punctuation at the very end (after the URL)
      const cleanUrl = url.replace(/[.,;!?]+$/, ''); // Remove trailing punctuation
      if (validateAddendumUrl(cleanUrl)) {
        urls.push(cleanUrl);
      }
    });
  }
  
  // Pattern for tracking URLs
  const trackingUrlPattern = /https?:\/\/track\.pstmrk\.it\/[^\s"<>]+/gi;
  const trackingMatches = text.match(trackingUrlPattern);
  if (trackingMatches) {
    trackingMatches.forEach(trackingUrl => {
      const prodbxUrl = extractProDBXUrlFromTracking(trackingUrl);
      if (prodbxUrl && validateAddendumUrl(prodbxUrl)) {
        urls.push(prodbxUrl);
      }
    });
  }
  
  // Remove duplicates
  return Array.from(new Set(urls));
}

/**
 * Extract ProDBX URL from a link element
 * Handles both direct URLs and tracking URLs (base64 encoded)
 * Allows dots in query string (e.g., ?33047.426.20250801132906)
 */
function extractUrlFromLink($link: any): string | null {
  let href = $link.attr('href');
  const linkText = $link.text().trim();
  
  // If href is a valid ProDBX URL, use it
  if (href && validateAddendumUrl(href)) {
    return href;
  }
  
  // Try to extract from link text (the visible URL)
  // Allow dots in query string - match until whitespace, quotes, angle brackets, or line breaks
  if (linkText && linkText.length > 0) {
    const urlMatch = linkText.match(/https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s"<>\n\r]+/i);
    if (urlMatch) {
      const extracted = urlMatch[0].replace(/[.,;!?]+$/, ''); // Remove trailing punctuation only
      if (validateAddendumUrl(extracted)) {
        return extracted;
      }
    }
  }
  
  // Try to decode the tracking URL (base64 encoded in the href)
  if (href && href.includes('aHR0cHM6Ly9sMS5wcm9kYnguY29t')) {
    try {
      // The tracking URL format: https://l2511a.prodbx.com/go?l=426-427947-aHR0cHM6Ly9sMS5wcm9kYnguY29tL2dvL3ZpZXcvPzMzMDQ3LjQyNi4yMDI1MDgwMTEzMjkwNi4%3D
      // Extract the base64 part after the last dash
      const base64Match = href.match(/[^-]+-([^\/]+)/);
      if (base64Match && base64Match[1]) {
        const base64Part = base64Match[1];
        try {
          // URL decode first, then base64 decode
          const urlDecoded = decodeURIComponent(base64Part);
          const decodedUrl = Buffer.from(urlDecoded, 'base64').toString('utf-8');
          // Allow dots in query string
          const urlMatch = decodedUrl.match(/https?:\/\/(l1|login)\.prodbx\.com\/go\/view\/\?[^\s"<>\n\r]+/i);
          if (urlMatch) {
            const extracted = urlMatch[0].replace(/[.,;!?]+$/, ''); // Remove trailing punctuation only
            if (validateAddendumUrl(extracted)) {
              return extracted;
            }
          }
        } catch (e) {
          // Base64 decode failed, try other methods
        }
      }
    } catch (e) {
      // Failed to decode tracking URL
    }
  }
  
  // If still not found, try extracting from tracking URL using the helper function
  if (href) {
    const extracted = extractProDBXUrlFromTracking(href);
    if (extracted && validateAddendumUrl(extracted)) {
      return extracted;
    }
  }
  
  return null;
}

/**
 * Extract Original Contract URL from HTML
 * Separate function to avoid interference with Addendums detection
 */
function extractOriginalContractUrlFromHTML($: any): string | null {
  // Find "Original Contract:" section
  const originalContractSection = $('strong').filter((_index: number, el: any) => {
    const text = $(el).text().toLowerCase();
    return text.includes('original contract');
  });
  
  if (originalContractSection.length === 0) {
    console.log('[Contract Link Extractor] "Original Contract:" section not found in HTML');
    return null;
  }
  
  console.log('[Contract Link Extractor] Found "Original Contract:" section in HTML');
  
  // Find the link after the "Original Contract:" label
  const parent = originalContractSection.parent();
  let link = parent.find('a[href*="prodbx.com"]').first();
  console.log(`[Contract Link Extractor] Links in parent: ${link.length}`);
  
  // If no link in parent, try next sibling div
  if (link.length === 0) {
    const parentDiv = originalContractSection.closest('div');
    console.log(`[Contract Link Extractor] Parent div found: ${parentDiv.length}`);
    if (parentDiv.length > 0) {
      const nextSibling = parentDiv.next('div');
      console.log(`[Contract Link Extractor] Next sibling div found: ${nextSibling.length}`);
      if (nextSibling.length > 0) {
        // Find all links and prefer the one with text content (the actual URL)
        const allLinks = nextSibling.find('a[href*="prodbx.com"]');
        console.log(`[Contract Link Extractor] Total links in sibling: ${allLinks.length}`);
        // Find the link with text content (not empty)
        allLinks.each((_index: number, el: any) => {
          const $linkEl = $(el);
          const text = $linkEl.text().trim();
          if (text.length > 0 && link.length === 0) {
            link = $linkEl;
            console.log(`[Contract Link Extractor] Found link with text: ${text.substring(0, 80)}...`);
          }
        });
        // If no link with text found, use first link
        if (link.length === 0 && allLinks.length > 0) {
          link = $(allLinks[0]);
          console.log(`[Contract Link Extractor] Using first link (no text found)`);
        }
      }
    }
  }
  
  // If still no link, search all divs after the Original Contract section
  if (link.length === 0) {
    console.log('[Contract Link Extractor] Searching all divs after Original Contract section...');
    const allDivs = $('div');
    let foundOriginalContractSection = false;
    allDivs.each((_index: number, div: any) => {
      const $div = $(div);
      if (!foundOriginalContractSection) {
        // Check if this div contains the "Original Contract:" strong tag
        if ($div.find('strong').filter((_idx: number, el: any) => {
          return $(el).text().toLowerCase().includes('original contract');
        }).length > 0) {
          foundOriginalContractSection = true;
          console.log('[Contract Link Extractor] Found Original Contract section, searching subsequent divs...');
        }
      } else {
        // We've found the Original Contract section, now look for links in subsequent divs
        const divLinks = $div.find('a[href*="prodbx.com"]');
        if (divLinks.length > 0 && link.length === 0) {
          // Prefer link with text content
          divLinks.each((_idx: number, el: any) => {
            const $linkEl = $(el);
            const text = $linkEl.text().trim();
            if (text.length > 0 && link.length === 0) {
              link = $linkEl;
              console.log(`[Contract Link Extractor] Found link with text in subsequent div: ${text.substring(0, 80)}...`);
            }
          });
          // If no link with text, use first link
          if (link.length === 0) {
            link = $(divLinks[0]);
            console.log(`[Contract Link Extractor] Using first link in subsequent div (no text found)`);
          }
        }
      }
    });
  }
  
  if (link.length > 0) {
    const extractedUrl = extractUrlFromLink(link);
    if (extractedUrl) {
      console.log(`[Contract Link Extractor] Successfully extracted Original Contract URL: ${extractedUrl}`);
      return extractedUrl;
    } else {
      const linkText = link.text().trim();
      const linkHtml = link.html() || '';
      console.warn(`[Contract Link Extractor] URL extraction failed`);
      console.warn(`[Contract Link Extractor] Link text was: ${linkText}`);
      console.warn(`[Contract Link Extractor] Link HTML was: ${linkHtml.substring(0, 200)}`);
    }
  } else {
    console.warn('[Contract Link Extractor] No link found after Original Contract section');
  }
  
  return null;
}

/**
 * Extract Addendum URLs from HTML
 * Separate function to avoid interference with Original Contract detection
 */
function extractAddendumUrlsFromHTML($: any): string[] {
  const addendumUrls: string[] = [];
  
  // Find "Addendums:" section
  const addendumsSection = $('strong').filter((_index: number, el: any) => {
    const text = $(el).text().toLowerCase();
    return text.includes('addendums');
  });
  
  if (addendumsSection.length === 0) {
    return addendumUrls;
  }
  
  // The links might be in the same parent or in a sibling div
  // First try the parent
  const parent = addendumsSection.parent();
  let links = parent.find('a[href*="prodbx.com"]');
  
  // If no links found in parent, try the next sibling div
  if (links.length === 0) {
    const parentDiv = addendumsSection.closest('div');
    if (parentDiv.length > 0) {
      // Find the next sibling div that contains links
      let nextSibling = parentDiv.next('div');
      while (nextSibling.length > 0 && links.length === 0) {
        links = nextSibling.find('a[href*="prodbx.com"]');
        if (links.length === 0) {
          nextSibling = nextSibling.next('div');
        } else {
          break;
        }
      }
    }
  }
  
  // If still no links, search all divs after the "Addendums:" section
  if (links.length === 0) {
    // Find all divs and search for links in divs that come after the "Addendums:" section
    const allDivs = $('div');
    let foundAddendumsSection = false;
    allDivs.each((_index: number, div: any) => {
      const $div = $(div);
      if (!foundAddendumsSection) {
        // Check if this div contains the "Addendums:" strong tag
        if ($div.find('strong').filter((_idx: number, el: any) => {
          return $(el).text().toLowerCase().includes('addendums');
        }).length > 0) {
          foundAddendumsSection = true;
        }
      } else {
        // We've found the Addendums section, now look for links in subsequent divs
        const divLinks = $div.find('a[href*="prodbx.com"]');
        divLinks.each((_idx: number, linkEl: any) => {
          const $link = $(linkEl);
          const extractedUrl = extractUrlFromLink($link);
          if (extractedUrl) {
            addendumUrls.push(extractedUrl);
          }
        });
      }
    });
  } else {
    // Process links found in parent or sibling
    links.each((_index: number, el: any) => {
      const $link = $(el);
      const extractedUrl = extractUrlFromLink($link);
      if (extractedUrl) {
        addendumUrls.push(extractedUrl);
      }
    });
  }
  
  return addendumUrls;
}

/**
 * Extract contract links from parsed email
 * Looks for "Original Contract:" and "Addendums:" sections in both HTML and text
 * Uses separate functions for each to avoid interference
 */
export function extractContractLinks(parsedEmail: ParsedEmail): ExtractedContractLinks {
  const result: ExtractedContractLinks = {
    originalContractUrl: null,
    addendumUrls: [],
  };
  
  // Try HTML first (more reliable)
  if (parsedEmail.html) {
    try {
      const $ = load(parsedEmail.html);
      
      // Extract Original Contract URL (separate function)
      result.originalContractUrl = extractOriginalContractUrlFromHTML($);
      
      // Extract Addendum URLs (separate function)
      result.addendumUrls = extractAddendumUrlsFromHTML($);
      
    } catch (error) {
      console.warn('[Contract Link Extractor] Error parsing HTML:', error);
    }
  }
  
  // Fall back to text parsing if HTML didn't find links
  if (!result.originalContractUrl && !result.addendumUrls.length && parsedEmail.text) {
    try {
      const text = parsedEmail.text;
      
      // Find "Original Contract:" section
      const originalContractMatch = text.match(/Original\s+Contract\s*:?\s*([^\n]+)/i);
      if (originalContractMatch) {
        const urls = extractUrlsFromText(originalContractMatch[1]);
        if (urls.length > 0) {
          result.originalContractUrl = urls[0]; // Take first URL as original contract
        }
      }
      
      // Find "Addendums:" section
      const addendumsMatch = text.match(/Addendums\s*:?\s*([\s\S]+?)(?=\n\n|\n[A-Z]|$)/i);
      if (addendumsMatch) {
        const urls = extractUrlsFromText(addendumsMatch[1]);
        result.addendumUrls.push(...urls);
      }
    } catch (error) {
      console.warn('[Contract Link Extractor] Error parsing text:', error);
    }
  }
  
  // Remove original contract URL from addendums if it appears there
  if (result.originalContractUrl) {
    result.addendumUrls = result.addendumUrls.filter(
      url => url !== result.originalContractUrl
    );
  }
  
  // Remove duplicates from addendums
  result.addendumUrls = Array.from(new Set(result.addendumUrls));
  
  return result;
}

