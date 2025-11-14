# Calimingo Contract Parser

A Next.js web application that parses signed build contract `.eml` files and generates Excel spreadsheets with formatted order items. The application also supports parsing addendums from ProDBX public URLs and appending them to the main contract data.

## Features

### Core Functionality
- **EML File Parsing**: Parse `.eml` email files containing signed build contracts
- **Order Items Extraction**: Extract order items, categories, and subcategories from email HTML tables
- **Location Extraction**: Extract client information, DBX Customer ID, order number, and address from email text
- **Excel Generation**: Generate formatted Excel spreadsheets with proper column mapping and styling
- **Template-Based**: Uses a base template (`template.xlsx`) to preserve formulas and structure

### Addendum Support
- **Addendum URL Parsing**: Parse addendums from ProDBX public URLs
- **Multiple Addendums**: Process multiple addendum URLs in sequence, maintaining input order
- **Addendum Number Extraction**: Extract addendum number from the page (e.g., "7") and URL ID (e.g., "35587")
- **Main Category Filtering**: Automatically filters out redundant main category rows (e.g., "0100 Calimingo - Concrete")
- **Formatted Headers**: Display addendum headers as "Addendum #7 (35587)" format

### Formatting Options
- **Conditional Formatting**: Toggle between basic (values only) and formatted (with styling) output
- **Header Formatting**: Apply fill color, white font, and bold to headers and subcategories
- **Visual Separators**: Subcategory headers extend to column BE (57) as visual separators
- **Column Formatting**: Automatic white fill for columns A and O

### Data Processing
- **Column Mapping**:
  - **Description**: Columns D-E (merged)
  - **Qty**: Column F
  - **Rate**: Column G (for email parser items)
  - **Amount/Extended**: Column H
- **Addendum Column Mapping**:
  - **Description**: Columns D-E (merged)
  - **Qty**: Column F
  - **Extended**: Column H (Rate column G is empty for addendums)
- **Row Management**: Automatic deletion of unused buffer rows (keeps 15 buffer rows after last data entry)

## Getting Started

### Prerequisites
- Node.js 18+ (for native `fetch` support)
- npm or yarn
- Next.js 14+

### Installation

1. Clone the repository:
```bash
git clone https://github.com/blastheart1/signed-contract-parser.git
cd signed-contract-parser
```

2. Install dependencies:
```bash
npm install
```

3. Place the template file:
   - Ensure `contract-parser/template.xlsx` exists in the project root
   - This template contains formulas and structure that will be preserved

4. Run the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
npm start
```

For Vercel deployment:
```bash
vercel
```

## Usage

### Basic Workflow

1. **Upload EML File**:
   - Drag and drop a `.eml` file into the upload area, or
   - Click "Browse Files" to select a file

2. **Optional: Add Addendums**:
   - Check the "Add Addendum" checkbox
   - Paste addendum URLs in the textarea (one per line)
   - URLs should be in format: `https://l1.prodbx.com/go/view/?35587.426.20251112100816` or `https://login.prodbx.com/go/view/?35587.426.20251112100816`

3. **Optional: Apply Formatting**:
   - Check the "Apply Formatting" checkbox for styled output
   - Unchecked: Basic output with values only
   - Checked: Formatted output with fill colors, white font, and bold headers

4. **Generate Spreadsheet**:
   - Click "Generate Spreadsheet" button
   - The spreadsheet will be automatically downloaded

### Addendum URLs

**Supported URL Formats**:
- `https://l1.prodbx.com/go/view/?35587.426.20251112100816`
- `https://login.prodbx.com/go/view/?35587.426.20251112100816`
- URLs with trailing dots are automatically cleaned (e.g., `...00816.` → `...00816`)

**Processing**:
- Addendums are processed sequentially in the order they are provided
- Each addendum is parsed and its items are appended to the spreadsheet
- Addendums are separated by 2 blank rows from the main contract items
- Addendum headers are formatted as "Addendum #X (URL ID)" (e.g., "Addendum #7 (35587)")

