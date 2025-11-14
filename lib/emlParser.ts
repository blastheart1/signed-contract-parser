import { simpleParser, ParsedMail } from 'mailparser';

export interface ParsedEmail {
  html: string;
  text: string;
  subject?: string;
  from?: any;
  date?: Date;
}

/**
 * Parse an .eml file and extract HTML content
 * @param emlContent - The .eml file content
 * @returns Parsed email object with HTML content
 */
export async function parseEML(emlContent: Buffer | string): Promise<ParsedEmail> {
  try {
    const parsed: ParsedMail = await simpleParser(emlContent);
    
    // Extract HTML content
    const html = parsed.html || '';
    
    // Extract text content for location parsing
    const text = parsed.text || '';
    
    return {
      html: Array.isArray(html) ? html.join('') : html,
      text: Array.isArray(text) ? text.join('') : text,
      subject: parsed.subject,
      from: parsed.from,
      date: parsed.date
    };
  } catch (error) {
    throw new Error(`Failed to parse EML file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

