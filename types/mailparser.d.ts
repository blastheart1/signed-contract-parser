declare module 'mailparser' {
  export interface ParsedMail {
    html?: string | string[] | false;
    text?: string | string[] | false;
    subject?: string;
    from?: any;
    to?: any;
    date?: Date;
    [key: string]: any;
  }

  export function simpleParser(source: Buffer | string | any): Promise<ParsedMail>;
}