**Error Handling**:
- Invalid URLs are validated before processing
- Failed addendums are logged but don't stop processing of other addendums
- If all addendums fail, an error is returned (but email items are still processed)

### Output Format

**Spreadsheet Structure**:
- **Row 16**: Location header (e.g., "Pool & Spa - laguna beach, California 92651, United States")
- **Row 17 onwards**: Order items (subcategories and line items)
- **Addendums**: Appended after email items with 2 blank rows separator
- **Addendum Headers**: Formatted as subcategories (e.g., "Addendum #7 (35587)")

**Sheet Naming**:
- Format: `#OrderNo-Street Address`
- Example: `#9682-1041 Temple terrace`
- Automatically sanitized for Excel (max 31 characters, invalid characters removed)
- Truncated if necessary

**Filename**:
- Format: `{Client Initial Last Name} - #{DBX Customer ID} - {Address}.xlsx`
- Example: `E. Przybyl - #9682 - 1041 Temple terrace.xlsx`
- Falls back to order number or timestamp if client info is missing

## Technical Details

### Architecture

**Frontend**:
- Next.js 14 with TypeScript
- React components with Tailwind CSS
- Client-side file upload and download handling

**Backend**:
- Next.js API routes (serverless functions)
- Node.js 18+ with native `fetch` support
- Excel generation using ExcelJS and XLSX-Populate

### Key Modules

**`lib/emlParser.ts`**:
- Parses `.eml` files using `mailparser`
- Extracts HTML and text content from emails

**`lib/tableExtractor.ts`**:
- Extracts location information from email text
- Extracts order items from HTML tables
- Identifies main categories, subcategories, and line items

**`lib/addendumParser.ts`**:
- Fetches HTML content from ProDBX URLs
- Extracts addendum number from page and URL
- Parses addendum HTML tables (similar to email parser)
- Filters out main category rows
- Validates URL formats

**`lib/spreadsheetGenerator.ts`**:
- Loads `template.xlsx` as base
- Preserves template structure and formulas
- Populates data starting at row 16
- Applies formatting (if enabled) using two-pass approach:
  - First pass: Data population with ExcelJS
  - Second pass: Formatting with XLSX-Populate
  - Third pass: Row deletion with ExcelJS
- Handles shared formulas and merges

**`lib/filenameGenerator.ts`**:
- Generates dynamic filenames based on extracted client information
- Formats client names as "First Initial. Last Name"
- Sanitizes filenames for filesystem compatibility

**`lib/cellFormatter.ts`**:
- ExcelJS-based formatting functions
- Applies and clears cell formatting
- Handles merged cells

**`lib/xlsxPopulateFormatter.ts`**:
- XLSX-Populate-based formatting functions
- Second-pass formatting for better style persistence
- Handles column-wide formatting

### Data Flow

1. **Upload**: User uploads `.eml` file (and optionally adds addendum URLs)
2. **Parse**: Backend parses EML file and extracts order items
3. **Fetch Addendums**: If provided, backend fetches and parses addendum URLs
4. **Generate**: Spreadsheet is generated with all data
5. **Format**: If enabled, formatting is applied in second pass
6. **Cleanup**: Unused rows are deleted (third pass)
7. **Download**: Spreadsheet is downloaded with dynamic filename

### Template Structure

**Rows 1-15**: Preserved formulas and structure (not modified)
**Row 16**: Location header (populated by parser)
**Rows 17-452**: Data area for order items and addendums
**Row 452+**: Buffer rows (automatically deleted if unused)

**Columns**:
- **A-C**: Row number, status, number (preserved from template)
- **D-E**: Product/Service (merged)
- **F**: Qty
- **G**: Rate (empty for addendums)
- **H**: Amount/Extended
- **I-BE**: Formulas (preserved from template)

## Testing

### Test Scripts

**`test-addendum-real.ts`**:
- Tests addendum parsing with real URLs
- Verifies addendum number extraction
- Validates parsing results

**`test-addendum-multiple.ts`**:
- Tests multiple addendum URLs
- Verifies processing order
- Validates error handling

