import { readFileSync, writeFileSync } from 'fs';
import { parseEML } from './lib/emlParser';
import { extractOrderItems, extractLocation } from './lib/tableExtractor';
import { generateSpreadsheet } from './lib/spreadsheetGenerator';

async function testParser() {
  try {
    console.log('Testing Contract Parser...\n');
    
    // Read the sample EML file
    console.log('1. Reading EML file...');
    const emlPath = './contract-parser/Build Contract Signed.eml';
    const emlContent = readFileSync(emlPath);
    console.log('   ✓ File read successfully\n');
    
    // Parse EML
    console.log('2. Parsing EML file...');
    const parsed = await parseEML(emlContent);
    console.log('   ✓ EML parsed successfully');
    console.log(`   - Subject: ${parsed.subject}`);
    console.log(`   - HTML length: ${parsed.html.length} chars\n`);
    
    // Extract location
    console.log('3. Extracting location...');
    const location = extractLocation(parsed.text);
    console.log('   ✓ Location extracted');
    console.log(`   - City: ${location.city}`);
    console.log(`   - State: ${location.state}`);
    console.log(`   - Zip: ${location.zip}\n`);
    
    // Extract order items
    console.log('4. Extracting order items...');
    const items = extractOrderItems(parsed.html);
    console.log(`   ✓ Extracted ${items.length} items`);
    
    // Count item types
    const mainCategories = items.filter(i => i.type === 'maincategory').length;
    const subCategories = items.filter(i => i.type === 'subcategory').length;
    const lineItems = items.filter(i => i.type === 'item').length;
    
    console.log(`   - Main Categories: ${mainCategories}`);
    console.log(`   - Sub Categories: ${subCategories}`);
    console.log(`   - Line Items: ${lineItems}\n`);
    
    // Show first few items
    console.log('5. Sample items:');
    items.slice(0, 10).forEach((item, index) => {
      if (item.type === 'maincategory' || item.type === 'subcategory') {
        console.log(`   ${index + 1}. [${item.type.toUpperCase()}] ${item.productService}`);
      } else {
        console.log(`   ${index + 1}. ${item.productService.substring(0, 50)}... (Qty: ${item.qty}, Amount: $${item.amount})`);
      }
    });
    console.log('');
    
    // Generate spreadsheet
    console.log('6. Generating spreadsheet...');
    const spreadsheetBuffer = await generateSpreadsheet(items, location);
    console.log(`   ✓ Spreadsheet generated (${spreadsheetBuffer.length} bytes)\n`);
    
    // Save test output
    const outputPath = './test-output.xlsx';
    writeFileSync(outputPath, spreadsheetBuffer);
    console.log(`7. ✓ Test spreadsheet saved to: ${outputPath}\n`);
    
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error instanceof Error ? error.stack : '');
    process.exit(1);
  }
}

testParser();

