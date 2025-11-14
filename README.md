# Calimingo Contract Parser

A Next.js application with TypeScript that parses signed build contract .eml files and generates formatted Excel spreadsheets.

## Features

- Drag-and-drop file upload for .eml files
- Automatic extraction of Order Items Table from contract emails
- Generation of Excel spreadsheets with proper formatting
- Category headers and line items preserved
- Location information extracted from customer data
- Built with Next.js 14, TypeScript, and Tailwind CSS

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Libraries**: 
  - `mailparser` - Parse .eml files
  - `cheerio` - HTML parsing
  - `xlsx` - Excel file generation

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── api/
│   │   └── parse-contract/
│   │       └── route.ts          # API route handler
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Home page
├── components/
│   └── FileUpload.tsx            # File upload component
├── lib/
│   ├── emlParser.ts              # EML parsing logic
│   ├── tableExtractor.ts         # HTML table extraction
│   └── spreadsheetGenerator.ts  # Excel file generation
└── contract-parser/
    └── Build Contract Signed.eml # Sample contract file
```

## Deployment to Vercel

1. Push your code to a Git repository
2. Import the project in Vercel
3. Vercel will automatically detect Next.js and deploy

## Usage

1. Upload a signed build contract .eml file
2. The application will:
   - Parse the email content
   - Extract the Order Items Table
   - Generate an Excel spreadsheet
3. Download the generated spreadsheet

## Output Format

The generated spreadsheet includes:
- Location header row (Pool & Spa - City, State Zip, United States)
- Column headers (PRODUCT/SERVICE, QTY, RATE, AMOUNT)
- Main category headers
- Sub-category headers
- Line items with quantities, rates, and amounts

## Testing

Run the test parser:
```bash
npm run test
```

This will test the parser with the sample contract file and generate a test output spreadsheet.