**Running Tests**:
```bash
# Test single addendum
npx tsx test-addendum-real.ts

# Test multiple addendums
npx tsx test-addendum-multiple.ts
```

### Manual Testing

1. **Test Basic Parsing**:
   - Upload a `.eml` file
   - Verify order items are extracted correctly
   - Check that location information is extracted

2. **Test Addendum Parsing**:
   - Upload a `.eml` file
   - Add an addendum URL
   - Verify addendum items are appended correctly
   - Check that addendum header format is correct

3. **Test Multiple Addendums**:
   - Upload a `.eml` file
   - Add multiple addendum URLs
   - Verify all addendums are processed in order
   - Check that each addendum has its own header

4. **Test Formatting**:
   - Generate spreadsheet with formatting enabled
   - Verify headers and subcategories are formatted
   - Check that line items are not formatted
   - Verify columns A and O have white fill

5. **Test Error Handling**:
   - Test with invalid addendum URLs
   - Test with network errors
   - Verify that errors don't stop processing

## Configuration

### Environment Variables

No environment variables are required for basic functionality. The application uses:
- Native `fetch` (Node.js 18+)
- File system access for template loading
- Vercel serverless functions for API routes

### Template File

The template file (`contract-parser/template.xlsx`) must be present in the project root. This file:
- Contains formulas in columns I-BE
- Has structure in rows 1-15
- Has buffer rows (17-452) for data population
- Has invoice status section (rows 37-50, columns A-H)

## Deployment

### Vercel Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Deploy automatically on push

**Requirements**:
- Node.js 18+ runtime
- Serverless function timeout: 60 seconds (for multiple addendums)
- File size limit: 10MB (for EML files)

### Build Configuration

The `next.config.js` is configured to:
- Mark server-only modules as external (`exceljs`, `xlsx-populate`, `mailparser`, `cheerio`)
- Provide fallbacks for Node.js core modules
- Exclude `lib/` modules from client-side bundling

## Error Handling

### Common Errors

**"Order Items Table not found"**:
- The email HTML doesn't contain a table with class "pos"
- The parser will try to use the first table as fallback

**"No order items found in addendum"**:
- The addendum HTML structure is different from expected
- The addendum might not have any order items
- Check the addendum URL to verify it's accessible

**"Invalid addendum URL format"**:
- The URL doesn't match the expected pattern
- Ensure the URL is in format: `https://(l1|login).prodbx.com/go/view/?...`

**"Failed to fetch addendum URL"**:
- Network error or timeout
- URL might be inaccessible or require authentication
- Check URL accessibility

### Debugging

Enable debug logging by checking console output:
- `[API]` prefix: API route logs
- `[Addendum Parser]` prefix: Addendum parsing logs
- `[First Pass]` prefix: Spreadsheet generation logs
- `[Formatting]` prefix: Formatting application logs

## Limitations

1. **Template Dependency**: Requires `template.xlsx` file in `contract-parser/` directory
2. **Row Limits**: Maximum 452 rows for data (rows 17-452)
3. **Sheet Name Length**: Excel sheet names limited to 31 characters
4. **File Size**: Large EML files or many addendums may exceed serverless function timeout
5. **URL Accessibility**: Addendum URLs must be publicly accessible (no authentication required)
6. **HTML Structure**: Parser expects specific HTML table structure (class "pos" or first table)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary software. All rights reserved.

## Support

For issues or questions:
1. Check the error messages in the console
2. Verify EML file format and addendum URL accessibility
3. Check that the template file exists and is valid
4. Review the test scripts for usage examples

## Changelog

### Version 1.1.0 (Current - Addendum Support)
- Added addendum URL parsing support
- Added multiple addendum processing
- Added addendum number extraction from page
- Added main category row filtering
- Added "Addendum #X (URL ID)" header format
- Added support for `login.prodbx.com` URLs
- Improved error handling for addendums

### Version 1.0.0 (Initial Release)
- EML file parsing
- Order items extraction
- Location information extraction
- Excel spreadsheet generation
- Template-based generation
- Conditional formatting
- Dynamic filename generation
- Row deletion feature
