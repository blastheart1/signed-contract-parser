# Calimingo Contract Parser

A Next.js application with TypeScript that parses signed build contract .eml files and generates professionally formatted Excel spreadsheets with automatic subcategory formatting and visual separators.

## Overview

This application processes email contract files (.eml format) containing build contract information, extracts order item tables, and generates properly formatted Excel spreadsheets with location data, category headers, subcategories, and line items. The application uses a two-pass formatting approach for reliable style preservation and applies visual formatting to subcategory rows extending from column D to BE.

## Features

- **File Upload**: Drag-and-drop interface for uploading .eml files
- **Email Parsing**: Automatic extraction of HTML and text content from email files
- **Table Extraction**: Intelligent parsing of Order Items Table from contract emails
- **Excel Generation**: Creates formatted Excel spreadsheets with proper structure
- **Subcategory Formatting**: Automatic formatting of subcategory headers with fill color (#495568) and white text
- **Visual Separators**: Subcategory rows extend to column BE (57) as visual separators
- **Template Support**: Uses Excel template for consistent formatting (rows 17-452)
- **Formatting Toggle**: Option to generate basic (values only) or formatted (with styling) spreadsheets
- **Location Extraction**: Automatically extracts customer location information from email content
- **Dynamic Sheet Naming**: Sheet names based on Order ID and Street Address

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Core Libraries**:
  - `mailparser` - Parse .eml email files
  - `cheerio` - HTML parsing and DOM manipulation
  - `exceljs` - Excel file generation and formatting (first pass)
  - `xlsx-populate` - Excel formatting and style preservation (second pass)
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
│   ├── spreadsheetGenerator.ts   # Excel file generation with template support
│   ├── cellFormatter.ts          # ExcelJS cell formatting utilities
│   └── xlsxPopulateFormatter.ts  # XLSX-Populate formatting utilities
├── types/
│   └── xlsx-populate.d.ts        # TypeScript definitions for xlsx-populate
├── contract-parser/
│   ├── Build Contract Signed.eml # Sample contract file for testing
│   └── template.xlsx             # Excel template file (rows 17-452)
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
└── tailwind.config.ts            # Tailwind CSS configuration
```

## Usage

1. **Upload File**: Drag and drop a signed build contract .eml file onto the upload area, or click to select a file
2. **Select Formatting**: Choose between:
   - **Basic Mode**: Values only, no formatting (faster, smaller file size)
   - **Formatted Mode**: Full formatting with subcategory headers, fill colors, and visual separators
3. **Processing**: The application will:
   - Parse the email content (HTML and text)
   - Extract location information (order number, address, city, state, zip)
   - Extract the Order Items Table from the HTML content
   - Generate a formatted Excel spreadsheet using the template
   - Apply formatting (if enabled) using a two-pass approach for reliable style preservation
4. **Download**: Download the generated spreadsheet with all extracted data

## Output Format

The generated Excel spreadsheet includes:

- **Location Header** (Row 16): Pool & Spa location with full address (City, State Zip, United States)
  - Formatted with fill color #495568, white text, bold
  - Merged across columns D-E
- **Subcategory Headers** (Rows 17-452):
  - Columns D-E: Subcategory text with white font, bold, fill color #495568
  - Columns F-BE (6-57): Fill color only (visual separator), no text
  - Serves as visual separators extending to column BE
- **Line Items**:
  - Product/Service descriptions (columns D-E, merged)
  - Quantities (column F)
  - Rates (column G)
  - Amounts (column H)
  - No formatting (plain text)
- **Template Structure**: 
  - Maximum usable rows: 17-452
  - Preserves existing formulas and structure
  - Dynamic sheet naming: `#OrderNo-Street Address`

## API Endpoint

The application includes an API route at `/api/parse-contract` that accepts POST requests with .eml file content and returns the generated Excel file.

### Request Format

- **Method**: POST
- **Content-Type**: multipart/form-data
- **Body**: 
  - `file`: The .eml file to parse
  - `applyFormatting` (optional): Boolean flag to enable/disable formatting (default: false)

### Response

- **Content-Type**: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
- **Body**: Excel file buffer (.xlsx format)

## Formatting Details

### Two-Pass Formatting Approach

The application uses a sophisticated two-pass formatting approach for reliable style preservation:

1. **First Pass (ExcelJS)**:
   - Loads the Excel template
   - Populates all data (location header, subcategories, line items)
   - Tracks subcategory row numbers
   - Generates initial buffer without formatting

2. **Second Pass (XLSX-Populate)** (if formatting enabled):
   - Re-reads the buffer into XLSX-Populate
   - Applies formatting to location header (row 16)
   - Formats all tracked subcategory rows (columns D-BE)
   - Preserves formatting reliably when writing the buffer

### Subcategory Formatting

- **Columns D-E**: Merged cells with subcategory text
  - Fill color: #495568
  - Font color: White (#ffffff)
  - Font style: Bold, size 11
  - Alignment: Center vertical, indent 1, wrap text
  
- **Columns F-BE (6-57)**: Visual separator
  - Fill color: #495568
  - No text (blank cells)
  - No font formatting (default font)
  - Serves as visual separator extending to column BE

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
