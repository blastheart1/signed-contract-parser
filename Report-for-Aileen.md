# Calimingo Contract Parser - Summary Report

## Email Version (For Aileen)

---

**Subject: Calimingo Contract Parser - Automated Spreadsheet Generator**

Hi Aileen,

I wanted to share an update on the Calimingo Contract Parser application we've been developing. This tool automates the process of converting signed contract emails into formatted Excel spreadsheets using your Template-V2.xlsx template.

**What It Does:**
The application takes a signed contract email (.eml file) and automatically:
- Extracts all order items, categories, and subcategories
- Pulls contract and addendum data from ProDBX links (when available in the email)
- Generates a formatted Excel spreadsheet that matches your template structure
- Preserves all formulas, conditional formatting, and structure from Template-V2.xlsx

**Key Features:**
- **Auto-Detection**: When you upload an email that contains "Original Contract" and "Addendum" links, the app automatically finds and processes them - no manual copying needed
- **Smart Parsing**: Identifies main categories (like "0020 Calimingo - Pools and Spas"), subcategories (like "EXCAVATION", "PLUMBING", "SHELL"), and individual line items
- **Template Preservation**: Uses your Template-V2.xlsx exactly as designed - all formulas and formatting remain intact
- **Error Feedback**: Shows clear messages about which links processed successfully (green), which had warnings (yellow), and which failed (red), with clickable links to verify

**Current Status:**
The application is fully functional and ready for use. It handles the most common contract formats and automatically processes both main contracts and addendums when links are present in the email.

**Limitations:**
- Requires manual file upload (one email at a time)
- Maximum of 339 rows of data per spreadsheet
- Addendum URLs must be publicly accessible (no login required)
- Some complex email formats may require manual verification

**Future Plans:**
We're planning to add webhook integration for full automation - this would allow the system to automatically process emails as they arrive, eliminating the need for manual uploads entirely.

Let me know if you'd like a demo or have any questions!

---

## Quick How-To Guide

### Step 1: Prepare Your Email
- Save the signed contract email as a `.eml` file (most email clients allow you to save emails in this format)

### Step 2: Upload to the Application
1. Open the Calimingo Contract Parser in your web browser
2. Drag and drop the `.eml` file into the upload area, OR click "Browse Files" to select it

### Step 3: Let It Auto-Detect (Recommended)
- **Leave the "Add Addendum" checkbox UNCHECKED**
- The app will automatically find and process any "Original Contract" and "Addendum" links in the email
- No manual copying of URLs needed!

### Step 4: Optional Settings
- **"Delete Extra Rows"**: Check this if you want to automatically remove empty rows after your data
- **Manual Addendums**: If auto-detection doesn't work, check "Add Addendum" and paste URLs manually (one per line)

### Step 5: Generate
- Click "Generate Spreadsheet"
- The file will automatically download with a filename like: `Client Name - #CustomerID - Address.xlsx`

### Step 6: Review
- Open the downloaded spreadsheet
- Check the feedback message to see which links processed successfully
- Verify the data matches the original contract

---

## Features

### Core Functionality
✅ **EML File Parsing**: Reads signed contract emails and extracts all relevant data  
✅ **Order Items Extraction**: Identifies main categories, subcategories, and line items  
✅ **Location Extraction**: Pulls client name, customer ID, order number, and address  
✅ **Excel Generation**: Creates formatted spreadsheets using Template-V2.xlsx  
✅ **Template Preservation**: Maintains all formulas, conditional formatting, and structure  

### Auto-Detection (New)
✅ **Link Detection**: Automatically finds "Original Contract" and "Addendum" links in email bodies  
✅ **Original Contract Parsing**: Processes main contract pages with full category/subcategory support  
✅ **Addendum Processing**: Handles multiple addendums automatically  
✅ **Smart URL Extraction**: Works with complex tracking links and encoded URLs  

### Data Processing
✅ **Subcategory Detection**: Identifies subcategories like "EXCAVATION", "PLUMBING", "SHELL", "INTERIOR FINISH"  
✅ **Category Mapping**: Properly labels items as "Initial" (from email) or "Addendum" (from links)  
✅ **Row Management**: Optional automatic cleanup of empty rows  
✅ **Error Handling**: Detailed feedback with color-coded success/warning/error messages  

