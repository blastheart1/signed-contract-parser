declare module 'xlsx-populate' {
  export interface Cell {
    value(): any;
    value(val: any): Cell;
    style(style: any): Cell;
    style(name: string, value: any): Cell;
  }

  export interface Range {
    merged(merged: boolean): Range;
    style(style: any): Range;
    style(name: string, value: any): Range;
  }

  export interface Sheet {
    cell(row: number, col: number): Cell;
    range(address: string): Range;
    name(): string;
    name(name: string): Sheet;
  }

  export interface Workbook {
    sheet(name: string): Sheet | undefined;
    sheet(index: number): Sheet | undefined;
    outputAsync(): Promise<Buffer>;
  }

  interface XLSXPopulateStatic {
    fromDataAsync(data: Buffer | ArrayBuffer): Promise<Workbook>;
    fromBlankAsync(): Promise<Workbook>;
    fromFileAsync(filepath: string): Promise<Workbook>;
  }

  const XLSXPopulate: XLSXPopulateStatic;
  export default XLSXPopulate;
}

