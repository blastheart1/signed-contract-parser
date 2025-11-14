# Calimingo Contract Parser

A Next.js application with TypeScript that parses signed build contract .eml files and generates formatted Excel spreadsheets.

## Overview

This application processes email contract files (.eml format) containing build contract information, extracts order item tables, and generates properly formatted Excel spreadsheets with location data, category headers, and line items.

## Features

- **File Upload**: Drag-and-drop interface for uploading .eml files
- **Email Parsing**: Automatic extraction of HTML and text content from email files
- **Table Extraction**: Intelligent parsing of Order Items Table from contract emails
- **Excel Generation**: Creates formatted Excel spreadsheets with proper structure
- **Data Preservation**: Maintains category headers, sub-categories, and line item details
- **Location Extraction**: Automatically extracts customer location information from email content
- **Template Support**: Uses Excel template for consistent formatting

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Core Libraries**:
  - `mailparser` - Parse .eml email files
  - `cheerio` - HTML parsing and DOM manipulation
  - `exceljs` - Excel file generation and formatting
  - `xlsx` - Additional Excel utilities

## Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

## Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd CalimingoPools
```

2. Install dependencies:
```bash
npm install
```

### Development

1. Run the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

3. Upload a signed build contract .eml file using the drag-and-drop interface

### Build

To create a production build:
```bash
npm run build
npm start
```

## Project Structure

```
CalimingoPools/
├── app/
│   ├── api/
│   │   └── parse-contract/
│   │       └── route.ts          # API route handler for contract parsing
│   ├── globals.css               # Global styles and Tailwind imports
│   ├── layout.tsx                # Root layout component
│   └── page.tsx                  # Home page with file upload
├── components/
│   └── FileUpload.tsx            # File upload component with drag-and-drop
├── lib/
│   ├── emlParser.ts              # EML file parsing logic
│   ├── tableExtractor.ts         # HTML table extraction and location parsing
│   └── spreadsheetGenerator.ts   # Excel file generation with template support
├── contract-parser/
│   ├── Build Contract Signed.eml # Sample contract file for testing
│   └── template.xlsx             # Excel template file
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── tailwind.config.ts            # Tailwind CSS configuration
```

## Usage

1. **Upload File**: Drag and drop a signed build contract .eml file onto the upload area, or click to select a file
2. **Processing**: The application will:
   - Parse the email content (HTML and text)
   - Extract location information (order number, address, city, state, zip)
   - Extract the Order Items Table from the HTML content
   - Generate a formatted Excel spreadsheet using the template
3. **Download**: Download the generated spreadsheet with all extracted data

## Output Format

The generated Excel spreadsheet includes:

- **Location Header**: Pool & Spa location with full address (City, State Zip, United States)
- **Column Headers**: PRODUCT/SERVICE, QTY, RATE, AMOUNT
- **Category Structure**:
  - Main category headers
  - Sub-category headers (indented)
  - Line items with quantities, rates, and calculated amounts
- **Formatting**: Proper cell formatting, borders, and alignment matching the template

## API Endpoint

The application includes an API route at `/api/parse-contract` that accepts POST requests with .eml file content and returns the generated Excel file.

## Testing

Run the test parser to verify functionality with the sample contract file:

```bash
npm run test
```

This will:
- Parse the sample contract file (`contract-parser/Build Contract Signed.eml`)
- Extract all data
- Generate a test output spreadsheet

## Deployment

### Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Import the project in [Vercel](https://vercel.com)
3. Vercel will automatically detect Next.js and configure the deployment
4. The application will be deployed and available at a Vercel URL

### Other Platforms

This Next.js application can be deployed to any platform that supports Node.js:
- AWS Amplify
- Netlify
- Railway
- DigitalOcean App Platform

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run test parser with sample file

## License

This project is proprietary software for Calimingo Pools.