### User Experience
✅ **Clickable URLs**: All links in feedback messages are clickable for easy verification  
✅ **Clear Feedback**: Shows exactly which links succeeded, which had warnings, and which failed  
✅ **Simplified Errors**: Easy-to-understand error messages with specific failure reasons  
✅ **Responsive Design**: Works on desktop and mobile devices  

---

## Current Limitations

### Technical Constraints
- **Row Limit**: Maximum 339 rows of data per spreadsheet (rows 16-339)
- **Sheet Name Length**: Excel sheet names limited to 31 characters (automatically truncated)
- **File Size**: Very large emails or many addendums may take longer to process
- **URL Accessibility**: Addendum URLs must be publicly accessible (no authentication/login required)

### Manual Processes
- **One File at a Time**: Currently requires manual upload of each email file
- **No Batch Processing**: Cannot process multiple emails simultaneously
- **No Direct Email Integration**: Must save emails as `.eml` files first
- **Manual Verification**: Some complex formats may require manual review

### Format Dependencies
- **Template Required**: Must have Template-V2.xlsx file in the correct location
- **HTML Structure**: Expects specific table structure in email HTML (class "pos" or first table)
- **Email Format**: Works best with standard ProDBX contract emails

### Error Scenarios
- **Network Issues**: Failed addendums if URLs are inaccessible or timeout
- **Missing Links**: If email doesn't contain contract/addendum links, falls back to email HTML only
- **Parse Failures**: Some non-standard formats may not parse correctly

---

## Future Improvements

### Full Automation (High Priority)
🔮 **Webhook Integration**: 
- Automatically process emails as they arrive
- No manual uploads required
- Direct integration with email systems (Gmail, Outlook, etc.)
- Automatic notifications when spreadsheets are ready

🔮 **Email Server Integration**:
- Connect directly to email accounts
- Monitor specific folders or labels
- Auto-process emails matching certain criteria

### Batch Processing
🔮 **Multiple File Upload**: Process multiple `.eml` files at once  
🔮 **Folder Processing**: Upload entire folders of contract emails  
🔮 **Scheduled Processing**: Set up automatic daily/weekly processing runs  

### Enhanced Features
🔮 **Google Sheets Integration**: 
- Option to open generated sheets directly in Google Sheets
- Use Google Sheets as template source
- Real-time collaboration capabilities

🔮 **Cloud Storage Integration**:
- Auto-save to Google Drive, Dropbox, or OneDrive
- Organize files by date, client, or project
- Share links automatically

🔮 **Advanced Error Recovery**:
- Automatic retry for failed links
- Partial processing with resume capability
- Better handling of network timeouts

### User Experience
🔮 **Progress Tracking**: Real-time progress bar for large files  
🔮 **History/Logs**: View processing history and download previous spreadsheets  
🔮 **Custom Templates**: Support for multiple template variations  
🔮 **Preview Mode**: Preview data before generating final spreadsheet  

### Data Management
🔮 **Database Integration**: Store processed contracts in a database  
🔮 **Search & Filter**: Search through processed contracts  
🔮 **Analytics Dashboard**: View statistics on processed contracts  
🔮 **Export Options**: Export to PDF, CSV, or other formats  

### Quality & Validation
🔮 **Data Validation**: Cross-check data against source documents  
🔮 **Duplicate Detection**: Identify and handle duplicate entries  
🔮 **Version Control**: Track changes and maintain version history  
🔮 **Audit Trail**: Log all processing activities for compliance  

---

## Technical Notes (For Reference)

**Current Architecture:**
- Next.js web application (runs in browser and on server)
- Processes files server-side for security
- Uses ExcelJS for spreadsheet generation
- Template-based approach preserves all Excel features

**Integration Points:**
- Email parsing: `mailparser` library
- HTML parsing: `cheerio` (server-side jQuery)
- Excel generation: `ExcelJS`
- URL fetching: Native Node.js `fetch` (Node 18+)

**Deployment:**
- Currently deployed as web application
- Can be self-hosted or cloud-hosted
- Serverless architecture (scales automatically)

---

*Last Updated: Current Version (1.4.0)*

